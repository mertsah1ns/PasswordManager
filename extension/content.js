/* VAULT Chrome Extension - Content Script: otomatik doldurma ve şifre yakalama */

(function() {
  'use strict';

  const VAULT_MARKER = 'data-vault-filled';

  function getPageOrigin() {
    return window.location.origin;
  }

  function getPageUrl() {
    return window.location.href;
  }

  function findLoginForm() {
    const forms = document.querySelectorAll('form');
    for (const form of forms) {
      const pwInput = form.querySelector('input[type="password"]');
      const userInput = form.querySelector('input[type="email"], input[type="text"], input[name*="user"], input[name*="login"], input[name*="email"], input[id*="user"], input[id*="login"], input[id*="email"]');
      if (pwInput && (userInput || pwInput)) return { form, userInput, pwInput };
    }
    const pwInputs = document.querySelectorAll('input[type="password"]');
    for (const pw of pwInputs) {
      const userInput = pw.closest('form')?.querySelector('input[type="email"], input[type="text"], input[name*="user"], input[name*="login"], input[name*="email"]')
        || document.querySelector('input[type="email"], input[type="text"]');
      return { form: pw.closest('form'), userInput, pwInput: pw };
    }
    return null;
  }

  async function requestCredentials() {
    const url = getPageUrl();
    const res = await chrome.runtime.sendMessage({ action: 'getCredentials', url });
    if (!res?.ok || !res.entry) return null;
    return res.entry;
  }

  function fillForm(userInput, pwInput, username, password) {
    if (userInput) {
      userInput.value = username;
      userInput.dispatchEvent(new Event('input', { bubbles: true }));
      userInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (pwInput) {
      pwInput.value = password;
      pwInput.dispatchEvent(new Event('input', { bubbles: true }));
      pwInput.dispatchEvent(new Event('change', { bubbles: true }));
      pwInput.setAttribute(VAULT_MARKER, '1');
    }
  }

  async function tryAutoFill() {
    const login = findLoginForm();
    if (!login) return;
    const { userInput, pwInput } = login;
    const entry = await requestCredentials();
    if (!entry) return;
    fillForm(userInput, pwInput, entry.username || '', entry.password || '');
  }

  function onFormSubmit(form, userInput, pwInput) {
    const username = userInput?.value?.trim() || '';
    const password = pwInput?.value || '';
    if (!password) return;
    const url = getPageUrl();
    const name = extractSiteName(url);
    chrome.runtime.sendMessage({
      action: 'offerSave',
      url,
      username,
      password,
      name
    });
  }

  function extractSiteName(url) {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '');
    } catch { return 'Site'; }
  }

  function attachFormListeners() {
    const login = findLoginForm();
    if (!login) return;
    const { form, userInput, pwInput } = login;
    if (pwInput?.hasAttribute(VAULT_MARKER)) return;
    const captureAndSubmit = (e) => {
      onFormSubmit(form, userInput, pwInput);
    };
    const handler = (e) => {
      captureAndSubmit(e);
    };
    if (form) {
      form.addEventListener('submit', handler, true);
    }
    const btns = document.querySelectorAll('button[type="submit"], input[type="submit"], button[type="button"]');
    btns.forEach(btn => {
      if (form && form.contains(btn)) btn.addEventListener('click', () => onFormSubmit(form, userInput, pwInput), true);
    });
  }

  function init() {
    tryAutoFill().catch(() => {});
    attachFormListeners();
    setTimeout(attachFormListeners, 1000);
    document.addEventListener('focusin', () => { tryAutoFill().catch(() => {}); }, true);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'manualFill') {
      tryAutoFill().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: e.message }));
      return true;
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
