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
        "force-light sticky top-0 z-40 w-full bg-white/95 transition-colors " +
        (scrolled
          ? "border-b border-paper-line"
          : "border-b border-transparent")
      }
    >
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 font-sans text-xl font-bold tracking-[-0.04em] text-[#484848]"
          aria-label="Readopp — home"
        >
          <span aria-hidden className="brand-mark grid h-8 w-8 rotate-[-8deg] place-items-center rounded-xl bg-[#cce68a] text-sm text-[#484848]">R</span>
          Readopp
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <a
            href="#try"
            className="hidden rounded-md px-3 py-1.5 text-[#666] transition-colors hover:text-[#333] sm:inline-block"
          >
            Make a post
          </a>
          <a
            href="#how-it-works"
            className="hidden rounded-md px-3 py-1.5 text-[#666] transition-colors hover:text-[#333] sm:inline-block"
          >
            How it works
          </a>
          <a
            href="#pricing"
            className="hidden rounded-md px-3 py-1.5 text-[#666] transition-colors hover:text-[#333] lg:inline-block"
          >
            Pricing
          </a>
          <a
            href="#try"
            className="ml-2 hidden rounded-xl bg-[#484848] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#333] sm:inline-block"
          >
            Try it free
          </a>
          <span className="flex items-center">
            <span aria-hidden className="mx-1 hidden h-5 w-px bg-[#e5e5e5] sm:block" />
            <ThemeToggle className="hidden sm:inline-flex" />
            <AuthMenu />
          </span>
        </div>
      </div>
    </nav>
  );
}
