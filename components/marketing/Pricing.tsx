"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";
import { Squiggle } from "./Squiggle";

/**
 * Pricing as a receipt, not a SaaS card grid. The receipt is one of
 * Readopp's own template formats, so the pricing section doubles as a
 * product demo: move the "how much do you post?" slider (or tap a plan)
 * and the receipt re-prints with line items, a yearly discount row, and
 * live cost-per-post math. Unit of value stays "posts" because that's
 * what writers can actually plan against.
 */

type Billing = "monthly" | "yearly";
type PlanId = "reader" | "author" | "studio";

interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  postsPerMonth: number | null; // null = unlimited
  cta: { text: string; href: string };
  lines: [string, string][];
}

const PLANS: Plan[] = [
  {
    id: "reader",
    name: "Reader",
    tagline: "For finding out if you'll use it.",
    monthly: 0,
    yearly: 0,
    postsPerMonth: 3,
    cta: { text: "Start free", href: "#try" },
    lines: [
      ["Posts / mo", "3"],
      ["Templates", "5 starter"],
      ["Export", "PNG"],
      ["Seats", "1"],
      ["Watermark", "Readopp"],
    ],
  },
  {
    id: "author",
    name: "Author",
    tagline: "For people who post weekly.",
    monthly: 12,
    yearly: 9,
    postsPerMonth: 60,
    cta: { text: "Get Author", href: "/signup?plan=author" },
    lines: [
      ["Posts / mo", "60"],
      ["Templates", "All 19"],
      ["Export", "PNG · MP4 · GIF"],
      ["Brand color", "Yours"],
      ["Source cap", "12,000 words"],
      ["Watermark", "None"],
    ],
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "For teams running content together.",
    monthly: 29,
    yearly: 22,
    postsPerMonth: null,
    cta: { text: "Start team trial", href: "/signup?plan=studio" },
    lines: [
      ["Posts / mo", "Unlimited"],
      ["Templates", "19 + custom"],
      ["Export", "PNG · MP4 · GIF"],
      ["Seats", "3 (+$22 extra)"],
      ["Brand kit", "Logo · fonts · palette"],
      ["Queue", "Priority"],
    ],
  },
];

// Representative slider positions when a plan is picked directly.
const TYPICAL_POSTS: Record<PlanId, number> = {
  reader: 3,
  author: 20,
  studio: 80,
};

function planForPosts(posts: number): PlanId {
  if (posts <= 3) return "reader";
  if (posts <= 60) return "author";
  return "studio";
}

