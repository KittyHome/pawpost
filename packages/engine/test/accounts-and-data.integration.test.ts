/**
 * Accounts, roles, data management, trash, privacy erase, exports and audit,
 * against a real Postgres.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createEngine, type Actor, type Engine } from "../src";
import { controllableClock, scriptedInbox, startTestDatabase } from "./support";

const DAY = 24 * 60 * 60 * 1000;
const meta = { ip: "203.0.113.7", userAgent: "vitest" };

describe("accounts and data management", () => {
  let database: Awaited<ReturnType<typeof startTestDatabase>>;
  let engine: Engine;
  const clock = controllableClock(new Date("2026-10-13T10:00:00Z"));
  let owner: Actor;
  let admin: Actor;
  let member: Actor;
  let memberToken = "";
  let listId = "";

  const actorOf = (user: { id: string; email: string; name: string; role: Actor["role"] }): Actor => ({ ...user, ip: meta.ip });

  beforeAll(async () => {
    database = await startTestDatabase();
    engine = createEngine({
      db: database.db,
      appSecret: "test-secret-that-is-at-least-32-characters",
      appUrl: "https://pawpost.test",
      inbox: scriptedInbox().reader,
      checkDomains: async (domains) => new Map([...domains].map((d) => [d, "ok"] as const)),
      clock: clock.now,
    });
  }, 120_000);

  afterAll(async () => {
    engine?.close();
    await database?.stop();
  });

  describe("setup and sign-in", () => {
    it("creates the owner once, with a strong password", async () => {
      expect(await engine.accounts.hasUsers()).toBe(false);
      await expect(
        engine.accounts.setupOwner({ name: "Olivia", email: "owner@x.test", password: "short" }, meta),
      ).rejects.toThrow(/10 characters/);
      const { user, token } = await engine.accounts.setupOwner(
        { name: "Olivia", email: "Owner@X.test", password: "tulip-orbit-cadence" },
        meta,
      );
      expect(user).toMatchObject({ email: "owner@x.test", role: "owner" });
      expect(user).not.toHaveProperty("passwordHash");
      expect((await engine.accounts.authenticate(token))?.user.id).toBe(user.id);
      owner = actorOf(user);

      await expect(
        engine.accounts.setupOwner({ name: "Mallory", email: "m@x.test", password: "another-strong-pass" }, meta),
      ).rejects.toThrow(/already set up/);
      expect(await engine.accounts.bootstrapOwner({ email: "env@x.test", password: "x" })).toBe(false);
    });

    it("rejects wrong passwords the same way for known and unknown emails", async () => {
      await expect(engine.accounts.signIn({ email: "owner@x.test", password: "wrong-password" }, meta)).rejects.toThrow(
        "Wrong email or password.",
      );
      await expect(engine.accounts.signIn({ email: "nobody@x.test", password: "wrong-password" }, meta)).rejects.toThrow(
        "Wrong email or password.",
      );
      const { token, user } = await engine.accounts.signIn({ email: "owner@x.test", password: "tulip-orbit-cadence" }, meta);
      expect(user).not.toHaveProperty("passwordHash");
      expect(await engine.accounts.authenticate(token)).not.toBeNull();
      await engine.accounts.signOut(token);
      expect(await engine.accounts.authenticate(token)).toBeNull();
    });

    it("expires sessions after 30 idle days", async () => {
      const { token } = await engine.accounts.signIn({ email: "owner@x.test", password: "tulip-orbit-cadence" }, meta);
      clock.advance(31 * DAY);
      expect(await engine.accounts.authenticate(token)).toBeNull();
    });
  });

  describe("team", () => {
    it("invites teammates who join with their own password", async () => {
      const adminInvite = await engine.accounts.invite(owner, { email: "ada@x.test", role: "admin" });
      expect(adminInvite).toMatchObject({ emailed: false });
      expect(adminInvite.url).toMatch(/^https:\/\/pawpost\.test\/invite\/[\w-]{40,}$/);
      const adminToken = adminInvite.url.split("/").pop()!;
      expect(await engine.accounts.lookupInvitation(adminToken)).toMatchObject({ email: "ada@x.test", role: "admin" });
      const joinedAdmin = await engine.accounts.acceptInvitation(
        adminToken,
        { name: "Ada", password: "lantern-meadow-42" },
        meta,
      );
      admin = actorOf(joinedAdmin.user);
      await expect(
        engine.accounts.acceptInvitation(adminToken, { name: "Again", password: "lantern-meadow-42" }, meta),
      ).rejects.toThrow(/no longer valid/);

      const memberInvite = await engine.accounts.invite(admin, { email: "max@x.test", role: "member" });
      const joinedMember = await engine.accounts.acceptInvitation(
        memberInvite.url.split("/").pop()!,
        { name: "Max", password: "harbor-violet-77" },
        meta,
      );
      member = actorOf(joinedMember.user);
      memberToken = joinedMember.token;
      expect((await engine.accounts.listUsers()).map((u) => [u.email, u.role])).toEqual([
        ["owner@x.test", "owner"],
        ["ada@x.test", "admin"],
        ["max@x.test", "member"],
      ]);
    });

    it("enforces roles", async () => {
      await expect(engine.accounts.invite(member, { email: "eve@x.test", role: "member" })).rejects.toThrow(/Only admins/);
      await expect(engine.accounts.changeRole(admin, owner.id, { role: "member" })).rejects.toThrow(/can't change this user/);
      await expect(engine.accounts.changeRole(admin, member.id, { role: "owner" })).rejects.toThrow(/Only the owner/);
      await expect(engine.accounts.setDisabled(admin, admin.id, true)).rejects.toThrow(/account page/);
      await expect(engine.suppressions.exportCsv(member)).rejects.toThrow(/Only admins can export/);
      await expect(engine.trash.empty(member)).rejects.toThrow(/permanently/);
    });

    it("disabling a user signs them out and blocks sign-in", async () => {
      await engine.accounts.setDisabled(admin, member.id, true);
      expect(await engine.accounts.authenticate(memberToken)).toBeNull();
      await expect(engine.accounts.signIn({ email: "max@x.test", password: "harbor-violet-77" }, meta)).rejects.toThrow(
        /disabled/,
      );
      await engine.accounts.setDisabled(admin, member.id, false);
    });

    it("locks an account after ten failed attempts", async () => {
      for (let i = 0; i < 10; i++) {
        await expect(engine.accounts.signIn({ email: "max@x.test", password: `guess-${i}-xxxx` }, meta)).rejects.toThrow();
      }
      await expect(engine.accounts.signIn({ email: "max@x.test", password: "harbor-violet-77" }, meta)).rejects.toThrow(
        /15 minutes/,
      );
      clock.advance(16 * 60 * 1000);
      memberToken = (await engine.accounts.signIn({ email: "max@x.test", password: "harbor-violet-77" }, meta)).token;
    });

    it("resets a forgotten password with an admin link and revokes old sessions", async () => {
      const { url } = await engine.accounts.createResetLink(admin, member.id);
      const token = url.split("/").pop()!;
      expect(await engine.accounts.lookupReset(token)).toEqual({ email: "max@x.test" });
      await engine.accounts.resetPassword(token, { password: "new-harbor-violet-88" }, meta);
      expect(await engine.accounts.authenticate(memberToken)).toBeNull();
      await expect(engine.accounts.resetPassword(token, { password: "again-harbor-violet" }, meta)).rejects.toThrow(
        /no longer valid/,
      );
      memberToken = (await engine.accounts.signIn({ email: "max@x.test", password: "new-harbor-violet-88" }, meta)).token;
    });

    it("changes your own password only with the current one", async () => {
      const session = await engine.accounts.authenticate(memberToken);
      await expect(
        engine.accounts.changePassword(
          member,
          { currentPassword: "nope", newPassword: "fresh-garden-path-1" },
          session!.sessionId,
        ),
      ).rejects.toThrow(/current password is wrong/);
      await engine.accounts.changePassword(
        member,
        { currentPassword: "new-harbor-violet-88", newPassword: "fresh-garden-path-1" },
        session!.sessionId,
      );
      expect(await engine.accounts.authenticate(memberToken)).not.toBeNull(); // the current session survives
    });

    it("transfers ownership", async () => {
      await engine.accounts.changeRole(owner, admin.id, { role: "owner" });
      const roles = Object.fromEntries((await engine.accounts.listUsers()).map((u) => [u.email, u.role]));
      expect(roles).toMatchObject({ "ada@x.test": "owner", "owner@x.test": "admin" });
      await engine.accounts.changeRole({ ...admin, role: "owner" }, owner.id, { role: "owner" });
    });
  });

  describe("contacts", () => {
    it("adds, edits, rejects duplicates, sorts and filters", async () => {
      const report = await engine.lists.createFromCsv(
        member,
        "Leads",
        ["email,first_name,company", "zoe@a.test,Zoe,Acme", "amy@b.test,Amy,", "bo@c.test,Bo,Corp"].join("\n"),
      );
      listId = report.listId;
      const added = await engine.lists.addContact(member, listId, {
        email: "Carl@D.test",
        firstName: "Carl",
        attributes: { Tier: "gold", Empty: "" },
      });
      expect(added).toMatchObject({ email: "carl@d.test", attributes: { Tier: "gold" } });
      expect((await engine.lists.get(listId)).attributeColumns).toContain("Tier");
      await expect(engine.lists.addContact(member, listId, { email: "carl@d.test" })).rejects.toThrow(/already in this list/);

      await engine.lists.updateContact(member, added.id, { email: "carl@d.test", firstName: "Carlos", company: "Delta" });
      const byName = await engine.lists.contacts(listId, { sort: "name", dir: "asc" });
      expect(byName.rows.map((c) => c.firstName)).toEqual(["Amy", "Bo", "Carlos", "Zoe"]);
      const search = await engine.lists.contacts(listId, { search: "delta" });
      expect(search.rows.map((c) => c.email)).toEqual(["carl@d.test"]);
    });

    it("bulk suppresses, copies, moves and trashes", async () => {
      const all = (await engine.lists.contacts(listId)).rows;
      const id = (email: string) => all.find((c) => c.email === email)!.id;

      expect(await engine.lists.suppressContacts(member, [id("bo@c.test")])).toEqual({ affected: 1, skipped: 0 });
      expect((await engine.lists.contacts(listId, { status: "suppressed" })).rows.map((c) => c.email)).toEqual(["bo@c.test"]);
      // The per-row flag shown in the table must match, too.
      const flags = Object.fromEntries((await engine.lists.contacts(listId)).rows.map((c) => [c.email, c.suppressed]));
      expect(flags).toEqual({ "amy@b.test": false, "bo@c.test": true, "carl@d.test": false, "zoe@a.test": false });

      const other = await engine.lists.createFromCsv(member, "Other", "email\nzoe@a.test");
      expect(await engine.lists.copyContacts(member, [id("zoe@a.test"), id("amy@b.test")], other.listId)).toEqual({
        affected: 1,
        skipped: 1,
      });
      expect(await engine.lists.moveContacts(member, [id("carl@d.test")], other.listId)).toEqual({ affected: 1, skipped: 0 });
      expect((await engine.lists.get(other.listId)).contactCount).toBe(3);

      expect(await engine.lists.trashContacts(member, [id("amy@b.test")])).toEqual({ affected: 1, skipped: 0 });
      expect((await engine.lists.contacts(listId)).rows.map((c) => c.email)).toEqual(["bo@c.test", "zoe@a.test"]);
    });

    it("creates an empty list and fills it by hand or by CSV", async () => {
      await expect(engine.lists.create(member, { name: "  " })).rejects.toThrow(/List name is required/);
      const empty = await engine.lists.create(member, { name: "Warm intros" });
      expect(await engine.lists.get(empty.id)).toMatchObject({ name: "Warm intros", contactCount: 0, attributeColumns: [] });

      await engine.lists.addContact(member, empty.id, { email: "kim@e.test", firstName: "Kim" });
      await engine.lists.importCsv(member, empty.id, "email,City\nlee@f.test,Oslo", { checkDomains: false });
      const filled = await engine.lists.get(empty.id);
      expect(filled).toMatchObject({ contactCount: 2, attributeColumns: ["City"] });
    });

    it("lets a trashed address be re-imported, and refuses a conflicting restore", async () => {
      await engine.lists.importCsv(member, listId, "email,first_name\namy@b.test,Amy Again", { checkDomains: false });
      const trashed = (await engine.trash.list()).contacts.find((c) => c.email === "amy@b.test")!;
      await expect(engine.trash.restore(member, "contact", trashed.id)).rejects.toThrow(/already back/);
    });
  });

  describe("trash", () => {
    it("protects lists in use and restores campaigns only with their list", async () => {
      const campaign = await engine.campaigns.create(member, { name: "Spring", listId });
      await expect(engine.lists.trash(member, listId)).rejects.toThrow(/used by a campaign/);

      await engine.campaigns.trash(member, campaign.id);
      const liveCount = (await engine.lists.get(listId)).contactCount;
      await engine.lists.trash(member, listId);
      expect((await engine.trash.list()).lists.find((l) => l.id === listId)?.contactCount).toBe(liveCount);
      expect(liveCount).toBeGreaterThan(0);
      expect((await engine.lists.list()).map((l) => l.id)).not.toContain(listId);
      await expect(engine.trash.restore(member, "campaign", campaign.id)).rejects.toThrow(/Restore its contact list/);
      await expect(engine.trash.purge(admin, "list", listId)).rejects.toThrow(/still used by the campaign "Spring"/);

      await engine.trash.restore(member, "list", listId);
      await engine.trash.restore(member, "campaign", campaign.id);
      expect((await engine.campaigns.list()).map((c) => c.name)).toContain("Spring");
    });

    it("purges items older than 30 days automatically", async () => {
      const copy = await engine.campaigns.duplicate(member, (await engine.campaigns.list())[0]!.id);
      await engine.campaigns.trash(member, copy.id);
      expect(await engine.trash.purgeExpired()).toMatchObject({ campaigns: 0 });
      clock.advance(31 * DAY);
      expect(await engine.trash.purgeExpired()).toMatchObject({ campaigns: 1, contacts: 1 });
      expect((await engine.trash.list()).campaigns.map((c) => c.id)).not.toContain(copy.id);
    });
  });

  describe("exports, erase and audit", () => {
    it("exports CSV with a BOM and neutralised formulas", async () => {
      await engine.lists.addContact(member, listId, { email: "evil@x.test", firstName: "=cmd|' /C calc'!A0" });
      const { filename, csv } = await engine.lists.exportCsv(admin, listId);
      expect(filename).toBe("leads-contacts.csv");
      expect(csv.startsWith("﻿email,first_name,last_name,company")).toBe(true);
      expect(csv).toContain("'=cmd");
      await expect(engine.lists.exportCsv(member, listId)).rejects.toThrow(/Only admins/);
    });

    it("erases a person everywhere but keeps them suppressed", async () => {
      const preview = await engine.privacy.preview(admin, "ZOE@a.test");
      expect(preview).toMatchObject({ email: "zoe@a.test", suppressed: false });
      expect(preview.lists.sort()).toEqual(["Leads", "Other"]);

      expect(await engine.privacy.erase(admin, "zoe@a.test")).toMatchObject({ contacts: 2 });
      expect(await engine.privacy.preview(admin, "zoe@a.test")).toMatchObject({ lists: [], suppressed: true });
      const report = await engine.lists.importCsv(member, listId, "email\nzoe@a.test", { checkDomains: false });
      expect(report.rejected.suppressed).toBe(1);
      await expect(engine.privacy.erase(member, "amy@b.test")).rejects.toThrow(/Only admins/);
    });

    it("records who did what", async () => {
      const { rows } = await engine.audit.list({ action: "contact" });
      const actions = rows.map((r) => r.action);
      expect(actions).toEqual(
        expect.arrayContaining(["contact.created", "contact.updated", "contact.moved", "contact.trashed", "contact.erased"]),
      );
      const erased = rows.find((r) => r.action === "contact.erased")!;
      expect(erased.actorEmail).toBe("ada@x.test");
      expect(erased.summary).toContain("zo•@a.test");
      expect(erased.summary).not.toContain("zoe@a.test");
      expect(erased.ipAddress).toBe(meta.ip);

      const security = await engine.audit.list({ action: "auth" });
      expect(security.rows.map((r) => r.action)).toEqual(
        expect.arrayContaining(["auth.login", "auth.login_failed", "auth.locked"]),
      );
      expect(await engine.audit.exportCsv({ action: "user" })).toMatch(/^﻿Time \(UTC\),User,Action/);
    });
  });
});
