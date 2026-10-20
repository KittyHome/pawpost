import type { Metadata } from "next";

const description = "Self-hosted cold email outreach. Your mailboxes, your contacts, your data.";

export const metadata: Metadata = {
  title: { absolute: "Pawpost — Self-hosted cold email outreach" },
  description,
  robots: { index: true, follow: true },
  openGraph: { title: "Pawpost — Self-hosted cold email outreach", description },
  twitter: { title: "Pawpost — Self-hosted cold email outreach", description },
};

/** Public marketing pages stay light regardless of the signed-in dashboard theme. */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return <div className="min-h-svh bg-[#fafafa] text-[#171717] antialiased [color-scheme:light]">{children}</div>;
}