export function Pricing() {
  const [billing, setBilling] = useState<Billing>("yearly");
  const [posts, setPosts] = useState(20);
  const [planId, setPlanId] = useState<PlanId>("author");
  // Demo mode: the slider sweeps on its own until the user touches any
  // control, then it's theirs for good.
  const [engaged, setEngaged] = useState(false);
  const [inView, setInView] = useState(false);
  // One-way "has this section ever been seen" flag. Used to gate one-shot
  // animations (like the receipt print) so they don't replay every time
  // the user scrolls past Pricing.
  const [seen, setSeen] = useState(false);
  const [reduced, setReduced] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const postsRef = useRef(posts);
  const dirRef = useRef(1);
  postsRef.current = posts;

  const plan = PLANS.find((p) => p.id === planId)!;
  const price = billing === "yearly" ? plan.yearly : plan.monthly;

  const onSlide = (value: number) => {
    setPosts(value);
    setPlanId(planForPosts(value));
  };

  const pickPlan = (id: PlanId) => {
    setEngaged(true);
    setPlanId(id);
    setPosts(TYPICAL_POSTS[id]);
  };

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) setSeen(true);
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (engaged || !inView || reduced) return;
    const id = setInterval(() => {
      let next = postsRef.current + dirRef.current;
      if (next >= 100) {
        next = 100;
        dirRef.current = -1;
      } else if (next <= 1) {
        next = 1;
        dirRef.current = 1;
      }
      onSlide(next);
    }, 150);
    return () => clearInterval(id);
  }, [engaged, inView, reduced]);

  return (
    <section id="pricing" ref={sectionRef} className="border-b border-paper-line bg-paper">
      {/* Lavender island: pinned light in both themes, like the sage
          "Your explainers" section — the user wants these to break from
          the site palette entirely. */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="force-light rounded-3xl bg-lavender-soft px-6 py-16 sm:px-12 sm:py-20">
        <Reveal>
          <SectionLabel title="Pricing" tone="lavender" />
        </Reveal>
        <Reveal delayMs={60}>
          <h2 className="mt-6 max-w-3xl font-display text-3xl font-medium leading-[1.1] tracking-tight text-ink sm:text-[40px]">
            Free until you find your{" "}
            <Squiggle className="[--squiggle:rgb(var(--c-lavender))]">
              rhythm
            </Squiggle>
            .
          </h2>
        </Reveal>
        <Reveal delayMs={120}>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
            One price per writer &mdash; never per word, per minute, or per
            credit. Slide to how much you actually post and we&rsquo;ll print
            the bill.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:gap-16">
          {/* Left: the controls */}
          <Reveal delayMs={180}>
            <div className="lg:pt-4">
              <PostsSlider
                posts={posts}
                onChange={(v) => {
                  setEngaged(true);
                  onSlide(v);
                }}
                plan={plan}
                billing={billing}
              />

              <div className="mt-10">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                  Billing
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <BillingToggle
                    billing={billing}
                    onChange={(b) => {
                      setEngaged(true);
                      setBilling(b);
                    }}
                  />
                  <span className="text-[12px] text-ink-muted">
                    {billing === "yearly"
                      ? "Yearly — 25% off, printed on the receipt"
                      : "Switch to yearly to save 25%"}
                  </span>
                </div>
              </div>

              <div className="mt-10">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                  Or pick directly
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2.5">
                  {PLANS.map((p) => {
                    const active = p.id === planId;
                    const pPrice = billing === "yearly" ? p.yearly : p.monthly;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => pickPlan(p.id)}
                        aria-pressed={active}
                        className={`rounded-xl border px-3 py-3 text-left transition-all duration-200 ${
                          active
                            ? "border-lavender bg-white shadow-[0_8px_24px_-14px_rgb(var(--c-lavender)/0.6)]"
                            : "border-transparent bg-white shadow-[0_1px_2px_rgba(60,45,90,0.06)] hover:-translate-y-0.5 hover:border-lavender/40"
                        }`}
                      >
                        <span className="block text-sm font-semibold tracking-tight text-ink">
                          {p.name}
                        </span>
                        <span
                          className={`mt-0.5 block text-[12px] ${
                            active ? "text-lavender-deep" : "text-ink-muted"
                          }`}
                        >
                          {pPrice === 0 ? "Free" : `$${pPrice}/mo`}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[13px] text-ink-soft">{plan.tagline}</p>
              </div>

              <p className="mt-10 text-sm text-ink-soft">
                Need 10+ seats, SSO, or a custom contract?{" "}
                <Link
                  href="mailto:hello@readopp.ai"
                  className="font-medium text-lavender-deep underline-offset-4 hover:underline"
                >
                  Talk to us &rarr;
                </Link>
              </p>
            </div>
          </Reveal>

          {/* Right: the receipt */}
          <Reveal delayMs={260}>
            <Receipt plan={plan} billing={billing} posts={posts} inView={seen} />
          </Reveal>
        </div>

        <Reveal delayMs={320}>
          <p className="mt-14 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-[13px] text-ink-muted">
            <span>Cancel anytime</span>
            <span aria-hidden className="text-ink-faint">&middot;</span>
            <span>No credit card for Reader</span>
            <span aria-hidden className="text-ink-faint">&middot;</span>
            <span>A post = one carousel + caption export</span>
            <span aria-hidden className="text-ink-faint">&middot;</span>
            <span>Prices in USD</span>
          </p>
        </Reveal>
        </div>
      </div>
    </section>
  );
}

function PostsSlider({
  posts,
  onChange,
  plan,
  billing,
}: {
  posts: number;
  onChange: (n: number) => void;
  plan: Plan;
  billing: Billing;
}) {
  const price = billing === "yearly" ? plan.yearly : plan.monthly;
  const perPost =
    plan.id === "reader"
      ? "free while you try it"
      : plan.postsPerMonth
      ? `≈ $${(price / plan.postsPerMonth).toFixed(2)} a post`
      : `flat $${price} — stop counting`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label
          htmlFor="posts-slider"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted"
        >
          How much do you post?
        </label>
        <span className="font-mono text-sm text-ink">
          {posts >= 100 ? "100+" : posts}{" "}
          <span className="text-ink-muted">posts / mo</span>
        </span>
      </div>
      <input
        id="posts-slider"
        type="range"
        min={1}
        max={100}
        value={posts}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-lavender/30"
        style={{ accentColor: "rgb(var(--c-lavender))" }}
      />
      <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-wide text-ink-faint">
        <span>once in a while</span>
        <span>weekly</span>
        <span>daily +</span>
      </div>
      <p className="mt-4 text-[15px] text-ink-soft">
        That&rsquo;s <span className="font-semibold text-ink">{plan.name}</span>{" "}
        territory — <span className="text-lavender-deep">{perPost}</span>.
      </p>
    </div>
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
      className="inline-flex items-center gap-1 rounded-full bg-white p-1 shadow-[0_1px_2px_rgba(60,45,90,0.08)]"
    >
      {(["monthly", "yearly"] as const).map((b) => (
        <button
          key={b}
          role="tab"
          aria-selected={billing === b}
          type="button"
          onClick={() => onChange(b)}
          className={`relative inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            billing === b ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
          }`}
        >
          {b === "monthly" ? "Monthly" : "Yearly"}
          {b === "yearly" && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                billing === "yearly"
                  ? "bg-white/20 text-paper"
                  : "bg-lavender-soft text-lavender-deep"
              }`}
            >
              &minus;25%
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// Deterministic bar widths so SSR and client agree.
const BARCODE = [3, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 2, 2, 1, 3, 1];

function Receipt({
  plan,
  billing,
  posts,
  inView,
}: {
  plan: Plan;
  billing: Billing;
  posts: number;
  inView: boolean;
}) {
  const price = billing === "yearly" ? plan.yearly : plan.monthly;
  const discount = plan.monthly - plan.yearly;
  const isPaid = plan.monthly > 0;

  return (
    <div className="mx-auto w-full max-w-sm rotate-[0.8deg] drop-shadow-[0_18px_30px_rgba(0,0,0,0.18)] transition-transform duration-500 ease-out hover:rotate-0 motion-reduce:rotate-0">
      {/* Printer slot the receipt hangs from */}
      <div className="relative z-10 mx-4 h-2.5 rounded-full bg-ink/90 dark:bg-dark" />

      <div className="-mt-1 overflow-hidden">
        {/* Re-keying re-runs the print animation on every change. inView
            is part of the key so the first run waits for viewport entry
            instead of finishing before the user scrolls down. */}
        <div
          key={`${plan.id}-${billing}-${inView ? "v" : "h"}`}
          className={
            "motion-reduce:animate-none " + (inView ? "receipt-print" : "")
          }
        >
          <div className="force-light bg-[#FFFDF8] px-7 pb-6 pt-7 font-mono text-[12.5px] leading-relaxed text-ink">
            <div className="text-center">
              <div className="text-[13px] font-bold uppercase tracking-[0.22em]">
                Readopp
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                * Pricing receipt — not a real charge *
              </div>
            </div>

            <Dashes />

            <Row label="Plan" value={plan.name.toUpperCase()} strong />
            <Row
              label="You post"
              value={`${posts >= 100 ? "100+" : posts} / MO`}
            />

            <Dashes />

            {plan.lines.map(([k, v]) => (
              <Row key={k} label={k} value={v} />
            ))}

            <Dashes />

            <Row
              label="Subtotal"
              value={isPaid ? `$${plan.monthly.toFixed(2)} /MO` : "$0.00"}
            />
            {billing === "yearly" && isPaid && (
              <Row
                label="Rhythm discount (yearly)"
                value={`-$${discount.toFixed(2)}`}
                accent
              />
            )}
            <div className="mt-2 flex items-end justify-between border-t-2 border-ink pt-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em]">
                Total
              </span>
              <span className="font-sans text-3xl font-semibold tracking-tight">
                ${price}
                <span className="ml-1 font-mono text-[11px] font-normal text-ink-muted">
                  {isPaid ? "/MO" : "FOREVER"}
                </span>
              </span>
            </div>
            {billing === "yearly" && isPaid && (
              <div className="mt-1 text-right text-[10px] uppercase tracking-wide text-ink-muted">
                Billed yearly · ${plan.monthly}/mo if monthly
              </div>
            )}

            <Link
              href={plan.cta.href}
              className={`mt-5 w-full ${plan.id === "author" ? "btn-lavender" : "btn-primary"}`}
            >
              {plan.cta.text}
              <span aria-hidden>&rarr;</span>
            </Link>

            {/* Barcode */}
            <div className="mt-6 flex h-8 items-stretch justify-center gap-[2px]" aria-hidden>
              {BARCODE.map((w, i) => (
                <span
                  key={i}
                  className="bg-ink"
                  style={{ width: `${w}px` }}
                />
              ))}
            </div>
            <div className="mt-2 text-center text-[9px] uppercase tracking-[0.18em] text-ink-muted">
              Cancel anytime · your carousels keep working
            </div>
          </div>

          {/* Perforated tear-off edge */}
          <svg
            viewBox="0 0 400 12"
            preserveAspectRatio="none"
            className="block h-3 w-full"
            aria-hidden
          >
            <path
              d="M0 0 L10 12 L20 0 L30 12 L40 0 L50 12 L60 0 L70 12 L80 0 L90 12 L100 0 L110 12 L120 0 L130 12 L140 0 L150 12 L160 0 L170 12 L180 0 L190 12 L200 0 L210 12 L220 0 L230 12 L240 0 L250 12 L260 0 L270 12 L280 0 L290 12 L300 0 L310 12 L320 0 L330 12 L340 0 L350 12 L360 0 L370 12 L380 0 L390 12 L400 0 Z"
              fill="#FFFDF8"
            />
          </svg>
        </div>
      </div>

      <style jsx>{`
        :global(.receipt-print) {
          animation: receiptPrint 600ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes receiptPrint {
          from {
            opacity: 0;
            transform: translateY(-18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 py-[3px]">
      <span
        className={`shrink-0 uppercase tracking-wide ${
          strong ? "font-bold" : "text-ink-soft"
        } ${accent ? "text-accent-deep" : ""}`}
      >
        {label}
      </span>
      <span className="min-w-4 flex-1 border-b border-dotted border-ink/30" aria-hidden />
      <span
        className={`shrink-0 text-right ${strong ? "font-bold" : ""} ${
          accent ? "font-semibold text-accent-deep" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Dashes() {
  return (
    <div className="my-3 border-t border-dashed border-ink/30" aria-hidden />
  );
}
