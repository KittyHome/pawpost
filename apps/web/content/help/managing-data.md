---
title: Managing data
description: Edit contacts, bulk actions, exports, the trash, erasing a person, and the audit log.
category: admin
order: 3
keywords: contacts, edit, add contact, bulk, select, move, copy, suppress, delete, trash, restore, recover, export, csv, download, gdpr, erase, right to be forgotten, privacy, audit log, history
---

## Working with contacts

Open a list from **Contact lists**.

- **Add contact** adds one person by hand.
- Click **⋯ → Edit** on a row to change someone's details or custom fields. Changes apply to future emails, including in running campaigns.
- Click a column heading (**Email**, **Name**, **Company**) to sort; click again to reverse.
- Use **All / Active / Suppressed** and the search box to filter.

### Bulk actions

Tick the boxes next to contacts (or the box in the header to select the whole page). A bar appears with:

| Action            | What it does                                                                       |
| ----------------- | ---------------------------------------------------------------------------------- |
| **Move**          | Moves them to another list. Anyone already in that list stays where they are.      |
| **Copy**          | Copies them into another list, skipping anyone already there.                      |
| **Suppress**      | Adds their addresses to the suppression list: no campaign will email them again.   |
| **Move to trash** | Removes them from the list; restorable for 30 days. Their running sequences pause. |

### Lists

From a list's **⋯** menu you can **Rename** it, **Export CSV** (admins), or **Move to trash**. A list that a campaign uses can't be deleted; delete the campaign first.

## Exports

Admins can download CSV files that open in Excel, Google Sheets or Numbers:

| Export                                                       | Where                                 |
| ------------------------------------------------------------ | ------------------------------------- |
| A list's contacts, with custom fields and suppression status | List → **⋯ → Export CSV**             |
| A campaign's results: each contact's status and emails sent  | Campaign → **⋯ → Export results**     |
| The suppression list                                         | **Suppression list → Export CSV**     |
| The audit log, with the current filters                      | **Settings → Audit log → Export CSV** |

Every export is recorded in the audit log. Values that a spreadsheet would treat as a formula are made safe automatically.

## Trash

Deleting a campaign, list or contact moves it to the **Trash** (in the sidebar) instead of deleting it straight away.

- **Restore** puts it back exactly as it was. A campaign can only be restored if its list isn't also in the trash; restore the list first.
- Items are **deleted permanently after 30 days**, automatically.
- Admins can **Delete** single items permanently or **Empty trash**.

> [!NOTE]
> Contacts in the trash don't receive emails. If you restore them, their sequence carries on where it stopped.

## Erasing a person

When someone asks you to delete their data (for example under GDPR's "right to erasure"):

1. Open **Settings → Privacy & data** (admins).
2. Enter their email address and click **Look up** to see where they appear: which lists, which campaigns, and how many sent emails.
3. Click **Erase** and confirm.

Pawpost deletes them from every list (including the trash), every campaign's history, sent-email records and activity. Only the **suppression list entry** is kept, so that they're never emailed again; that's the minimum needed to honour their request. Erasure can't be undone.

## The audit log

**Settings → Audit log** (admins) records who did what and when:

- sign-ins, failed attempts, lockouts and password changes,
- invitations, role changes, disabled and removed users,
- campaigns created, edited, started, paused or deleted,
- lists and contacts created, imported, edited, moved, exported, trashed, restored or erased,
- mailbox and settings changes.

Each entry shows the person, their IP address and a plain-language summary. Filter by area or person, and export what you see as CSV. Entries can't be edited or deleted from the app.
