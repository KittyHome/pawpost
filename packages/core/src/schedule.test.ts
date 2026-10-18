import { describe, expect, it } from "vitest";

import { isWithinSendWindow, localTimeParts, nextSendGapMs, parseTimeOfDay, validateSendWindow } from "./schedule";

const weekdays9to5 = { days: [1, 2, 3, 4, 5], startMinute: 9 * 60, endMinute: 17 * 60 };

describe("send window", () => {
  it("evaluates in the campaign's timezone", () => {
    // Tuesday 2026-10-13 14:30 UTC = 10:30 in New York, 23:30 in Tokyo.
    const now = new Date("2026-10-13T14:30:00Z");
    expect(isWithinSendWindow(now, { ...weekdays9to5, timezone: "America/New_York" })).toBe(true);
    expect(isWithinSendWindow(now, { ...weekdays9to5, timezone: "Asia/Tokyo" })).toBe(false);
  });

  it("excludes weekends and the end minute", () => {
    expect(isWithinSendWindow(new Date("2026-10-17T12:00:00Z"), { ...weekdays9to5, timezone: "UTC" })).toBe(false);
    expect(isWithinSendWindow(new Date("2026-10-13T17:00:00Z"), { ...weekdays9to5, timezone: "UTC" })).toBe(false);
    expect(localTimeParts(new Date("2026-10-18T00:00:00Z"), "UTC").weekday).toBe(7);
  });

  it("validates windows", () => {
    expect(validateSendWindow({ ...weekdays9to5, timezone: "Mars/Olympus" })).toMatch(/timezone/);
    expect(validateSendWindow({ ...weekdays9to5, timezone: "UTC", startMinute: 600, endMinute: 600 })).toMatch(/start before/);
    expect(validateSendWindow({ ...weekdays9to5, timezone: "UTC" })).toBeNull();
  });
});

describe("helpers", () => {
  it("adds up to 50% jitter to the send gap", () => {
    expect(nextSendGapMs(100, () => 0)).toBe(100_000);
    expect(nextSendGapMs(100, () => 1)).toBe(150_000);
  });

  it("parses times of day", () => {
    expect(parseTimeOfDay("9:05")).toBe(545);
    expect(parseTimeOfDay("24:00")).toBe(1440);
    expect(parseTimeOfDay("25:00")).toBeNull();
  });
});
