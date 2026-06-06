/**
 * VAULT — Merkezi sabit değerler
 * Tüm magic number/string'ler tek yerde; bakım kolaylığı ve tutarlılık.
 */

const PKG = require('../package.json');

/** Uygulama */
const APP = {
  NAME: 'VAULT — Şifre Yöneticisi',
  VERSION: PKG.version || '2.4.0',
  DEFAULT_CATEGORY: 'diğer',
  CATEGORIES: ['sosyal', 'iş', 'finans', 'eğlence', 'alışveriş', 'e-posta', 'diğer'],
};

/** Kriptografi */
const CRYPTO = {
  PBKDF2_ITERATIONS_DEFAULT: 100_000,
  PBKDF2_ITERATIONS_MIN: 10_000,
  PBKDF2_ITERATIONS_MAX: 1_000_000,
  SALT_LENGTH: 32,
  KEY_LENGTH: 64,
  VAULT_KEY_LENGTH: 32,
  GCM_IV_LENGTH: 12,
  GCM_TAG_LENGTH: 16,
  HASH_ALGORITHM: 'sha512',
};

/** Pencere */
const WINDOW = {
  MAIN: { width: 1000, height: 720, minWidth: 800, minHeight: 600 },
  PASSWORD_CHECK: { width: 520, height: 620, minWidth: 480, minHeight: 520 },
  TITLEBAR_HEIGHT: 40,
};

/** Extension / Native Host */
const EXTENSION = {
  PORT: 31_415,
  INSTALL_TIMEOUT_MS: 15_000,
};

/** Zamanlama */
const TIMING = {
  TOAST_DURATION_MS: 1_800,
  CLIPBOARD_CLEAR_SECONDS: 30,
  TOTP_PERIOD_SECONDS: 30,
};

/** Varsayılan ID'ler (boş vault için) */
const DEFAULT_IDS = {
  nextId: 1,
  nextCardId: 1,
  nextNoteId: 1,
  nextPaymentId: 1,
};

/** Dosya adları */
const FILES = {
  VAULT: 'vault.json',
  AUTH: 'auth.json',
  REMINDERS: 'reminders.json',
};

module.exports = {
  APP,
  CRYPTO,
  WINDOW,
  EXTENSION,
  TIMING,
  DEFAULT_IDS,
  FILES,
};
