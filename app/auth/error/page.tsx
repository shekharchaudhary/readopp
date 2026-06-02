import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const reason = searchParams.reason ?? "unknown_error";
  return (
    <main className="mx-auto max-w-xl space-y-6 px-6 py-20">
      <h1 className="text-2xl font-medium text-ink">Sign-in didn&rsquo;t complete</h1>
      <p className="text-sm text-ink-soft">
        Supabase returned an error during the OAuth exchange:
      </p>
      <pre className="overflow-x-auto rounded-md border border-paper-line bg-paper-soft p-3 font-mono text-xs text-ink">
        {reason}
      </pre>
      <p className="text-sm text-ink-muted">
        Try again from the home page. If this keeps happening, double-check
        that the Google provider is enabled in Supabase and the redirect URI
        is configured correctly in the Google Cloud console.
      </p>
      <Link
        href="/"
        className="inline-block rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink-soft hover:border-ink-muted"
      >
        ← Back home
      </Link>
    </main>
  );
}
