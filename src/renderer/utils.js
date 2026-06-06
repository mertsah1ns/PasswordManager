/**
 * VAULT — Renderer tarafı paylaşılan yardımcılar
 * index.html ve password-check.html'de script olarak yüklenir.
 * window.VaultUtils üzerinden erişilir.
 */
(function (global) {
  'use strict';

  const TOAST_DURATION_MS = 1800;

  function notify(msg) {
    const el = document.getElementById('notif');
    if (!el) return;
    el.innerHTML = '<span style="margin-right:6px">✓</span>' + String(msg);
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
    }, TOAST_DURATION_MS);
  }

  function extractDomain(url) {
    if (!url) return '';
    try {
      const u = new URL(url.startsWith('http') ? url : 'https://' + url);
      return u.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return (url || '').toLowerCase();
    }
  }

  function strengthFromPw(pw) {
    if (!pw || !pw.length) return { score: 0, level: 'weak', pct: 0 };
    let s = 0;
    if (pw.length >= 8) s += 20;
    if (pw.length >= 12) s += 15;
    if (pw.length >= 16) s += 10;
    if (/[a-z]/.test(pw)) s += 10;
    if (/[A-Z]/.test(pw)) s += 10;
    if (/[0-9]/.test(pw)) s += 15;
    if (/[^a-zA-Z0-9]/.test(pw)) s += 20;
    const pct = Math.min(100, s);
    const level = pct >= 70 ? 'strong' : pct >= 40 ? 'medium' : 'weak';
    return { score: pct, level, pct };
  }

  const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

  function formatDate(str) {
    if (!str) return '—';
    const d = new Date(str);
    return d.getDate() + ' ' + MONTHS_TR[d.getMonth()] + ' ' + d.getFullYear();
  }

  function getFaviconUrl(url) {
    const domain = extractDomain(url);
    return domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : null;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function refreshLucideIcons() {
    if (typeof global.lucide !== 'undefined') global.lucide.createIcons();
  }

  const PASSWORD_CHARS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symCommon: '!@#$%^&*',
    symBrackets: '()[]{}<>',
    symOther: '_-+=;:,.?/',
  };

  function generatePassword(options = {}) {
    const {
      length = 16,
      upper = true,
      lower = true,
      numbers = true,
      symbols = '',
    } = options;

    let pool = '';
    if (upper) pool += PASSWORD_CHARS.upper;
    if (lower) pool += PASSWORD_CHARS.lower;
    if (numbers) pool += PASSWORD_CHARS.numbers;
    if (symbols) pool += symbols;
    if (!pool) pool = PASSWORD_CHARS.lower + PASSWORD_CHARS.numbers;

    const len = Math.min(64, Math.max(8, length));
    const arr = new Uint32Array(len);
    global.crypto.getRandomValues(arr);
    let pw = '';
    for (let i = 0; i < len; i++) pw += pool[arr[i] % pool.length];
    return pw;
  }

  const PASSPHRASE_WORDS = [
    'akilli', 'ruzgar', 'gunes', 'deniz', 'yesil', 'kapi', 'kitap', 'dunya', 'hayat', 'yildiz', 
    'nehir', 'dalga', 'toprak', 'orman', 'bulut', 'aslan', 'sahin', 'nese', 'sevgi', 'baris', 
    'demir', 'celik', 'altin', 'gumus', 'bakir', 'elmas', 'zumrut', 'yakut', 'inci', 'mavi', 
    'kirmizi', 'sari', 'beyaz', 'siyah', 'turuncu', 'mor', 'pembe', 'gri', 'kahve', 'agac', 
    'cicek', 'yaprak', 'meyve', 'sebze', 'ekmek', 'su', 'cay', 'sut', 'bal', 'seker', 
    'tuz', 'biber', 'elma', 'armut', 'kiraz', 'cilek', 'erik', 'uzum', 'kavun', 'karpuz', 
    'incir', 'nar', 'ceviz', 'findik', 'fistik', 'badem', 'bugday', 'arpa', 'misir', 'pirinc', 
    'un', 'yag', 'peynir', 'yogurt', 'kaymak', 'tereyagi', 'zeytin', 'yumurta', 'et', 'balik', 
    'tavuk', 'hindi', 'ordek', 'kaz', 'kuzu', 'dana', 'keci', 'koyun', 'inek', 'at', 
    'esek', 'katir', 'deve', 'fil', 'kaplan', 'ayi', 'kurt', 'tilki', 'tavsan', 'kartal',
    'guvercin', 'kedi', 'kopek', 'kus', 'kelebek', 'ari', 'karinca', 'balina', 'yunus', 'ahtapot',
    'gol', 'dere', 'vadi', 'dag', 'tepe', 'kaya', 'tas', 'kum', 'kil', 'camur',
    'yagmur', 'kar', 'dolu', 'sis', 'firtina', 'simsek', 'yildirim', 'gokkusagi', 'isik', 'golge'
  ];

  function generatePassphrase(wordCount = 4) {
    const count = Math.min(8, Math.max(3, wordCount));
    const arr = new Uint32Array(count);
    global.crypto.getRandomValues(arr);
    const words = [];
    for (let i = 0; i < count; i++) {
      words.push(PASSPHRASE_WORDS[arr[i] % PASSPHRASE_WORDS.length]);
    }
    return words.join('-');
  }

  const VaultUtils = {
    notify,
    extractDomain,
    strengthFromPw,
    formatDate,
    getFaviconUrl,
    escapeHtml,
    refreshLucideIcons,
    PASSWORD_CHARS,
    generatePassword,
    PASSPHRASE_WORDS,
    generatePassphrase,
  };

  global.VaultUtils = VaultUtils;
})(typeof window !== 'undefined' ? window : globalThis);
