import { describe, expect, it } from "vitest";

import { cleanName, isValidEmail } from "./contacts";
import { CsvFormatError, parseContactsCsv } from "./csv";

describe("parseContactsCsv", () => {
  it("maps Name,Email files, cleans names and rejects bad rows", () => {
    const csv = [
      "﻿Name,Email,City",
      "Andrew Yuan,Yuan59880@Gmail.com,Oslo",
      "aa5536,aa5536@columbia.edu,",
      "Dup,yuan59880@gmail.com,",
      "Info Box,info@acme.com,",
      "Broken,not-an-email,",
      "ALICE SMITH,alice@acme.com,Paris",
    ].join("\n");

    const result = parseContactsCsv(csv);

    expect(result.attributeColumns).toEqual(["City"]);
    expect(result.contacts).toEqual([
      {
        line: 2,
        email: "yuan59880@gmail.com",
        firstName: "Andrew",
        lastName: "Yuan",
        company: null,
        attributes: { City: "Oslo" },
      },
      { line: 3, email: "aa5536@columbia.edu", firstName: null, lastName: null, company: null, attributes: {} },
      { line: 7, email: "alice@acme.com", firstName: "Alice", lastName: "Smith", company: null, attributes: { City: "Paris" } },
    ]);
    expect(result.rejected).toEqual([
      { line: 4, email: "yuan59880@gmail.com", reason: "duplicate" },
      { line: 5, email: "info@acme.com", reason: "role_address" },
      { line: 6, email: "not-an-email", reason: "invalid_email" },
    ]);
  });

  it("prefers explicit first/last name columns", () => {
    const result = parseContactsCsv("email,first_name,Last Name,Company\nx@y.io,jo,DOE,Acme");
    expect(result.contacts[0]).toMatchObject({ firstName: "Jo", lastName: "Doe", company: "Acme" });
  });

  it("fails clearly without an email column", () => {
    expect(() => parseContactsCsv("Name,Phone\nA,1")).toThrow(CsvFormatError);
  });
});

describe("contact hygiene", () => {
  it("treats handles and initials as missing names", () => {
    expect(cleanName("alexramsdell", "alexramsdell@gmail.com").firstName).toBeNull();
    expect(cleanName("adamw17", "a@gmail.com").firstName).toBeNull();
    expect(cleanName("A.", "a@gmail.com").firstName).toBeNull();
    expect(cleanName("Charlie", "charleezyguan@gmail.com").firstName).toBe("Charlie");
    expect(cleanName("mary-jane o'neil", "mj@x.com")).toEqual({ firstName: "Mary-Jane", lastName: "O'Neil" });
  });

  it("validates addresses", () => {
    expect(isValidEmail("a.b+c@sub.example.co")).toBe(true);
    expect(isValidEmail("a..b@example.com")).toBe(false);
    expect(isValidEmail("a@localhost")).toBe(false);
  });
});
