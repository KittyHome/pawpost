import { describe, expect, it } from "vitest";

import { isOptOutReply, stripQuotedReply } from "./optout";

describe("opt-out replies", () => {
  it("detects stop requests in the reply itself", () => {
    expect(isOptOutReply("Please remove me from your list.")).toBe(true);
    expect(isOptOutReply("STOP")).toBe(true);
    expect(isOptOutReply("Not interested, thanks")).toBe(true);
  });

  it("ignores our own footer in the quoted original", () => {
    const reply =
      "Sure, Thursday works!\n\nOn Tue, 13 Oct 2026, Sam <sam@x.test> wrote:\n> Hi\n> Not interested? Unsubscribe here: https://x";
    expect(stripQuotedReply(reply)).toBe("Sure, Thursday works!");
    expect(isOptOutReply(reply)).toBe(false);
  });
});
