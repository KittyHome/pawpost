---
title: Reading your results
description: What the numbers, statuses and activity feed mean, and what good looks like.
category: results
order: 2
keywords: statistics, stats, results, reply rate, bounce rate, overview, dashboard, activity, contact status, enrolled, completed, failed, progress, inbox
---

## The Overview page

The four cards at the top cover **the last 7 days across all campaigns**:

| Card             | Meaning                                                       |
| ---------------- | ------------------------------------------------------------- |
| **Emails sent**  | Emails your mailboxes sent (also shown for the last 24 hours) |
| **Replies**      | Human replies, and the reply rate: replies ÷ emails sent      |
| **Bounces**      | Undeliverable emails, and the bounce rate                     |
| **Unsubscribes** | People who opted out, as a share of emails sent               |

Below are the **recent activity** feed and, until you've completed setup, a **Get started** checklist. If anyone has written back and their reply still needs a look, a notice links to **Replies**.

## A campaign's Overview tab

| Card            | Meaning                                                               |
| --------------- | --------------------------------------------------------------------- |
| **Enrolled**    | Contacts in the campaign, and how many are still in their sequence    |
| **Emails sent** | All emails sent by this campaign, including follow-ups                |
| **Replies**     | Replies, as a share of enrolled contacts                              |
| **Bounces**     | Bounces, as a share of emails attempted. Above 2% pauses the campaign |

## What good looks like

Rough ranges for cold outreach. Your results depend heavily on how well the list matches the offer.

| Metric           | Healthy  | Investigate          |
| ---------------- | -------- | -------------------- |
| Reply rate       | 2–10%    | Under 1%             |
| Bounce rate      | Under 1% | Over 2% (auto-pause) |
| Unsubscribe rate | Under 2% | Over 5% (auto-pause) |

A low reply rate with low bounces usually means the email or the targeting needs work, not the setup. A high bounce rate means the list needs cleaning.

## Contact statuses

The campaign's **Contacts** tab shows where each person is. Use the filter buttons to see one status at a time.

| Status           | Meaning                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| **Active**       | In the sequence. "Next email" shows which email is next and when it's due |
| **Sending**      | An email is being sent right now                                          |
| **Completed**    | Received every email, no reply                                            |
| **Replied**      | Replied; sequence stopped                                                 |
| **Bounced**      | The address bounced; sequence stopped and address suppressed              |
| **Unsubscribed** | Opted out; sequence stopped and address suppressed                        |
| **Suppressed**   | Added to the suppression list manually while in the sequence              |
| **Failed**       | Couldn't be sent. The error is shown under the status                     |

> [!NOTE]
> **Failed** contacts are never retried automatically. If a send was interrupted, the email may already have reached them, and a duplicate would look careless. Check the error message; most often the email couldn't be rendered or the connection dropped mid-send.

## The reply inbox

**Replies** in the sidebar lists people who wrote back. [How to work through them](/help/replies-and-bounces#the-reply-inbox)

## The activity feed

Each campaign has a feed of everything that happened, newest first:

- **Sent**: which email and subject went to whom.
- **Reply**: with the AI label and summary when [reply classification](/help/ai-features#reply-classification) is on, otherwise the first lines of the reply.
- **Auto-reply**: an out-of-office notice (sequence continues).
- **Bounce**: refused by the receiving server, or a bounce notice.
- **Unsubscribed**: via the link, the email app's button, or a reply.
- **Campaign paused / completed**: including the reason for automatic pauses.
