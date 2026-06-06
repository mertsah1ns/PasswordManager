/**
 * Have I Been Pwned — k-anonymity parola sızıntı kontrolü
 * https://haveibeenpwned.com/API/v3#PwnedPasswords
 */

const crypto = require('crypto');
const https = require('https');

function checkPasswordBreach(password) {
  if (!password) return Promise.resolve({ ok: true, count: 0 });

  const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  return new Promise((resolve) => {
    const req = https.get(
      {
        hostname: 'api.pwnedpasswords.com',
        path: `/range/${prefix}`,
        headers: { 'User-Agent': 'VAULT-Password-Manager', 'Add-Padding': 'true' },
        timeout: 8000,
      },
      (res) => {
        if (res.statusCode !== 200) {
          resolve({ ok: false, error: 'Sızıntı kontrolü servisi yanıt vermedi' });
          return;
        }
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          let count = 0;
          for (const line of body.split('\n')) {
            const [hashPart, countStr] = line.split(':');
            if (hashPart?.trim() === suffix) {
              count = parseInt(countStr, 10) || 0;
              break;
            }
          }
          resolve({ ok: true, count });
        });
      }
    );
    req.on('error', (e) => resolve({ ok: false, error: 'Bağlantı hatası: ' + e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Zaman aşımı' });
    });
  });
}

const HIBP_DELAY_MS = 400;

async function scanPasswords(passwords, onProgress) {
  const breaches = [];
  for (let i = 0; i < passwords.length; i++) {
    const { id, name, password } = passwords[i];
    if (!password) continue;
    const r = await checkPasswordBreach(password);
    if (r.ok && r.count > 0) {
      breaches.push({ id, name, count: r.count });
    }
    if (onProgress) onProgress(i + 1, passwords.length);
    if (i < passwords.length - 1) {
      await new Promise((res) => setTimeout(res, HIBP_DELAY_MS));
    }
  }
  return breaches;
}

module.exports = { checkPasswordBreach, scanPasswords, HIBP_DELAY_MS };
