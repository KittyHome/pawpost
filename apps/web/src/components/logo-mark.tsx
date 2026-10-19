import { cn } from "@/lib/utils";

export const BRAND_ACCENT = "#f97316";

/**
 * The Pawpost mark: an envelope with a paw badge. Without `colors` it follows the
 * theme; image generation (no CSS) passes fixed colors. Keep in sync with app/icon.svg.
 */
export function LogoMark({
  className,
  colors,
  rounded = true,
  px = 64,
}: {
  className?: string;
  colors?: { tile: string; ink: string };
  /** Apple touch icons must be square: iOS rounds the corners itself. */
  rounded?: boolean;
  /** Rendered size where no CSS applies (generated images); in the app, size it with `className`. */
  px?: number;
}) {
  const tile = colors ? { fill: colors.tile } : { className: "fill-primary" };
  const inkStroke = colors ? { stroke: colors.ink } : { className: "stroke-primary-foreground" };
  const cutout = colors ? { stroke: colors.tile } : { className: "stroke-primary" };

  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-8 shrink-0", className)} width={px} height={px}>
      <rect width="64" height="64" rx={rounded ? 14 : 0} {...tile} />
      <g transform="translate(-2 -3)">
        <rect x="11" y="17" width="36" height="26" rx="4.5" fill="none" strokeWidth="3.5" {...inkStroke} />
        <path
          d="M12.5 20 29 32l16.5-12"
          fill="none"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          {...inkStroke}
        />
        <circle cx="46" cy="44" r="12.5" fill={BRAND_ACCENT} strokeWidth="3.5" {...cutout} />
        <ellipse cx="46" cy="47.6" rx="4.6" ry="3.8" fill="#fff" />
        <circle cx="40.2" cy="42.4" r="1.9" fill="#fff" />
        <circle cx="43.6" cy="38.9" r="1.9" fill="#fff" />
        <circle cx="48.4" cy="38.9" r="1.9" fill="#fff" />
        <circle cx="51.8" cy="42.4" r="1.9" fill="#fff" />
      </g>
    </svg>
  );
}
