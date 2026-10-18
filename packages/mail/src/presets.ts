/** Server settings for common providers, so users only type their address and app password. */

export interface ProviderPreset {
  id: string;
  label: string;
  smtp: { host: string; port: number; secure: boolean };
  imap: { host: string; port: number; secure: boolean };
  /** Shown next to the password field. */
  passwordHint: string;
}

export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    id: "google",
    label: "Google Workspace / Gmail",
    smtp: { host: "smtp.gmail.com", port: 465, secure: true },
    imap: { host: "imap.gmail.com", port: 993, secure: true },
    passwordHint: "Use an App Password (Google Account → Security → 2-Step Verification → App passwords).",
  },
  {
    id: "microsoft",
    label: "Microsoft 365 / Outlook",
    smtp: { host: "smtp.office365.com", port: 587, secure: false },
    imap: { host: "outlook.office365.com", port: 993, secure: true },
    passwordHint:
      "Your admin must enable Authenticated SMTP for this mailbox. Microsoft switches password-based SMTP off by default from end of December 2026.",
  },
  {
    id: "zoho",
    label: "Zoho Mail",
    smtp: { host: "smtp.zoho.com", port: 465, secure: true },
    imap: { host: "imap.zoho.com", port: 993, secure: true },
    passwordHint: "Use an application-specific password if 2FA is on.",
  },
  {
    id: "custom",
    label: "Other (custom SMTP/IMAP)",
    smtp: { host: "", port: 587, secure: false },
    imap: { host: "", port: 993, secure: true },
    passwordHint: "Use the SMTP and IMAP settings from your email provider.",
  },
];
