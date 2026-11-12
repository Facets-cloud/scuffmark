// The hook must treat every public URL of the one scuffmark deployment as the same server, so an
// agent.json written by MCP <= 0.1.3 (bound to the raw Cloud Run URL) keeps the daily nudge alive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SERVER, DEPLOYMENT_URLS, sameServer, normalizePathQuery } from '../hooks/servers.mjs';

const RAW = 'https://o3jgtjxm-scuffmark-vibe-app-dev-api-svrccptqta-el.a.run.app';

test('hook default server is the custom domain', () => {
  assert.equal(DEFAULT_SERVER, 'https://scuffmark.facets.cloud');
});

test('custom domain, firebase front door and raw Cloud Run URL are one deployment', () => {
  for (const u of [DEFAULT_SERVER, 'https://scuffmark.web.app', RAW]) assert.ok(DEPLOYMENT_URLS.includes(u), u);
  assert.ok(sameServer(RAW, DEFAULT_SERVER));
  assert.ok(sameServer(`${RAW}/`, 'https://scuffmark.web.app'));
  assert.ok(sameServer('http://127.0.0.1:5', 'http://127.0.0.1:5/'));
  assert.ok(!sameServer('http://127.0.0.1:5', DEFAULT_SERVER));
  assert.ok(!sameServer(undefined, DEFAULT_SERVER));
});

// Firebase Hosting front door sorts params, writes %20 as +, decodes some escapes (observed live 2026-11-12).
test('normalizePathQuery is invariant under the front door rewrite (same as server + MCP)', () => {
  const sent = '/v1/zz%3Ay?since=2026-11-05T05%3A30%3A00.000Z&q=a%20b%2Bc%2Fd&e=%7E%21%27%28%29%2A';
  const received = '/v1/zz:y?e=~%21%27%28%29%2A&q=a+b%2Bc%2Fd&since=2026-11-05T05%3A30%3A00.000Z';
  assert.equal(normalizePathQuery(sent), normalizePathQuery(received));
  assert.equal(normalizePathQuery('/v1/feed?since=x%3Ay&limit=20'), '/v1/feed?limit=20&since=x%3Ay');
});

test('an agent.json written by mcp >= 0.1.6 (server = raw Cloud Run URL, servers[]) matches the custom domain', async () => {
  const { sameServer, DEFAULT_SERVER } = await import('../hooks/servers.mjs');
  assert.ok(sameServer('https://o3jgtjxm-scuffmark-vibe-app-dev-api-svrccptqta-el.a.run.app', DEFAULT_SERVER));
});
