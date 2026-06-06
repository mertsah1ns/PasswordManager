#!/usr/bin/env node
/**
 * VAULT Native Messaging Host
 * Chrome <-> Electron köprüsü (stdin/stdout <-> HTTP)
 */
const http = require('http');

const VAULT_PORT = 31415;
const VAULT_HOST = '127.0.0.1';
const MAX_MSG_SIZE = 1024 * 1024;

function sendToVault(msg) {
  return new Promise((resolve) => {
    const data = JSON.stringify(msg);
    const req = http.request({
      hostname: VAULT_HOST,
      port: VAULT_PORT,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data, 'utf8')
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}'));
        } catch {
          resolve({ ok: false, error: 'Geçersiz yanıt' });
        }
      });
    });
    req.on('error', () => {
      resolve({ ok: false, error: 'VAULT bağlantısı kurulamadı. Uygulama açık mı?' });
    });
    req.setTimeout(12000, () => {
      req.destroy();
      resolve({ ok: false, error: 'Zaman aşımı' });
    });
    req.write(data);
    req.end();
  });
}

function writeMessage(obj) {
  const msg = JSON.stringify(obj);
  const buf = Buffer.from(msg, 'utf8');
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32LE(buf.length, 0);
  process.stdout.write(len);
  process.stdout.write(buf);
}

let buffer = Buffer.alloc(0);

async function processMessage(msgBuf) {
  try {
    const msg = JSON.parse(msgBuf.toString('utf8'));
    const res = await sendToVault(msg);
    writeMessage(res);
  } catch {
    writeMessage({ ok: false, error: 'Geçersiz mesaj' });
  }
}

process.stdin.on('data', async (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length >= 4) {
    const msgLen = buffer.readUInt32LE(0);
    if (msgLen === 0 || msgLen > MAX_MSG_SIZE) {
      buffer = buffer.slice(4);
      continue;
    }
    if (buffer.length < 4 + msgLen) break;
    const msgBuf = buffer.slice(4, 4 + msgLen);
    buffer = buffer.slice(4 + msgLen);
    await processMessage(msgBuf);
  }
});

process.stdin.on('end', () => process.exit(0));
