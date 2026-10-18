/**
 * Role-based permissions. The single source of truth for both the server (which
 * enforces them) and the UI (which hides what you can't do). Client-safe.
 */

export type Role = "owner" | "admin" | "member";

export const ROLES: readonly Role[] = ["owner", "admin", "member"];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full access, including managing admins. One per installation.",
  admin: "Full access: team, mailboxes, settings, exports, audit log and privacy tools.",
  member: "Day-to-day work: contact lists, contacts and campaigns.",
};

const GRANTS = {
  /** Invite, change roles, disable or remove users, issue password reset links. */
  "team.manage": ["owner", "admin"],
  /** Connect, edit, pause and remove sending mailboxes. */
  "mailboxes.manage": ["owner", "admin"],
  /** Instance settings such as AI. */
  "settings.manage": ["owner", "admin"],
  "audit.view": ["owner", "admin"],
  /** Download lists, campaign results, suppressions and the audit log as CSV. */
  "data.export": ["owner", "admin"],
  /** Erase a person's data everywhere. */
  "data.erase": ["owner", "admin"],
  /** Delete items from the trash permanently. */
  "trash.purge": ["owner", "admin"],
  /** Remove addresses from the suppression list. */
  "suppressions.remove": ["owner", "admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof GRANTS;

export function can(role: Role, permission: Permission): boolean {
  return (GRANTS[permission] as readonly Role[]).includes(role);
}

/** Whether `actor` may change `target`'s role, status or password. */
export function canManageUser(actor: { id: string; role: Role }, target: { id: string; role: Role }): boolean {
  if (actor.id === target.id) return false; // use the account page for yourself
  if (!can(actor.role, "team.manage")) return false;
  if (target.role === "owner") return false;
  return actor.role === "owner" || target.role === "member" || target.role === "admin";
}
