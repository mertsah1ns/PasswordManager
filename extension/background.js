/* VAULT Chrome Extension - Background Service Worker */

const NATIVE_HOST = 'com.vault.passwordmanager';

async function sendToNativeHost(msg) {
  try {
    const port = chrome.runtime.connectNative(NATIVE_HOST);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        port.disconnect();
        reject(new Error('VAULT yanıt vermedi. Uygulama açık mı?'));
      }, 15000);
      port.onMessage.addListener((response) => {
        clearTimeout(timeout);
        port.disconnect();
        resolve(response);
      });
      port.onDisconnect.addListener(() => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error('VAULT bağlantısı kurulamadı. Uygulama açık ve eklenti kurulmuş olmalı.'));
        }
      });
      port.postMessage(msg);
    });
  } catch (e) {
    throw e;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      const res = await sendToNativeHost({
        ...msg,
        tabId: sender.tab?.id,
        tabUrl: sender.tab?.url
      });
      return res;
    } catch (e) {
      return { ok: false, error: e.message || 'Bağlantı hatası' };
    }
  })().then(sendResponse);
  return true;
});
