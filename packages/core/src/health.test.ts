import { describe, expect, it } from "vitest";

import { evaluateCampaignHealth } from "./health";
import { decryptSecret, deriveSecretKey, encryptSecret } from "./secrets";

describe("evaluateCampaignHealth", () => {
  it("waits for a minimum sample", () => {
    expect(evaluateCampaignHealth({ sent: 10, bounced: 5, unsubscribed: 0 }).ok).toBe(true);
  });

  it("pauses on high bounce or unsubscribe rates", () => {
    expect(evaluateCampaignHealth({ sent: 100, bounced: 3, unsubscribed: 0 })).toMatchObject({ ok: false });
    expect(evaluateCampaignHealth({ sent: 100, bounced: 2, unsubscribed: 6 })).toMatchObject({ ok: false });
    expect(evaluateCampaignHealth({ sent: 100, bounced: 2, unsubscribed: 5 }).ok).toBe(true);
  });
});

describe("secrets", () => {
  const key = deriveSecretKey("x".repeat(32));

  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptSecret("app-password", key);
    expect(a).not.toBe(encryptSecret("app-password", key));
    expect(decryptSecret(a, key)).toBe("app-password");
  });

  it("rejects tampered payloads and wrong keys", () => {
    const payload = encryptSecret("secret", key);
    expect(() => decryptSecret(payload, deriveSecretKey("y".repeat(32)))).toThrow();
    expect(() => decryptSecret(payload.slice(0, -2) + "AA", key)).toThrow();
  });

  it("requires a long APP_SECRET", () => {
    expect(() => deriveSecretKey("short")).toThrow(/32/);
  });
});

describe("isDomainError", () => {
  it("recognises domain errors by brand, even from another copy of the package", async () => {
    const { DomainError, isDomainError } = await import("./errors");
    expect(isDomainError(new DomainError("forbidden", "No."))).toBe(true);
    expect(isDomainError(new Error("No."))).toBe(false);
    expect(isDomainError(null)).toBe(false);
    // What a second bundled copy of the class would produce.
    const foreign = Object.assign(new Error("No."), { [Symbol.for("pawpost.domain-error")]: true, code: "forbidden" });
    expect(isDomainError(foreign)).toBe(true);
  });
});
