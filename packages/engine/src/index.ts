import { createAccountService } from "./accounts";
import { createAiService, type AiEnvironment } from "./ai";
import { createAuditService } from "./audit";
import { createCampaignService } from "./campaigns";
import { createContext, type EngineOptions } from "./context";
import { createDispatcher } from "./dispatch";
import { createInboxSync } from "./inbox-sync";
import { createListService } from "./lists";
import { createMailboxService } from "./mailboxes";
import { createPrivacyService } from "./privacy";
import { createReplyService } from "./replies";
import { createStatsService } from "./stats";
import { createSuppressionService } from "./suppressions";
import { createSystemService } from "./system";
import { createTrashService } from "./trash";

export interface CreateEngineOptions extends EngineOptions {
  ai?: AiEnvironment;
}

/**
 * The application layer. The web app and the worker both talk to Pawpost only
 * through this object, so business rules live in exactly one place.
 *
 * Every method that changes data takes the acting user (`Actor`), checks their
 * role, and writes an audit entry in the same transaction as the change.
 */
export function createEngine(options: CreateEngineOptions) {
  const ctx = createContext(options);
  const mailboxes = createMailboxService(ctx);
  const ai = createAiService(ctx, options.ai);

  return {
    accounts: createAccountService(ctx),
    audit: createAuditService(ctx),
    mailboxes,
    lists: createListService(ctx),
    campaigns: createCampaignService(ctx),
    suppressions: createSuppressionService(ctx),
    trash: createTrashService(ctx),
    privacy: createPrivacyService(ctx),
    replies: createReplyService(ctx),
    stats: createStatsService(ctx),
    ai,
    system: createSystemService(ctx),
    /** One dispatch pass. The worker calls this on a short interval. */
    dispatch: createDispatcher(ctx, mailboxes),
    /** One inbox pass over mailboxes that are due. */
    syncInboxes: createInboxSync(ctx, mailboxes, ai),
    close() {
      ctx.sender.close();
    },
  };
}

export type Engine = ReturnType<typeof createEngine>;

export type { PublicUser, RequestMeta, SessionInfo } from "./accounts";
export type { AiEnvironment, AiStatus } from "./ai";
export type { AuditFilters } from "./audit";
export type { CampaignDetail, Preflight } from "./campaigns";
export type { Actor, EngineOptions } from "./context";
export type { DispatchSummary } from "./dispatch";
export type { InboxSyncSummary } from "./inbox-sync";
export type { BulkResult, ContactQuery, ImportReport, ListOverview, ListSummary } from "./lists";
export type { ConnectionTestResult, MailboxSummary } from "./mailboxes";
export type { ErasePreview } from "./privacy";
export type { ReplyCounts, ReplyQuery, ReplyRow, ReplyTab } from "./replies";
export { REPLY_TABS } from "./replies";
export type { CampaignStats } from "./stats";
export type { WorkerStatus } from "./system";
export type { TrashKind } from "./trash";
export { TRASH_RETENTION_DAYS } from "./trash";
export * from "./permissions";
export { DomainError, isDomainError } from "@pawpost/core";
