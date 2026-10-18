/** Audit log filter areas: action prefixes as written by the engine. Shared by the server page and the client filters. */
export const AUDIT_AREAS = [
  { value: "auth", label: "Sign-ins & sessions" },
  { value: "user", label: "Team & accounts" },
  { value: "campaign", label: "Campaigns" },
  { value: "list", label: "Lists" },
  { value: "contact", label: "Contacts" },
  { value: "mailbox", label: "Mailboxes" },
  { value: "suppression", label: "Suppression list" },
  { value: "settings", label: "Settings" },
  { value: "trash", label: "Trash" },
] as const;
