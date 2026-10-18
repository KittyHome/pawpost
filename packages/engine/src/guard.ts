import { DomainError } from "@pawpost/core";

import type { Actor } from "./context";
import { can, type Permission } from "./permissions";

const DENIED: Record<Permission, string> = {
  "team.manage": "Only admins can manage the team.",
  "mailboxes.manage": "Only admins can manage mailboxes.",
  "settings.manage": "Only admins can change settings.",
  "audit.view": "Only admins can view the audit log.",
  "data.export": "Only admins can export data.",
  "data.erase": "Only admins can erase personal data.",
  "trash.purge": "Only admins can delete items permanently.",
  "suppressions.remove": "Only admins can remove addresses from the suppression list.",
};

/** Throws a user-facing error unless the actor's role grants the permission. */
export function requirePermission(actor: Actor, permission: Permission): void {
  if (!can(actor.role, permission)) throw new DomainError("forbidden", DENIED[permission]);
}
