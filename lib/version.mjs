// Strict plain `X.Y.Z` versions. The update notice prints only what passes parseVersion, so
// this regex is the whole boundary between registry-supplied text and the agent's context:
// no pre-release, no build metadata, no leading zeros, at most 9 digits per part.

const PLAIN_VERSION = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;

export function parseVersion(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(PLAIN_VERSION);
  return m ? m.slice(1).map(Number) : null;
}

// Negative, zero or positive like a sort comparator; NaN when either side is not a plain
// version, so `compareVersions(a, b) > 0` is false for anything unparsable.
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return NaN;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}
