---
title: Troubleshooting
description: Fixes for connection errors, campaigns that don't send, missed replies, AI errors and more.
category: support
order: 1
keywords: problem, error, not working, fix, help, 535, authentication failed, connection refused, timeout, not sending, stuck, paused, spam, ai error, proxy, login, import error
---

Find your symptom below. Error messages are quoted as Pawpost shows them, so you can also search for the text you see.

## Mailbox connection errors

These appear when connecting or testing a mailbox, or under a mailbox's address on the **Mailboxes** page.

| Message contains                                              | Likely cause                                                         | Fix                                                                                                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Login failed` · `535` · `Username and Password not accepted` | Wrong password, or a normal password where an app password is needed | Gmail/Google Workspace: create an [App Password](/help/mailboxes#google-workspace-and-gmail). Others: re-check the username (usually the full email address) |
| `SmtpClientAuthentication is disabled` · `5.7.139`            | Microsoft 365: Authenticated SMTP is off for this mailbox            | Ask your admin to enable it ([how](/help/mailboxes#microsoft-365-and-outlook))                                                                               |
| `Basic authentication is not supported` · `5.7.30`            | Microsoft has switched off password sign-in for SMTP                 | Your admin can re-enable SMTP AUTH for now; otherwise use another provider                                                                                   |
| `Could not connect` · `ECONNREFUSED` · `ETIMEDOUT`            | Wrong server name or port, or the server's network blocks mail ports | Check host and port; ask whoever runs Pawpost whether ports 465/587/993 are open ([details](/help/self-hosting#network-requirements))                        |
| `wrong version number` · `SSL routines`                       | The SSL/TLS checkbox doesn't match the port                          | 465 and 993: checkbox **on**. 587 and 143: checkbox **off**                                                                                                  |
| `self-signed certificate`                                     | Your own mail server uses a self-signed certificate                  | Your administrator can set `SMTP_ALLOW_SELF_SIGNED=true`                                                                                                     |
| `IMAP:` … `AUTHENTICATIONFAILED` · `Invalid credentials`      | IMAP login differs, or IMAP is disabled at the provider              | Enable IMAP in the mailbox's settings (Gmail: Settings → Forwarding and POP/IMAP), or fill in the separate IMAP username/password                            |
| `quota` · `limit exceeded` · `5.4.5`                          | The provider's daily sending limit was reached                       | Wait 24 hours, lower the mailbox's daily limit, then click **Test**                                                                                          |
| `can't be decrypted (was APP_SECRET changed?)`                | The server's secret key was changed                                  | Edit the mailbox and enter the password again                                                                                                                |

After fixing the cause, click **Test** on the mailbox. A successful test returns an **Error** mailbox to **Active**.

## The worker is offline

The sidebar says "Worker offline" or "Worker not started", and the Overview shows a red warning. Nothing is sent and no replies are read until the worker runs again. No data is lost; due emails wait.

- **Docker:** `docker compose ps` should show the `worker` service running. Start it with `docker compose up -d worker` and check `docker compose logs worker` for errors.
- **Development:** run `pnpm --filter @pawpost/worker dev`.
- A worker that stops right after starting usually has a configuration problem; its log says which setting is invalid.

## Nothing is being sent

Work through this list on the campaign page:

1. **Is the worker online?** (bottom of the sidebar)
2. **Is the campaign Active?** Drafts and paused campaigns don't send.
3. **Is it inside the sending window?** Check the days, hours and **timezone** on the Settings tab. A window of 09:00–17:00 in `America/New_York` is 15:00–23:00 in Central Europe.
4. **Is anyone due?** On the Contacts tab, "Next email" shows when each contact's next email is due. Follow-ups wait the configured days.
5. **Can a mailbox send?** On **Mailboxes**, check that the campaign's mailboxes are **Active** and below their daily limit. Each mailbox also waits its minimum gap between emails.

If the campaign was just started, the first email usually goes out within a minute, then one per mailbox every few minutes.

### "No contacts could be enrolled"

Every contact in the list is either on the suppression list or already in another running campaign. Pawpost never puts one person in two campaigns at the same time.

