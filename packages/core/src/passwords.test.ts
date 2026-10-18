import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";
import { hashPassword, hashToken, passwordProblem, verifyPassword } from "./passwords";

describe("passwords", () => {
  it("hashes with a fresh salt and verifies", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("correct horse batterY", a)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("rejects weak passwords with a reason", () => {
    expect(passwordProblem("short")).toMatch(/10 characters/);
    expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/repeated/);
    expect(passwordProblem("my-password-1")).toMatch(/easy to guess/);
    expect(passwordProblem("sam.lee.secret.1", { email: "sam.lee@x.com" })).toMatch(/email/);
    expect(passwordProblem("tulip-orbit-cadence")).toBeNull();
  });

  it("hashes tokens deterministically", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).toHaveLength(64);
  });
});

describe("toCsv", () => {
  it("quotes values, adds a BOM and neutralises formulas", () => {
    const csv = toCsv(
      [
        { name: "Ann, Smith", note: '=HYPERLINK("x")', n: 3 },
        { name: "李", note: null, n: 0 },
      ],
      [
        { header: "Name", value: (r) => r.name },
        { header: "Note", value: (r) => r.note },
        { header: "N", value: (r) => r.n },
      ],
    );
    expect(csv).toBe('﻿Name,Note,N\r\n"Ann, Smith","\'=HYPERLINK(""x"")",3\r\n李,,0');
  });
});
