/**
 * Accounts: first-run setup, sign-in, server-side sessions, profile, team
 * invitations, roles and password resets. One organisation per installation.
 *
 * Security notes
 *  - Passwords: scrypt with a per-user salt (core/passwords).
 *  - Session, invitation and reset tokens are random, sent to the browser once,
 *    and stored only as SHA-256 hashes.
 *  - Ten failed sign-ins lock an account for 15 minutes.
 *  - Disabling a user, resetting or changing a password revokes sessions.
 *  - Unknown and known emails take the same time and give the same error.
 */
import { DomainError, hashPassword, hashToken, passwordProblem, randomToken, verifyPassword } from "@pawpost/core";
import { invitations, passwordResets, sessions, users, type Executor, type User } from "@pawpost/db";
import { and, asc, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";

import { writeAudit } from "./audit";
import type { Actor, EngineContext } from "./context";
import { requirePermission } from "./guard";
import { canManageUser, ROLE_LABELS, type Role } from "./permissions";
import {
  acceptInviteInput,
  changePasswordInput,
  inviteInput,
  profileInput,
  resetPasswordInput,
  roleChangeInput,
  setupInput,
  signInInput,
} from "./validation";

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 30 * DAY_MS;
const SESSION_TOUCH_MS = 5 * 60 * 1000;
const INVITE_TTL_MS = 7 * DAY_MS;
const SELF_RESET_TTL_MS = 60 * 60 * 1000;
const ADMIN_RESET_TTL_MS = DAY_MS;
const LOCK_AFTER_FAILURES = 10;
const LOCK_MS = 15 * 60 * 1000;

export type PublicUser = Pick<User, "id" | "email" | "name" | "role" | "status" | "lastLoginAt" | "createdAt">;

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export interface SessionInfo {
  user: PublicUser;
  sessionId: string;
}

const publicColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  status: users.status,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

const toActor = (user: PublicUser, ip?: string | null): Actor => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  ip,
});

function assertStrongPassword(password: string, context: { email?: string; name?: string }) {
  const problem = passwordProblem(password, context);
  if (problem) throw new DomainError("weak_password", problem);
}

