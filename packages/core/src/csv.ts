import Papa from "papaparse";

import { cleanName, cleanNamePart, isRoleAddress, isValidEmail, normalizeEmail } from "./contacts";

export interface ParsedContact {
  /** 1-based line number in the file (header = line 1). */
  line: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  attributes: Record<string, string>;
}

export type RejectReason = "invalid_email" | "duplicate" | "role_address" | "missing_email";

export interface RejectedRow {
  /** 1-based line number in the file, counting the header as line 1. */
  line: number;
  email: string;
  reason: RejectReason;
}

export interface ParseContactsResult {
  contacts: ParsedContact[];
  rejected: RejectedRow[];
  /** Extra columns kept as attributes, usable as {{columnName}} in templates. */
  attributeColumns: string[];
}

export interface ParseContactsOptions {
  skipRoleAddresses?: boolean;
}

const COLUMN_ALIASES = {
  email: ["email", "e-mail", "emailaddress", "mail"],
  fullName: ["name", "fullname", "contactname"],
  firstName: ["firstname", "first", "givenname"],
  lastName: ["lastname", "last", "surname", "familyname"],
  company: ["company", "companyname", "organization", "organisation", "org"],
} as const;

type KnownColumn = keyof typeof COLUMN_ALIASES;

const MAX_ROWS = 100_000;

export class CsvFormatError extends Error {
  override readonly name = "CsvFormatError";
}

export function parseContactsCsv(text: string, options: ParseContactsOptions = {}): ParseContactsResult {
  const skipRoleAddresses = options.skipRoleAddresses ?? true;
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const mapping = mapColumns(headers);
  if (!mapping.email) {
    throw new CsvFormatError(`No email column found. Columns were: ${headers.join(", ") || "(none)"}.`);
  }
  if (parsed.data.length > MAX_ROWS) {
    throw new CsvFormatError(`Files are limited to ${MAX_ROWS.toLocaleString("en-US")} rows.`);
  }

  const known = new Set(Object.values(mapping));
  const attributeColumns = headers.filter((h) => h && !known.has(h));

  const contacts: ParsedContact[] = [];
  const rejected: RejectedRow[] = [];
  const seen = new Set<string>();

  parsed.data.forEach((row, index) => {
    const line = index + 2;
    const rawEmail = row[mapping.email!] ?? "";
    const email = normalizeEmail(rawEmail);

    if (!email) return rejected.push({ line, email: rawEmail, reason: "missing_email" });
    if (!isValidEmail(email)) return rejected.push({ line, email: rawEmail, reason: "invalid_email" });
    if (seen.has(email)) return rejected.push({ line, email, reason: "duplicate" });
    if (skipRoleAddresses && isRoleAddress(email)) return rejected.push({ line, email, reason: "role_address" });
    seen.add(email);

    const name =
      mapping.firstName || mapping.lastName
        ? { firstName: cleanNamePart(row[mapping.firstName ?? ""]), lastName: cleanNamePart(row[mapping.lastName ?? ""]) }
        : cleanName(row[mapping.fullName ?? ""] ?? "", email);

    const attributes: Record<string, string> = {};
    for (const column of attributeColumns) {
      const value = row[column]?.trim();
      if (value) attributes[column] = value;
    }

    contacts.push({
      line,
      email,
      ...name,
      company: row[mapping.company ?? ""]?.trim() || null,
      attributes,
    });
  });

  return { contacts, rejected, attributeColumns };
}

function mapColumns(headers: string[]): Partial<Record<KnownColumn, string>> {
  const mapping: Partial<Record<KnownColumn, string>> = {};
  for (const header of headers) {
    const key = header.toLowerCase().replace(/[\s_.-]/g, "");
    for (const [column, aliases] of Object.entries(COLUMN_ALIASES) as [KnownColumn, readonly string[]][]) {
      if (!mapping[column] && aliases.includes(key)) {
        mapping[column] = header;
        break;
      }
    }
  }
  return mapping;
}
