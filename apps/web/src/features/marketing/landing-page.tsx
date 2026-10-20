import {
  BanIcon,
  BookOpenIcon,
  InboxIcon,
  LockIcon,
  MailIcon,
  ScaleIcon,
  SendIcon,
  ServerIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { LogoMark } from "@/components/logo-mark";

const GITHUB = "https://github.com/KittyHome/pawpost";
const LICENSE = `${GITHUB}/blob/main/LICENSE.md`;
const CONTACT = "mailto:hello@kittyhome.org";

const FEATURES = [
  {
    icon: InboxIcon,
    title: "Your mailboxes, rotated",
    body: "Connect Google Workspace, Microsoft 365 or any SMTP/IMAP account. Each mailbox has a daily cap and a gap between sends.",
  },
  {
    icon: MailIcon,
    title: "Sequences that thread",
    body: "A first email plus follow-ups. An empty subject sends the next step as a reply in the same thread, from the same mailbox.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Stops when it should",
    body: "IMAP sync spots replies, out-of-office notices and bounce reports, and ends that contact's sequence.",
  },
  {
    icon: ScaleIcon,
    title: "Compliance in every send",
    body: "Postal address, unsubscribe link and one-click unsubscribe headers. Opt-outs and bounces go on a global suppression list.",
  },
  {
    icon: BanIcon,
    title: "Automatic brakes",
    body: "A campaign pauses itself when bounces pass 2% or unsubscribes pass 5%. List hygiene runs on every import.",
  },
  {
    icon: SparklesIcon,
    title: "Optional AI assist",
    body: "Draft a sequence from a brief, review an email for spam signals, and triage replies. Bring your own OpenAI key.",
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Connect mailboxes",
    body: "Add the inboxes you already own. Pawpost sends and reads from them. Nothing is relayed through a third-party sender.",
  },
  {
    n: "02",
    title: "Import a list",
    body: "Duplicates, invalid addresses, role inboxes and suppressed contacts are rejected with reasons before they ever queue.",
  },
  {
    n: "03",
    title: "Write a sequence and start",
    body: "Plain-text steps, a schedule and mailbox limits. The worker sends at a human pace and stops on replies or bounces.",
  },
] as const;

export function LandingPage({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b border-neutral-200/80 bg-[#fafafa]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <LogoMark />
            Pawpost
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
            <a
              href="#features"
              className="hidden rounded-md px-3 py-2 text-sm text-neutral-600 hover:text-neutral-950 sm:inline"
            >
              Features
            </a>
            <a href="#self-host" className="hidden rounded-md px-3 py-2 text-sm text-neutral-600 hover:text-neutral-950 sm:inline">
              Self-host
            </a>
            <a
              href={GITHUB}
              className="hidden rounded-md px-3 py-2 text-sm text-neutral-600 hover:text-neutral-950 md:inline"
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            {signedIn ? (
              <Link
                href="/overview"
                className="ml-1 inline-flex h-9 items-center rounded-md bg-neutral-950 px-3.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Open app
              </Link>
            ) : (
              <Link
                href="/login"
                className="ml-1 inline-flex h-9 items-center rounded-md bg-neutral-950 px-3.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600">
              <span className="size-1.5 rounded-full bg-orange-500" aria-hidden />
              Source-available · PolyForm Noncommercial
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
              Cold email on mailboxes you already own
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-pretty text-neutral-600">
              Pawpost is self-hosted outreach you run yourself. Sequences, inbox sync, suppressions and a team dashboard
              — no third-party sender in the middle.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#self-host"
                className="inline-flex h-11 items-center rounded-md bg-neutral-950 px-5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Self-host Pawpost
              </a>
              <a
                href={GITHUB}
                className="inline-flex h-11 items-center rounded-md border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-950 hover:bg-neutral-50"
                rel="noreferrer"
                target="_blank"
              >
                View the source
              </a>
            </div>
          </div>

          <div className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_24px_80px_-24px_rgba(23,23,23,0.18)]">
            <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-neutral-300" aria-hidden />
              <span className="size-2.5 rounded-full bg-neutral-300" aria-hidden />
              <span className="size-2.5 rounded-full bg-neutral-300" aria-hidden />
              <span className="mx-auto hidden h-6 min-w-48 items-center justify-center rounded-md border border-neutral-200 bg-white px-3 text-xs text-neutral-400 sm:flex">
                your-install.example
              </span>
            </div>
            <Image
              src="/banner.png"
              alt="Pawpost: an orange envelope with a paw print"
              width={1400}
              height={700}
              priority
              className="h-auto w-full"
            />
          </div>
        </section>

        <section id="features" className="scroll-mt-20 border-t border-neutral-200 bg-white">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-orange-600">What it does</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Built like an engine, not a blast tool</h2>
              <p className="mt-4 text-neutral-600">
                You bring the mailboxes and the list. Pawpost sends short plain-text sequences at a human pace, reads the
                same inboxes, and stops when it should.
              </p>
            </div>
            <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="bg-white p-6 sm:p-8">
                  <feature.icon className="size-5 text-orange-600" aria-hidden />
                  <h3 className="mt-4 text-base font-semibold tracking-tight">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">{feature.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-neutral-200 bg-[#fafafa]">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-orange-600">How it works</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Three steps to the first send</h2>
            </div>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map((step) => (
                <li key={step.n} className="relative">
                  <span className="font-mono text-xs font-medium text-neutral-400">{step.n}</span>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-neutral-200 bg-white">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-20 sm:py-24 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-medium text-orange-600">Your data stays put</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">One organisation per install</h2>
              <p className="mt-4 leading-relaxed text-neutral-600">
                Owner, admin and member roles. Invitations by link. Server-side sessions you can review and revoke. CSV
                exports, a 30-day trash, one-step privacy erase, and an audit log of who changed what.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-neutral-700">
                <li className="flex gap-3">
                  <LockIcon className="mt-0.5 size-4 shrink-0 text-orange-600" aria-hidden />
                  Email and password sign-in. No third-party identity provider required.
                </li>
                <li className="flex gap-3">
                  <BookOpenIcon className="mt-0.5 size-4 shrink-0 text-orange-600" aria-hidden />
                  A built-in help center, with a “?” on every page that needs one.
                </li>
                <li className="flex gap-3">
                  <SendIcon className="mt-0.5 size-4 shrink-0 text-orange-600" aria-hidden />
                  A separate worker is the only process that talks SMTP or IMAP.
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-[#fafafa] p-6 sm:p-8">
              <p className="text-sm font-medium text-neutral-950">Use it responsibly</p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                Cold email is regulated. Honest headers, a postal address and a working opt-out are required almost
                everywhere; the EU, UK and Canada generally require consent for messages to individuals. Pawpost
                enforces the mechanics. Whether you may contact someone is yours.
              </p>
            </div>
          </div>
        </section>

        <section id="self-host" className="scroll-mt-20 border-t border-neutral-200 bg-neutral-950 text-white">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-20 sm:py-24 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-medium text-orange-400">
                <ServerIcon className="size-4" aria-hidden />
                Self-host
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Run it on your own server</h2>
              <p className="mt-4 leading-relaxed text-neutral-400">
                Docker Compose starts Postgres, the worker and the dashboard. Point DNS at the box, then run the domain
                script for HTTPS. Source-available under PolyForm Noncommercial 1.0.0 — not open source.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={GITHUB}
                  className="inline-flex h-11 items-center rounded-md bg-white px-5 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
                  rel="noreferrer"
                  target="_blank"
                >
                  Repository
                </a>
                <a
                  href={`${GITHUB}#self-hosting`}
                  className="inline-flex h-11 items-center rounded-md border border-white/20 px-5 text-sm font-medium text-white hover:bg-white/10"
                  rel="noreferrer"
                  target="_blank"
                >
                  Self-hosting guide
                </a>
              </div>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-5 font-mono text-[13px] leading-7 text-neutral-200">
              <code>
                {`git clone ${GITHUB}.git
cd pawpost
cp .env.example .env
docker compose up -d`}
              </code>
            </pre>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <LogoMark className="size-7!" />
              Pawpost
            </Link>
            <p className="mt-3 max-w-sm text-sm text-neutral-500">
              A{" "}
              <a href="https://www.kittyhome.org" className="underline-offset-4 hover:underline" rel="noreferrer" target="_blank">
                KittyHome
              </a>{" "}
              product. Source-available, self-hosted cold email outreach.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-neutral-600">
            <a href={GITHUB} className="hover:text-neutral-950" rel="noreferrer" target="_blank">
              GitHub
            </a>
            <a href={LICENSE} className="hover:text-neutral-950" rel="noreferrer" target="_blank">
              License
            </a>
            <a href={CONTACT} className="hover:text-neutral-950">
              hello@kittyhome.org
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
