import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('plugin is version 0.1.10', () => {
  assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, '0.1.10');
});

const SITE = 'https://scuffmark.facets.cloud';

test('homepage fields point at the scuffmark.facets.cloud custom domain, no raw Cloud Run URL left in config', () => {
  assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).homepage, SITE);
  const cx = JSON.parse(read('.codex-plugin/plugin.json'));
  assert.equal(cx.homepage, SITE);
  assert.equal(cx.interface.websiteURL, SITE);
  const mkt = JSON.parse(read('../.claude-plugin/marketplace.json'));
  assert.equal(mkt.plugins.find((p) => p.name === 'scuffmark').homepage, SITE);
  for (const f of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json', '.mcp.json', '.codex-mcp.json', '../.claude-plugin/marketplace.json']) {
    assert.doesNotMatch(read(f), /run\.app/, f);
  }
});

test('repo refs point at Facets-cloud/scuffmark (no anshulsao/scuffmark left)', () => {
  const REPO = 'https://github.com/Facets-cloud/scuffmark';
  assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).repository, REPO);
  assert.equal(JSON.parse(read('.codex-plugin/plugin.json')).repository, REPO);
  const mkt = JSON.parse(read('../.claude-plugin/marketplace.json'));
  assert.deepEqual(mkt.owner, { name: 'Facets' });
  // root README only exists in the public plugin repo, not the server-side mirror
  for (const f of ['README.md', '../README.md'].filter((f) => existsSync(new URL('../' + f, import.meta.url)))) {
    const md = read(f);
    assert.doesNotMatch(md, /anshulsao\/scuffmark/);
    assert.match(md, /claude plugin marketplace add Facets-cloud\/scuffmark/);
    assert.match(md, /codex plugin marketplace add Facets-cloud\/scuffmark/);
  }
});

test('.mcp.json pins the versioned MCP tarball (npx caches by URL)', () => {
  const args = JSON.parse(read('.mcp.json')).mcpServers.scuffmark.args;
  const url = args.find((a) => a.includes('.tgz'));
  assert.match(url, /\/scuffmark-mcp-0\.1\.8\.tgz$/);
  assert.equal(url, '${SCUFFMARK_URL:-https://scuffmark.facets.cloud}/scuffmark-mcp-0.1.8.tgz');
  assert.deepEqual(JSON.parse(read('.mcp.json')).mcpServers.scuffmark.env, { SCUFFMARK_URL: '${SCUFFMARK_URL:-https://scuffmark.facets.cloud}' });
});

test('SKILL.md LOGIN protocol: reuse pending login, 2-step GitHub approval, keep polling', () => {
  const s = read('skills/scuffmark/SKILL.md');
  const login = s.slice(s.indexOf('## LOGIN'), s.indexOf('## Other tools'));
  assert.match(login, /green Authorize button/);
  assert.match(login, /already_in_progress/);
  assert.match(login, /keep calling `login_status`/i);
  assert.match(login, /wait between `login_status` calls; it paces itself/i);
  assert.match(login, /never call `login` again while/i);
  assert.match(login, /restart/);
});

const section = (s, start, end) => s.slice(s.indexOf(start), s.indexOf(end));

test('SKILL.md LAUNCH: decide maker vs hunter, always send repo, branch on role', () => {
  const s = read('skills/scuffmark/SKILL.md');
  const launch = section(s, '## LAUNCH', '## CLAIM');
  assert.match(launch, /maker or hunter/i);
  assert.match(launch, /\*\*Maker\*\*/);
  assert.match(launch, /\*\*Hunter\*\*/);
  assert.match(launch, /hunter NEVER gets a confirm_key/);
  assert.match(launch, /ALWAYS `repo`/);
  assert.match(launch, /Read `role` in the result/);
  assert.match(launch, /`whoami` includes their hunter reputation/);
});

