#!/usr/bin/env node
// Detached from SessionStart by _update-notice.mjs — not a registered hook. Asks the registry
// for the latest published version and caches it only when it is a plain X.Y.Z. Prints
// nothing, follows no redirect, reads at most MAX_BODY_BYTES, and gives up after
// FETCH_TIMEOUT_MS. Every failure leaves the cache as the hook left it.

import process from 'node:process';
import { resolveRoots } from './_shared.mjs';
import { cachePath, readJsonFile, writeCache } from './_update-notice.mjs';
import { parseVersion } from './lib/version.mjs';
import {
  DEFAULT_REGISTRY, FETCH_TIMEOUT_MS, MAX_BODY_BYTES, latestUrl,
} from './lib/update-notice.mjs';

const { sdlcRoot } = resolveRoots(import.meta.url);

async function readCapped(body, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of body) {
    size += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.byteLength;
    if (size > limit) return null;
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const url = new URL(latestUrl(process.env.WARNYIN_SDLC_REGISTRY_URL || DEFAULT_REGISTRY));
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return; // fetch also reads data:
  const res = await fetch(url, {
    redirect: 'error',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok || !res.body) return;
  const text = await readCapped(res.body, MAX_BODY_BYTES);
  if (text === null) return;
  const version = JSON.parse(text)?.version;
  if (!parseVersion(version)) return;
  const cache = readJsonFile(cachePath(sdlcRoot));
  writeCache(sdlcRoot, { checkedAt: cache?.checkedAt ?? new Date().toISOString(), latest: version });
}

main().catch(() => {}).finally(() => process.exit(0)); // fail open, silently
