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
  const { data } = (await (admin
    .from("explainers")
    .select("title, url, panels, created_at")
    .order("created_at", { ascending: false })
    .limit(3) as any));
  for (const ex of data ?? []) {
    console.log(`\n=== ${ex.title} ===`);
    console.log(`   ${ex.url}`);
    for (const p of ex.panels) {
      const vt = p.plan?.visualType ?? "(no-plan, AI-rendered)";
      const mk = p.plan?.metaphor?.kind;
      const heading = p.heading || "(no heading)";
      console.log(`   - ${vt}${mk ? ":" + mk : ""}  | ${heading.slice(0, 60)}`);
      if (vt === "(no-plan, AI-rendered)") {
        console.log(`       (no plan present — check why planner didn't slot-fill)`);
      }
    }
  }
}
main().catch(console.error);
