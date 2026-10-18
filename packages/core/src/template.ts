/**
 * Minimal, predictable templating for plain-text emails.
 *
 *   {{firstName}}          → contact's first name, or "" if missing
 *   {{firstName|there}}    → contact's first name, or "there" if missing
 *
 * Deliberately no logic, loops or HTML: cold email should read like a person
 * typed it, and a tiny syntax keeps templates easy to lint before sending.
 */

export type TemplateContext = Readonly<Record<string, string | null | undefined>>;

export interface TemplateVariable {
  name: string;
  fallback: string | null;
}

export type TemplateIssue =
  | { severity: "error"; code: "unknown_variable"; variable: string; message: string }
  | { severity: "warning"; code: "missing_fallback"; variable: string; message: string };

/** Variables every contact can provide. Contact attributes from the CSV are added on top. */
export const STANDARD_VARIABLES = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "company",
  "senderName",
  "senderFirstName",
] as const;

/** Variables that are often blank on cold lists, so they should carry a fallback. */
const OPTIONAL_VARIABLES = new Set(["firstName", "lastName", "fullName", "company"]);

const VARIABLE_PATTERN = /\{\{\s*([A-Za-z_][\w.-]*)\s*(?:\|([^}]*))?\}\}/g;

export function templateVariables(template: string): TemplateVariable[] {
  const found: TemplateVariable[] = [];
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    found.push({ name: match[1]!, fallback: match[2] === undefined ? null : match[2].trim() });
  }
  return found;
}

export function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(VARIABLE_PATTERN, (_match, name: string, fallback?: string) => {
    const value = context[name]?.trim();
    if (value) return value;
    return fallback?.trim() ?? "";
  });
}

/**
 * Checks a template before a campaign starts. `knownVariables` should include the
 * standard variables plus every attribute column present in the campaign's list.
 */
export function lintTemplate(template: string, knownVariables: Iterable<string>): TemplateIssue[] {
  const known = new Set(knownVariables);
  const issues: TemplateIssue[] = [];
  const seen = new Set<string>();

  for (const variable of templateVariables(template)) {
    const key = `${variable.name}|${variable.fallback ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!known.has(variable.name)) {
      issues.push({
        severity: "error",
        code: "unknown_variable",
        variable: variable.name,
        message: `{{${variable.name}}} is not a contact field. Known fields: ${[...known].join(", ")}.`,
      });
    } else if (variable.fallback === null && OPTIONAL_VARIABLES.has(variable.name)) {
      issues.push({
        severity: "warning",
        code: "missing_fallback",
        variable: variable.name,
        message: `Some contacts have no ${variable.name}. Add a fallback, e.g. {{${variable.name}|there}}.`,
      });
    }
  }
  return issues;
}

export interface ContactForTemplate {
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  attributes: Record<string, string>;
}

export interface SenderForTemplate {
  fromName: string;
}

export function buildTemplateContext(contact: ContactForTemplate, sender: SenderForTemplate): TemplateContext {
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  return {
    // Attributes first so standard fields always win on a name clash.
    ...contact.attributes,
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName: fullName || null,
    email: contact.email,
    company: contact.company,
    senderName: sender.fromName,
    senderFirstName: sender.fromName.trim().split(/\s+/)[0] ?? sender.fromName,
  };
}
