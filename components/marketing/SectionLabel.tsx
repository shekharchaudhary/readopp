export type Tone =
  | "accent"
  | "sky"
  | "coral"
  | "butter"
  | "lavender"
  | "rose"
  | "sage";

const DOT: Record<Tone, string> = {
  accent: "bg-accent",
  sky: "bg-sky",
  coral: "bg-coral",
  butter: "bg-butter",
  lavender: "bg-lavender",
  rose: "bg-rose",
  sage: "bg-sage",
};

interface Props {
  title: string;
  tone?: Tone;
}

/** Minimal section label: hued dot + small sans title in a quiet pill. */
export function SectionLabel({ title, tone = "accent" }: Props) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-paper-line bg-surface px-3.5 py-1.5 text-xs font-medium tracking-tight text-ink-soft">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      {title}
    </div>
  );
}
