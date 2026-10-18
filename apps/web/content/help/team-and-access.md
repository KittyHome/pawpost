---
title: Team and access
description: Invite teammates, understand roles, manage your account, and recover access.
category: admin
order: 2
keywords: team, users, invite, invitation, roles, owner, admin, member, permissions, account, password, sessions, sign in, login, lockout, reset, disable, remove, transfer ownership
---

Pawpost is one shared workspace per installation. Everyone you invite works on the same campaigns, lists and mailboxes; what they can change depends on their role.

## Roles

|                                                                    | Owner | Admin             | Member |
| ------------------------------------------------------------------ | ----- | ----------------- | ------ |
| Campaigns, lists and contacts: create, edit, start, pause          | ✓     | ✓                 | ✓      |
| Restore things from the trash                                      | ✓     | ✓                 | ✓      |
| Add addresses to the suppression list                              | ✓     | ✓                 | ✓      |
| See mailboxes                                                      | ✓     | ✓                 | ✓      |
| Connect, edit, pause or remove mailboxes                           | ✓     | ✓                 |        |
| Invite teammates, change roles, disable or remove users            | ✓     | ✓ (not the owner) |        |
| AI settings                                                        | ✓     | ✓                 |        |
| Export data to CSV                                                 | ✓     | ✓                 |        |
| Erase a person, remove suppressions, delete from trash permanently | ✓     | ✓                 |        |
| View the audit log                                                 | ✓     | ✓                 |        |
| Transfer ownership                                                 | ✓     |                   |        |

There is always exactly one **owner**. Make admins of people you trust with settings and personal data; everyone else can be a **member**.

## First-time setup

The first time anyone opens Pawpost, it asks them to create the **owner account** (name, email, password). That page disappears as soon as an account exists.

> [!TIP]
> If whoever installs Pawpost sets `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the server configuration, the owner is created automatically instead, and there's no setup page at all. Sign in, then change the password on your **Account** page. [Configuration](/help/self-hosting#configuration-reference)

## Inviting teammates

1. Open **Settings → Team** and click **Invite teammate**.
2. Enter their email and choose **Member** or **Admin**.
3. Click **Create invitation** and copy the link.
4. Send them the link (chat, email, however you like). It works once and expires after 7 days.

When they open it, they choose their name and password and are signed straight in. If the installation has system email configured, the invitation is also emailed to them.

Pending invitations are listed under the team. Links are only shown when created; to send a new one, **Withdraw** the old invitation and invite again.

## Managing teammates

In **Settings → Team**, the **⋯** menu next to a person offers:

- **Change role**: takes effect immediately.
- **Reset password…**: creates a one-time link (valid 24 hours) to send them. Use this when someone forgets their password.
- **Disable**: signs them out everywhere and blocks sign-in, without deleting anything. **Re-enable** reverses it.
- **Remove from team**: deletes their account. Campaigns and lists they made stay, and the audit log keeps their email.
- **Make owner (transfer)**: owner only. They become the owner and you become an admin.

You can't change your own role or disable yourself; another admin or the owner can.

## Your account

Open **Account** from the menu under your name (bottom of the sidebar) to:

- change your **name** or **email** (you sign in with the new email afterwards),
- change your **password** (your other devices are signed out),
- see **signed-in devices** with their location (IP) and last activity, and **sign out** any you don't recognise.

Sessions last 30 days of inactivity. Using Pawpost keeps you signed in.

## Passwords and security

- Passwords need at least 10 characters. A few unrelated words make a strong, memorable password.
- After **10 wrong passwords** in a row, the account is locked for 15 minutes. An admin's reset link unlocks it immediately.
- Every sign-in, failed attempt and lockout is recorded in the [audit log](/help/managing-data#the-audit-log).

## Forgot your password?

- **If system email is configured:** click **Forgot password?** on the sign-in page and follow the link you receive (valid 1 hour).
- **Otherwise:** ask an admin to create a reset link for you in **Settings → Team**.
- **The owner is locked out and there's no other admin:** whoever runs the server can create a reset link from the command line:

```bash
pnpm user:reset-link owner@example.com
```
