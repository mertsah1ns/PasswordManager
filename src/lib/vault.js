/**
 * Vault yükleme, kaydetme, normalizasyon
 */

const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { APP, FILES } = require('../constants');
const { encryptVault, decryptVault, isVaultEncrypted } = require('./crypto');
const { getEmptyVault } = require('./defaults');

const userDataPath = app.getPath('userData');
const vaultPath = path.join(userDataPath, FILES.VAULT);
const attachmentsPath = path.join(userDataPath, 'attachments');

// Ensure attachments directory exists
if (!fs.existsSync(attachmentsPath)) {
  fs.mkdirSync(attachmentsPath, { recursive: true });
}

function normalizeEntry(e) {
  return {
    ...e,
    category: e.category || APP.DEFAULT_CATEGORY,
    tags: Array.isArray(e.tags)
      ? e.tags
      : (e.tags ? String(e.tags).split(',').map((t) => t.trim()).filter(Boolean) : []),
    customFields: Array.isArray(e.customFields)
      ? e.customFields.filter((f) => f && (f.key || f.value))
      : [],
  };
}

function normalizeVault(v) {
  const defaults = getEmptyVault();
  const entries = (v.entries || []).map(normalizeEntry);
  return {
    entries: entries.length ? entries : defaults.entries,
    cards: v.cards || [],
    notes: v.notes || [],
    payments: v.payments || [],
    attachments: v.attachments || [],
    logs: v.logs || [],
    nextId: v.nextId ?? defaults.nextId,
    nextCardId: v.nextCardId ?? 1,
    nextNoteId: v.nextNoteId ?? 1,
    nextPaymentId: v.nextPaymentId ?? 1,
  };
}

function loadVaultRaw() {
  if (!fs.existsSync(vaultPath)) return null;
  return fs.readFileSync(vaultPath, 'utf8');
}

/**
 * @param {Buffer|null} key - vaultKey (aes key). Şifreli vault için gerekli.
 */
function loadVault(key = null) {
  try {
    const raw = loadVaultRaw();
    if (!raw) return normalizeVault({});

    if (isVaultEncrypted(raw)) {
      if (!key) throw new Error('VAULT_LOCKED');
      const plain = decryptVault(raw, key);
      return normalizeVault(JSON.parse(plain));
    }
    return normalizeVault(JSON.parse(raw));
  } catch (e) {
    if (e.message === 'VAULT_LOCKED') throw e;
    return normalizeVault(getEmptyVault());
  }
}

/**
 * @param {Object} vault - Kasa verisi
 * @param {Buffer|null} key - Şifreli kaydetmek için key; null ise plain JSON
 */
function saveVault(vault, key = null) {
  const normalized = normalizeVault({ ...vault });
  const plain = JSON.stringify(normalized, null, 2);
  const data = key ? encryptVault(plain, key) : plain;
  fs.writeFileSync(vaultPath, data, 'utf8');
}

function getVaultPath() {
  return vaultPath;
}

module.exports = {
  vaultPath,
  userDataPath,
  attachmentsPath,
  normalizeVault,
  loadVaultRaw,
  loadVault,
  saveVault,
  getVaultPath,
};
