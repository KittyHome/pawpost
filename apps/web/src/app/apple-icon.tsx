import { ImageResponse } from "next/og";

import { LogoMark } from "@/components/logo-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iOS, also used by Slack and other link previews. */
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex" }}>
      <LogoMark colors={{ tile: "#171717", ink: "#fafafa" }} rounded={false} px={180} />
    </div>,
    size,
  );
}
