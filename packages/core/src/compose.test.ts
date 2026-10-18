import { describe, expect, it } from "vitest";

import { composeEmail, type ComposeInput } from "./compose";

const base: ComposeInput = {
  step: { subject: "Quick idea for {{company|your team}}", body: "Hi {{firstName|there}},\r\n\r\n\r\nShort note.   " },
  threadSubject: null,
  context: { firstName: "Ann" },
  postalAddress: "1 Main St, Springfield",
  unsubscribeUrl: "https://app.test/u/tok",
  oneClickUnsubscribeUrl: "https://app.test/api/unsubscribe/tok",
  senderEmail: "sam@send.test",
  threadMessageIds: [],
};

describe("composeEmail", () => {
  it("renders the first email with footer and one-click unsubscribe headers", () => {
    const email = composeEmail(base);
    expect(email.subject).toBe("Quick idea for your team");
    expect(email.text).toBe(
      "Hi Ann,\n\nShort note.\n\n--\n1 Main St, Springfield\nNot interested? Unsubscribe here: https://app.test/u/tok\n",
    );
    expect(email.headers["List-Unsubscribe"]).toBe(
      "<https://app.test/api/unsubscribe/tok>, <mailto:sam@send.test?subject=unsubscribe>",
    );
    expect(email.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(email.headers["In-Reply-To"]).toBeUndefined();
  });

  it("threads a follow-up with no subject under the original", () => {
    const email = composeEmail({
      ...base,
      step: { subject: "", body: "Bumping this." },
      threadSubject: "Quick idea",
      threadMessageIds: ["<a@x>", "<b@x>"],
    });
    expect(email.subject).toBe("Re: Quick idea");
    expect(email.headers["In-Reply-To"]).toBe("<b@x>");
    expect(email.headers["References"]).toBe("<a@x> <b@x>");
  });

  it("does not stack Re: prefixes", () => {
    const email = composeEmail({ ...base, step: { subject: "", body: "x" }, threadSubject: "RE: Hi" });
    expect(email.subject).toBe("RE: Hi");
  });

  it("refuses a first email without a subject", () => {
    expect(() => composeEmail({ ...base, step: { subject: "  ", body: "x" } })).toThrow(/needs a subject/);
  });
});
