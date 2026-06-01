import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-paper">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link
              href="/"
              className="inline-flex items-baseline gap-2 text-base font-semibold tracking-tight text-ink"
            >
              <span aria-hidden className="inline-block h-2 w-2 translate-y-px rounded-full bg-accent" />
              Readopp
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
              An experiment in turning careful writing into something worth
              sharing — without flattening what the writer said.
            </p>
          </div>
          <nav aria-label="Sections" className="flex flex-col gap-2 text-sm">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
              Read
            </p>
            <a href="#how-it-works" className="text-ink-muted hover:text-ink">
              How it works
            </a>
            <a href="#use-cases" className="text-ink-muted hover:text-ink">
              What it&rsquo;s for
            </a>
            <a href="#faq" className="text-ink-muted hover:text-ink">
              Questions
            </a>
          </nav>
          <nav aria-label="Project" className="flex flex-col gap-2 text-sm">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
              Project
            </p>
            <a
              href="https://github.com/shekharchaudhary/readopp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-muted hover:text-ink"
            >
              Source on GitHub
            </a>
          </nav>
        </div>
        <div className="mt-12 flex items-center justify-between border-t border-paper-line pt-6 text-xs text-ink-faint">
          <span>© {year} Readopp</span>
          <span className="font-mono">v0.1</span>
        </div>
      </div>
    </footer>
  );
}
