---
title: Writing emails that get replies
description: Build your sequence, personalise it with fields, and follow proven cold email practices.
category: campaigns
order: 2
keywords: sequence, email, subject, body, follow-up, template, variables, fields, personalise, personalize, fallback, firstName, preview, copy, writing, threading
---

## The sequence editor

Open a campaign's **Sequence** tab. Each card is one email:

- **Email 1** is sent first.
- **Follow-ups** are sent a set number of days after the previous email, only to people who haven't replied.

For each email you can edit the **subject** and **body**, reorder with the arrows, remove it with the bin icon, and add follow-ups with **Add follow-up** (up to 10 emails in total). The **Preview** on the right shows the email exactly as a real contact from your list will see it. Switch on **Contact without a name** to check how it reads for contacts with no first name.

Click **Save sequence** when you're done. Unsaved changes are lost if you leave the page.

## Subjects and threads

- **Email 1 needs a subject.** Short and plain works best: 2–6 words, written like a colleague would, e.g. "Quick question" or "Idea for Acme".
- **Follow-ups: leave the subject empty** to send them as a reply in the same thread ("Re: Quick question"). The recipient sees the whole conversation, which gives context. Add a subject only to deliberately start a new thread.

## Personalising with fields

Fields are placeholders replaced with each contact's details. Click a field button under the body to insert it at the cursor.

| Field                 | Replaced with                                               |
| --------------------- | ----------------------------------------------------------- |
| `{{firstName}}`       | Contact's first name                                        |
| `{{lastName}}`        | Contact's last name                                         |
| `{{fullName}}`        | First and last name                                         |
| `{{email}}`           | Contact's email address                                     |
| `{{company}}`         | Contact's company                                           |
| `{{senderName}}`      | Your mailbox's sender name, e.g. "Sam Lee"                  |
| `{{senderFirstName}}` | First word of the sender name, e.g. "Sam"                   |
| `{{AnyColumn}}`       | Any other column from your CSV, using the exact column name |

### Fallbacks

Some contacts won't have every detail. Add a **fallback** after a `|` to use when the value is missing:

```
Hi {{firstName|there}},
```

This gives "Hi Ann," for Ann and "Hi there," for a contact without a first name. Without a fallback, the field would just be left out ("Hi ,"), so Pawpost warns you when `firstName`, `lastName`, `fullName` or `company` is used without one.

> [!WARNING]
> A misspelled field name, such as `{{fristName}}`, blocks the campaign from starting, so a broken email never goes out.

## What Pawpost adds automatically

Every email gets a short footer:

```
--
Your postal address
Not interested? Unsubscribe here: https://…
```

It also gets the hidden headers that make an **Unsubscribe** button appear in Gmail, Yahoo and other email apps. Don't add your own unsubscribe text; it would appear twice.

Emails are sent as **plain text**, like an email typed by hand. That's intentional: plain text reaches the inbox more reliably than designed HTML emails for this kind of outreach.

## Writing tips that work

1. **Short.** First email 50–120 words; follow-ups 25–70. The editor shows a word count.
2. **About them, not you.** Open with why you're writing to _them_ specifically.
3. **One clear, small ask.** "Worth a quick look?" gets more replies than "Can we book a 30-minute demo next week?".
4. **At most one link**, ideally none in the first email. Links, and especially several of them, are a spam signal. Pawpost warns you about more than one.
5. **No hype.** Avoid ALL CAPS, exclamation marks, "free", "guarantee", "act now".
6. **Follow-ups add something.** A new detail or a different angle, not just "bumping this".
7. **Two or three emails is plenty.** Long sequences annoy people and raise complaint rates.

> [!TIP]
> Not sure about a draft? Click **Review** on any email to get an AI check for spam signals and clarity, with a suggested rewrite. [AI features](/help/ai-features)

## Example

**Email 1**: subject "Quick question"

```
Hi {{firstName|there}},

I noticed {{company|your team}} writes a lot of customer email. We built a free
Chrome extension that drafts replies in your own voice. Press Alt+K in Gmail
and it writes a first draft.

Would it be useful if I sent the link?

{{senderFirstName}}
```

**Follow-up 1**: no subject, 4 days later

```
Hi {{firstName|there}}, one more detail: it also summarises long threads into the
three things that need a reply. Happy to send the link if that's useful.

{{senderFirstName}}
```
