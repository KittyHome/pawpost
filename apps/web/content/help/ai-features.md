---
title: AI features
description: Set up OpenAI, then let AI draft sequences, review emails and sort replies.
category: campaigns
order: 3
keywords: ai, openai, gpt, api key, model, proxy, write with ai, review, reply classification, intent, triage, privacy, cost
---

Pawpost can use AI in three places. All of them are optional; everything else works without AI.

| Feature                  | Where           | What it does                                                                                        |
| ------------------------ | --------------- | --------------------------------------------------------------------------------------------------- |
| **Write with AI**        | Sequence tab    | Drafts a whole sequence from a short description of your offer                                      |
| **Review**               | Each email card | Checks an email for spam signals and clarity, scores it, and suggests a rewrite                     |
| **Reply classification** | Automatic       | Labels each reply (interested, question, not now, opt-out…) and unsubscribes people who ask to stop |

## Setting up

You need an OpenAI API key, from [platform.openai.com](https://platform.openai.com) → API keys. Usage is billed by OpenAI to your account.

1. Go to **Settings → AI**.
2. Paste the key into **OpenAI API key**.
3. Leave **Model** as it is unless you know you want a different one. Any OpenAI model that supports structured outputs works.
4. Choose whether to **Classify replies**.
5. Click **Save**, then **Test connection**.

The status line shows where the key comes from. A key saved here is stored encrypted and takes precedence over one set by your administrator in the server configuration (`OPENAI_API_KEY`).

> [!NOTE]
> **Behind a proxy?** If your network only reaches the internet through an HTTP proxy, your administrator sets `OPENAI_PROXY_URL` in the server configuration. Settings then shows "Using HTTP proxy". The proxy is used only for AI requests, never for sending email. [Configuration](/help/self-hosting#configuration-reference)

## Write with AI

1. On a campaign's **Sequence** tab, click **Write with AI**.
2. Describe what you offer, who it's for, and what you want them to do. Add a link if the ask is "try it", and choose a tone and the number of emails.
3. Click **Generate**.

The draft **replaces** the emails in the editor but is **not saved**. Read it, edit anything that doesn't sound like you, then click **Save sequence**.

The AI is instructed to write short plain-text emails with one clear ask, use `{{firstName|there}}`-style fields, and never invent facts, prices or customers. Still check every claim before sending.

## Review an email

Click **Review** on any email card. You get:

- a **score** out of 100 and a verdict (Good to send / Needs work / Risky),
- a list of **issues**, most important first,
- a **suggested version** that fixes them.

Click **Use suggestion** to put it in the editor (then save), or **Keep mine**.

## Reply classification

With **Classify replies** on, each human reply is labelled:

| Label          | Meaning                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| Interested     | Wants to talk, try it or learn more                                         |
| Question       | Asks something before deciding                                              |
| Referral       | Points you to someone else                                                  |
| Not now        | Maybe later                                                                 |
| Not interested | Declines politely                                                           |
| Opt-out        | Asks to stop or be removed; **added to the suppression list automatically** |
| Out of office  | Automatic away reply; the sequence continues                                |
| Wrong person   | Says they're not the right contact                                          |

Labels and a one-line summary appear in the activity feed. Every reply except an out-of-office stops the contact's sequence (when the campaign is set to stop on reply), whatever its label.

Without AI, Pawpost still spots common opt-out phrases ("unsubscribe", "remove me", "not interested", "stop") and suppresses those senders.

## Privacy

When you use AI, this is sent to OpenAI:

- **Write with AI:** the description you type.
- **Review:** the email's subject and body (with field placeholders, not contact data).
- **Reply classification:** the text of each reply and your original subject.

Contact lists are never sent. If replies may contain sensitive information, leave **Classify replies** off.
