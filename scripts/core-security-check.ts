import assert from "node:assert/strict";
import { issueDraftClaim, verifyDraftClaim, safeNextPath } from "../lib/supabase/draftClaim";
import { isPublicAddress, fetchPublicResource } from "../lib/publicFetch";
import { panelContentSafetyError, sanitizePanelContent } from "../lib/render/contentSafety";

async function main() {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "isolated-test-signing-key";
  const user = "11111111-1111-4111-8111-111111111111";
  const time = 1700000000000;
  const token = issueDraftClaim(user, time);
  assert.equal(verifyDraftClaim(token, time), user);
  assert.equal(verifyDraftClaim(user, time), null);
  assert.equal(verifyDraftClaim(token, time + 600000), null);
  assert.equal(verifyDraftClaim(token.replace(/^./, "a"), time), null);
  const payload = Buffer.from(JSON.stringify({ userId: "22222222-2222-4222-8222-222222222222", expires: 1700000600 })).toString("base64url");
  assert.equal(verifyDraftClaim(`${payload}.${token.split(".")[1]}`, time), null);
  for (const next of ["//evil.example", "/\\evil.example", "https://evil.example", "/\r\nevil"]) assert.equal(safeNextPath(next), "/");
  assert.equal(safeNextPath("/library?view=mine"), "/library?view=mine");
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "::ffff:127.0.0.1", "fd00::1", "2001:db8::1"]) assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(isPublicAddress(ip), true, ip);
  await assert.rejects(fetchPublicResource("http://127.0.0.1"), /Private/);
  await assert.rejects(fetchPublicResource("https://user:pass@example.com"), /public/);
  await assert.rejects(fetchPublicResource("https://example.com:9000"), /public/);
  const attacks = [
    '<svg><rect style="fill:url(\'https://evil.example/a b\')"/></svg>',
    '<video poster="https://evil.example/tracker"/>',
    '<svg onclick="alert(1)"><rect width="100" height="100"/></svg>',
    '<svg><script>alert(1)</script></svg>',
    '<svg><foreignObject><iframe srcdoc="evil"/></foreignObject></svg>',
    '<svg><a href="javascript:alert(1)">x</a></svg>',
    '<svg><style>@import "https://evil.example";</style></svg>',
    '<svg><rect style="fill:url(https://evil.example)"/></svg>',
    '<svg><set attributeName="href" to="javascript:alert(1)"/></svg>',
  ];
  for (const attack of attacks) {
    assert.ok(panelContentSafetyError(attack), attack);
    assert.equal(panelContentSafetyError(sanitizePanelContent(attack)), null);
  }
  assert.equal(panelContentSafetyError('<svg viewBox="0 0 100 100"><defs><linearGradient id="g"/></defs><rect fill="url(#g)" width="100" height="100"/></svg>'), null);
  console.log("Core security checks passed: signed ownership claims, local redirects, network boundaries, and artwork sanitization.");
}
void main();
