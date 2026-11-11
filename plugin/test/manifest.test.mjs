import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('plugin is version 0.1.1', () => {
  assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, '0.1.1');
});

test('.mcp.json pins the versioned MCP tarball (npx caches by URL)', () => {
  const args = JSON.parse(read('.mcp.json')).mcpServers.scuffmark.args;
  const url = args.find((a) => a.includes('.tgz'));
  assert.match(url, /\/scuffmark-mcp-0\.1\.1\.tgz$/);
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
