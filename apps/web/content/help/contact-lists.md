---
title: Contact lists and CSV import
description: Prepare a CSV file, import it, and understand why some rows are skipped.
category: setup
order: 3
keywords: csv, import, contacts, list, spreadsheet, excel, columns, upload, duplicates, role address, invalid, custom fields, attributes
---

A **contact list** is a group of people to email, imported from a CSV file. A campaign sends to one list.

## Preparing your CSV file

Any spreadsheet app (Excel, Google Sheets, Numbers) can save a sheet as CSV: use **File → Save as / Download → CSV**.

The first row must be column names. Pawpost recognises these (capitalisation and spaces don't matter):

| Column     | Accepted names                                                   | Required |
| ---------- | ---------------------------------------------------------------- | -------- |
| Email      | `email`, `e-mail`, `email address`, `mail`                       | Yes      |
| Full name  | `name`, `full name`, `contact name`                              | No       |
| First name | `first name`, `first_name`, `firstname`, `given name`            | No       |
| Last name  | `last name`, `last_name`, `surname`, `family name`               | No       |
| Company    | `company`, `company name`, `organization`, `organisation`, `org` | No       |

Example:

```
Name,Email,Company,City
Ann Smith,ann@example.com,Acme,Oslo
Bob Jones,bob@example.org,,Paris
```

If you have both a full-name column and first/last name columns, the first/last name columns are used.

### Custom fields

**Every other column** is kept as a custom field that you can use in your emails. In the example above, `City` becomes `{{City}}`. Use the column name exactly as written in the file, including capitals. [Using fields in emails](/help/writing-emails#personalising-with-fields)

### Names

Pawpost tidies names: "ANN SMITH" becomes "Ann Smith". Values that look like usernames rather than names (such as "bob77" or "jsmith") are left blank, so your email says "Hi there" instead of "Hi bob77".

## Importing

1. Go to **Contact lists**.
2. Enter a **list name** and choose the **CSV file** (up to 10 MB, 100,000 rows).
3. Choose the checks (both are recommended):
   - **Check that each domain can receive mail**: looks up each email domain and skips those that can't receive email, such as misspelled domains that don't exist or companies that have closed.
   - **Skip role addresses**: skips shared inboxes like `info@`, `sales@`, `support@`, which rarely reply and often report spam.
4. Click **Create list**.

To add more contacts later, open the list and click **Import more**. People already in the list are skipped.

## Why rows are skipped

The import summary shows how many rows were skipped and why. Expand **Show skipped rows** to see each one with its line number in your file.

| Reason                    | Meaning                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| Invalid address           | Not a valid email address                                                  |
| Duplicate in file         | The same address appears earlier in the file                               |
| Role address              | A shared inbox such as info@ (when that check is on)                       |
| No email                  | The email column is empty on that row                                      |
| On suppression list       | This person unsubscribed or bounced before; they'll never be emailed again |
| Domain can't receive mail | The domain doesn't exist or doesn't accept email (when that check is on)   |

> [!TIP]
> Importing filters out obviously bad addresses, but it can't tell whether a mailbox at a valid domain still exists. For older or bought-in lists, run the file through an email verification service first. A bounce rate above 2% will pause your campaign.

## Viewing and searching a list

Open a list to see its contacts. Search by name or email. The status column shows **Suppressed** for anyone on the suppression list. They stay in the list for your records but are never emailed.

## Deleting a list

Open the list and click **Delete**. A list that a campaign uses can't be deleted; delete the campaign first.
