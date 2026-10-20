---
title: Creating and running campaigns
description: Create a campaign, set its schedule, start, pause, resume and delete it.
category: campaigns
order: 1
keywords: campaign, create, start, pause, resume, delete, schedule, timezone, sending window, days, hours, postal address, stop on reply, draft, active, completed, checks
---

A **campaign** sends one email sequence to one contact list, from one or more mailboxes, on a schedule you choose.

## Creating a campaign

1. Go to **Campaigns → New campaign**.
2. Enter a name and choose a contact list.
3. Click **Create campaign**.

The campaign starts as a **Draft** with an example two-email sequence, and every active mailbox attached. Nothing is sent until you click **Start**.

## The campaign page

| Tab          | What it's for                                                    |
| ------------ | ---------------------------------------------------------------- |
| **Overview** | Statistics and the activity feed (sends, replies, bounces)       |
| **Sequence** | The emails, in order. [Writing emails](/help/writing-emails)     |
| **Settings** | Name, list, schedule, mailboxes, postal address                  |
| **Contacts** | Every contact in the campaign and where they are in the sequence |

## Settings

### Schedule

- **Timezone**: the timezone the sending window uses. Choose your recipients' timezone, e.g. `America/New_York` or `Europe/London`. Start typing to see suggestions.
- **From / Until**: the hours emails may go out, for example 09:00–17:00. Emails sent during working hours look more natural and get more replies.
- **Days**: the weekdays to send. Weekdays only is the usual choice for business contacts.

Follow-ups that fall due outside the window wait for the next allowed time.

### Sending mailboxes

Tick the mailboxes that should send this campaign. Contacts are spread across them, and each contact's follow-ups come from the same mailbox as their first email. [How rotation works](/help/how-sending-works#which-mailbox-sends-to-whom)

### Compliance

- **Postal address**: added to the bottom of every email together with an unsubscribe link. It's required, and the campaign can't start without it. [Why](/help/compliance)
- **Stop the sequence when someone replies**: on by default. When a contact replies, they get no more emails from this campaign. Leave it on unless you have a specific reason.

Click **Save settings** when you're done.

## Before you can start

While a campaign is a draft or paused, a **Before you can start** box lists anything that blocks starting (red) and things worth a look (amber). Common items:

- **Add a postal address.**
- **Placeholder text in <angle brackets>**: the example email hasn't been replaced yet.
- **Unknown field** such as `{{Citty}}`: a typo in a field name. [Fields](/help/writing-emails#personalising-with-fields)
- **No active mailbox attached.**
- **Missing fallback** (amber): some contacts have no first name; add a fallback like `{{firstName|there}}`.

The **Start** button stays enabled for amber items. Only red items block starting — missing sequence, no mailbox, empty list, or no postal address. High daily limits and new mailboxes are warnings, not blockers.

## Starting

Click **Start** and confirm. Pawpost then:

- enrols every contact in the list, except those on the suppression list and anyone currently in _another_ running campaign (so nobody gets two campaigns at once),
- begins sending within your schedule and mailbox limits.

## Pausing, resuming and editing

- **Pause** stops all sending for this campaign immediately. Contacts keep their place.
- To **edit** the emails or settings of a running campaign, pause it first, make your changes, then **Resume**.
- **Resume** re-runs the start checks, and also enrols anyone added to the contact list since the campaign started.

The contact list can only be changed while the campaign is a draft.

## Automatic pause

A campaign pauses itself when, after at least 25 emails, more than **2%** bounce or more than **5%** unsubscribe. The reason is shown at the top of the campaign. Fix the cause (usually the list quality or the email copy) before resuming. [What to do](/help/troubleshooting#my-campaign-paused-itself)

## Completion and deleting

A campaign becomes **Completed** when every contact has either received all emails or stopped early (replied, bounced or unsubscribed).

**Delete** removes the campaign with its sequence and statistics. You can't delete a running campaign; pause it first. People who unsubscribed or bounced stay on the suppression list.

## Campaign statuses

| Status        | Meaning                                                |
| ------------- | ------------------------------------------------------ |
| **Draft**     | Being set up; nothing has been sent                    |
| **Active**    | Sending within its schedule                            |
| **Paused**    | Stopped by you, or automatically (the reason is shown) |
| **Completed** | Every contact has finished the sequence                |
