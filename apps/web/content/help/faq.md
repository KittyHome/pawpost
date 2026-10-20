---
title: FAQ and glossary
description: Quick answers to common questions, and the terms used across Pawpost.
category: support
order: 2
keywords: faq, questions, glossary, terms, definitions, how many, limit, track opens, html, attachments, multiple users, cost
---

## Frequently asked questions

### How many emails can I send per day?

As many as your mailboxes allow at a safe pace. Each mailbox has its own daily limit; for cold outreach, 30–50 per mailbox per day is a sensible maximum. To send more, connect more mailboxes. [Pacing](/help/how-sending-works#how-fast)

### Does Pawpost track opens and clicks?

No. Open tracking needs a hidden image and click tracking rewrites your links; both make emails look like mass marketing and hurt deliverability. Replies are the measure that matters for outreach, and Pawpost tracks those.

### Can I send HTML emails, images or attachments?

No. Pawpost deliberately sends plain-text emails, which reach the inbox more reliably for one-to-one outreach. Link to anything you want to share instead (one link per email at most).

### Where do I read and answer replies?

In the mailbox itself (Gmail, Outlook…), as usual. Pawpost reads the same inbox in the background to stop sequences and log replies, and lists people who need a look under **Replies**. Answer from your mail app, then mark the reply done in Pawpost.

### Will contacts get the same email twice?

No. Pawpost records every send and never retries an email that may have gone out. A contact is never in two running campaigns at once.

### Can I edit a campaign that's already running?

Yes: **Pause** it, change the emails or settings, then **Resume**. Contacts keep their place in the sequence. The contact list can only be changed before starting.

### I added contacts to the list after starting. Do they get emails?

Yes, once you **Pause** and **Resume** the campaign; resuming enrols new contacts from the list.

### What happens if I remove an email from a sequence while contacts are on it?

Contacts who already received it continue with the following emails; anyone due an email that no longer exists finishes the sequence.

### Can several people use Pawpost?

Yes. Invite teammates from **Settings → Team**; each gets their own login and a role (owner, admin or member) that decides what they can change. [Team and access](/help/team-and-access)

### Does Pawpost warm up my mailboxes?

No. Raise each mailbox's daily limit by hand, slowly. [Ramp-up schedule](/help/deliverability#ramp-up-new-mailboxes-slowly)

### What does it cost?

Pawpost is free for noncommercial use under the [PolyForm Noncommercial License](https://polyformproject.org/licenses/noncommercial/1.0.0); commercial use requires permission from the copyright holder. Running it, you pay only for your server, your mailboxes (e.g. Google Workspace), your domain, and AI usage if you use it.

### Is my data shared with anyone?

No. Everything stays in your own database. The only outside services involved are your mail providers and, if you turn on AI, OpenAI ([what's sent](/help/ai-features#privacy)).

## Glossary

| Term                      | Meaning                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| **Mailbox**               | An email account Pawpost sends from and reads replies in                                       |
| **SMTP**                  | The standard used to send email                                                                |
| **IMAP**                  | The standard used to read an inbox                                                             |
| **App password**          | A separate password your email provider issues for apps like Pawpost                           |
| **Contact list**          | People imported from a CSV file                                                                |
| **Campaign**              | One sequence sent to one list from one or more mailboxes                                       |
| **Sequence**              | The first email plus its follow-ups                                                            |
| **Follow-up**             | An email sent some days later to people who haven't replied                                    |
| **Field**                 | A placeholder such as `{{firstName}}`, replaced per contact                                    |
| **Fallback**              | The text used when a field is empty: `{{firstName\|there}}`                                    |
| **Sending window**        | The days and hours a campaign may send, in its timezone                                        |
| **Daily limit**           | The most emails one mailbox sends in 24 hours                                                  |
| **Bounce**                | An email that couldn't be delivered, usually because the address doesn't exist                 |
| **Suppression list**      | Addresses that are never emailed again                                                         |
| **One-click unsubscribe** | The Unsubscribe button email apps show next to your name                                       |
| **SPF / DKIM / DMARC**    | DNS records that prove your emails are really from your domain ([setup](/help/sending-domain)) |
| **Deliverability**        | How reliably your emails reach the inbox rather than spam                                      |
| **Worker**                | The background process that sends emails and reads inboxes                                     |
| **Auto-pause**            | A campaign stopping itself because of too many bounces or unsubscribes                         |
