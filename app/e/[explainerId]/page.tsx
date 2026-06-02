import Link from "next/link";
import { notFound } from "next/navigation";
import { ExplainerView } from "@/components/ExplainerView";
import { getExplainer } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ExplainerPermalink({
  params,
}: {
  params: { explainerId: string };
}) {
  const explainer = await getExplainer(params.explainerId);
  if (!explainer) notFound();

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-10">
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
