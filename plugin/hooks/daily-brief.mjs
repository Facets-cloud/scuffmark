#!/usr/bin/env node
// scuffmark daily SessionStart hook. No deps. Never blocks or errors the session:
// every failure path exits 0 with no output.
//
// Silent when: SCUFFMARK_DAILY=off, the session is non-interactive (see isHeadless: flow --auto children,
// launchd playbooks, `claude -p`, Agent SDK; a headless session must not spend the human's daily slot), not logged in (no ~/.scuffmark/agent.json for this server or another host of the same deployment),
// already ran today (~/.scuffmark/last-brief), offline/slow server (hard 1.5s budget), or 0 new cards.
// Otherwise: signed GET /v1/feed?since=<last-brief>&limit=20 and a one-line nudge as additionalContext.
// Card text is untrusted: only the count and the top 3 slugs reach the model's context.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { DEFAULT_SERVER, sameServer, normalizePathQuery } from './servers.mjs';

const BUDGET_MS = 1500;

// Hard ceiling: whatever happens, leave quietly.
setTimeout(() => process.exit(0), BUDGET_MS + 300).unref();

// Non-interactive sessions: nobody is there to be briefed, so they must not stamp last-brief.
// stdin TTY is not used: Claude Code always pipes the hook input JSON, interactive or not.
export function isHeadless(env, input) {
  if (env.SCUFFMARK_HEADLESS && env.SCUFFMARK_HEADLESS !== '0') return true;
  if (env.FLOW_AUTO_RUN) return true; // `flow do --auto` / `flow auto` child
  if ((env.FLOW_TERM || '').toLowerCase() === 'bg') return true;
  if (env.CLAUDE_CODE_SESSION_ATTENDED === '0') return true;
  if (/^sdk/i.test(env.CLAUDE_CODE_ENTRYPOINT || '')) return true; // sdk-cli (claude -p), sdk-ts, sdk-py
  if (input && (input.non_interactive === true || input.interactive === false)) return true;
  return false;
}

// Hook input JSON on stdin; never wait on it for long.
function readInput(ms = 300) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve(null);
    let buf = '';
    const done = () => {
      clearTimeout(t);
      process.stdin.pause();
      try { resolve(JSON.parse(buf)); } catch { resolve(null); }
    };
    const t = setTimeout(done, ms);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { buf += d; if (buf.length > 65536) done(); });
    process.stdin.on('end', done);
    process.stdin.on('error', done);
  });
}

function sameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

async function main() {
  const env = process.env;
  if ((env.SCUFFMARK_DAILY || '').toLowerCase() === 'off') return;
  if (isHeadless(env, null)) return;
  if (isHeadless({}, await readInput())) return;

  const server = (env.SCUFFMARK_URL || DEFAULT_SERVER).replace(/\/+$/, '');
  const home = env.SCUFFMARK_HOME || path.join(os.homedir(), '.scuffmark');
  const stampFile = path.join(home, 'last-brief');

  const agent = JSON.parse(fs.readFileSync(path.join(home, 'agent.json'), 'utf8'));
  if (!agent?.agent_id || !sameServer(agent.server, server)) return;

  const now = new Date();
  let since = new Date(now.getTime() - 7 * 86400e3).toISOString();
  if (fs.existsSync(stampFile)) {
    const last = new Date(fs.readFileSync(stampFile, 'utf8').trim());
    if (!Number.isNaN(last.getTime())) {
      if (sameLocalDay(last, now)) return;
      since = last.toISOString();
    }
  }

  const key = crypto.createPrivateKey(fs.readFileSync(path.join(home, 'key.pem')));
  // Normalized (sorted params) so the signature survives the front door's request-line rewrite.
  const pathWithQuery = normalizePathQuery(`/v1/feed?since=${encodeURIComponent(since)}&limit=20`);
  const ts = String(Math.floor(Date.now() / 1000));
  const canonical = `GET\n${pathWithQuery}\n${ts}\n${crypto.createHash('sha256').update('').digest('hex')}`;
  const sig = crypto.sign(null, Buffer.from(canonical), key).toString('base64');

  const res = await fetch(server + pathWithQuery, {
    headers: { 'X-Scuffmark-Agent': agent.agent_id, 'X-Scuffmark-Ts': ts, 'X-Scuffmark-Sig': sig },
    signal: AbortSignal.timeout(BUDGET_MS),
  });
  if (!res.ok) return;
  const body = await res.json();
  // Stamp only after a real feed answer; anything else retries next session.
  if (!Array.isArray(body?.cards)) return;
  const cards = body.cards;

  fs.mkdirSync(home, { recursive: true, mode: 0o700 });
  fs.writeFileSync(stampFile, now.toISOString());
  if (cards.length === 0) return;

  const slugs = cards
    .slice(0, 3)
    .map((c) => String(c?.slug ?? ''))
    .filter((s) => /^[a-z0-9][a-z0-9-]{0,99}$/.test(s));
  const n = cards.length;
  const ctx =
    `scuffmark: ${n} new launch${n === 1 ? '' : 'es'} since ${since.slice(0, 10)}` +
    (slugs.length ? ` (top: ${slugs.join(', ')})` : '') +
    '. At a natural pause, offer the user a <=5-bullet brief filtered to their work (scuffmark skill BRIEF protocol). ' +
    'Do not interrupt the current task for this.';
  const out = JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx } });
  await new Promise((resolve) => process.stdout.write(out, resolve));
}

main().then(
  () => process.exit(0),
  () => process.exit(0),
);
