"use client";

import Link from "next/link";
import { ReactNode, useState } from "react";
import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";

/**
 * Pricing section. Three tiers, single highlight, monthly/yearly toggle,
 * reassurance row beneath. Unit of value is "posts" (a carousel + caption
 * export) rather than tokens or credits, because that's what writers can
 * actually plan against.
 *
 * Layout grammar borrowed from Napkin's pricing page: clear ladder, one
 * "popular" tier elevated, identical feature-list rhythm per card, and a
 * generous reassurance row instead of urgency tactics. Voice stays in
 * Readopp's register (editorial, low-stakes, writer-first).
 */

type Billing = "monthly" | "yearly";

interface Plan {
  id: string;
  name: string;
  tagline: string;
  badge?: string;
  monthly: number;
  yearly: number;
  highlight?: boolean;
  cta: { text: string; href: string };
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: "reader",
    name: "Reader",
    tagline: "For finding out if you'll use it.",
    monthly: 0,
    yearly: 0,
    cta: { text: "Start free", href: "#try" },
    features: [
      "3 posts per month",
      "5 starter templates",
      "PNG carousel export",
      "Single user",
      "Readopp watermark",
    ],
  },
  {
    id: "author",
    name: "Author",
    tagline: "For people who post weekly.",
    badge: "Most popular",
    monthly: 12,
    yearly: 9,
    highlight: true,
    cta: { text: "Get Author", href: "/signup?plan=author" },
    features: [
      "60 posts per month",
      "All 19 templates",
      "PNG, MP4 and GIF export",
      "Your brand color and no watermark",
      "Long sources — up to 12,000 words",
      "Permalink + revision history",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "For teams running content together.",
    badge: "For teams",
    monthly: 29,
    yearly: 22,
    cta: { text: "Start team trial", href: "/signup?plan=studio" },
    features: [
      "Unlimited posts",
      "3 seats included, +$22 per extra seat",
      "Brand kit — logo, fonts, palette",
      "Custom template requests",
      "Priority generation queue",
      "Shared workspace and audit log",
    ],
  },
];

export function Pricing() {
  const [billing, setBilling] = useState<Billing>("yearly");

  return (
    <section id="pricing" className="section-amb amb-br border-b border-paper-line bg-surface">
      <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
        <Reveal>
          <SectionLabel title="Pricing" />
        </Reveal>
        <Reveal delayMs={60}>
          <h2 className="mt-6 max-w-3xl font-display text-3xl font-medium leading-[1.1] tracking-tight text-ink sm:text-[40px]">
            Free until you find your rhythm.
          </h2>
        </Reveal>
        <Reveal delayMs={120}>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
            One price per writer &mdash; never per word, per minute, or per
            credit. Cancel any month and the carousels you&rsquo;ve already made
            keep working.
          </p>
        </Reveal>

        <Reveal delayMs={180}>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <BillingToggle billing={billing} onChange={setBilling} />
            <span className="text-[12px] text-ink-muted">
              {billing === "yearly"
                ? "Billed yearly — 25% off"
                : "Switch to yearly to save 25%"}
            </span>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-3 sm:gap-6 sm:pt-4">
          {PLANS.map((p, i) => (
            <Reveal key={p.id} delayMs={240 + i * 70}>
              <PlanCard plan={p} billing={billing} />
            </Reveal>
          ))}
        </div>

        <Reveal delayMs={520}>
          <p className="mt-12 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-[13px] text-ink-muted">
            <span>Cancel anytime</span>
            <span aria-hidden className="text-ink-faint">
              &middot;
            </span>
            <span>No credit card for Reader</span>
            <span aria-hidden className="text-ink-faint">
              &middot;
            </span>
            <span>Fair-use limits apply</span>
            <span aria-hidden className="text-ink-faint">
              &middot;
            </span>
            <span>Prices in USD</span>
          </p>
        </Reveal>

        <Reveal delayMs={560}>
          <p className="mt-5 text-center text-sm text-ink-soft">
            A post = one carousel + caption export, regardless of source length.
          </p>
        </Reveal>

        <Reveal delayMs={600}>
          <p className="mt-8 text-center text-sm text-ink-soft">
            Need 10+ seats, SSO, or a custom contract?{" "}
            <Link
              href="mailto:hello@readopp.ai"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Talk to us &rarr;
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function BillingToggle({
  billing,
  onChange,
}: {
  billing: Billing;
  onChange: (b: Billing) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Billing period"
      className="inline-flex items-center gap-1 rounded-full border border-paper-line bg-surface p-1 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
    >
      <ToggleBtn
        active={billing === "monthly"}
        onClick={() => onChange("monthly")}
      >
        Monthly
      </ToggleBtn>
      <ToggleBtn
        active={billing === "yearly"}
        onClick={() => onChange("yearly")}
      >
        <span className="flex items-center gap-2">
          Yearly
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
              billing === "yearly"
                ? "bg-white/20 text-paper"
                : "bg-accent-soft text-accent-deep"
            }`}
          >
            &minus;25%
          </span>
        </span>
      </ToggleBtn>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-ink text-paper"
          : "text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const price = billing === "yearly" ? plan.yearly : plan.monthly;
  const isPaid = plan.monthly > 0;
  const isHighlight = plan.highlight === true;

  return (
    <article
      className={`relative flex h-full flex-col rounded-2xl border bg-surface p-7 transition-transform duration-500 ${
        isHighlight
          ? "border-accent shadow-[0_24px_60px_-30px_rgba(232,93,42,0.45)] sm:-translate-y-2 sm:hover:-translate-y-3"
          : "border-paper-line shadow-[0_1px_2px_rgba(23,23,23,0.04)] hover:-translate-y-0.5"
      }`}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span
            className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold tracking-tight ${
              isHighlight
                ? "bg-accent text-white"
                : "bg-paper-soft text-ink-soft"
            }`}
          >
            {plan.badge}
          </span>
        </div>
      )}

      <h3 className="text-lg font-medium text-ink">{plan.name}</h3>
      <p className="mt-1 text-sm text-ink-soft">{plan.tagline}</p>

      <div className="mt-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-semibold tracking-tight text-ink">
            ${price}
          </span>
          <span className="text-sm text-ink-muted">{isPaid ? "/mo" : ""}</span>
        </div>
        {isPaid && billing === "yearly" && (
          <p className="mt-1 text-[12px] text-ink-muted">
            Billed yearly &middot;{" "}
            <span className="line-through">${plan.monthly}</span> /mo if paid
            monthly
          </p>
        )}
        {isPaid && billing === "monthly" && (
          <p className="mt-1 text-[12px] text-ink-muted">Billed monthly</p>
        )}
        {!isPaid && (
          <p className="mt-1 text-[12px] text-ink-muted">
            Forever &middot; no credit card
          </p>
        )}
      </div>

      <Link
        href={plan.cta.href}
        className={`mt-7 ${isHighlight ? "btn-accent" : isPaid ? "btn-primary" : "btn-ghost"}`}
      >
        {plan.cta.text}
        <span aria-hidden>&rarr;</span>
      </Link>

      <ul className="mt-7 space-y-3 border-t border-paper-line pt-6">
        {plan.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-3 text-[13.5px] leading-relaxed text-ink-soft"
          >
            <CheckIcon highlight={isHighlight} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function CheckIcon({ highlight }: { highlight: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={`mt-[3px] h-3.5 w-3.5 shrink-0 ${
        highlight ? "text-accent" : "text-ink"
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.5 L 6.5 12 L 13 4" />
    </svg>
  );
}
