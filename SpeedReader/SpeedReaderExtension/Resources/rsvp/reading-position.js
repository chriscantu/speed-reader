// reading-position.js — Per-URL reading position persistence.
// Uses browser.storage.local to save/restore word index per article.

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ref', 'source',
];

export function normalizeUrl(rawUrl) {
  const url = new URL(rawUrl);
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
