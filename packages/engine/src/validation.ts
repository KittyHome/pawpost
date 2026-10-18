/**
 * Input schemas for every write operation. The web app parses form data with
 * these, so validation rules live in one place. Client-safe: no Node imports.
 */
import { z } from "zod";

const trimmed = (max = 500) => z.string().trim().max(max);
const required = (label: string, max = 500) => trimmed(max).min(1, `${label} is required.`);
const port = z.coerce.number().int().min(1).max(65535);
/** HTML checkboxes submit "on" or nothing. */
const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());
const optionalSecret = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

export const mailboxInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  fromName: required("Sender name", 100),
  smtpHost: required("SMTP host", 253),
  smtpPort: port,
  smtpSecure: checkbox,
  smtpUsername: required("SMTP username", 320),
  /** Optional on update: blank keeps the stored password. */
  smtpPassword: optionalSecret,
  imapHost: required("IMAP host", 253),
  imapPort: port,
  imapSecure: checkbox,
  /** Blank = same as SMTP username. */
  imapUsername: trimmed(320).optional(),
  /** Blank = same as SMTP password. */
  imapPassword: optionalSecret,
  dailyLimit: z.coerce.number().int().min(1, "At least 1 email per day.").max(500, "500 per day is the maximum.").default(30),
  minIntervalSeconds: z.coerce.number().int().min(30, "Wait at least 30 seconds between sends.").max(3600).default(180),
});
export type MailboxInput = z.infer<typeof mailboxInput>;

export const listInput = z.object({
  name: required("List name", 120),
});

export const importContactsInput = z.object({
  skipRoleAddresses: checkbox.default(true),
  checkDomains: checkbox.default(true),
});
export type ImportContactsOptions = z.infer<typeof importContactsInput>;

const timeOfDay = z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:MM.");

export const campaignCreateInput = z.object({
  name: required("Campaign name", 120),
  listId: z.uuid("Choose a contact list."),
});
export type CampaignCreateInput = z.infer<typeof campaignCreateInput>;

export const campaignSettingsInput = z.object({
  name: required("Campaign name", 120),
  listId: z.uuid("Choose a contact list."),
  timezone: required("Timezone", 64),
  sendDays: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Pick at least one sending day."),
  windowStart: timeOfDay,
  windowEnd: timeOfDay,
  postalAddress: trimmed(300),
  stopOnReply: checkbox,
  mailboxIds: z.array(z.uuid()).default([]),
});
export type CampaignSettingsInput = z.infer<typeof campaignSettingsInput>;

export const stepInput = z.object({
  subject: trimmed(200),
  body: z
    .string()
    .max(10_000)
    .refine((v) => v.trim().length > 0, "Email body is required."),
  /** Ignored for the first email. */
  waitDays: z.coerce.number().int().min(0).max(60),
});
export const stepsInput = z
  .array(stepInput)
  .min(1, "Add at least one email.")
  .max(10, "Up to 10 emails per sequence.")
  .superRefine((steps, issue) => {
    steps.forEach((step, i) => {
      if (i > 0 && step.waitDays < 1)
        issue.addIssue({ code: "custom", path: [i, "waitDays"], message: `Email ${i + 1}: wait at least 1 day.` });
    });
  });
export type StepInput = z.infer<typeof stepInput>;

export const aiSettingsInput = z.object({
  model: required("Model", 100),
  /** Blank keeps the saved key. */
  apiKey: optionalSecret,
  removeKey: checkbox.default(false),
  classifyReplies: checkbox,
});

export const suppressionInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  note: trimmed(300).optional(),
});

/* -------------------------------------------------------------------------- */
/* Accounts                                                                   */
/* -------------------------------------------------------------------------- */

const emailField = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));
const nameField = required("Name", 100);
/** Strength rules are checked on the server (see core passwordProblem). */
const newPassword = z.string().min(1, "Choose a password.").max(200, "Use at most 200 characters.");
const roleField = z.enum(["admin", "member"], { message: "Choose a role." });

export const setupInput = z.object({
  name: nameField,
  email: emailField,
  password: newPassword,
  setupToken: z.string().optional(),
});

export const signInInput = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password.").max(200),
});

export const profileInput = z.object({
  name: nameField,
  email: emailField,
});

export const changePasswordInput = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword,
});

export const inviteInput = z.object({
  email: emailField,
  role: roleField,
});

export const acceptInviteInput = z.object({
  name: nameField,
  password: newPassword,
});

export const resetPasswordInput = z.object({
  password: newPassword,
});

export const roleChangeInput = z.object({
  role: z.enum(["owner", "admin", "member"]),
});

/* -------------------------------------------------------------------------- */
/* Contacts                                                                   */
/* -------------------------------------------------------------------------- */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const contactInput = z.object({
  email: emailField,
  firstName: optionalText(100),
  lastName: optionalText(100),
  company: optionalText(200),
  /** Custom fields, keyed by column name. Empty values are dropped. */
  attributes: z
    .record(z.string().trim().min(1).max(100), z.string().trim().max(1000))
    .default({})
    .transform((a) => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== ""))),
});
export type ContactInput = z.infer<typeof contactInput>;

export const contactSort = z.enum(["email", "name", "company", "created"]).catch("email");
export const sortDirection = z.enum(["asc", "desc"]).catch("asc");
