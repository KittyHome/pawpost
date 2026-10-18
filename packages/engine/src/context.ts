import { deriveSecretKey, noopLogger, type Logger, type SecretKey } from "@pawpost/core";
import type { Database } from "@pawpost/db";
import { checkMailDomains, createInboxReader, createMailSender, type InboxReader, type MailSender } from "@pawpost/mail";

export interface EngineOptions {
  db: Database;
  /** Used to encrypt mailbox passwords. At least 32 characters. */
  appSecret: string;
  /** Public base URL of the web app, used in unsubscribe links. */
  appUrl: string;
  logger?: Logger;
  /** Injectable for tests. */
  sender?: MailSender;
  inbox?: InboxReader;
  checkDomains?: typeof checkMailDomains;
  clock?: () => Date;
}

export interface EngineContext {
  db: Database;
  secretKey: SecretKey;
  appUrl: string;
  logger: Logger;
  sender: MailSender;
  inbox: InboxReader;
  checkDomains: typeof checkMailDomains;
  now(): Date;
}

export function createContext(options: EngineOptions): EngineContext {
  return {
    db: options.db,
    secretKey: deriveSecretKey(options.appSecret),
    appUrl: options.appUrl.replace(/\/+$/, ""),
    logger: options.logger ?? noopLogger,
    sender: options.sender ?? createMailSender(),
    inbox: options.inbox ?? createInboxReader(),
    checkDomains: options.checkDomains ?? checkMailDomains,
    now: options.clock ?? (() => new Date()),
  };
}
