import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="force-light bg-dark">
      <div className="mx-auto max-w-[1080px] px-5 py-10 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-5 border-t border-white/20 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-display text-xl font-semibold tracking-[-.04em] text-paper">Readopp</Link>
            <span className="hidden text-sm text-paper-line/60 sm:inline">Good reads, made visible.</span>
          </div>
          <nav aria-label="Footer" className="flex items-center gap-5 text-sm">
            <a href="#try" className="text-paper-line/75 hover:text-paper">Make a post</a>
            <a href="#pricing" className="text-paper-line/75 hover:text-paper">Pricing</a>
            <a href="https://github.com/shekharchaudhary/readopp" target="_blank" rel="noopener noreferrer" className="text-paper-line/75 hover:text-paper">GitHub</a>
          </nav>
        </div>
        <div className="mt-8 font-mono text-[10px] uppercase tracking-wider text-paper-line/40">© {year} Readopp</div>
      </div>
    </footer>
  );
}
