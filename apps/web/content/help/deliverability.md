---
title: Reaching the inbox
description: The practices that decide whether your emails land in the inbox or in spam.
category: practice
order: 1
keywords: deliverability, spam, inbox, reputation, warm up, warmup, ramp, volume, complaint rate, postmaster, blacklist, list quality, verification
---

Whether an email reaches the inbox depends mostly on **how recipients react** to your emails and on **your domain's track record**, not on any single setting. These practices matter most, roughly in order.

## Authenticate your domain

SPF, DKIM and DMARC must all pass. Without them, Gmail, Yahoo and Microsoft send much of your mail to spam or reject it. [Setup guide](/help/sending-domain)

## Send to the right people

Spam complaints are the strongest negative signal there is. Gmail asks bulk senders to keep their reported spam rate **below 0.1%** and treats **0.3%** as a hard limit. With cold email you can only stay there by emailing people with a genuine reason to care.

- Narrow lists beat big lists.
- Remove people who are clearly not a fit before importing.
- Never buy or scrape lists. They're full of dead addresses and "spam traps" that destroy your reputation.

## Keep your list clean

- Keep the **domain check** and **skip role addresses** options on when importing.
- For any list you didn't collect yourself recently, run it through an **email verification service** before importing.
- Keep bounces under 1%. Pawpost pauses at 2% for you.

## Ramp up new mailboxes slowly

New mailboxes and new domains have no reputation yet. Sending a lot immediately looks like a spammer's behaviour. Raise each mailbox's **daily limit** gradually (Mailboxes → ⋯ → Edit):

| Week           | Daily limit per mailbox                       |
| -------------- | --------------------------------------------- |
| Before sending | Use the mailbox normally for 1–2 weeks        |
| Week 1         | 10                                            |
| Week 2         | 20                                            |
| Week 3         | 30                                            |
| Week 4 onwards | 30–50, if bounce and complaint rates stay low |

To send more, add mailboxes instead of pushing one mailbox past about 50 a day.

> [!NOTE]
> Pawpost does not raise the limit for you. Follow this schedule by hand (Mailboxes → ⋯ → Edit).

## Write like a person

- Plain text (Pawpost always sends plain text), short, one clear ask.
- No more than one link; no images or attachments.
- Avoid hype words, ALL CAPS and exclamation marks.
- Personalise beyond the first name where you can.

[Writing tips](/help/writing-emails#writing-tips-that-work)

## Respect opt-outs and replies

Pawpost handles this automatically: unsubscribe links and headers, the suppression list, and stopping when people reply. Don't work around it, for example by re-importing people who unsubscribed.

## Monitoring

- Watch the **bounce** and **unsubscribe** rates on each campaign.
- Register your sending domain with **Google Postmaster Tools** (postmaster.google.com) to see your spam rate and domain reputation at Gmail.
- Now and then, send a test to a personal Gmail and Outlook address to check where it lands.

## If emails go to spam

1. Pause the campaign.
2. Check SPF, DKIM and DMARC all pass ([how](/help/sending-domain#check-your-setup)).
3. Lower daily limits and review your list's quality.
4. Simplify the email: remove links, shorten it, tone down the sales language. **Review** with AI can help spot problems.
5. Resume slowly.

Reputation recovers over weeks, not days.
