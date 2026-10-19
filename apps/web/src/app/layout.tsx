import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const description = "Self-hosted cold email outreach. Your mailboxes, your contacts, your data.";

/** Per request, not at build time: link previews need absolute URLs on this install's APP_URL. */
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: publicBase(),
    title: { default: "Pawpost", template: "%s · Pawpost" },
    description,
    applicationName: "Pawpost",
    openGraph: { type: "website", siteName: "Pawpost", title: "Pawpost", description },
    twitter: { card: "summary_large_image", title: "Pawpost", description },
    robots: { index: false, follow: false },
  };
}

function publicBase(): URL | undefined {
  try {
    return new URL(process.env.APP_URL ?? "");
  } catch {
    return undefined;
  }
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-background font-sans text-foreground">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