## My campaign paused itself

The reason is shown at the top of the campaign:

- **Bounce rate above 2%:** the list has too many dead addresses. Run the remaining contacts through an email verification service, and import cleaner data before resuming. Bounced addresses are already suppressed.
- **Unsubscribe rate above 5%:** recipients don't find the email relevant. Narrow the audience or rewrite the email ([tips](/help/writing-emails#writing-tips-that-work)) before resuming.

Click **Resume** once you've addressed it. Resuming without a fix usually leads to another pause, and damages your sending reputation in the meantime.

## Contacts show "Failed"

The error is shown under the status on the Contacts tab:

- **"Interrupted while sending…":** the worker stopped mid-send, so the email may or may not have arrived. It isn't retried, to avoid a duplicate.
- **"Email body is empty after filling in contact fields":** the email is made only of fields that were empty for this contact. Add fallbacks.
- Other messages come from the mail server; see [Mailbox connection errors](#mailbox-connection-errors).

## Replies aren't being detected

- Check **Inbox synced** on the Mailboxes page. "Failing" means Pawpost can't log in to IMAP; the error is shown under the address.
- Inboxes are read every couple of minutes, so allow a few minutes.
- Only mail that arrives after the mailbox was connected is read.
- A reply sent from a _different_ address than the one you emailed, in a brand-new email rather than a reply, can't be linked to the contact. Mark them manually by adding them to the suppression list if they asked to stop.

## Emails are going to spam

See [Reaching the inbox → If emails go to spam](/help/deliverability#if-emails-go-to-spam). The most common causes are missing SPF/DKIM/DMARC, a new domain sending too much too soon, and low-quality lists.

## Unsubscribe links point to localhost

The links use the server setting `APP_URL`. Whoever runs Pawpost must set it to the public HTTPS address of the dashboard and restart. Emails already sent keep their old links.

## AI errors

| Message                                                 | Fix                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Add an OpenAI API key in Settings → AI"                | Add a key in **Settings → AI**                                                                                                                   |
| "OpenAI rejected the API key"                           | The key is wrong, revoked or from a deleted project. Create a new key and save it                                                                |
| "OpenAI rate limit or quota reached"                    | Check billing and usage limits at platform.openai.com, or try again later                                                                        |
| "Could not reach the OpenAI API … set OPENAI_PROXY_URL" | The server can't reach OpenAI. Behind a proxy, the administrator sets `OPENAI_PROXY_URL` ([details](/help/self-hosting#configuration-reference)) |
| "OpenAI error 404" mentioning the model                 | The model name doesn't exist for your account. Change **Model** in Settings → AI                                                                 |

Use **Test connection** in Settings → AI to check after any change. If reply classification fails, Pawpost falls back to its built-in opt-out detection, so no replies are missed.

## Importing a CSV fails

| Message                                           | Fix                                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| "No email column found"                           | Rename the email column to `email` (the message lists the columns it found) |
| "CSV files are limited to 10 MB" / "100,000 rows" | Split the file into several lists                                           |
| Names look garbled (Ã©, â€™)                      | Re-save from Excel as **CSV UTF-8**                                         |

## "Pawpost needs UTF8" when starting

The worker stops at startup with "The database uses the … character encoding; Pawpost needs UTF8". The PostgreSQL database was created with a legacy character set, which can't store names in many languages. Pawpost refuses to run on it rather than failing halfway through an import.

- **Docker Compose:** the bundled database is always UTF-8, so this only happens with your own PostgreSQL server.
- **Your own PostgreSQL:** create a new database with `CREATE DATABASE pawpost ENCODING 'UTF8' TEMPLATE template0;`, point `DATABASE_URL` at it, and start the worker again.
- **Local development (`pnpm db:dev`):** delete the `.data/postgres` folder and run `pnpm db:dev` again.

## I can't sign in

The login comes from the server configuration (`ADMIN_EMAIL` and `ADMIN_PASSWORD`); it can't be reset from the dashboard. Ask whoever installed Pawpost. You stay signed in for 7 days per browser.
