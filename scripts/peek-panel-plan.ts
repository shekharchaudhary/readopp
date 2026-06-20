import { readFileSync } from "node:fs";
import { join } from "node:path";

const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let val = m[2];
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!(m[1] in process.env)) process.env[m[1]] = val;
}

import { getAdminSupabase } from "../lib/supabase/server";

async function main() {
  const admin = getAdminSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin
    .from("explainers")
    .select("title, panels")
    .order("created_at", { ascending: false })
    .limit(3) as any);
  for (const ex of data ?? []) {
    console.log(`\n=== ${ex.title} ===`);
    for (const p of ex.panels) {
      const planKeys = p.plan ? Object.keys(p.plan).filter((k) => k !== "narrativeReason") : [];
      const vt = p.plan?.visualType ?? "(no plan)";
      console.log(`  - heading: ${(p.heading || "").slice(0, 50)}`);
      console.log(`    visualType: ${vt}`);
      console.log(`    plan keys: ${planKeys.join(", ") || "(none)"}`);
      console.log(`    fallback: ${p.fallback}`);
    }
  }
}
main().catch(console.error);
