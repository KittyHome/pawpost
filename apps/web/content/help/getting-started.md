---
title: Quick start
description: From an empty account to your first email in about 20 minutes.
category: start
order: 1
keywords: start, setup, first campaign, tutorial, onboarding, begin
---

Pawpost sends short, personal-looking email sequences from **your own mailboxes** to **your own contact lists**. It sends slowly, the way a person would, reads the replies, and stops emailing anyone who answers, bounces or asks to stop.

This guide takes you through the five steps to your first email. It assumes you're signed in; if you're setting up a new installation, the first screen asks you to create the owner account, and you can invite teammates later from **Settings → Team**. Each step links to a detailed article if you want more.

> [!TIP]
> Keep this page open in a second tab while you work through the steps.

## Before you start

You need:

- **A mailbox to send from.** Ideally a Google Workspace or Microsoft 365 address on a _separate_ domain from your main business domain, for example `you@getyourcompany.com` instead of `you@yourcompany.com`. [Why a separate domain?](/help/sending-domain)
- **A list of people to contact** as a CSV file, with at least an email column. A spreadsheet exported as CSV works.
- **Your postal address.** Anti-spam laws require one in every commercial email, and Pawpost won't start a campaign without it.

## Step 1: Connect a mailbox

1. Open **Mailboxes** in the sidebar and click **Connect mailbox**.
2. Choose your provider. Pawpost fills in the server settings for you.
3. Enter the email address, the name recipients should see (a real person's name works best), and the password. For Gmail and Google Workspace this must be an **App Password**, not your normal password. [How to create one](/help/mailboxes#google-workspace-and-gmail)
4. Leave the daily limit at **10** for a new mailbox. You can raise it later.
5. Click **Connect mailbox**. Pawpost logs in to check everything works before saving.

## Step 2: Import your contacts

1. Open **Contact lists**.
2. Give the list a name, choose your CSV file and click **Create list**.
3. Read the import summary. Pawpost skips duplicates, broken addresses and addresses that would bounce, and tells you why for each.

[More about contact lists and CSV files](/help/contact-lists)

## Step 3: Create a campaign and write your emails

1. Open **Campaigns** and click **New campaign**.
2. Name it, pick your list and click **Create campaign**.
3. On the **Sequence** tab, replace the example text with your own email. The preview on the right shows exactly what one of your contacts will receive.
4. Keep the follow-up (sent a few days later only if there's no reply), or remove it.
5. Click **Save sequence**.

Not sure what to write? With AI set up, **Write with AI** drafts a sequence for you. [Writing good emails](/help/writing-emails)

## Step 4: Set the schedule and your address

On the **Settings** tab:

1. Set the **timezone** of the people you're emailing, and the days and hours to send.
2. Check which **mailboxes** should send this campaign.
3. Enter your **postal address**.
4. Click **Save settings**.

## Step 5: Start

At the top of the campaign, a **Before you can start** box lists anything still missing (red). Amber items are advice — you can still start. When the red items are gone, click **Start** and confirm.

Pawpost then sends a few emails at a time within your schedule and mailbox limits. You can follow progress on the campaign's **Overview** and **Contacts** tabs.

> [!IMPORTANT]
> Emails are only sent while the **worker** is running. The sidebar shows "Worker online" when it is. If it says offline, see [Troubleshooting](/help/troubleshooting#the-worker-is-offline).

## What happens next

- **Replies** arrive in your normal mailbox, like any email. Pawpost notices them, stops the sequence for that person, and lists people who need a look under **Replies** in the sidebar.
- **Bounces** (addresses that don't exist) and **unsubscribes** are added to your [suppression list](/help/replies-and-bounces#the-suppression-list) automatically, so those addresses are never emailed again.
- If too many emails bounce, the campaign **pauses itself** so your sending reputation isn't damaged.

Next, read [How sending works](/help/how-sending-works) to understand the timing, or [Deliverability](/help/deliverability) to make sure your emails reach the inbox.
