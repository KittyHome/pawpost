# Architecture

## Processes

| Process                    | Responsibility                                                                       | Talks to                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **web** (`apps/web`)       | Dashboard, Server Actions, public unsubscribe pages, health check                    | Postgres; SMTP/IMAP only to _verify_ a mailbox login; AI API for interactive features |
| **worker** (`apps/worker`) | Sends due emails, syncs inboxes, auto-pauses/completes campaigns, writes a heartbeat | Postgres, SMTP, IMAP, AI API (reply triage)                                           |

Postgres is the only shared state. There is no queue service: the database rows _are_ the queue, and row locks give the guarantees below. Several workers can run at once.

## Layers

```
apps/web, apps/worker      delivery: HTTP, forms, loops, env, logging
        │
packages/engine            use cases: services + dispatcher + inbox sync
        │
packages/core   pure rules (no I/O)     packages/mail  SMTP/IMAP/DNS adapters
packages/ai     AI tasks + providers    packages/db    schema, migrations, client
```

Rules of the road:

- Apps never touch `@pawpost/db` tables directly; they call `engine.*`. (The worker only opens the connection and runs migrations.)
- `core` has no network or database code and is unit-tested in isolation.
- `mail` and `ai` are adapters behind interfaces (`MailSender`, `InboxReader`, `AiProvider`), injected into the engine, which is how the integration tests swap in fakes.
- Expected failures are `DomainError`s with a user-facing message. Anything else is a bug and is logged.
- Client-safe subpaths (`@pawpost/core/template`, `@pawpost/mail/presets`, `@pawpost/engine/validation`) are importable from browser components; the package roots are server-only.

## Data model

```
mailboxes ─┐                      contact_lists ─< contacts
           │                              │
campaign_mailboxes >─ campaigns ──────────┘ (list_id)
                         │
                         ├─< campaign_steps   (position, wait_days, subject, body)
                         └─< enrollments      (one per contact per campaign)
                                  │  status, next_step, next_send_at, mailbox_id (sticky), unsubscribe_token
                                  └─< messages (rfc_message_id, step_position, status)

suppressions   global do-not-contact list (email PK, reason)
events         append-only activity log (sent, reply, bounce, unsubscribe, …)
app_settings   instance settings (AI config) and the worker heartbeat
```

Enrollment lifecycle:

```
active ──claim──▶ sending ──sent, more steps──▶ active (next_send_at = now + wait_days)
                     │
                     ├──sent, last step──▶ completed
                     ├──RCPT rejected──▶ bounced (+ suppression)
                     ├──connection failed──▶ active (retry later)
                     └──ambiguous failure──▶ failed (never retried)

active/completed ──reply──▶ replied      ──DSN──▶ bounced      ──opt-out──▶ unsubscribed
```

## Accounts, permissions and audit

Each installation is one organisation. `users` have a role; `sessions`, `invitations` and `password_resets` hold hashed, expiring tokens.

Services that change data take an `Actor` (the signed-in user plus their IP address). They check the role with `requirePermission`, and write an audit entry with `writeAudit` inside the same transaction as the change. A change and its audit record therefore commit or roll back together.

## Trash and erasure

`contact_lists`, `contacts` and `campaigns` are soft-deleted (`deleted_at`, `deleted_by_id`). Every query filters them out; the dispatcher skips trashed contacts, so their sequences pause. The uniqueness of a contact within a list only applies to live rows (a partial index), so a trashed address can be re-imported. The worker purges items older than 30 days: campaigns first, then contacts, then lists no campaign still references.

Erasing a person hard-deletes their contacts (cascading to enrollments), messages and events, and adds a `manual` suppression so they're never contacted again. The audit entry stores only a masked address.

## The send pipeline (`engine/src/dispatch.ts`)

Each worker cycle:

1. **Recover stale claims.** An enrollment stuck in `sending` for 10+ minutes means a worker died mid-send. It is marked `failed`, not retried, because the email may have gone out. A missed email is better than a duplicate.
2. **Review running campaigns.** Pause any whose bounce or unsubscribe rate breaks the thresholds in `core/health.ts`; complete any with nobody left in sequence.
3. **Filter by send window.** Only campaigns inside their days and hours, in their own timezone.
4. **Pick eligible mailboxes.** Active, attached to a sendable campaign, its send slot is free (`next_send_at <= now`), and under its rolling 24-hour cap.
5. **Claim, per mailbox, in one transaction:**
   - `SELECT … FOR UPDATE OF enrollments SKIP LOCKED`: the oldest due contact pinned to this mailbox, or an unassigned one, and not suppressed.
   - Advance the mailbox's `next_send_at` by the minimum gap plus up to 50% jitter (only if still free).
   - Mark the enrollment `sending` and pin it to the mailbox.
6. **Compose and send** outside the transaction: template rendering, the compliance footer, `List-Unsubscribe` headers, and `In-Reply-To`/`References` for follow-ups.
7. **Record** the message, the event and the next step in one transaction.

Each mailbox sends at most one email per cycle, so pacing comes from the cycle interval, the per-mailbox gap and the daily cap together.

## Inbox sync (`engine/src/inbox-sync.ts`)

Per mailbox, at most once per `INBOX_SYNC_INTERVAL_SECONDS`:

- The first sync, or a UIDVALIDITY change, only records the current position; older mail is never processed.
- New messages are classified (`mail/src/classify.ts`) as **bounce** (DSN, 5.x.x only), **auto-reply** or **reply**, and matched to the original via Message-ID headers (falling back to the sender address).
- Replies stop the sequence (if the campaign says so). When AI is enabled, the reply's intent is classified; otherwise a rule-based detector catches "remove me"-style opt-outs.
- Processing a message and advancing the IMAP cursor happen in one transaction, so a crash never double-counts or skips mail. A message that can't be processed is logged and skipped.

## AI (`packages/ai`)

Every feature is a _task_: instructions, input and a Zod output schema, run through an `AiProvider`. Tasks post-validate the output (clamping numbers, enforcing step rules), so behaviour doesn't depend on the provider. OpenAI is implemented with the Responses API and structured outputs. An optional HTTP(S) proxy is applied with undici's `ProxyAgent`, for API calls only.

Background AI use (reply triage) never blocks mail processing: failures return `null` and the rule-based path takes over.

## Security notes

- Mailbox passwords and the AI key are encrypted with AES-256-GCM, using a key derived from `APP_SECRET`.
- Users sign in with email and password (scrypt, per-user salt). Ten failed attempts lock an account for 15 minutes.
- Sessions are server-side: the cookie holds a random token and only its SHA-256 hash is stored, so sessions can be listed and revoked. Invitation and password-reset tokens work the same way and are single-use.
- `proxy.ts` only checks that a session cookie exists; every page, Server Action and export route validates it against the database.
- Roles (owner, admin, member) are defined once in `engine/src/permissions.ts`. The engine enforces them; the UI uses the same table to hide what you can't do.
- Every change made by a user is written to `audit_log` in the same transaction as the change itself.
- Recipient-facing unsubscribe pages are public and token-based. A GET only shows a confirm button, because link scanners open every URL; the change happens on POST (form or RFC 8058 one-click).
