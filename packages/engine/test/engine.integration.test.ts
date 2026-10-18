/**
 * End-to-end engine test against real Postgres and a real SMTP server.
 * Covers: mailbox verification, CSV import, campaign start, paced dispatch,
 * concurrent-claim safety, SMTP rejects, DSN bounces, AI-triaged replies,
 * threaded follow-ups, unsubscribe links and campaign completion.
 */
import { createMailSender } from "@pawpost/mail";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createEngine, type Engine } from "../src";
import { controllableClock, fakeAi, scriptedInbox, startSmtpServer, startTestDatabase } from "./support";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

describe("engine end to end", () => {
  let database: Awaited<ReturnType<typeof startTestDatabase>>;
  let smtp: Awaited<ReturnType<typeof startSmtpServer>>;
  let engine: Engine;
  const inbox = scriptedInbox();
  const ai = fakeAi({ reply_triage: { intent: "interested", summary: "Wants a call next week.", confidence: 0.9 } });
  // Tuesday 10:00 UTC.
  const clock = controllableClock(new Date("2026-10-13T10:00:00Z"));
  let campaignId = "";
  let mailboxId = "";

  beforeAll(async () => {
    [database, smtp] = await Promise.all([startTestDatabase(), startSmtpServer({ rejectRecipients: ["gone@acme.test"] })]);
    engine = createEngine({
      db: database.db,
      appSecret: "test-secret-that-is-at-least-32-characters",
      appUrl: "https://pawpost.test/",
      sender: createMailSender({ allowSelfSignedCertificates: true }),
      inbox: inbox.reader,
      checkDomains: async (domains) => new Map([...domains].map((d) => [d, d === "dead.test" ? "no_mail" : "ok"] as const)),
      clock: clock.now,
      ai: { provider: ai },
    });
  }, 120_000);

  afterAll(async () => {
    engine?.close();
    await Promise.all([smtp?.close(), database?.stop()]);
  });

  it("connects a mailbox only after SMTP and IMAP login succeed", async () => {
    const mailbox = await engine.mailboxes.create({
      email: "Sam@Send.Test",
      fromName: "Sam Lee",
      smtpHost: "127.0.0.1",
      smtpPort: smtp.port,
      smtpSecure: false,
      smtpUsername: "sam@send.test",
      smtpPassword: "app-password",
      imapHost: "127.0.0.1",
      imapPort: 993,
      imapSecure: "on",
      minIntervalSeconds: 60,
      dailyLimit: 50,
    });
    mailboxId = mailbox.id;
    expect(mailbox.email).toBe("sam@send.test");
    expect(mailbox.smtpPasswordEnc).not.toContain("app-password");
  });

  it("imports a CSV, rejecting unusable rows with reasons", async () => {
    const list = await engine.lists.create({ name: "Test list" });
    const report = await engine.lists.importCsv(
      list.id,
      [
        "Name,Email,City",
        "Ann Smith,ann@acme.test,Oslo",
        "bob77,bob@acme.test,",
        "Cat Jones,cat@acme.test,",
        "Gone,gone@acme.test,",
        "Dead,x@dead.test,",
        "Info,info@acme.test,",
        "Ann again,ANN@acme.test,",
      ].join("\n"),
    );
    expect(report).toMatchObject({
      imported: 4,
      rejected: { duplicate: 1, role_address: 1, no_mail_domain: 1, invalid_email: 0, suppressed: 0 },
      attributeColumns: ["City"],
    });
    expect(report.rejectedSample.map((r) => r.line)).toEqual([6, 7, 8]);

    const campaign = await engine.campaigns.create({ name: "Launch", listId: list.id });
    campaignId = campaign.id;
  });

  it("refuses to start until compliance and copy checks pass", async () => {
    await expect(engine.campaigns.start(campaignId)).rejects.toThrow(/postal address/);
    const check = await engine.campaigns.preflight(campaignId);
    expect(check.errors.join("\n")).toMatch(/placeholder text/);
  });

  it("starts and sends at most one email per mailbox per slot, even with parallel workers", async () => {
    await engine.campaigns.updateSettings(campaignId, {
      name: "Launch",
      listId: (await engine.campaigns.get(campaignId)).listId,
      timezone: "UTC",
      sendDays: [1, 2, 3, 4, 5, 6, 7],
      windowStart: "00:00",
      windowEnd: "24:00",
      postalAddress: "1 Main St, Springfield",
      stopOnReply: "on",
      mailboxIds: [mailboxId],
    });
    await engine.campaigns.saveSteps(campaignId, [
      {
        subject: "Idea for {{company|your team}}",
        body: "Hi {{firstName|there}},\n\nOne question about {{City|your city}}.\n\n{{senderFirstName}}",
        waitDays: 0,
      },
      { subject: "", body: "Hi {{firstName|there}}, following up once.", waitDays: 4 },
    ]);
    expect(await engine.campaigns.start(campaignId)).toEqual({ enrolled: 4 });

    const [a, b] = await Promise.all([engine.dispatch(), engine.dispatch()]);
    expect(a.sent + a.bounced + b.sent + b.bounced).toBe(1);

    // Each later slot needs the minimum gap (60s, plus up to 50% jitter).
    for (let i = 0; i < 5; i++) {
      clock.advance(2 * MINUTE);
      await engine.dispatch();
    }
    const stats = (await engine.campaigns.get(campaignId)).stats;
    expect(stats.emailsSent).toBe(3);
    expect(stats.bounces).toBe(1); // gone@ rejected at RCPT
    expect(smtp.received).toHaveLength(3);
  });

  it("writes compliant, personalised plain-text emails", () => {
    const ann = smtp.received.find((m) => m.to.includes("ann@acme.test"))!;
    expect(ann.subject).toBe("Idea for your team");
    expect(ann.text).toContain("Hi Ann,\n\nOne question about Oslo.\n\nSam");
    expect(ann.text).toContain("1 Main St, Springfield");
    expect(ann.text).toMatch(/Unsubscribe here: https:\/\/pawpost\.test\/u\/\w+/);
    expect(ann.rawHeaders["list-unsubscribe"]).toMatch(
      /^<https:\/\/pawpost\.test\/api\/unsubscribe\/\w+>, <mailto:sam@send\.test\?subject=unsubscribe>$/,
    );
    expect(ann.rawHeaders["list-unsubscribe-post"]).toBe("List-Unsubscribe=One-Click");

    const bob = smtp.received.find((m) => m.to.includes("bob@acme.test"))!;
    expect(bob.text).toContain("Hi there,"); // "bob77" is a handle, not a name
  });

  it("stops sequences on replies and bounces found in the inbox", async () => {
    await engine.syncInboxes(); // first sync only positions the cursor
    const ann = smtp.received.find((m) => m.to.includes("ann@acme.test"))!;
    const cat = smtp.received.find((m) => m.to.includes("cat@acme.test"))!;

    inbox.deliver({
      from: "ann@acme.test",
      subject: `Re: ${ann.subject}`,
      inReplyTo: ann.messageId,
      references: [ann.messageId],
      headers: {},
      contentType: "text/plain",
      text: "Sounds good, call me next week.\n\nOn Tue, Sam wrote:\n> Not interested? Unsubscribe here",
      raw: "",
    });
    inbox.deliver({
      from: "mailer-daemon@googlemail.com",
      subject: "Delivery Status Notification (Failure)",
      inReplyTo: null,
      references: [],
      headers: {},
      contentType: 'multipart/report; report-type="delivery-status"',
      text: "",
      raw: `Final-Recipient: rfc822; cat@acme.test\nAction: failed\nStatus: 5.1.1\n\nMessage-ID: ${cat.messageId}\n`,
    });

    clock.advance(3 * MINUTE);
    const sync = await engine.syncInboxes();
    expect(sync).toMatchObject({ processed: 2, replies: 1, bounces: 1, errors: 0 });
    expect(ai.calls.map((c) => c.task)).toEqual(["reply_triage"]);

    const { rows } = await engine.campaigns.enrollments(campaignId);
    const status = Object.fromEntries(rows.map((r) => [r.email, r.status]));
    expect(status).toEqual({
      "ann@acme.test": "replied",
      "bob@acme.test": "active",
      "cat@acme.test": "bounced",
      "gone@acme.test": "bounced",
    });

    const activity = await engine.stats.recentActivity({ campaignId });
    expect(activity.find((e) => e.type === "reply")?.detail).toMatchObject({
      intent: "interested",
      summary: "Wants a call next week.",
    });

    const suppressed = await engine.suppressions.list();
    expect(suppressed.rows.map((s) => [s.email, s.reason]).sort()).toEqual([
      ["cat@acme.test", "bounced"],
      ["gone@acme.test", "bounced"],
    ]);
  });

  it("sends the follow-up in the same thread once it is due", async () => {
    clock.advance(DAY);
    expect((await engine.dispatch()).sent).toBe(0); // not due yet

    clock.advance(3 * DAY + 10 * MINUTE);
    expect((await engine.dispatch()).sent).toBe(1);
    const [first, followUp] = smtp.received.filter((m) => m.to.includes("bob@acme.test"));
    expect(followUp!.subject).toBe(`Re: ${first!.subject}`);
    expect(followUp!.inReplyTo).toBe(first!.messageId);
  });

  it("completes the campaign and honours unsubscribe links idempotently", async () => {
    clock.advance(5 * MINUTE);
    const summary = await engine.dispatch();
    expect(summary.completedCampaigns).toEqual([campaignId]);
    expect((await engine.campaigns.get(campaignId)).status).toBe("completed");

    const bobToken = /\/u\/(\w+)/.exec(smtp.received.find((m) => m.to.includes("bob@acme.test"))!.text)![1]!;
    expect(await engine.suppressions.lookupToken(bobToken)).toEqual({ maskedEmail: "bo•@acme.test", alreadyUnsubscribed: false });
    expect(await engine.suppressions.unsubscribeByToken(bobToken, "one_click")).toBe(true);
    expect(await engine.suppressions.unsubscribeByToken(bobToken, "link")).toBe(true);
    expect((await engine.campaigns.get(campaignId)).stats.unsubscribes).toBe(1);
    expect(await engine.suppressions.unsubscribeByToken("not-a-real-token-123456", "link")).toBe(false);
  });
});