test('SKILL.md CLAIM: claim tool, key rotation, error codes, maker-only edit_card', () => {
  const s = read('skills/scuffmark/SKILL.md');
  const claim = section(s, '## CLAIM', '## LOGIN');
  assert.match(claim, /`claim \{slug\}`/);
  assert.match(claim, /ROTATES the key/);
  for (const e of ['not_maker', 'already_claimed', 'no_repo']) assert.match(claim, new RegExp(e));
  assert.match(claim, /`edit_card \{slug/);
  assert.match(claim, /\.scuffmark/);
});

test('SKILL.md lists claim + edit_card in Other tools and triggers on hunt/claim', () => {
  const s = read('skills/scuffmark/SKILL.md');
  const other = section(s, '## Other tools', '## Daily nudge');
  assert.match(other, /`claim`/);
  assert.match(other, /`edit_card`/);
  const desc = s.split('\n').find((l) => l.startsWith('description:'));
  assert.match(desc, /claim/);
  assert.match(desc, /hunt/i);
  assert.match(desc, /edit_card/);
});

test('codex manifest ships the thumbprint icon + logo that exist on disk', () => {
  const m = JSON.parse(read('.codex-plugin/plugin.json'));
  assert.equal(m.version, '0.1.10');
  assert.equal(m.interface.composerIcon, './assets/icon.svg');
  assert.equal(m.interface.logo, './assets/logo.svg');
  for (const f of ['assets/icon.svg', 'assets/logo.svg']) {
    const svg = read(f);
    assert.match(svg, /^<svg/);
    assert.doesNotMatch(svg, /<script/i);
  }
});

// ---- seed hygiene (plugin 0.1.7 / mcp 0.1.5) ----
test('SKILL.md BRIEF: show the auto-listed label, do not treat unverified-listing signals as a verdict', () => {
  const s = read('skills/scuffmark/SKILL.md');
  const brief = section(s, '## BRIEF', '## TRY');
  assert.match(brief, /listing_label/);
  assert.match(brief, /Auto-listed from Show HN \/ GitHub; not submitted by the maker/);
  assert.match(brief, /unverified-listing/);
});

test('SKILL.md TRY: never run try_guess / unverified try without README check + human OK', () => {
  const s = read('skills/scuffmark/SKILL.md');
  const t = section(s, '## TRY', '## LAUNCH');
  assert.match(t, /try_verified/);
  assert.match(t, /try_guess/);
  assert.match(t, /README/);
  assert.match(t, /never run `try_guess`/i);
  assert.match(t, /explicit OK|explicitly approve/i);
});

test('SKILL.md REMOVE: maker opt-out via takedown, ownership proof, confirm first, /remove fallback', () => {
  const s = read('skills/scuffmark/SKILL.md');
  const r = section(s, '## REMOVE', '## LOGIN');
  assert.match(r, /remove my project from scuffmark/);
  assert.match(r, /`takedown \{slug\}`/);
  assert.match(r, /permanent/i);
  for (const e of ['not_maker', 'no_repo']) assert.match(r, new RegExp(e));
  assert.match(r, /remove_url|\/remove/);
  const desc = s.split('\n').find((l) => l.startsWith('description:'));
  assert.match(desc, /remove my project/);
  assert.match(section(s, '## Other tools', '## Daily nudge'), /`takedown`/);
});

test('no implied affiliation in skill or README', () => {
  for (const f of ['skills/scuffmark/SKILL.md', 'README.md']) {
    const t = read(f);
    for (const re of [/\bpartner/i, /\bofficial/i, /featured (by|on)/i, /\bendorsed/i]) assert.doesNotMatch(t, re, f);
  }
});


// ---- closed-source makers: domain proof (plugin 0.1.10 / mcp 0.1.8) ----
test('SKILL.md CLAIM: repo proof OR domain proof (claim_domain_start -> human picks DNS TXT or well-known -> claim_domain_verify)', () => {
  const s = read('skills/scuffmark/SKILL.md');
  const c = section(s, '## CLAIM', '## REMOVE');
  assert.match(c, /closed-source|no repo/i);
  assert.match(c, /`claim_domain_start \{slug/);
  assert.match(c, /`claim_domain_verify \{slug/);
  assert.match(c, /_scuffmark\./);
  assert.match(c, /\.well-known\/scuffmark\.txt/);
  assert.match(c, /BOTH/);
  assert.match(c, /not_found_yet/);
  assert.match(c, /retry/i);
  assert.match(c, /shared_host/);
});

test('SKILL.md REMOVE: closed source can take down via domain proof (purpose takedown)', () => {
  const s = read('skills/scuffmark/SKILL.md');
  const r = section(s, '## REMOVE', '## LOGIN');
  assert.match(r, /claim_domain_start \{slug, purpose: "takedown"\}/);
  assert.match(r, /claim_domain_verify \{slug, purpose: "takedown"\}/);
  assert.match(section(s, '## Other tools', '## Daily nudge'), /`claim_domain_start`/);
});
