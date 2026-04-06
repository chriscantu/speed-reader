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
