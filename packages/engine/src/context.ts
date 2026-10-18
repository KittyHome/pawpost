import { deriveSecretKey, noopLogger, type Logger, type SecretKey } from "@pawpost/core";
import type { Database } from "@pawpost/db";
import {
  checkMailDomains,
  createInboxReader,
  createMailSender,
  type InboxReader,
  type MailSender,
  type SystemMailer,
} from "@pawpost/mail";

import type { Role } from "./permissions";

export interface EngineOptions {
  db: Database;
  /** Used to encrypt mailbox passwords. At least 32 characters. */
  appSecret: string;
  /** Public base URL of the web app, used in unsubscribe, invitation and reset links. */
  appUrl: string;
  logger?: Logger;
  /** Sends invitations and password resets. Optional: links are shown to copy otherwise. */
  systemMailer?: SystemMailer | null;
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
  systemMailer: SystemMailer | null;
  sender: MailSender;
  inbox: InboxReader;
  checkDomains: typeof checkMailDomains;
  now(): Date;
}

/** The signed-in user performing an action, plus request details for the audit log. */
export interface Actor {
  id: string;
  email: string;
  name: string;
  role: Role;
  ip?: string | null;
}

export function createContext(options: EngineOptions): EngineContext {
  return {
    db: options.db,
    secretKey: deriveSecretKey(options.appSecret),
    appUrl: options.appUrl.replace(/\/+$/, ""),
    logger: options.logger ?? noopLogger,
    systemMailer: options.systemMailer ?? null,
    sender: options.sender ?? createMailSender(),
    inbox: options.inbox ?? createInboxReader(),
    checkDomains: options.checkDomains ?? checkMailDomains,
    now: options.clock ?? (() => new Date()),
  };
}
