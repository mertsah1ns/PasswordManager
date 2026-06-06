/**
 * PBKDF2 performans testi — tez raporu için
 * Kullanım: node scripts/benchmark-pbkdf2.js
 */

const crypto = require('crypto');
const { CRYPTO } = require('../src/constants');

const ITERATIONS = [50_000, 100_000, 200_000, 500_000];
const RUNS = 3;
const password = 'benchmark-test-password';
const salt = crypto.randomBytes(CRYPTO.SALT_LENGTH).toString('hex');
const { KEY_LENGTH, HASH_ALGORITHM } = CRYPTO;

console.log('VAULT — PBKDF2 Performans Testi');
console.log('Algoritma:', HASH_ALGORITHM);
console.log('Salt uzunluğu:', CRYPTO.SALT_LENGTH, 'byte');
console.log('---');

const results = [];

for (const it of ITERATIONS) {
  const times = [];
  for (let r = 0; r < RUNS; r++) {
    const start = process.hrtime.bigint();
    crypto.pbkdf2Sync(password, salt, it, KEY_LENGTH, HASH_ALGORITHM);
    times.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  results.push({ iterations: it, avgMs: Math.round(avg * 100) / 100, runs: times.map((t) => Math.round(t * 100) / 100) });
  console.log(`${it.toLocaleString('tr-TR')} tekrar → ortalama ${results.at(-1).avgMs} ms (${times.map((t) => t.toFixed(1)).join(', ')} ms)`);
}

console.log('---');
console.log(JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
