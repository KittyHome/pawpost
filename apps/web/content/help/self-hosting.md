---
title: Installing and running Pawpost
description: Install with Docker, configure it, keep it updated and backed up. For whoever runs the server.
category: admin
order: 1
keywords: install, self-host, docker, compose, server, configuration, environment, env, app_url, app_secret, admin password, update, upgrade, backup, restore, health, worker, proxy
---

This page is for the person who installs and maintains Pawpost. If someone else runs it for you, you can skip it.

## What runs where

| Part           | Job                                                           |
| -------------- | ------------------------------------------------------------- |
| **Web app**    | The dashboard you're using, plus the public unsubscribe pages |
| **Worker**     | Sends emails and reads inboxes in the background              |
| **PostgreSQL** | Stores everything                                             |

Both the web app and the worker need to be running. You only need one web app; you can run several workers if you like, since they never send the same email twice.

## Installing with Docker

On a server with Docker installed:

```bash
git clone <your Pawpost repository> pawpost
cd pawpost
cp .env.example .env
# edit .env (see below), then:
docker compose up -d
```

This starts PostgreSQL, the worker (which sets up the database on first start) and the web app on port 3000.

Put the web app behind **HTTPS** with a reverse proxy (Caddy, nginx, Traefik) or your hosting platform's load balancer, on a domain such as `outreach.yourcompany.com`.

> [!IMPORTANT]
> Unsubscribe links in every email point to `APP_URL`. It must be a public address that recipients can open from anywhere, not `localhost`.

## Configuration reference

Settings are environment variables in the `.env` file.

| Variable                      | Required | Purpose                                                                                       |
| ----------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | Yes      | PostgreSQL connection string (set automatically by Docker Compose)                            |
| `APP_URL`                     | Yes      | Public HTTPS address of the web app                                                           |
| `APP_SECRET`                  | Yes      | At least 32 random characters. Encrypts stored passwords and API keys, and signs logins       |
| `ADMIN_EMAIL`                 | Yes      | Login email for the dashboard                                                                 |
| `ADMIN_PASSWORD`              | Yes      | Login password (8+ characters; use a long random one)                                         |
| `OPENAI_API_KEY`              | No       | Default AI key. A key saved in Settings → AI overrides it                                     |
| `OPENAI_MODEL`                | No       | Default AI model                                                                              |
| `OPENAI_BASE_URL`             | No       | For OpenAI-compatible gateways                                                                |
| `OPENAI_PROXY_URL`            | No       | HTTP(S) proxy for AI requests only, e.g. `http://127.0.0.1:7890`. Falls back to `HTTPS_PROXY` |
| `DISPATCH_INTERVAL_SECONDS`   | No       | How often the worker looks for due emails (default 20)                                        |
| `INBOX_SYNC_INTERVAL_SECONDS` | No       | How often each inbox is read (default 120)                                                    |
| `SMTP_ALLOW_SELF_SIGNED`      | No       | `true` to accept self-signed certificates from your own SMTP server                           |
| `LOG_LEVEL`                   | No       | `debug`, `info` (default), `warn` or `error`                                                  |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> [!CAUTION]
> Never change `APP_SECRET` after setup. Stored mailbox passwords and the AI key are encrypted with it and would become unreadable; you'd have to re-enter every password.

After changing `.env`, restart: `docker compose up -d`.

## Network requirements

The worker needs outbound access to your mail providers: SMTP ports **465** or **587** and IMAP port **993**. Some hosting providers block mail ports by default; check before choosing a host. The [connection test](/help/mailboxes#managing-mailboxes) will tell you if they're blocked.

## Updating

```bash
git pull
docker compose up -d --build
```

The worker applies any database changes automatically when it starts.

## Backups

Everything lives in PostgreSQL. Back it up regularly:

```bash
docker compose exec postgres pg_dump -U pawpost pawpost > pawpost-$(date +%F).sql
```

Restore into an empty database with `psql`. Keep backups somewhere other than the server, and keep `APP_SECRET` with them; without it, the stored passwords in a backup can't be decrypted.

## Health check

`GET /api/health` returns `{"status":"ok"}` when the web app and database work, plus whether the worker is online. Point your uptime monitor at it.

## Logs

Both services log one JSON line per event:

```bash
docker compose logs -f worker
docker compose logs -f web
```

The worker logs every send, failure, automatic pause and inbox-sync problem.