export function createAccountService(ctx: EngineContext) {
  const { db } = ctx;
  let dummyHash: Promise<string> | undefined;

  const now = () => ctx.now();
  const later = (ms: number) => new Date(now().getTime() + ms);

  async function createSession(tx: Executor, userId: string, meta: RequestMeta): Promise<string> {
    const token = randomToken(32);
    await tx.insert(sessions).values({
      tokenHash: hashToken(token),
      userId,
      ipAddress: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      lastSeenAt: now(),
      expiresAt: later(SESSION_TTL_MS),
    });
    return token;
  }

  async function findUser(id: string): Promise<User> {
    const user = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!user) throw new DomainError("not_found", "User not found.");
    return user;
  }

  async function managedUser(actor: Actor, userId: string): Promise<User> {
    requirePermission(actor, "team.manage");
    const target = await findUser(userId);
    if (!canManageUser(actor, target)) {
      throw new DomainError(
        "forbidden",
        target.id === actor.id ? "Use your account page to change your own details." : "You can't change this user.",
      );
    }
    return target;
  }

  async function emailInUse(email: string, exceptUserId?: string): Promise<boolean> {
    const existing = await db.query.users.findFirst({
      where: exceptUserId ? and(eq(users.email, email), ne(users.id, exceptUserId)) : eq(users.email, email),
    });
    return Boolean(existing);
  }

  async function sendSystemMail(to: string, subject: string, text: string): Promise<boolean> {
    if (!ctx.systemMailer) return false;
    try {
      await ctx.systemMailer.send({ to, subject, text });
      return true;
    } catch (error) {
      ctx.logger.warn("system email failed", { to, subject, error });
      return false;
    }
  }

  return {
    async hasUsers(): Promise<boolean> {
      const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
      return (row?.n ?? 0) > 0;
    },

    systemMailConfigured(): boolean {
      return ctx.systemMailer !== null;
    },

    /** First-run: creates the owner. Only possible while there are no users. */
    async setupOwner(raw: unknown, meta: RequestMeta, expectedSetupToken?: string | null) {
      const input = setupInput.parse(raw);
      if (expectedSetupToken && input.setupToken !== expectedSetupToken) {
        throw new DomainError(
          "invalid_setup_token",
          "The setup token is wrong. It's the SETUP_TOKEN value in the server configuration.",
        );
      }
      assertStrongPassword(input.password, input);
      const passwordHash = await hashPassword(input.password);

      return db.transaction(async (tx) => {
        // Serialise concurrent setup attempts.
        await tx.execute(sql`lock table ${users} in exclusive mode`);
        const [existing] = await tx.select({ id: users.id }).from(users).limit(1);
        if (existing) throw new DomainError("already_set_up", "Pawpost is already set up. Sign in instead.");

        const [user] = await tx
          .insert(users)
          .values({ email: input.email, name: input.name, passwordHash, role: "owner", lastLoginAt: now() })
          .returning(publicColumns);
        await writeAudit(tx, toActor(user!, meta.ip), {
          action: "account.setup",
          summary: `${user!.name} set up Pawpost and became the owner`,
          entityType: "user",
          entityId: user!.id,
        });
        return { token: await createSession(tx, user!.id, meta), user: user! };
      });
    },

    /** Creates the owner from ADMIN_EMAIL / ADMIN_PASSWORD on first start, for unattended installs. */
    async bootstrapOwner(config: { email?: string | null; password?: string | null }): Promise<boolean> {
      const email = config.email?.trim().toLowerCase();
      if (!email || !config.password) return false;
      const passwordHash = await hashPassword(config.password);
      return db.transaction(async (tx) => {
        await tx.execute(sql`lock table ${users} in exclusive mode`);
        const [existing] = await tx.select({ id: users.id }).from(users).limit(1);
        if (existing) return false;
        const [user] = await tx
          .insert(users)
          .values({ email, name: email.split("@")[0] ?? "Owner", passwordHash, role: "owner" })
          .returning(publicColumns);
        await writeAudit(tx, null, {
          action: "account.setup",
          summary: `Owner account ${email} created from the server configuration`,
          entityType: "user",
          entityId: user!.id,
        });
        ctx.logger.info("owner account created from configuration", { email });
        return true;
      });
    },

    async signIn(raw: unknown, meta: RequestMeta) {
      const input = signInInput.parse(raw);
      const invalid = new DomainError("invalid_credentials", "Wrong email or password.");
      const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });

      if (!user) {
        // Same work as a real check, so response time doesn't reveal which emails exist.
        dummyHash ??= hashPassword("timing-equaliser-password");
        await verifyPassword(input.password, await dummyHash);
        throw invalid;
      }
      if (user.lockedUntil && user.lockedUntil > now()) {
        throw new DomainError(
          "locked",
          "Too many failed attempts. Try again in 15 minutes, or ask an admin for a password reset link.",
        );
      }
      if (!(await verifyPassword(input.password, user.passwordHash))) {
        const failures = user.failedLoginCount + 1;
        const lock = failures >= LOCK_AFTER_FAILURES;
        await db
          .update(users)
          .set({ failedLoginCount: lock ? 0 : failures, lockedUntil: lock ? later(LOCK_MS) : user.lockedUntil })
          .where(eq(users.id, user.id));
        await writeAudit(
          db,
          { ...toActor(user, meta.ip) },
          {
            action: lock ? "auth.locked" : "auth.login_failed",
            summary: lock
              ? `${user.email} was locked after ${LOCK_AFTER_FAILURES} failed sign-ins`
              : `Failed sign-in for ${user.email}`,
            entityType: "user",
            entityId: user.id,
          },
        );
        throw invalid;
      }
      if (user.status === "disabled") {
        throw new DomainError("disabled", "This account has been disabled. Ask an admin to re-enable it.");
      }

      return db.transaction(async (tx) => {
        await tx.update(users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: now() }).where(eq(users.id, user.id));
        const token = await createSession(tx, user.id, meta);
        await writeAudit(tx, toActor(user, meta.ip), {
          action: "auth.login",
          summary: `${user.email} signed in`,
          entityType: "user",
          entityId: user.id,
        });
        const { id, email, name, role, status, createdAt } = user;
        return { token, user: { id, email, name, role, status, createdAt, lastLoginAt: now() } satisfies PublicUser };
      });
    },

    /** Resolves a session cookie. Extends the session while it's in use. */
    async authenticate(token: string | undefined | null): Promise<SessionInfo | null> {
      if (!token || token.length < 20 || token.length > 200) return null;
      const [row] = await db
        .select({ session: sessions, user: publicColumns })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.tokenHash, hashToken(token)))
        .limit(1);
      if (!row || row.session.expiresAt <= now() || row.user.status !== "active") return null;

      if (now().getTime() - row.session.lastSeenAt.getTime() > SESSION_TOUCH_MS) {
        await db
          .update(sessions)
          .set({ lastSeenAt: now(), expiresAt: later(SESSION_TTL_MS) })
          .where(eq(sessions.id, row.session.id));
      }
      return { user: row.user, sessionId: row.session.id };
    },

    async signOut(token: string | undefined | null): Promise<void> {
      if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
    },

    /* ----------------------------- Your account ----------------------------- */

    async listSessions(userId: string) {
      return db
        .select({
          id: sessions.id,
          ipAddress: sessions.ipAddress,
          userAgent: sessions.userAgent,
          lastSeenAt: sessions.lastSeenAt,
          createdAt: sessions.createdAt,
        })
        .from(sessions)
        .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now())))
        .orderBy(desc(sessions.lastSeenAt));
    },

    async revokeSession(actor: Actor, sessionId: string): Promise<void> {
      await db.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, actor.id)));
      await writeAudit(db, actor, {
        action: "auth.session_revoked",
        summary: `${actor.email} signed out a session`,
        entityType: "user",
        entityId: actor.id,
      });
    },

    async revokeOtherSessions(actor: Actor, keepSessionId: string): Promise<number> {
      const removed = await db
        .delete(sessions)
        .where(and(eq(sessions.userId, actor.id), ne(sessions.id, keepSessionId)))
        .returning({ id: sessions.id });
      await writeAudit(db, actor, {
        action: "auth.sessions_revoked",
        summary: `${actor.email} signed out ${removed.length} other session(s)`,
        entityType: "user",
        entityId: actor.id,
      });
      return removed.length;
    },

    async updateProfile(actor: Actor, raw: unknown): Promise<void> {
      const input = profileInput.parse(raw);
      if (await emailInUse(input.email, actor.id)) throw new DomainError("duplicate", "Another user already uses that email.");
      await db.update(users).set({ name: input.name, email: input.email }).where(eq(users.id, actor.id));
      await writeAudit(db, actor, {
        action: "user.profile_updated",
        summary: `${actor.email} updated their profile`,
        entityType: "user",
        entityId: actor.id,
        metadata: input.email !== actor.email ? { previousEmail: actor.email, newEmail: input.email } : {},
      });
    },

    /** Changes your own password and signs out your other sessions. */
    async changePassword(actor: Actor, raw: unknown, keepSessionId: string): Promise<void> {
      const input = changePasswordInput.parse(raw);
      const user = await findUser(actor.id);
      if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
        throw new DomainError("invalid_credentials", "Your current password is wrong.");
      }
      assertStrongPassword(input.newPassword, user);
      const passwordHash = await hashPassword(input.newPassword);
      await db.transaction(async (tx) => {
        await tx.update(users).set({ passwordHash }).where(eq(users.id, actor.id));
        await tx.delete(sessions).where(and(eq(sessions.userId, actor.id), ne(sessions.id, keepSessionId)));
        await writeAudit(tx, actor, {
          action: "user.password_changed",
          summary: `${actor.email} changed their password`,
          entityType: "user",
          entityId: actor.id,
        });
      });
    },

    /* --------------------------------- Team --------------------------------- */

    async listUsers(): Promise<PublicUser[]> {
      return db
        .select(publicColumns)
        .from(users)
        .orderBy(sql`case ${users.role} when 'owner' then 0 when 'admin' then 1 else 2 end`, asc(users.name));
    },

    async listInvitations() {
      return db
        .select({
          id: invitations.id,
          email: invitations.email,
          role: invitations.role,
          expiresAt: invitations.expiresAt,
          createdAt: invitations.createdAt,
          invitedByName: users.name,
        })
        .from(invitations)
        .leftJoin(users, eq(users.id, invitations.invitedById))
        .where(and(isNull(invitations.acceptedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, now())))
        .orderBy(desc(invitations.createdAt));
    },

    /** Creates an invitation link (emailed too when system email is configured). */
    async invite(actor: Actor, raw: unknown): Promise<{ url: string; emailed: boolean }> {
      requirePermission(actor, "team.manage");
      const input = inviteInput.parse(raw);
      if (await emailInUse(input.email)) throw new DomainError("duplicate", `${input.email} already has an account.`);

      const token = randomToken(32);
      await db.transaction(async (tx) => {
        await tx
          .update(invitations)
          .set({ revokedAt: now() })
          .where(and(eq(invitations.email, input.email), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)));
        const [invitation] = await tx
          .insert(invitations)
          .values({
            email: input.email,
            role: input.role,
            tokenHash: hashToken(token),
            invitedById: actor.id,
            expiresAt: later(INVITE_TTL_MS),
          })
          .returning({ id: invitations.id });
        await writeAudit(tx, actor, {
          action: "user.invited",
          summary: `${actor.email} invited ${input.email} as ${ROLE_LABELS[input.role]}`,
          entityType: "invitation",
          entityId: invitation!.id,
        });
      });

      const url = `${ctx.appUrl}/invite/${token}`;
      const emailed = await sendSystemMail(
        input.email,
        `${actor.name} invited you to Pawpost`,
        `${actor.name} (${actor.email}) invited you to join their Pawpost workspace as ${ROLE_LABELS[input.role].toLowerCase()}.\n\nAccept the invitation and choose your password:\n${url}\n\nThe link expires in 7 days.`,
      );
      return { url, emailed };
    },

    async revokeInvitation(actor: Actor, invitationId: string): Promise<void> {
      requirePermission(actor, "team.manage");
      const [invitation] = await db
        .update(invitations)
        .set({ revokedAt: now() })
        .where(and(eq(invitations.id, invitationId), isNull(invitations.acceptedAt)))
        .returning({ email: invitations.email });
      if (!invitation) throw new DomainError("not_found", "Invitation not found.");
      await writeAudit(db, actor, {
        action: "user.invitation_revoked",
        summary: `${actor.email} revoked the invitation for ${invitation.email}`,
        entityType: "invitation",
        entityId: invitationId,
      });
    },

    async lookupInvitation(token: string) {
      const [row] = await db
        .select({ invitation: invitations, invitedByName: users.name })
        .from(invitations)
        .leftJoin(users, eq(users.id, invitations.invitedById))
        .where(eq(invitations.tokenHash, hashToken(token)))
        .limit(1);
      if (!row || row.invitation.acceptedAt || row.invitation.revokedAt || row.invitation.expiresAt <= now()) return null;
      return { email: row.invitation.email, role: row.invitation.role, invitedByName: row.invitedByName };
    },

    async acceptInvitation(token: string, raw: unknown, meta: RequestMeta) {
      const input = acceptInviteInput.parse(raw);
      const invitation = await db.query.invitations.findFirst({ where: eq(invitations.tokenHash, hashToken(token)) });
      if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= now()) {
        throw new DomainError("invalid_invitation", "This invitation is no longer valid. Ask an admin for a new one.");
      }
      if (await emailInUse(invitation.email))
        throw new DomainError("duplicate", `${invitation.email} already has an account. Sign in instead.`);
      assertStrongPassword(input.password, { email: invitation.email, name: input.name });
      const passwordHash = await hashPassword(input.password);

      return db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({ email: invitation.email, name: input.name, passwordHash, role: invitation.role, lastLoginAt: now() })
          .returning(publicColumns);
        await tx.update(invitations).set({ acceptedAt: now() }).where(eq(invitations.id, invitation.id));
        await writeAudit(tx, toActor(user!, meta.ip), {
          action: "user.joined",
          summary: `${user!.email} accepted their invitation and joined as ${ROLE_LABELS[user!.role]}`,
          entityType: "user",
          entityId: user!.id,
        });
        return { token: await createSession(tx, user!.id, meta), user: user! };
      });
    },

    /** Owners can hand ownership to someone else; they become an admin. */
    async changeRole(actor: Actor, userId: string, raw: unknown): Promise<void> {
      const { role } = roleChangeInput.parse(raw);
      const target = await managedUser(actor, userId);
      if (role === "owner" && actor.role !== "owner")
        throw new DomainError("forbidden", "Only the owner can transfer ownership.");
      if (role === target.role) return;

      await db.transaction(async (tx) => {
        await tx.update(users).set({ role }).where(eq(users.id, target.id));
        if (role === "owner") await tx.update(users).set({ role: "admin" }).where(eq(users.id, actor.id));
        await writeAudit(tx, actor, {
          action: role === "owner" ? "user.ownership_transferred" : "user.role_changed",
          summary:
            role === "owner"
              ? `${actor.email} transferred ownership to ${target.email}`
              : `${actor.email} changed ${target.email} from ${ROLE_LABELS[target.role]} to ${ROLE_LABELS[role as Role]}`,
          entityType: "user",
          entityId: target.id,
        });
      });
    },

    /** Disabling signs the user out everywhere; their work stays. */
    async setDisabled(actor: Actor, userId: string, disabled: boolean): Promise<void> {
      const target = await managedUser(actor, userId);
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ status: disabled ? "disabled" : "active", failedLoginCount: 0, lockedUntil: null })
          .where(eq(users.id, target.id));
        if (disabled) await tx.delete(sessions).where(eq(sessions.userId, target.id));
        await writeAudit(tx, actor, {
          action: disabled ? "user.disabled" : "user.enabled",
          summary: `${actor.email} ${disabled ? "disabled" : "re-enabled"} ${target.email}`,
          entityType: "user",
          entityId: target.id,
        });
      });
    },

    async removeUser(actor: Actor, userId: string): Promise<void> {
      const target = await managedUser(actor, userId);
      await db.transaction(async (tx) => {
        await tx.delete(users).where(eq(users.id, target.id));
        await writeAudit(tx, actor, {
          action: "user.removed",
          summary: `${actor.email} removed ${target.email}`,
          entityType: "user",
          entityId: target.id,
        });
      });
    },

    /** A one-time link an admin passes on to a teammate who forgot their password (valid 24 hours). */
    async createResetLink(actor: Actor, userId: string): Promise<{ url: string; emailed: boolean }> {
      const target = await managedUser(actor, userId);
      const token = randomToken(32);
      await db
        .insert(passwordResets)
        .values({ userId: target.id, tokenHash: hashToken(token), createdById: actor.id, expiresAt: later(ADMIN_RESET_TTL_MS) });
      await writeAudit(db, actor, {
        action: "user.reset_link_created",
        summary: `${actor.email} created a password reset link for ${target.email}`,
        entityType: "user",
        entityId: target.id,
      });
      const url = `${ctx.appUrl}/reset-password/${token}`;
      const emailed = await sendSystemMail(
        target.email,
        "Reset your Pawpost password",
        `${actor.name} sent you a link to set a new Pawpost password:\n${url}\n\nThe link expires in 24 hours.`,
      );
      return { url, emailed };
    },

    /**
     * Self-service "forgot password". Works only with system email configured.
     * Always reports success, so it can't be used to discover which emails have accounts.
     */
    async requestPasswordReset(rawEmail: unknown): Promise<{ mailConfigured: boolean }> {
      if (!ctx.systemMailer) return { mailConfigured: false };
      const email = String(rawEmail ?? "")
        .trim()
        .toLowerCase();
      const user = await db.query.users.findFirst({ where: eq(users.email, email) });
      if (user && user.status === "active") {
        const token = randomToken(32);
        await db
          .insert(passwordResets)
          .values({ userId: user.id, tokenHash: hashToken(token), expiresAt: later(SELF_RESET_TTL_MS) });
        await sendSystemMail(
          user.email,
          "Reset your Pawpost password",
          `Someone asked to reset the password for ${user.email}. If it was you, choose a new password here:\n${ctx.appUrl}/reset-password/${token}\n\nThe link expires in 1 hour. If it wasn't you, you can ignore this email.`,
        );
      }
      return { mailConfigured: true };
    },

    /** For the command-line recovery tool: a reset link for any user, e.g. a locked-out owner. */
    async createRecoveryLink(email: string): Promise<string> {
      const user = await db.query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()) });
      if (!user) throw new DomainError("not_found", `No user with the email ${email}.`);
      const token = randomToken(32);
      await db
        .insert(passwordResets)
        .values({ userId: user.id, tokenHash: hashToken(token), expiresAt: later(ADMIN_RESET_TTL_MS) });
      await writeAudit(db, null, {
        action: "user.reset_link_created",
        summary: `A recovery link for ${user.email} was created from the command line`,
        entityType: "user",
        entityId: user.id,
      });
      return `${ctx.appUrl}/reset-password/${token}`;
    },

    async lookupReset(token: string): Promise<{ email: string } | null> {
      const [row] = await db
        .select({ reset: passwordResets, email: users.email })
        .from(passwordResets)
        .innerJoin(users, eq(users.id, passwordResets.userId))
        .where(eq(passwordResets.tokenHash, hashToken(token)))
        .limit(1);
      if (!row || row.reset.usedAt || row.reset.expiresAt <= now()) return null;
      return { email: row.email };
    },

    /** Sets a new password from a reset link and signs the user out everywhere. */
    async resetPassword(token: string, raw: unknown, meta: RequestMeta): Promise<void> {
      const input = resetPasswordInput.parse(raw);
      const reset = await db.query.passwordResets.findFirst({ where: eq(passwordResets.tokenHash, hashToken(token)) });
      if (!reset || reset.usedAt || reset.expiresAt <= now()) {
        throw new DomainError("invalid_reset", "This reset link is no longer valid. Ask for a new one.");
      }
      const user = await findUser(reset.userId);
      assertStrongPassword(input.password, user);
      const passwordHash = await hashPassword(input.password);
      await db.transaction(async (tx) => {
        await tx.update(passwordResets).set({ usedAt: now() }).where(eq(passwordResets.id, reset.id));
        await tx.update(users).set({ passwordHash, failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, user.id));
        await tx.delete(sessions).where(eq(sessions.userId, user.id));
        await writeAudit(tx, toActor(user, meta.ip), {
          action: "user.password_reset",
          summary: `${user.email} set a new password with a reset link`,
          entityType: "user",
          entityId: user.id,
        });
      });
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
