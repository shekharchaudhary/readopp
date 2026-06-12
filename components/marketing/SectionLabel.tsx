interface Props {
  title: string;
}

/** Minimal section label: accent dot + small sans title in a quiet pill. */
export function SectionLabel({ title }: Props) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-paper-line bg-surface px-3.5 py-1.5 text-xs font-medium tracking-tight text-ink-soft">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
      {title}
    </div>
  );
}
