import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* -------------------------------------------------------------------------- */
/* Mailboxes: the user's own sending accounts (Google Workspace, M365, SMTP). */
/* -------------------------------------------------------------------------- */

export const mailboxStatus = pgEnum("mailbox_status", ["active", "paused", "error"]);

export const mailboxes = pgTable("mailboxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  fromName: text("from_name").notNull(),

  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull(),
  smtpSecure: boolean("smtp_secure").notNull(),
  smtpUsername: text("smtp_username").notNull(),
  /** AES-256-GCM, see @pawpost/core secrets. */
  smtpPasswordEnc: text("smtp_password_enc").notNull(),

  imapHost: text("imap_host").notNull(),
  imapPort: integer("imap_port").notNull(),
  imapSecure: boolean("imap_secure").notNull(),
  imapUsername: text("imap_username").notNull(),
  imapPasswordEnc: text("imap_password_enc").notNull(),

  /** Max emails in any rolling 24 hours. */
  dailyLimit: integer("daily_limit").notNull().default(30),
  /** Minimum gap between two sends; jitter is added on top. */
  minIntervalSeconds: integer("min_interval_seconds").notNull().default(180),

  status: mailboxStatus("status").notNull().default("active"),
  lastError: text("last_error"),
  /** Send slot: the dispatcher claims a mailbox by moving this forward atomically. */
  nextSendAt: timestamp("next_send_at", { withTimezone: true }),

  imapUidValidity: bigint("imap_uid_validity", { mode: "number" }),
  imapLastUid: bigint("imap_last_uid", { mode: "number" }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* -------------------------------------------------------------------------- */
/* Contacts                                                                   */
/* -------------------------------------------------------------------------- */

export const contactLists = pgTable("contact_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Attribute columns seen on import, offered as template variables. */
  attributeColumns: jsonb("attribute_columns").$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => contactLists.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    company: text("company"),
    attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("contacts_list_email_uq").on(t.listId, t.email), index("contacts_email_idx").on(t.email)],
);

/** Global do-not-contact list. Checked before every single send. */
export const suppressionReason = pgEnum("suppression_reason", ["unsubscribed", "bounced", "complained", "manual"]);

export const suppressions = pgTable("suppressions", {
  email: text("email").primaryKey(),
  reason: suppressionReason("reason").notNull(),
  note: text("note"),
  createdAt: createdAt(),
});

/* -------------------------------------------------------------------------- */
/* Campaigns                                                                  */
/* -------------------------------------------------------------------------- */

export const campaignStatus = pgEnum("campaign_status", ["draft", "active", "paused", "completed"]);

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: campaignStatus("status").notNull().default("draft"),
  listId: uuid("list_id")
    .notNull()
    .references(() => contactLists.id, { onDelete: "restrict" }),

  timezone: text("timezone").notNull().default("UTC"),
  /** ISO weekdays, 1 = Monday. */
  sendDays: integer("send_days")
    .array()
    .notNull()
    .default(sql`'{1,2,3,4,5}'::integer[]`),
  windowStartMinute: integer("window_start_minute")
    .notNull()
    .default(9 * 60),
  windowEndMinute: integer("window_end_minute")
    .notNull()
    .default(17 * 60),

  postalAddress: text("postal_address").notNull().default(""),
  stopOnReply: boolean("stop_on_reply").notNull().default(true),
  pauseReason: text("pause_reason"),

  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const campaignSteps = pgTable(
  "campaign_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    /** 0-based order in the sequence. */
    position: integer("position").notNull(),
    /** Days to wait after the previous step. Ignored for the first step. */
    waitDays: integer("wait_days").notNull().default(3),
    /** Empty on a follow-up means "reply in the same thread". */
    subject: text("subject").notNull().default(""),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("campaign_steps_position_uq").on(t.campaignId, t.position)],
);

export const campaignMailboxes = pgTable(
  "campaign_mailboxes",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    mailboxId: uuid("mailbox_id")
      .notNull()
      .references(() => mailboxes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.mailboxId] })],
);

/* -------------------------------------------------------------------------- */
/* Delivery                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * active      waiting for its next step (due at next_send_at)
 * sending     claimed by a dispatcher; SMTP in flight
 * completed   every step sent, no reply
 * replied / bounced / unsubscribed / suppressed   stopped early
 * failed      could not be sent; never retried automatically (avoids duplicates)
 */
export const enrollmentStatus = pgEnum("enrollment_status", [
  "active",
  "sending",
  "completed",
  "replied",
  "bounced",
  "unsubscribed",
  "suppressed",
  "failed",
]);

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    /** Sticky sender: assigned on the first send so follow-ups thread correctly. */
    mailboxId: uuid("mailbox_id").references(() => mailboxes.id, { onDelete: "set null" }),
    status: enrollmentStatus("status").notNull().default("active"),
    nextStep: integer("next_step").notNull().default(0),
    nextSendAt: timestamp("next_send_at", { withTimezone: true }).notNull().defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    unsubscribeToken: text("unsubscribe_token").notNull().unique(),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("enrollments_campaign_contact_uq").on(t.campaignId, t.contactId),
    index("enrollments_due_idx").on(t.status, t.nextSendAt),
    index("enrollments_campaign_status_idx").on(t.campaignId, t.status),
  ],
);

export const messageStatus = pgEnum("message_status", ["sent", "bounced"]);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    stepId: uuid("step_id").references(() => campaignSteps.id, { onDelete: "set null" }),
    /** Null once the mailbox is deleted; history is kept. */
    mailboxId: uuid("mailbox_id").references(() => mailboxes.id, { onDelete: "set null" }),
    stepPosition: integer("step_position").notNull(),
    /** RFC 5322 Message-ID including angle brackets; used to match replies and bounces. */
    rfcMessageId: text("rfc_message_id").notNull().unique(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    status: messageStatus("status").notNull().default("sent"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_mailbox_sent_idx").on(t.mailboxId, t.sentAt),
    index("messages_enrollment_idx").on(t.enrollmentId, t.stepPosition),
  ],
);

export const eventType = pgEnum("event_type", [
  "sent",
  "send_failed",
  "reply",
  "auto_reply",
  "bounce",
  "unsubscribe",
  "campaign_paused",
  "campaign_completed",
  "mailbox_error",
]);

/** Append-only activity log; drives the dashboard feed and campaign counters. */
export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: eventType("type").notNull(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id").references(() => enrollments.id, { onDelete: "cascade" }),
    mailboxId: uuid("mailbox_id").references(() => mailboxes.id, { onDelete: "set null" }),
    email: text("email"),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("events_campaign_type_idx").on(t.campaignId, t.type), index("events_created_idx").on(t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

/** Instance-wide settings managed in the UI, one JSON document per key (e.g. "ai"). */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedAt: updatedAt(),
});

export type Mailbox = typeof mailboxes.$inferSelect;
export type ContactList = typeof contactLists.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Suppression = typeof suppressions.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type CampaignStep = typeof campaignSteps.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Event = typeof events.$inferSelect;
export type EventType = (typeof eventType.enumValues)[number];
export type EnrollmentStatus = (typeof enrollmentStatus.enumValues)[number];
export type CampaignStatus = (typeof campaignStatus.enumValues)[number];
export type MailboxStatus = (typeof mailboxStatus.enumValues)[number];
export type SuppressionReason = (typeof suppressionReason.enumValues)[number];
