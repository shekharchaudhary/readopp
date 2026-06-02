"use client";

import { useEffect, useRef, useState } from "react";
import { signInWithGoogle, signOut } from "@/lib/supabase/auth";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { GoogleLogo } from "./GoogleLogo";

interface AuthState {
  loading: boolean;
  /** True for a real signed-in user. Anonymous and signed-out both render the "Sign in" button. */
  signedIn: boolean;
  email: string | null;
}

/**
 * Nav-bar auth widget.
 *
 * - Loading: nothing (avoids flicker).
 * - Anonymous OR signed-out: a "Sign in" button that kicks off Google OAuth.
 * - Permanent user: their email + a "Sign out" affordance.
 */
export function AuthMenu() {
  const [state, setState] = useState<AuthState>({
    loading: true,
    signedIn: false,
    email: null,
  });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;

    async function refresh() {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const u = data.user;
      const signedIn = !!u && u.is_anonymous !== true;
      setState({
        loading: false,
        signedIn,
        email: u?.email ?? null,
      });
    }
    refresh();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Click-outside to close the dropdown.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    const t = window.setTimeout(
      () => window.addEventListener("mousedown", onDown),
      0
    );
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  if (state.loading) {
    // Same footprint as the Sign in button so the nav doesn't jump when the
    // session resolves a few hundred ms later.
    return (
      <div
        aria-hidden
        className="h-7 w-[68px] rounded-md bg-paper-soft motion-safe:animate-pulse"
      />
    );
  }

  if (!state.signedIn) {
    return (
      <button
        type="button"
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          try {
            await signInWithGoogle("/");
          } catch {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {!busy && <GoogleLogo size={14} />}
        {busy ? "…" : "Sign in"}
      </button>
    );
  }

  // Signed-in — small dropdown anchored on the email.
  const label = state.email ?? "Account";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="max-w-[180px] truncate rounded-md px-3 py-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
        title={label}
      >
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border border-paper-line bg-white shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setBusy(true);
              await signOut();
            }}
            disabled={busy}
            className="block w-full px-3 py-2 text-left text-sm text-ink-soft hover:bg-paper-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
