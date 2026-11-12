import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('plugin is version 0.1.4', () => {
  assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, '0.1.4');
});

test('repo refs point at Facets-cloud/scuffmark (no anshulsao/scuffmark left)', () => {
  const REPO = 'https://github.com/Facets-cloud/scuffmark';
  assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).repository, REPO);
  assert.equal(JSON.parse(read('.codex-plugin/plugin.json')).repository, REPO);
  const mkt = JSON.parse(read('../.claude-plugin/marketplace.json'));
  assert.deepEqual(mkt.owner, { name: 'Facets' });
  for (const f of ['README.md', '../README.md']) {
    const md = read(f);
    assert.doesNotMatch(md, /anshulsao\/scuffmark/);
    assert.match(md, /claude plugin marketplace add Facets-cloud\/scuffmark/);
    assert.match(md, /codex plugin marketplace add Facets-cloud\/scuffmark/);
  }
});

test('.mcp.json pins the versioned MCP tarball (npx caches by URL)', () => {
  const args = JSON.parse(read('.mcp.json')).mcpServers.scuffmark.args;
  const url = args.find((a) => a.includes('.tgz'));
  assert.match(url, /\/scuffmark-mcp-0\.1\.3\.tgz$/);
});

test('SKILL.md LOGIN protocol: reuse pending login, 2-step GitHub approval, keep polling', () => {
  const s = read('skills/scuffmark/SKILL.md');
  const login = s.slice(s.indexOf('## LOGIN'), s.indexOf('## Other tools'));
  assert.match(login, /green Authorize button/);
  assert.match(login, /already_in_progress/);
  assert.match(login, /keep calling `login_status`/i);
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
