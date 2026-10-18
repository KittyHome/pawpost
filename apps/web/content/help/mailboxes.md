---
title: Connecting mailboxes
description: Add Gmail, Google Workspace, Microsoft 365 or any SMTP/IMAP account to send from.
category: setup
order: 1
keywords: mailbox, smtp, imap, gmail, google workspace, outlook, microsoft 365, office 365, app password, port, ssl, tls, starttls, zoho, connect, sender
---

A **mailbox** is an email account Pawpost sends from. Pawpost uses two standard connections for each one:

- **SMTP** to _send_ email,
- **IMAP** to _read_ the inbox, so it can see replies and bounces.

When you connect a mailbox, Pawpost logs in with both before saving. If either fails, you'll see why, and nothing is saved.

## Connecting a mailbox

1. Go to **Mailboxes → Connect mailbox**.
2. Pick your **Provider**. For Google, Microsoft and Zoho the server settings are filled in for you.
3. Fill in:
   - **Email address**: the address emails come from.
   - **Sender name**: what recipients see, e.g. "Sam Lee". A real person's name gets more replies than a company name.
   - **Username**: usually the email address itself.
   - **Password**: see the provider sections below; most providers need an _app password_.
4. Optionally adjust the [pacing](#pacing-daily-limit-and-minimum-gap).
5. Click **Connect mailbox**.

> [!NOTE]
> Passwords are stored encrypted. They're only used to send and to read the inbox.

## Google Workspace and Gmail

Google doesn't allow your normal password for this. You need an **App Password**:

1. Turn on **2-Step Verification** for the Google account, if it isn't already (Google Account → Security).
2. Open Google Account → Security → 2-Step Verification → **App passwords** (or go to `myaccount.google.com/apppasswords`).
3. Create one named "Pawpost" and copy the 16-character password.
4. Paste it into the **Password** field in Pawpost (spaces don't matter).

Settings (filled in automatically): SMTP `smtp.gmail.com`, port 465, SSL/TLS on; IMAP `imap.gmail.com`, port 993, SSL/TLS on.

> [!WARNING]
> If you can't find "App passwords", your Google Workspace administrator may have turned them off, or the account uses Advanced Protection. Ask your admin to allow app passwords for this user.

Google also limits how much one account can send per day: about 500 for free Gmail and 2,000 for Workspace. For cold outreach, stay far below that ([see Deliverability](/help/deliverability)).

## Microsoft 365 and Outlook

1. Your Microsoft 365 admin must enable **Authenticated SMTP** for the mailbox: Microsoft 365 admin center → Users → Active users → select the user → Mail → Manage email apps → tick **Authenticated SMTP**.
2. Use the account's password. If the account has multi-factor authentication, you may need an app password, if your organisation allows them.

Settings (filled in automatically): SMTP `smtp.office365.com`, port 587, SSL/TLS **off** (it uses STARTTLS); IMAP `outlook.office365.com`, port 993, SSL/TLS on.

> [!CAUTION]
> Microsoft is retiring password-based ("basic") authentication for SMTP. From the end of December 2026 it's switched off by default for existing Microsoft 365 organisations; admins can switch it back on for now, and Microsoft plans to announce final removal in 2027. Pawpost currently connects with passwords, so Google Workspace or another provider is the more future-proof choice. Sign-in with Microsoft (OAuth) is on the roadmap.

## Other providers

Choose **Other (custom SMTP/IMAP)** and copy the settings from your provider's help pages. You'll need the SMTP and IMAP server names and ports.

About the **SSL/TLS** checkbox:

| Port                   | SSL/TLS checkbox | Meaning                                                                                      |
| ---------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| 465 (SMTP), 993 (IMAP) | On               | Encrypted from the start ("SSL" or "implicit TLS")                                           |
| 587 (SMTP), 143 (IMAP) | Off              | Starts plain, then upgrades to encryption ("STARTTLS"). Pawpost always requires the upgrade. |

If your IMAP login differs from your SMTP login, fill in the optional **IMAP username/password** fields; otherwise leave them blank.

## Pacing: daily limit and minimum gap

- **Daily limit**: the most emails this mailbox sends in any 24-hour period. Start new mailboxes at **10–20**, then raise it gradually to 30–50 over a few weeks. [Ramp-up plan](/help/deliverability#ramp-up-new-mailboxes-slowly)
- **Minimum gap**: seconds between two emails from this mailbox, plus a random 0–50% extra. The default is 180 seconds (3 minutes).

You can change both at any time with **Edit**.

## Managing mailboxes

Each mailbox row on the **Mailboxes** page shows:

- **Status**: **Active** (sending), **Paused** (you paused it) or **Error** (the provider rejected it; see below).
- **Sent (24h)**: emails sent in the last 24 hours, against its daily limit.
- **Inbox synced**: when Pawpost last read its inbox. "Failing" means it couldn't log in to IMAP; the error is shown under the address.

The row's actions:

- **Test** logs in again and reports what works. A successful test also clears the Error status.
- **Edit** changes settings. Leave the password blank to keep the saved one.
- **Pause / Resume sending** temporarily stops this mailbox; campaigns keep using your other mailboxes.
- **Remove** deletes the mailbox. Its sent history is kept, and its contacts move to the campaign's other mailboxes.

## When a mailbox shows "Error"

Pawpost stops a mailbox when its provider:

- rejects the login (password changed, app password revoked),
- reports a sending limit or block ("quota exceeded", "too many messages").

Fix the cause (for a limit, wait a day and lower the daily limit), then click **Test**. If the test passes, the mailbox becomes Active again. [Common errors and fixes](/help/troubleshooting#mailbox-connection-errors)
