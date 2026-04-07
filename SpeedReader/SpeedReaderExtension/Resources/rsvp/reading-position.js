// reading-position.js — Per-URL reading position persistence.
// Uses browser.storage.local to save/restore word index per article.

const STORAGE_KEY = 'readingPositions';
const MAX_ENTRIES = 100;

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ref', 'source',
];

export function normalizeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  url.hash = '';
  for (const param of TRACKING_PARAMS) {
    url.searchParams.delete(param);
  }
  url.searchParams.sort();
  let result = url.origin + url.pathname.replace(/\/$/, '');
  const qs = url.searchParams.toString();
  if (qs) {
    result += '?' + qs;
  }
  return result;
}

export function hashText(text) {
  const sample = text.length <= 200
    ? text
    : text.slice(0, 100) + text.slice(-100);
  // djb2 hash
  let hash = 5381;
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) + hash + sample.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

export async function save(rawUrl, text, index, total) {
  if (index === 0) return;
  const key = normalizeUrl(rawUrl);
  const entry = {
    index,
    total,
    textHash: hashText(text),
    timestamp: Math.floor(Date.now() / 1000),
  };
  const data = await browser.storage.local.get(STORAGE_KEY);
  const positions = data[STORAGE_KEY] || {};
  positions[key] = entry;
  // LRU eviction
  const keys = Object.keys(positions);
  if (keys.length > MAX_ENTRIES) {
    let oldestKey = keys[0];
    let oldestTime = positions[keys[0]].timestamp;
    for (let i = 1; i < keys.length; i++) {
      if (positions[keys[i]].timestamp < oldestTime) {
        oldestTime = positions[keys[i]].timestamp;
        oldestKey = keys[i];
      }
    }
    delete positions[oldestKey];
  }
  await browser.storage.local.set({ [STORAGE_KEY]: positions });
}

export async function restore(rawUrl, text) {
  const key = normalizeUrl(rawUrl);
  const hash = hashText(text);
  const data = await browser.storage.local.get(STORAGE_KEY);
  const positions = data[STORAGE_KEY] || {};
  const entry = positions[key];
  if (!entry) return null;
  if (entry.textHash !== hash) return null;
  if (entry.index >= entry.total) return null;
  return entry.index;
}

export async function clear(rawUrl) {
  const key = normalizeUrl(rawUrl);
  const data = await browser.storage.local.get(STORAGE_KEY);
  const positions = data[STORAGE_KEY] || {};
  if (!(key in positions)) return;
  delete positions[key];
  await browser.storage.local.set({ [STORAGE_KEY]: positions });
}
