/* Şifre Üretici penceresi — VaultUtils kullanır */
const CHARS = window.VaultUtils?.PASSWORD_CHARS ?? {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symCommon: '!@#$%^&*',
  symBrackets: '()[]{}<>',
  symOther: '_-+=;:,.?/',
};
const notify = (msg) => window.VaultUtils?.notify?.(msg);

function setToggleIcon(iconName) {
  const toggle = document.getElementById('genPwToggle');
  if (!toggle) return;
  toggle.innerHTML = `<i data-lucide="${iconName}"></i>`;
  window.VaultUtils?.refreshLucideIcons?.();
}

function getSymbolPool() {
  const useSymbols = document.getElementById('genSymbols')?.checked ?? true;
  if (!useSymbols) return '';
  let pool = '';
  if (document.getElementById('genSymCommon')?.checked) pool += CHARS.symCommon;
  if (document.getElementById('genSymBrackets')?.checked) pool += CHARS.symBrackets;
  if (document.getElementById('genSymOther')?.checked) pool += CHARS.symOther;
  const custom = (document.getElementById('genSymCustom')?.value || '').replace(/\s/g, '');
  if (custom) pool += custom;
  return pool;
}

function generatePassword() {
  const type = document.getElementById('genType')?.value || 'random';
  const out = document.getElementById('genOutput');

  let pw = '';
  if (type === 'passphrase') {
    const lenEl = document.getElementById('genLength');
    const wordCount = Math.min(8, Math.max(3, parseInt(lenEl?.value) || 4));
    if (window.VaultUtils?.generatePassphrase) {
      pw = window.VaultUtils.generatePassphrase(wordCount);
    } else {
      pw = 'yesil-nehir-aslan-sevgi';
    }
  } else {
    const lenEl = document.getElementById('genLength');
    const len = Math.min(64, Math.max(8, parseInt(lenEl?.value) || 16));
    const upper = document.getElementById('genUpper')?.checked ?? true;
    const lower = document.getElementById('genLower')?.checked ?? true;
    const numbers = document.getElementById('genNumbers')?.checked ?? true;
    const symbols = getSymbolPool();
    let pool = '';
    if (upper) pool += CHARS.upper;
    if (lower) pool += CHARS.lower;
    if (numbers) pool += CHARS.numbers;
    if (symbols) pool += symbols;
    if (!pool) pool = CHARS.lower + CHARS.numbers;
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) pw += pool[arr[i] % pool.length];
  }
  
  if (out) {
    out.value = pw;
    out.type = 'password';
    setToggleIcon('eye');
  }
}

function togglePasswordVisibility() {
  const out = document.getElementById('genOutput');
  if (!out) return;
  if (out.type === 'password') {
    out.type = 'text';
    setToggleIcon('eye-off');
  } else {
    out.type = 'password';
    setToggleIcon('eye');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const theme = localStorage.getItem('vault_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('genGenerate')?.addEventListener('click', generatePassword);
  document.getElementById('genPwToggle')?.addEventListener('click', togglePasswordVisibility);
  
  document.getElementById('genType')?.addEventListener('change', (e) => {
    const type = e.target.value;
    const isPassphrase = type === 'passphrase';
    const cboxes = document.getElementById('genCheckboxes');
    const symOpts = document.getElementById('genSymbolOptions');
    const lenLabel = document.getElementById('genLengthLabel');
    const lenInput = document.getElementById('genLength');
    
    if (cboxes) cboxes.style.display = isPassphrase ? 'none' : 'block';
    if (symOpts) symOpts.style.display = isPassphrase ? 'none' : (document.getElementById('genSymbols')?.checked ? 'block' : 'none');
    if (lenLabel) lenLabel.textContent = isPassphrase ? 'Kelime Sayısı' : 'Uzunluk (Karakter)';
    if (lenInput) {
      if (isPassphrase) {
        if (parseInt(lenInput.value, 10) > 8) lenInput.value = '4';
        lenInput.min = '3';
        lenInput.max = '8';
      } else {
        if (parseInt(lenInput.value, 10) <= 8) lenInput.value = '16';
        lenInput.min = '8';
        lenInput.max = '64';
      }
    }
    generatePassword();
  });

  document.getElementById('genSymbols')?.addEventListener('change', (e) => {
    const type = document.getElementById('genType')?.value || 'random';
    if (type === 'passphrase') return;
    const opts = document.getElementById('genSymbolOptions');
    if (opts) opts.style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('genCopy')?.addEventListener('click', () => {
    const v = document.getElementById('genOutput')?.value;
    if (v) {
      if (window.vault?.copyToClipboard) window.vault.copyToClipboard(v);
      else navigator.clipboard?.writeText(v);
      notify('Panoya kopyalandı');
    }
  });
  document.getElementById('winMinimize')?.addEventListener('click', () => window.windowControls?.minimize());
  document.getElementById('winMaximize')?.addEventListener('click', () => window.windowControls?.maximize());
  document.getElementById('winClose')?.addEventListener('click', () => window.windowControls?.close());

  const maxIcon = document.getElementById('winMaxIcon');
  window.windowControls?.onMaximized?.(() => {
    if (maxIcon) { maxIcon.setAttribute('data-lucide', 'minimize-2'); window.VaultUtils?.refreshLucideIcons?.(); }
  });
  window.windowControls?.onUnmaximized?.(() => {
    if (maxIcon) { maxIcon.setAttribute('data-lucide', 'square'); window.VaultUtils?.refreshLucideIcons?.(); }
  });

  generatePassword();
  window.VaultUtils?.refreshLucideIcons?.();
});
