# Pawpost

Self-hosted, source-available cold email outreach. You bring your own mailboxes and contact lists; Pawpost sends short plain-text sequences from them at a human pace, reads replies and bounces from the same inboxes, and stops when it should.

- **Your mailboxes, rotated.** Connect Google Workspace, Microsoft 365 or any SMTP/IMAP account. Each has a daily cap and a minimum gap between sends, with random jitter.
- **Sequences that thread.** A first email plus follow-ups. A follow-up with an empty subject is sent as a reply in the same thread, from the same mailbox.
- **Stops on replies and bounces.** IMAP sync spots replies, out-of-office notices and bounce reports, and ends the contact's sequence.
- **Compliance built in.** Every email carries a postal address, an unsubscribe link and RFC 8058 one-click unsubscribe headers. Opt-outs and bounces go on a global suppression list that is checked before every send.
- **Automatic brakes.** A campaign pauses itself when bounces pass 2% or unsubscribes pass 5%.
- **List hygiene on import.** Duplicates, invalid addresses, role inboxes (info@, sales@), suppressed addresses and domains that can't receive mail are rejected with reasons.
- **A team, not a login.** Owner, admin and member roles; invitations by link; server-side sessions you can review and revoke; account lockout after repeated failed sign-ins.
- **Data you can manage.** Edit contacts and use bulk actions (move, copy, suppress, trash), CSV exports, a 30-day trash with restore, and one-step erasure of a person for privacy requests.
- **Audit log.** Every sign-in and change is recorded with who, when and from which IP.
- **Built-in help center.** Searchable step-by-step guides for every feature, with "?" links from each page and tricky field straight to the right section.
- **AI assist (optional, OpenAI).** Draft a sequence from a short brief, review an email for spam signals before sending, and triage replies (interested, question, not now, opt-out…).

> **Use it responsibly.** Cold email is regulated: honest headers, a postal address and a working opt-out are required almost everywhere, and the EU, UK and Canada generally require consent for messages to individuals. Pawpost enforces the mechanics; whether you may contact someone is your responsibility. Send from a separate domain, not your main business domain.

## How it works

```
apps/web     Next.js dashboard (shadcn/ui). Manages mailboxes, lists, campaigns, settings.
apps/worker  Background process. Sends due emails and syncs inboxes. The only thing that talks SMTP/IMAP.
packages/
  engine     Use cases shared by both apps (campaigns, dispatch, inbox sync, suppressions, AI).
  core       Pure domain logic: templates, compliance footer, schedules, health rules, CSV parsing.
  mail       SMTP sending, IMAP reading, bounce/reply classification, provider presets.
  ai         Provider-agnostic AI tasks; OpenAI implementation with optional HTTP proxy.
  db         Drizzle schema, migrations and client (PostgreSQL).
```

Both apps go through `@pawpost/engine`, so every business rule lives in one place. See [docs/architecture.md](docs/architecture.md) for the data model and the send pipeline.

## Quick start (development)

Requirements: Node 22+, pnpm 9. No Docker needed.

```bash
pnpm install
cp .env.example .env            # then set APP_SECRET and ADMIN_PASSWORD
pnpm db:dev                     # local Postgres on :54329, migrations applied (keep running)
pnpm smtp:dev                   # optional: local SMTP sink, saves mail to .data/outbox (keep running)
pnpm --filter @pawpost/web dev  # dashboard on http://localhost:3000
pnpm --filter @pawpost/worker dev
```

To send to the local sink, connect a mailbox with host `127.0.0.1`, port `2525`, SSL/TLS off, and run the worker with `SMTP_ALLOW_SELF_SIGNED=true`.

## Self-hosting

```bash
cp .env.example .env   # set APP_URL (public https URL) and APP_SECRET
docker compose up -d
# open the app and create the owner account, then invite your team in Settings → Team
```

This runs Postgres, the worker (applies migrations on start) and the web app on port 3000. Put the web app behind HTTPS. Unsubscribe links point at `APP_URL`, so it must be reachable by recipients.

The images can also run separately on any container host:

```bash
docker build --target web -t pawpost-web .
docker build --target worker -t pawpost-worker .
```

Run exactly the services you need: one web instance, and one or more workers (claims are row-locked, so extra workers never double-send).

## Configuration

All settings are environment variables; see [.env.example](.env.example).

| Variable                                                   | Purpose                                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`                                             | PostgreSQL connection string                                           |
| `APP_URL`                                                  | Public URL of the dashboard, used in unsubscribe links                 |
| `APP_SECRET`                                               | 32+ characters. Encrypts stored passwords and API keys, signs sessions |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`                            | Optional: create the owner account on first start                      |
| `SETUP_TOKEN`                                              | Optional: required on the first-run setup page                         |
| `SYSTEM_SMTP_URL`, `SYSTEM_EMAIL_FROM`                     | Optional: email invitations and password resets                        |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`        | Optional AI defaults; a key saved in Settings takes precedence         |
| `OPENAI_PROXY_URL`                                         | HTTP(S) proxy for OpenAI calls only (falls back to `HTTPS_PROXY`)      |
| `DISPATCH_INTERVAL_SECONDS`, `INBOX_SYNC_INTERVAL_SECONDS` | Worker pacing                                                          |
| `SMTP_ALLOW_SELF_SIGNED`                                   | Accept self-signed certificates from your SMTP server                  |

## Mailbox setup tips

- **Gmail / Google Workspace:** turn on 2-Step Verification, then create an App Password and use it as the password.
- **Microsoft 365:** SMTP AUTH must be enabled for the mailbox in the admin center.
- Set up SPF, DKIM and DMARC for the sending domain before sending anything.
- Start new mailboxes at 10–20 emails a day and raise the limit gradually. The in-app **Help center** has a ramp-up plan.

## Development

```bash
pnpm check       # typecheck, lint, and all tests across the monorepo
pnpm test        # unit tests, plus engine integration tests (real Postgres + SMTP)
pnpm db:generate # create a migration after changing packages/db/src/schema.ts
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

- Mailbox warm-up (gradual daily ramp, then an opt-in warm-up network)
- More AI providers behind the same interface
- Sign in with Google / Microsoft (OAuth), and OAuth for Microsoft 365 mailboxes
- Per-contact AI personalisation of the first line
- Open/click tracking as an opt-in (off by default; it hurts deliverability)

## License

Pawpost is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md).

- **Allowed:** using, studying, modifying and sharing Pawpost for any **noncommercial** purpose, such as personal projects, research, education, and use by charities and public institutions.
- **Not allowed:** any commercial use, including using it to run outreach for a business or offering it as a paid product or service.

Because commercial use is restricted, Pawpost is _source-available_ rather than "open source" in the OSI sense. For commercial licensing, contact KittyHome at hello@kittyhome.org.
