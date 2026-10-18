import { describe, expect, it } from "vitest";

import { buildTemplateContext, lintTemplate, renderTemplate, STANDARD_VARIABLES } from "./template";

describe("renderTemplate", () => {
  it("fills variables and falls back when blank", () => {
    const out = renderTemplate("Hi {{ firstName | there }}, {{company}}!", { firstName: "  ", company: "Acme" });
    expect(out).toBe("Hi there, Acme!");
  });

  it("renders missing variables without a fallback as empty", () => {
    expect(renderTemplate("[{{nope}}]", {})).toBe("[]");
  });
});

describe("lintTemplate", () => {
  it("flags unknown variables and optional ones without a fallback", () => {
    const issues = lintTemplate("Hi {{firstName}} at {{companyy}}, {{email}}", STANDARD_VARIABLES);
    expect(issues.map((i) => [i.severity, i.variable])).toEqual([
      ["warning", "firstName"],
      ["error", "companyy"],
    ]);
  });

  it("accepts optional variables that have a fallback", () => {
    expect(lintTemplate("Hi {{firstName|there}}", STANDARD_VARIABLES)).toEqual([]);
  });
});

describe("buildTemplateContext", () => {
  it("lets standard fields win over same-named attributes", () => {
    const ctx = buildTemplateContext(
      { email: "a@b.co", firstName: "Ann", lastName: null, company: null, attributes: { firstName: "X", city: "Oslo" } },
      { fromName: "Sam Lee" },
    );
    expect(ctx.firstName).toBe("Ann");
    expect(ctx.city).toBe("Oslo");
    expect(ctx.fullName).toBe("Ann");
    expect(ctx.senderFirstName).toBe("Sam");
  });
});
