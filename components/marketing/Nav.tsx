"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthMenu } from "@/components/AuthMenu";

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
        "sticky top-0 z-40 w-full transition-colors " +
        (scrolled
          ? "border-b border-paper-line bg-paper/85 backdrop-blur"
          : "border-b border-transparent bg-transparent")
      }
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="inline-flex items-baseline gap-2 text-base font-semibold tracking-tight text-ink"
          aria-label="Readopp — home"
        >
          <span aria-hidden className="inline-block h-2 w-2 translate-y-px rounded-full bg-accent" />
          Readopp
        </Link>
        <div className="flex items-center gap-1 text-sm">
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
            href="#faq"
            className="hidden rounded-md px-3 py-1.5 text-ink-muted transition-colors hover:text-ink sm:inline-block"
          >
            Questions
          </a>
          <a
            href="#try"
            className="ml-2 rounded-md border border-ink px-3.5 py-1.5 font-medium text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            Try it
          </a>
          <span aria-hidden className="mx-1 h-5 w-px bg-paper-line" />
          <AuthMenu />
        </div>
      </div>
    </nav>
  );
}
