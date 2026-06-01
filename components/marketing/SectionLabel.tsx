interface Props {
  number: string;
  title: string;
}

/**
 * Editorial-style chapter mark for marketing sections.
 * Renders as: § 01 — How it works
 */
export function SectionLabel({ number, title }: Props) {
  return (
    <div className="flex items-baseline gap-3 font-mono text-xs tracking-wide text-ink-muted">
      <span className="text-accent">§</span>
      <span className="font-medium tabular-nums text-accent">{number}</span>
      <span aria-hidden className="h-px w-8 bg-paper-line" />
      <span className="uppercase tracking-[0.18em]">{title}</span>
    </div>
  );
}
