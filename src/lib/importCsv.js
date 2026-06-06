/**
 * CSV içe aktarma — Vault, Bitwarden, Chrome, Firefox formatları
 */

const { extractDomain } = require('./utils');
const { APP } = require('../constants');

function normalizeHeader(h) {
  return (h || '').trim().toLowerCase().replace(/^\ufeff/, '').replace(/\s+/g, '_');
}

function detectFormat(headers) {
  const h = headers.map(normalizeHeader);
  if (h.includes('login_username') || h.includes('login_password') || h.includes('login_uri')) {
    return 'bitwarden';
  }
  if (h.includes('formactionorigin') || h.includes('timelastused') || h.includes('timecreated')) {
    return 'firefox';
  }
  if (h.includes('name') && h.includes('url') && h.includes('username') && h.includes('password')) {
    if (h.includes('category') || h.includes('tags')) return 'vault';
    return 'chrome';
  }
  if (h.includes('title') && h.includes('url') && h.includes('username')) return 'chrome';
  return 'generic';
}

const FORMAT_LABELS = {
  vault: 'VAULT CSV',
  bitwarden: 'Bitwarden CSV',
  chrome: 'Chrome CSV',
  firefox: 'Firefox CSV',
  generic: 'Genel CSV',
};

function mapRow(headers, row) {
  const map = {};
  headers.forEach((header, i) => {
    map[normalizeHeader(header)] = (row[i] ?? '').trim();
  });
  return map;
}

function rowToEntry(map, format) {
  let name = '';
  let url = '';
  let username = '';
  let password = '';
  let notes = '';
  let category = APP.DEFAULT_CATEGORY;

  if (format === 'bitwarden') {
    name = map.name || extractDomain(map.login_uri) || 'Kayıt';
    url = map.login_uri || '';
    username = map.login_username || '';
    password = map.login_password || '';
    notes = map.notes || '';
    category = (map.folder || '').trim() || APP.DEFAULT_CATEGORY;
  } else if (format === 'firefox') {
    url = map.url || '';
    username = map.username || '';
    password = map.password || '';
    name = extractDomain(url) || username || 'Kayıt';
  } else if (format === 'chrome') {
    name = map.name || map.title || extractDomain(map.url) || 'Kayıt';
    url = map.url || '';
    username = map.username || '';
    password = map.password || '';
  } else {
    name = map.name || map.title || 'Kayıt';
    url = map.url || map.login_uri || '';
    username = map.username || map.login_username || map.user || '';
    password = map.password || map.login_password || map.pass || '';
    notes = map.notes || map.note || '';
    category = (map.category || map.folder || '').trim() || APP.DEFAULT_CATEGORY;
  }

  name = name.trim();
  if (!name) return null;
  if (!password && !username && !url) return null;

  const tags = (map.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  const now = new Date().toISOString().slice(0, 10);

  return {
    name,
    url,
    username,
    password,
    notes,
    category,
    tags,
    icon: '🔐',
    strength: 'medium',
    totpSecret: null,
    createdAt: now,
    updatedAt: now,
  };
}

function isDuplicate(existing, entry) {
  const key = (e) => `${(e.url || '').toLowerCase()}|${(e.username || '').toLowerCase()}`;
  return existing.some((e) => key(e) === key(entry) && key(entry) !== '|');
}

function importCsvRows(rows, existingEntries = []) {
  if (rows.length < 2) {
    return { ok: false, error: 'CSV boş veya yalnızca başlık satırı var' };
  }

  const headers = rows[0];
  const format = detectFormat(headers);
  const entries = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c?.trim())) continue;
    const entry = rowToEntry(mapRow(headers, row), format);
    if (!entry) {
      skipped++;
      continue;
    }
    if (isDuplicate(existingEntries, entry) || isDuplicate(entries, entry)) {
      skipped++;
      continue;
    }
    entries.push(entry);
  }

  if (entries.length === 0) {
    return { ok: false, error: 'İçe aktarılacak geçerli kayıt bulunamadı', format };
  }

  return { ok: true, entries, format, formatLabel: FORMAT_LABELS[format] || format, skipped };
}

module.exports = { detectFormat, importCsvRows, FORMAT_LABELS };
