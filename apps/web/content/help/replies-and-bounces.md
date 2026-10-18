---
title: Replies, bounces and unsubscribes
description: What Pawpost does when people reply, emails bounce, or someone asks to stop, and how the suppression list works.
category: results
order: 1
keywords: reply, replies, bounce, bounces, unsubscribe, opt-out, suppression list, out of office, auto-reply, do not contact, one-click
---

## Replies

Replies arrive in the sending mailbox like any other email. Read and answer them there, in Gmail, Outlook or your usual email app. Pawpost reads the same inbox every couple of minutes and:

- marks the contact **Replied**, which stops their sequence (when the campaign's "Stop the sequence when someone replies" setting is on),
- adds the reply to the campaign's activity feed, with an AI label and summary if [reply classification](/help/ai-features#reply-classification) is on,
- if the reply asks to stop ("please remove me", "unsubscribe"), also adds the address to the **suppression list**.

**Out-of-office replies** are recognised and ignored. The contact keeps receiving the sequence.

> [!NOTE]
> Pawpost only looks at email that arrives _after_ a mailbox is connected, and never deletes, moves or marks your mail as read.

## Bounces

A **bounce** means an email couldn't be delivered, usually because the address doesn't exist. Pawpost catches bounces in two ways:

- the receiving server **refuses the address while sending**, or
- a **bounce notice** ("Delivery Status Notification", "Undeliverable") arrives in the inbox later.

Either way, the contact is marked **Bounced**, the address goes on the suppression list, and it counts towards the campaign's bounce rate. Temporary delivery delays are not counted as bounces.

> [!WARNING]
> Bounce rates above about 2% tell email providers you're using a poor-quality list, which hurts all your future emails. Pawpost pauses a campaign that goes over 2%. [Keeping bounces low](/help/deliverability#keep-your-list-clean)

## Unsubscribes

People can unsubscribe in three ways, all automatic:

1. **The link in the footer.** It opens a page where they confirm with one click. The confirmation step stops security scanners, which open every link in an email, from unsubscribing people by accident.
2. **Their email app's Unsubscribe button.** Gmail, Yahoo, Apple Mail and others show one next to the sender's name, thanks to the "one-click unsubscribe" headers Pawpost adds to every email.
3. **By replying** with something like "remove me" or "stop".

The person is added to the suppression list immediately, and every running sequence for that address stops, across all campaigns.

## The suppression list

The **Suppression list** (in the sidebar) is your global do-not-contact list. Addresses on it are:

- never emailed by any campaign, even if they're in a new list you import later,
- skipped when you import a CSV (shown as "On suppression list").

Each entry shows why it was added:

| Reason       | Added when                                                       |
| ------------ | ---------------------------------------------------------------- |
| Unsubscribed | The person used an unsubscribe link or button, or asked by reply |
| Bounced      | The address bounced                                              |
| Manual       | You added it yourself                                            |

### Adding an address yourself

Use **Add an address** at the top of the page, for example when someone asks by phone or social media to not be contacted. Any running sequences for that address stop right away.

### Removing an address

Click **Remove** next to an entry. Only do this for an address that bounced by mistake, or for someone who has **explicitly asked** to hear from you again. Contacting people who unsubscribed is illegal in most countries.
