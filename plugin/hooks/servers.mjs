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
