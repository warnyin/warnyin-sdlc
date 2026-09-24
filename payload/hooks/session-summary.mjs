#!/usr/bin/env node
// Stop hook — the observability tap. Parses the session transcript's real
// usage numbers, attributes them to the active change, appends a `session`
// journal event, and prints a one-line summary. Cost is computed only when
// sdlc/config.yaml provides a price table — otherwise reported as n/a.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { resolveRoots, readStdinJson, activeChange, appendJournal } from './_shared.mjs';
import { parseTranscriptUsage, mergeUsage, costUsd } from './lib/usage.mjs';
import { parseConfig } from './lib/config.mjs';
import { pickSessionId } from './lib/active.mjs';

const { sdlcRoot } = resolveRoots(import.meta.url);

// Claude Code keeps each subagent's transcript beside the session's, in
// `<session>/subagents/agent-*.jsonl`; the main transcript carries none of their
// usage. Only regular files are read — a symlink or directory there is skipped.
function subagentTranscripts(transcriptPath) {
  const dir = path.join(path.dirname(transcriptPath), path.basename(transcriptPath, '.jsonl'), 'subagents');
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const texts = [];
  for (const e of entries) {
    if (!e.isFile() || !/^agent-[\w-]+\.jsonl$/.test(e.name)) continue;
    try { texts.push(fs.readFileSync(path.join(dir, e.name), 'utf8')); } catch { /* unreadable: skip */ }
  }
  return texts;
}

const fmt = (n) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n));

async function main() {
  const input = await readStdinJson();
  const transcriptPath = input?.transcript_path;
  if (!transcriptPath || !fs.existsSync(transcriptPath) || !fs.existsSync(sdlcRoot)) return;

  const usage = mergeUsage(
    parseTranscriptUsage(fs.readFileSync(transcriptPath, 'utf8')),
    ...subagentTranscripts(transcriptPath).map(parseTranscriptUsage),
  );
  if (!usage.totals.input && !usage.totals.output) return;

  let prices = null;
  try {
    prices = parseConfig(fs.readFileSync(path.join(sdlcRoot, 'config.yaml'), 'utf8')).prices;
  } catch { /* no config, no cost */ }
  const usd = costUsd(usage, prices);

  const sessionId = pickSessionId(input?.session_id, process.env.CLAUDE_CODE_SESSION_ID);
  const change = activeChange(sdlcRoot, sessionId);
  appendJournal(sdlcRoot, change, {
    event: 'session',
    session: input?.session_id ?? null,
    totals: usage.totals,
    models: usage.models,
    costUsd: usd,
  });

  const t = usage.totals;
  console.log(
    `[sdlc] session: ${fmt(t.input)} in / ${fmt(t.output)} out / ${fmt(t.cacheRead)} cache-read`
    + ` · cost ${usd == null ? 'n/a' : `$${usd}`}`
    + (change ? ` · change ${change}` : ''),
  );
}

main().catch(() => process.exit(0)); // fail open
