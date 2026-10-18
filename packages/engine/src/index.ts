import { createAiService, type AiEnvironment } from "./ai";
import { createCampaignService } from "./campaigns";
import { createContext, type EngineOptions } from "./context";
import { createDispatcher } from "./dispatch";
import { createInboxSync } from "./inbox-sync";
import { createListService } from "./lists";
import { createMailboxService } from "./mailboxes";
import { createStatsService } from "./stats";
import { createSuppressionService } from "./suppressions";
import { createSystemService } from "./system";

export interface CreateEngineOptions extends EngineOptions {
  ai?: AiEnvironment;
}

/**
 * The application layer. The web app and the worker both talk to Pawpost only
 * through this object, so business rules live in exactly one place.
 */
export function createEngine(options: CreateEngineOptions) {
  const ctx = createContext(options);
  const mailboxes = createMailboxService(ctx);
  const ai = createAiService(ctx, options.ai);

  return {
    mailboxes,
    lists: createListService(ctx),
    campaigns: createCampaignService(ctx),
    suppressions: createSuppressionService(ctx),
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

export type { AiEnvironment, AiStatus } from "./ai";
export type { CampaignDetail, Preflight } from "./campaigns";
export type { EngineOptions } from "./context";
export type { DispatchSummary } from "./dispatch";
export type { InboxSyncSummary } from "./inbox-sync";
export type { ImportReport, ListSummary } from "./lists";
export type { ConnectionTestResult, MailboxSummary } from "./mailboxes";
export type { CampaignStats } from "./stats";
export type { WorkerStatus } from "./system";
export { DomainError, isDomainError } from "@pawpost/core";
