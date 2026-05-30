import Link from "next/link";
import { notFound } from "next/navigation";
import { ExplainerView } from "@/components/ExplainerView";
import { getExplainer } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ExplainerPermalink({
  params,
}: {
  params: { explainerId: string };
}) {
  const explainer = getExplainer(params.explainerId);
  if (!explainer) notFound();

  return (
    <main className="space-y-8">
      <Link
        href="/"
        className="inline-block text-sm text-ink-muted hover:text-ink"
      >
        ← New explainer
      </Link>
      <ExplainerView explainer={explainer} canExport />
    </main>
  );
}
