/**
 * Main process yardımcıları — domain, path vb.
 */

function extractDomain(url) {
  if (!url) return '';
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return (url || '').toLowerCase();
  }
}

module.exports = {
  extractDomain,
};
