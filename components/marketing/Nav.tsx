"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthMenu } from "@/components/AuthMenu";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      aria-label="Primary"
      className={
        "sticky top-0 z-40 w-full bg-paper/88 backdrop-blur-xl transition-colors " +
        (scrolled
          ? "border-b border-paper-line"
          : "border-b border-transparent")
      }
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 font-display text-xl font-semibold tracking-[-0.03em] text-ink"
          aria-label="Readopp — home"
        >
          <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-sky text-[10px] font-sans font-bold text-white">R</span>
          Readopp
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <a
            href="#templates"
            className="hidden rounded-md px-3 py-1.5 text-ink-muted transition-colors hover:text-ink sm:inline-block"
          >
            Templates
          </a>
          <a
            href="#how-it-works"
            className="hidden rounded-md px-3 py-1.5 text-ink-muted transition-colors hover:text-ink sm:inline-block"
          >
            How it works
          </a>
          <a
            href="#use-cases"
            className="hidden rounded-md px-3 py-1.5 text-ink-muted transition-colors hover:text-ink sm:inline-block"
          >
            For
          </a>
          <a
            href="#pricing"
            className="hidden rounded-md px-3 py-1.5 text-ink-muted transition-colors hover:text-ink sm:inline-block"
          >
            Pricing
          </a>
          <a
            href="#faq"
            className="hidden rounded-md px-3 py-1.5 text-ink-muted transition-colors hover:text-ink sm:inline-block"
          >
            Questions
          </a>
          <a
            href="#try"
            className="ml-2 rounded-full bg-sky px-4 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-sky-deep"
          >
            Try it
          </a>
          <span aria-hidden className="mx-1 h-5 w-px bg-paper-line" />
          <ThemeToggle />
          <AuthMenu />
        </div>
      </div>
    </nav>
  );
}
