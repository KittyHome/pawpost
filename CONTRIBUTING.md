# Contributing

Thanks for helping. A few conventions keep the codebase predictable.

By submitting a contribution, you agree that it is licensed under the project's license, the [PolyForm Noncommercial License 1.0.0](LICENSE.md), and that KittyHome as the copyright holder may also license it under other terms.

## Setup

See the README's development quick start. `pnpm check` must pass before a PR is merged; CI runs the same command.

## Where code goes

- **A business rule** (who gets emailed, when, what's allowed): `packages/engine`, or `packages/core` if it needs no I/O.
- **Talking to an external system** (SMTP, IMAP, DNS, an AI API): `packages/mail` or `packages/ai`, behind an interface the engine can fake.
- **UI:** `apps/web/src/features/<domain>/` holds that domain's Server Actions (`actions.ts`) and components. Routes in `src/app` stay thin. Use shadcn/ui components from `src/components/ui` (add new ones with `pnpm dlx shadcn@latest add <name>` inside `apps/web`).
- **Validation schemas** for writes live in `packages/engine/src/validation.ts` and are shared by the UI and the engine.
- **User help:** articles are Markdown files in `apps/web/content/help/` (front matter: `title`, `description`, `category`, `order`, `keywords`). Use `> [!TIP]`, `> [!NOTE]`, `> [!WARNING]` or `> [!CAUTION]` for callouts. Link to other articles as `/help/<slug>#<heading-id>`, and from the UI with `<HelpLink>` or `<LearnMore>`. `pnpm lint` fails on a broken help link. When you change how a feature behaves, update its article in the same PR.

## Conventions

- Server Actions go through `runAction()` (auth + error mapping), and forms use `useActionForm()`, which keeps user input on validation errors.
- Throw `DomainError` for expected failures; its message is shown to the user.
- Database changes: edit `packages/db/src/schema.ts`, then `pnpm db:generate`, and commit the generated SQL.
- Tests: pure logic gets a unit test next to the file. Anything touching sending, claiming or inbox processing belongs in `packages/engine/test` (real Postgres + SMTP).
- Never relax a compliance guarantee (unsubscribe link and headers, postal address, suppression checks, auto-pause) without discussing it in an issue first.

## Commit style

Short imperative subject ("Add Zoho preset"), with a body explaining _why_ when it isn't obvious.
