// Codex CLI parity. Codex reads the Claude layout (marketplace, skills, hooks/hooks.json with
// CLAUDE_PLUGIN_ROOT) but does NOT expand ${VAR:-default} in MCP config, so Codex gets its own
// overlay (.codex-plugin/plugin.json) pointing at an MCP file with literal values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const json = (p) => JSON.parse(read(p));
const LIVE = 'https://scuffmark.facets.cloud';
const codex = () => json('.codex-plugin/plugin.json');

test('codex manifest mirrors the Claude manifest identity and version', () => {
  const c = codex();
  const claude = json('.claude-plugin/plugin.json');
  assert.equal(c.name, 'scuffmark');
  assert.equal(c.version, claude.version);
  assert.equal(c.license, 'MIT');
});

test('codex manifest wires the shared skill dir and shared hooks.json', () => {
  const c = codex();
  assert.equal(c.skills, './skills/');
  assert.equal(c.hooks, './hooks/hooks.json');
  assert.ok(existsSync(new URL('../skills/scuffmark/SKILL.md', import.meta.url)));
});

test('codex MCP file has no ${...} (Codex does not interpolate) and pins the versioned live tarball', () => {
  const c = codex();
  assert.match(c.mcpServers, /^\.\/.+\.json$/);
  const raw = read(c.mcpServers.slice(2));
  assert.doesNotMatch(raw, /\$\{/);
  const s = JSON.parse(raw).mcpServers.scuffmark;
  assert.equal(s.command, 'npx');
  assert.deepEqual(s.args, ['-y', `${LIVE}/scuffmark-mcp-0.1.9.tgz`]);
  assert.deepEqual(s.env, { SCUFFMARK_URL: LIVE });
});

test('codex and claude MCP configs pin the same tarball version', () => {
  const claudeUrl = json('.mcp.json').mcpServers.scuffmark.args.find((a) => a.includes('.tgz'));
  const codexUrl = json(codex().mcpServers.slice(2)).mcpServers.scuffmark.args.find((a) => a.includes('.tgz'));
  assert.equal(codexUrl.match(/scuffmark-mcp-[\d.]+\.tgz$/)[0], claudeUrl.match(/scuffmark-mcp-[\d.]+\.tgz$/)[0]);
});

test('codex interface metadata is within Codex limits', () => {
  const i = codex().interface;
  assert.equal(i.displayName, 'scuffmark');
  assert.ok(i.shortDescription.length > 0);
  for (const p of i.defaultPrompt) assert.ok(p.length <= 128, `defaultPrompt too long: ${p}`);
});

test('shared hooks.json uses CLAUDE_PLUGIN_ROOT (Codex sets it too) on SessionStart startup|resume', () => {
  const h = json('hooks/hooks.json').hooks.SessionStart[0];
  assert.equal(h.matcher, 'startup|resume');
  assert.match(h.hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/daily-brief\.mjs/);
});
