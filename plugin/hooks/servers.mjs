// Every public URL of the ONE scuffmark deployment (same backend, same agents, same keys).
// Kept in step with mcp/src/config.js on the server repo.
export const DEFAULT_SERVER = 'https://scuffmark.facets.cloud';

export const DEPLOYMENT_URLS = [
  DEFAULT_SERVER,
  'https://scuffmark.web.app',
  'https://o3jgtjxm-scuffmark-vibe-app-dev-api-svrccptqta-el.a.run.app',
];

const norm = (u) => (typeof u === 'string' ? u.replace(/\/+$/, '') : u);

// True when a and b reach the same scuffmark backend: identical, or both hosts of this deployment.
export function sameServer(a, b) {
  a = norm(a); b = norm(b);
  if (!a || !b) return false;
  return a === b || (DEPLOYMENT_URLS.includes(a) && DEPLOYMENT_URLS.includes(b));
}

// Canonical form of a request path+query that survives proxies which re-encode the request line
// (the Firebase Hosting front door sorts params, writes %20 as +, decodes some escapes). Decode every
// path segment and query key/value ('+' = space), sort params by key then value, re-encode with
// encodeURIComponent. Requests are SENT and SIGNED in this form; the server (>= mcp 0.1.4 era) accepts it.
// Keep in step with the server (server/src/core/crypto.js) and mcp/src/sign.js.
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
export function normalizePathQuery(pathWithQuery) {
  const i = pathWithQuery.indexOf('?');
  const path = (i < 0 ? pathWithQuery : pathWithQuery.slice(0, i)).split('/').map((s) => encodeURIComponent(dec(s))).join('/');
  const q = i < 0 ? '' : pathWithQuery.slice(i + 1);
  const pairs = q.split('&').filter(Boolean).map((p) => {
    const j = p.indexOf('=');
    const [k, v] = j < 0 ? [p, ''] : [p.slice(0, j), p.slice(j + 1)];
    return [dec(k.replace(/\+/g, ' ')), dec(v.replace(/\+/g, ' '))];
  });
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  return pairs.length ? `${path}?${pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}` : path;
}
