/**
 * Vault şifreleme/çözme — AES-256-GCM, PBKDF2
 */

const crypto = require('crypto');
const { CRYPTO } = require('../constants');

const {
  PBKDF2_ITERATIONS_DEFAULT,
  SALT_LENGTH,
  KEY_LENGTH,
  VAULT_KEY_LENGTH,
  GCM_IV_LENGTH,
  GCM_TAG_LENGTH,
  HASH_ALGORITHM,
} = CRYPTO;

function hashPassword(password, iterations = PBKDF2_ITERATIONS_DEFAULT) {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, iterations, KEY_LENGTH, HASH_ALGORITHM)
    .toString('hex');
  return { salt, hash, pbkdf2Iterations: iterations };
}

function verifyPassword(password, auth) {
  if (!auth?.salt || !auth?.hash) return false;
  const it = getPbkdf2Iterations(auth);
  const hash = crypto
    .pbkdf2Sync(password, auth.salt, it, KEY_LENGTH, HASH_ALGORITHM)
    .toString('hex');
  return crypto.timingSafeEqual(
    Buffer.from(auth.hash, 'hex'),
    Buffer.from(hash, 'hex')
  );
}

function getPbkdf2Iterations(auth) {
  const n = auth?.pbkdf2Iterations;
  return n >= CRYPTO.PBKDF2_ITERATIONS_MIN && n <= CRYPTO.PBKDF2_ITERATIONS_MAX
    ? n
    : PBKDF2_ITERATIONS_DEFAULT;
}

function deriveVaultKey(password, salt, iterations = PBKDF2_ITERATIONS_DEFAULT) {
  return crypto.pbkdf2Sync(
    password,
    salt,
    iterations,
    VAULT_KEY_LENGTH,
    HASH_ALGORITHM
  );
}

function encryptVault(plainJson, key) {
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plain = Buffer.from(plainJson, 'utf8');
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptVault(encryptedBase64, key) {
  const buf = Buffer.from(encryptedBase64, 'base64');
  const iv = buf.subarray(0, GCM_IV_LENGTH);
  const tag = buf.subarray(GCM_IV_LENGTH, GCM_IV_LENGTH + GCM_TAG_LENGTH);
  const enc = buf.subarray(GCM_IV_LENGTH + GCM_TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function isVaultEncrypted(data) {
  if (!data || typeof data !== 'string') return false;
  const trimmed = data.trim();
  if (trimmed.startsWith('{')) return false;
  try {
    Buffer.from(trimmed, 'base64');
    return trimmed.length > 50;
  } catch {
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  getPbkdf2Iterations,
  deriveVaultKey,
  encryptVault,
  decryptVault,
  isVaultEncrypted,
};
