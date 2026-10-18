---
title: How sending works
description: When emails go out, how fast, from which mailbox, and when Pawpost stops.
category: start
order: 2
keywords: worker, schedule, pace, speed, timing, rotation, daily limit, gap, jitter, sequence, follow-up
---

Pawpost is built to send the way a careful person would: a few emails at a time, spread across the working day, from real mailboxes. This page explains exactly what happens after you click **Start**.

## The worker

Sending is done by a background process called the **worker**, not by the web page. The worker:

- checks every 20 seconds (by default) for emails that are due,
- sends them through your mailboxes,
- reads your inboxes every couple of minutes for replies and bounces.

You can close the browser; sending continues. The sidebar shows **Worker online** while it's running. If the worker stops, nothing is sent until it's back, and nothing is lost: due emails simply wait.

## When an email is sent

An email goes out only when **all** of these are true:

1. The campaign is **Active** (not a draft, paused or completed).
2. It's inside the campaign's **sending window**: the chosen days and hours, in the campaign's timezone.
3. The contact's next email is **due**. The first email is due immediately; each follow-up is due the set number of days after the previous one.
4. A mailbox attached to the campaign is **available**: active, under its daily limit, and past its minimum gap since its last send.
5. The address isn't on the [suppression list](/help/replies-and-bounces#the-suppression-list).

## How fast

Each mailbox has two limits, set when you connect it:

| Setting         | What it does                                                                                                              | Default |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | ------- |
| **Daily limit** | The most emails this mailbox sends in any rolling 24 hours                                                                | 30      |
| **Minimum gap** | Seconds to wait between two emails from this mailbox. Pawpost adds a random extra 0–50% so sends don't look machine-timed | 180     |

With the defaults, one mailbox sends roughly one email every 3–4½ minutes, up to 30 a day. More mailboxes mean more volume: three mailboxes at 30 a day can send about 90 emails a day.

> [!TIP]
> To reach a big list faster, add more mailboxes rather than raising the limits. Low volume per mailbox is what keeps emails out of spam.

## Which mailbox sends to whom

Contacts are spread across all mailboxes attached to the campaign. Once a contact gets their first email from a mailbox, **all their follow-ups come from that same mailbox**, so the conversation stays in one thread.

If you remove a mailbox from a campaign, its contacts are moved to the remaining mailboxes for their next email.

## Follow-ups and threading

A follow-up with an **empty subject** is sent as a reply to your previous email (subject "Re: …", in the same conversation thread in the recipient's inbox). This is usually best: it gives context and looks like a normal personal follow-up. Give a follow-up its own subject only if you want it to start a new conversation.

## When Pawpost stops emailing someone

A contact's sequence ends early when they:

- **reply** (if "Stop the sequence when someone replies" is on, which is the default). Out-of-office auto-replies don't count.
- **bounce** (the address doesn't exist or rejects mail),
- **unsubscribe**, by link, by their email app's unsubscribe button, or by replying with something like "please remove me".

Otherwise they get every email in the sequence, and their status becomes **Completed**.

## Safety brakes

- **Auto-pause:** once at least 25 emails have been attempted, a campaign pauses itself if more than **2%** bounce or more than **5%** unsubscribe. You'll see the reason at the top of the campaign. [What to do](/help/troubleshooting#my-campaign-paused-itself)
- **Never a double send:** if something goes wrong while an email is being sent (for example the server restarts mid-send), that contact is marked **Failed** rather than retried, because the email may already have gone out. One missed email is better than a duplicate.
- **Mailbox errors:** if your email provider rejects a mailbox's login or says it has hit a sending limit, that mailbox is set to **Error** and stops sending until you fix it and click **Test**.
