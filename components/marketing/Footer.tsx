import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="force-light border-t border-white/10 bg-dark">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link
              href="/"
              className="inline-flex items-baseline gap-2 font-display text-lg font-semibold tracking-tight text-paper"
            >
              <span aria-hidden className="inline-block h-2 w-2 translate-y-px rounded-full bg-accent" />
              Readopp
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-paper-line/80">
              An experiment in turning careful writing into something worth
              sharing — without flattening what the writer said.
            </p>
          </div>
          <nav aria-label="Sections" className="flex flex-col gap-2 text-sm">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-line/50">
              Read
            </p>
            <a href="#templates" className="text-paper-line/80 hover:text-paper">
              Templates
            </a>
            <a href="#how-it-works" className="text-paper-line/80 hover:text-paper">
              How it works
            </a>
            <a href="#use-cases" className="text-paper-line/80 hover:text-paper">
              Who it&rsquo;s for
            </a>
            <a href="#faq" className="text-paper-line/80 hover:text-paper">
              Questions
            </a>
          </nav>
          <nav aria-label="Project" className="flex flex-col gap-2 text-sm">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-paper-line/50">
              Project
            </p>
            <a
              href="https://github.com/shekharchaudhary/readopp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-paper-line/80 hover:text-paper"
            >
              Source on GitHub
            </a>
          </nav>
        </div>
        <div className="mt-12 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-paper-line/50">
          <span>© {year} Readopp</span>
          <span className="font-mono">v0.1</span>
        </div>
      </div>
    </footer>
  );
}
