---
title: Installing and running Pawpost
description: Install with Docker, configure it, keep it updated and backed up. For whoever runs the server.
category: admin
order: 1
keywords: install, self-host, docker, compose, server, configuration, environment, env, app_url, app_secret, admin password, update, upgrade, backup, restore, health, worker, proxy, domain, https, ssl, tls, certificate, caddy, dns, a record, lets encrypt
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

Open the app and create the **owner account** on the setup page, then invite your team from **Settings → Team**. [Team and access](/help/team-and-access)

> [!WARNING]
> Until the owner account exists, anyone who can reach the app can create it. Do it right after deploying, or set `SETUP_TOKEN` (or `ADMIN_EMAIL` and `ADMIN_PASSWORD`) so nobody else can.

> [!IMPORTANT]
> Unsubscribe links in every email point to `APP_URL`. It must be a public address that recipients can open from anywhere, not `localhost`. Before sending, put Pawpost on a domain with HTTPS (next section).

## Your domain and HTTPS

Every email links to Pawpost's address (the unsubscribe link and Gmail's one-click unsubscribe button). Spam filters distrust links to bare IP addresses like `http://203.0.113.7:3000`, and Gmail expects HTTPS, so use a domain before sending real email. HTTPS also encrypts your team's sign-ins.

Pawpost includes [Caddy](https://caddyserver.com), which gets a free certificate from Let's Encrypt and renews it automatically. Setup takes two steps:

1. **Point a domain at the server.** At your domain's DNS provider, create an **A record**, for example `app` on your outreach domain, with the server's IP address as the value. Use your outreach domain rather than your main company domain, so a reputation problem with outreach can't affect your company's own email. If you use Cloudflare, set the record to **DNS only** (grey cloud).
2. **Run the setup script** on the server, in the Pawpost folder:

   ```bash
   bash scripts/setup-domain.sh app.yourdomain.com
   ```

The script checks that the domain points to this server and that ports 80 and 443 are free. It then sets `DOMAIN`, `APP_URL`, `COMPOSE_PROFILES` and `WEB_BIND_ADDRESS` in `.env` (keeping a backup), starts Caddy, and waits until `https://app.yourdomain.com` works. Sign in at the new address afterwards. Port 3000 is then only reachable from the server itself, so nobody can bypass HTTPS.

> [!TIP]
> **Settings → General** shows whether the public URL is ready for sending. The Overview page and each campaign's pre-start checks warn you when it isn't.

If the script stops, it says why. The usual causes:

- **The DNS record is new.** It can take a few minutes, occasionally an hour, to appear everywhere. Wait and run the script again.
- **Ports 80 and 443 are blocked.** Open them in your hosting provider's firewall panel, and on the server if it uses ufw: `ufw allow 80/tcp && ufw allow 443`.
- **Something else uses port 80 or 443**, such as nginx or Apache. Stop it, or use that web server as the reverse proxy instead.

To use your own reverse proxy (nginx, Traefik, a cloud load balancer), skip the script. Forward HTTPS traffic to port 3000 and set `APP_URL` to the public HTTPS address yourself.

## Configuration reference

Settings are environment variables in the `.env` file.

| Variable                      | Required | Purpose                                                                                                                                      |
| ----------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | Yes      | PostgreSQL connection string (set automatically by Docker Compose)                                                                           |
| `APP_URL`                     | Yes      | Public HTTPS address of the web app                                                                                                          |
| `APP_SECRET`                  | Yes      | At least 32 random characters. Encrypts stored passwords and API keys, and signs logins                                                      |
| `ADMIN_EMAIL`                 | No       | Creates the owner account on first start (otherwise the first visitor sets it up in the browser)                                             |
| `ADMIN_PASSWORD`              | No       | Password for that owner account; change it after signing in                                                                                  |
| `SETUP_TOKEN`                 | No       | When set, the first-run setup page asks for this value, so nobody else can claim the owner account first                                     |
| `SYSTEM_SMTP_URL`             | No       | SMTP connection for invitation and password-reset emails, e.g. `smtps://user:pass@smtp.example.com:465`. Without it, links are shown to copy |
| `SYSTEM_EMAIL_FROM`           | No       | Sender for those emails, e.g. `Pawpost <no-reply@example.com>`                                                                               |
| `OPENAI_API_KEY`              | No       | Default AI key. A key saved in Settings → AI overrides it                                                                                    |
| `OPENAI_MODEL`                | No       | Default AI model                                                                                                                             |
| `OPENAI_BASE_URL`             | No       | For OpenAI-compatible gateways                                                                                                               |
| `OPENAI_PROXY_URL`            | No       | HTTP(S) proxy for AI requests only, e.g. `http://127.0.0.1:7890`. Falls back to `HTTPS_PROXY`                                                |
| `DISPATCH_INTERVAL_SECONDS`   | No       | How often the worker looks for due emails (default 20)                                                                                       |
| `INBOX_SYNC_INTERVAL_SECONDS` | No       | How often each inbox is read (default 120)                                                                                                   |
| `SMTP_ALLOW_SELF_SIGNED`      | No       | `true` to accept self-signed certificates from your own SMTP server                                                                          |
| `LOG_LEVEL`                   | No       | `debug`, `info` (default), `warn` or `error`                                                                                                 |
| `DOMAIN`                      | No       | Domain Caddy serves with HTTPS. Set by `scripts/setup-domain.sh`                                                                             |
| `COMPOSE_PROFILES`            | No       | `https` starts the Caddy container. Set by `scripts/setup-domain.sh`                                                                         |
| `WEB_BIND_ADDRESS`            | No       | Where port 3000 listens: `0.0.0.0` (default, everywhere) or `127.0.0.1` (only the server itself, used behind Caddy)                          |

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
