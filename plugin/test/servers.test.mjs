// The hook must treat every public URL of the one scuffmark deployment as the same server, so an
// agent.json written by MCP <= 0.1.3 (bound to the raw Cloud Run URL) keeps the daily nudge alive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SERVER, DEPLOYMENT_URLS, sameServer } from '../hooks/servers.mjs';

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
