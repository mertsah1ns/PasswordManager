document.getElementById('btnFill').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const err = document.getElementById('error');
  const btn = document.getElementById('btnFill');
  status.textContent = '';
  err.textContent = '';
  btn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Sekme bulunamadı');
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'manualFill' });
    if (res?.ok) {
      status.textContent = 'Dolduruldu.';
    } else {
      err.textContent = res?.error || 'Bu sayfada giriş formu bulunamadı.';
    }
  } catch (e) {
    err.textContent = e.message || 'Bir hata oluştu.';
  }
  btn.disabled = false;
});
