import { readFileSync } from "node:fs";
import { join } from "node:path";

// Load env
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

const JOB_IDS = [
  "c5b551dc-aa4b-4a4b-a8fa-0283e325899d",
  "7b56d1d4-cbc0-4243-94a3-8f381518ed08",
];

async function main() {
  const admin = getAdminSupabase();
  for (const id of JOB_IDS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin
      .from("jobs")
      .select("status, error, progress")
      .eq("id", id)
      .maybeSingle() as any);
    console.log(`\n=== job ${id} ===`);
    console.log(JSON.stringify(data, null, 2));
  }
}
main().catch(console.error);
