"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MobileNav } from "./MobileNav";
import { AuthMenu } from "@/components/AuthMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getBrowserSupabase } from "@/lib/supabase/client";

import { PRO_FEATURES_ENABLED } from "@/lib/featureFlags";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;

    async function refreshAuth() {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) {
        setSignedIn(!!data.user && data.user.is_anonymous !== true);
      }
    }

    void refreshAuth();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void refreshAuth();
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <nav
      aria-label="Primary"
      className={
        "landing-nav sticky top-0 z-40 w-full bg-surface/95 transition-colors " +
        (scrolled
          ? "border-b border-paper-line"
          : "border-b border-transparent")
      }
    >
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-2 px-4 py-4 sm:gap-4 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 font-sans text-xl font-bold tracking-[-0.04em] text-ink"
          aria-label="Readopp — home"
        >
          <span aria-hidden className="brand-mark grid h-8 w-8 rotate-[-8deg] place-items-center rounded-xl bg-[#cce68a] text-sm text-[#484848]">R</span>
          Readopp
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <a
            href="/#try"
            className="hidden rounded-md px-3 py-1.5 text-ink-soft transition-colors hover:text-ink sm:inline-block"
          >
            Create a story
          </a>
          <a
            href="/#how-it-works"
            className="hidden rounded-md px-3 py-1.5 text-ink-soft transition-colors hover:text-ink sm:inline-block"
          >
            How it works
          </a>
          {PRO_FEATURES_ENABLED && (
          <Link
            href="/pricing"
            className="hidden rounded-md px-3 py-1.5 text-ink-soft transition-colors hover:text-ink lg:inline-block"
          >
            Pricing
          </Link>
          )}
          {signedIn && (
            <Link
              href="/library"
              className="hidden rounded-md px-2 py-1.5 font-semibold text-ink-soft transition-colors hover:text-ink sm:inline-block sm:px-3"
            >
              Library
            </Link>
          )}
          <a
            href="/#try"
            className="ml-2 hidden rounded-xl bg-ink px-4 py-2.5 text-xs font-semibold text-paper transition hover:bg-ink/90 sm:inline-block"
          >
            Start creating
          </a>
          <span className="flex items-center">
            <span aria-hidden className="mx-1 hidden h-5 w-px bg-paper-line sm:block" />
            <ThemeToggle />
            <AuthMenu />
            <MobileNav signedIn={signedIn} />
          </span>
        </div>
      </div>
    </nav>
  );
}
