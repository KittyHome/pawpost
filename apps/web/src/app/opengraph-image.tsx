import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import { BRAND_ACCENT, LogoMark } from "@/components/logo-mark";

export const alt = "Pawpost: self-hosted cold email outreach";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FEATURES = ["Follow-up sequences", "Reply detection", "One-click unsubscribe"];

/** The preview card shown when a Pawpost link is shared (Slack, iMessage, LinkedIn, X). */
export default async function OpenGraphImage() {
  const fonts = path.join(process.cwd(), "assets/fonts");
  const [regular, semibold] = await Promise.all([
    readFile(path.join(fonts, "Geist-Regular.ttf")),
    readFile(path.join(fonts, "Geist-SemiBold.ttf")),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        backgroundColor: "#0a0a0a",
        backgroundImage: `radial-gradient(circle at 100% 0%, rgba(249, 115, 22, 0.22), transparent 55%)`,
        color: "#fafafa",
        fontFamily: "Geist",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <LogoMark colors={{ tile: "#262626", ink: "#fafafa" }} px={84} />
        <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1 }}>Pawpost</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: -2.5, lineHeight: 1.05, maxWidth: 920 }}>
          Cold email outreach you host yourself.
        </div>
        <div style={{ fontSize: 32, color: "#a3a3a3", lineHeight: 1.35, maxWidth: 900 }}>
          Your mailboxes, your contacts, your data. Campaigns, follow-ups and replies in one dashboard.
        </div>
      </div>

      <div style={{ display: "flex", gap: 14 }}>
        {FEATURES.map((feature) => (
          <div
            key={feature}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 22px",
              borderRadius: 999,
              border: "1.5px solid #333",
              backgroundColor: "#171717",
              fontSize: 24,
              color: "#e5e5e5",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: BRAND_ACCENT }} />
            {feature}
          </div>
        ))}
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
