import { describe, expect, it } from "vitest";

import { type AiProvider, type AiRequest } from "./provider";
import { classifyReply, reviewCopy, writeSequence } from "./tasks";

/** Returns a canned result per task and records what was asked. */
function fakeProvider(results: Record<string, unknown>) {
  const calls: AiRequest<unknown>[] = [];
  const provider: AiProvider = {
    id: "fake",
    model: "fake-1",
    async generate<T>(request: AiRequest<T>) {
      calls.push(request as AiRequest<unknown>);
      return request.schema.parse(results[request.task]);
    },
  };
  return { provider, calls };
}

describe("writeSequence", () => {
  it("normalises the model output into valid steps", async () => {
    const { provider, calls } = fakeProvider({
      cold_email_sequence: {
        steps: [
          { subject: "", body: "Hi {{firstName|there}},\r\nFirst.", waitDays: 5 },
          { subject: "should be dropped", body: "Second.", waitDays: 40 },
          { subject: "extra", body: "Third.", waitDays: 3 },
        ],
      },
    });
    const steps = await writeSequence(provider, {
      product: "AI writing helper",
      audience: "developers",
      goal: "install it",
      steps: 2,
    });
    expect(steps).toEqual([
      { subject: "Quick question", body: "Hi {{firstName|there}},\nFirst.", waitDays: 0 },
      { subject: "", body: "Second.", waitDays: 14 },
    ]);
    expect(calls[0]!.input).toContain("don't include any link");
  });

  it("validates the brief before calling the model", async () => {
    const { provider, calls } = fakeProvider({});
    await expect(writeSequence(provider, { product: "", audience: "x", goal: "y" })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("reviewCopy and classifyReply", () => {
  it("clamps scores and keeps follow-up subjects empty", async () => {
    const { provider } = fakeProvider({
      cold_email_review: { score: 140, verdict: "good", issues: [], improvedSubject: "x", improvedBody: " body " },
    });
    const review = await reviewCopy(provider, { subject: "", body: "hi" });
    expect(review.score).toBe(100);
    expect(review.improvedSubject).toBe("");
    expect(review.improvedBody).toBe("body");
  });

  it("returns the intent with a bounded confidence", async () => {
    const { provider } = fakeProvider({ reply_triage: { intent: "unsubscribe", summary: "Wants off the list.", confidence: 3 } });
    expect(await classifyReply(provider, { originalSubject: "Hi", text: "remove me" })).toEqual({
      intent: "unsubscribe",
      summary: "Wants off the list.",
      confidence: 1,
    });
  });
});
