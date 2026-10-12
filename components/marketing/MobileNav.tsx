"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function MobileNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={ref} className="relative sm:hidden">
    <button ref={trigger} type="button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(value => !value)} className="mobile-nav-trigger grid h-10 w-10 place-items-center rounded-xl border border-paper-line text-ink-soft"><svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">{open ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg></button>
    {open && <div id="mobile-navigation" className="mobile-nav-panel absolute right-0 top-12 z-50 w-56 rounded-2xl border border-paper-line bg-surface p-2 shadow-xl" onClick={() => setOpen(false)}>
      <a href="/#try" className="mobile-nav-link">Create a story <span aria-hidden>↗</span></a>
      <a href="/#how-it-works" className="mobile-nav-link">How it works</a>
      <Link href="/samples" className="mobile-nav-link">Example stories</Link>
      {signedIn && <><Link href="/library" className="mobile-nav-link">Your library</Link><Link href="/brand" className="mobile-nav-link">Brand settings</Link></>}
    </div>}
  </div>;
}
