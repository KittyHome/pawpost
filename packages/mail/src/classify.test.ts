import { describe, expect, it } from "vitest";

import { classifyInbound } from "./classify";
import { classifySmtpError } from "./smtp";
import type { InboundMessage } from "./types";

const message = (overrides: Partial<InboundMessage>): InboundMessage => ({
  uid: 1,
  from: "ann@example.com",
  subject: "Re: Quick idea",
  inReplyTo: "<m1@send.test>",
  references: ["<m0@send.test>", "<m1@send.test>"],
  headers: {},
  contentType: "text/plain",
  text: "Sounds good, let's talk.",
  raw: "",
  ...overrides,
});

const gmailBounce = [
  "From: Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
  'Content-Type: multipart/report; report-type=delivery-status; boundary="b"',
  "X-Failed-Recipients: Gone@Example.com",
  "",
  "--b",
  "Content-Type: message/delivery-status",
  "",
  "Final-Recipient: rfc822; gone@example.com",
  "Action: failed",
  "Status: 5.1.1",
  "",
  "--b",
  "Content-Type: message/rfc822",
  "",
  "Message-ID: <abc-123@send.test>",
  "Subject: Quick idea",
].join("\n");

describe("classifyInbound", () => {
  it("recognises a hard bounce and the original Message-ID", () => {
    const result = classifyInbound(
      message({
        from: "mailer-daemon@googlemail.com",
        subject: "Delivery Status Notification (Failure)",
        contentType: 'multipart/report; report-type="delivery-status"; boundary="b"',
        raw: gmailBounce,
      }),
    );
    expect(result).toEqual({
      kind: "bounce",
      permanent: true,
      recipients: ["gone@example.com"],
      referencedMessageIds: ["<abc-123@send.test>"],
    });
  });

  it("does not treat a delay notice as a permanent bounce", () => {
    const raw = gmailBounce.replace("Action: failed", "Action: delayed").replace("Status: 5.1.1", "Status: 4.4.7");
    expect(classifyInbound(message({ from: "mailer-daemon@googlemail.com", raw }))).toMatchObject({
      kind: "bounce",
      permanent: false,
    });
  });

  it("separates out-of-office replies from human replies", () => {
    expect(classifyInbound(message({ headers: { "auto-submitted": "auto-replied" } })).kind).toBe("auto_reply");
    expect(classifyInbound(message({ subject: "Out of Office: Quick idea" })).kind).toBe("auto_reply");
    expect(classifyInbound(message({}))).toEqual({
      kind: "reply",
      referencedMessageIds: ["<m1@send.test>", "<m0@send.test>"],
    });
  });
});

describe("classifySmtpError", () => {
  it("maps nodemailer errors to retry decisions", () => {
    expect(classifySmtpError({ code: "EAUTH", response: "535 bad credentials" }).kind).toBe("mailbox_problem");
    expect(classifySmtpError({ code: "ECONNECTION", message: "refused" }).kind).toBe("not_sent");
    expect(
      classifySmtpError({ code: "EENVELOPE", command: "RCPT TO", responseCode: 550, response: "550 5.1.1 user unknown" }).kind,
    ).toBe("recipient_rejected");
    expect(
      classifySmtpError({
        code: "EMESSAGE",
        command: "DATA",
        responseCode: 550,
        response: "550 5.4.5 Daily user sending quota exceeded",
      }).kind,
    ).toBe("mailbox_problem");
    expect(classifySmtpError({ code: "ESOCKET", message: "socket hang up" }).kind).toBe("unknown");
  });
});
