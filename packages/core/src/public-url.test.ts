import { describe, expect, it } from "vitest";

import { checkPublicUrl } from "./public-url";

describe("public URL check", () => {
  it("accepts HTTPS on a domain", () => {
    expect(checkPublicUrl("https://app.example.com")).toEqual({ problem: null, message: null });
    expect(checkPublicUrl("https://outreach.example.co.uk:8443/base").problem).toBeNull();
  });

  it("flags addresses recipients can't use or filters distrust", () => {
    expect(checkPublicUrl("http://localhost:3000").problem).toBe("localhost");
    expect(checkPublicUrl("http://127.0.0.1:3000").problem).toBe("localhost");
    expect(checkPublicUrl("http://[::1]:3000").problem).toBe("localhost");
    expect(checkPublicUrl("http://147.93.180.134:3000").problem).toBe("ip_address");
    expect(checkPublicUrl("https://147.93.180.134").problem).toBe("ip_address");
    expect(checkPublicUrl("https://[2001:db8::1]").problem).toBe("ip_address");
    expect(checkPublicUrl("http://app.example.com").problem).toBe("not_https");
    expect(checkPublicUrl("app.example.com").problem).toBe("invalid");
  });

  it("explains the problem", () => {
    expect(checkPublicUrl("http://147.93.180.134:3000").message).toMatch(/IP address/);
  });
});
