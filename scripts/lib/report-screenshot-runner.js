const fs = require('fs');
const path = require('path');
const { SCREENSHOTS_DIR, SCREENSHOTS } = require('./report-shared');

const DEMO_PASSWORD = 'VaultDemo2024!';
const ROOT = path.join(__dirname, '../..');
const WINDOW = require(path.join(ROOT, 'src/constants')).WINDOW;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function capture(win, filename) {
  const image = await win.webContents.capturePage();
  const out = path.join(SCREENSHOTS_DIR, filename);
  fs.writeFileSync(out, image.toPNG());
  console.log('  ✓', filename);
  return out;
}

async function exec(win, script) {
  return win.webContents.executeJavaScript(script, true);
}

function createPasswordCheckWindow() {
  const { BrowserWindow } = require('electron');
  const iconPath = path.join(ROOT, 'assets/icon.png');
  const hasIcon = fs.existsSync(iconPath);
  const win = new BrowserWindow({
    width: WINDOW.PASSWORD_CHECK.width,
    height: WINDOW.PASSWORD_CHECK.height,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    icon: hasIcon ? iconPath : undefined,
    webPreferences: {
      preload: path.join(ROOT, 'src/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#f8f9fc',
  });
  win.loadFile(path.join(ROOT, 'src/renderer/password-check.html'));
  return win;
}

async function waitForLoad(win) {
  if (win.webContents.isLoading()) {
    await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  }
  await delay(600);
}

async function showLockMode(win, mode) {
  await exec(win, `
    (function() {
      const winChrome = document.getElementById('winChrome');
      const lockScreen = document.getElementById('lockScreen');
      const lockSetup = document.getElementById('lockSetup');
      const lockUnlock = document.getElementById('lockUnlock');
      const lock2fa = document.getElementById('lock2fa');
      const appLayout = document.getElementById('appLayout');
      winChrome?.classList.add('is-locked');
      lockScreen?.classList.remove('is-hidden');
      appLayout?.classList.remove('is-visible');
      lockSetup?.classList.toggle('is-active', '${mode}' === 'setup');
      lockUnlock?.classList.toggle('is-active', '${mode}' === 'unlock');
      lock2fa?.classList.toggle('is-active', '${mode}' === '2fa');
    })();
  `);
  await delay(400);
}

async function unlockWithDemo(win) {
  await exec(win, `
    (async () => {
      const pw = document.getElementById('lockUnlockPw');
      if (pw) pw.value = '${DEMO_PASSWORD}';
      const btn = document.getElementById('lockUnlockBtn');
      if (btn) btn.click();
      await new Promise(r => setTimeout(r, 1200));
    })();
  `);
  await delay(800);
}

async function seedDemoEntries(win) {
  await exec(win, `
    (async () => {
      const demo = [
        { name: 'Google', url: 'https://google.com', username: 'mert@mail.com', password: 'Str0ng!Pass2024', category: 'e-posta', notes: 'Ana e-posta hesabı' },
        { name: 'GitHub', url: 'https://github.com', username: 'mertsahin', password: 'GitHub#Secure99', category: 'iş', notes: 'Kod depoları' },
        { name: 'Netflix', url: 'https://netflix.com', username: 'mert@mail.com', password: '12345', category: 'eğlence', notes: 'Zayıf parola örneği' },
        { name: 'Ziraat Bankası', url: 'https://ziraat.com.tr', username: '12345678', password: 'Bank@2024!Secure', category: 'finans', notes: '' },
        { name: 'Instagram', url: 'https://instagram.com', username: 'mertshn', password: 'Str0ng!Pass2024', category: 'sosyal', notes: 'Tekrar eden parola' },
      ];
      for (const e of demo) {
        await window.vault.saveEntry({ ...e, id: '', icon: '🔐', tags: [] });
      }
      if (typeof loadEntries === 'function') await loadEntries();
      else {
        const nav = document.querySelector('[data-route="home"]');
        if (nav) nav.click();
      }
      await new Promise(r => setTimeout(r, 600));
    })();
  `);
  await delay(700);
}

async function clickRoute(win, route) {
  await exec(win, `
    (function() {
      const el = document.querySelector('[data-route="${route}"]');
      if (el) el.click();
    })();
  `);
  await delay(900);
}

async function openFirstEntry(win) {
  await exec(win, `
    (function() {
      const row = document.querySelector('#sidebarList .entry-row');
      if (row) row.click();
    })();
  `);
  await delay(700);
}

async function seedAuditLogs(win) {
  await exec(win, `
    (async () => {
      const logs = [
        ['Kasa açıldı', 'Otomatik rapor örneği'],
        ['Parola eklendi', 'Google kaydı oluşturuldu'],
        ['Parola kopyalandı', 'GitHub — panoya kopyalandı'],
        ['Güvenlik raporu', 'Rapor görüntülendi'],
        ['Kasa kilitlendi', 'Oturum kapatıldı'],
      ];
      for (const [action, details] of logs) {
        await window.vault.addLog(action, details);
      }
    })();
  `);
  await delay(400);
}

async function scrollToAuditLog(win) {
  await exec(win, `
    (function() {
      const body = document.querySelector('#panelSettings .settings-body');
      const audit = document.getElementById('auditLogList');
      if (body && audit) {
        const top = audit.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 24;
        body.scrollTop = Math.max(0, top);
      }
    })();
  `);
  await delay(500);
}

async function run({ mainWindow, app }) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  console.log('Ekran görüntüleri alınıyor →', SCREENSHOTS_DIR);

  const win = mainWindow;
  win.show();
  await waitForLoad(win);

  // 1 — Kurulum ekranı
  await showLockMode(win, 'setup');
  await capture(win, SCREENSHOTS[0].file);

  // 2 — Giriş ekranı (master şifre oluştur, kilitle)
  await exec(win, `
    (async () => {
      await window.auth.setMasterPassword('${DEMO_PASSWORD}');
      await window.auth.lock();
      const winChrome = document.getElementById('winChrome');
      const lockScreen = document.getElementById('lockScreen');
      const lockSetup = document.getElementById('lockSetup');
      const lockUnlock = document.getElementById('lockUnlock');
      const appLayout = document.getElementById('appLayout');
      winChrome?.classList.add('is-locked');
      lockScreen?.classList.remove('is-hidden');
      appLayout?.classList.remove('is-visible');
      lockSetup?.classList.remove('is-active');
      lockUnlock?.classList.add('is-active');
    })();
  `);
  await delay(500);
  await capture(win, SCREENSHOTS[1].file);

  // 3 — Ana ekran
  await unlockWithDemo(win);
  await seedDemoEntries(win);
  await clickRoute(win, 'home');
  await capture(win, SCREENSHOTS[2].file);

  // 4 — Parola detayı
  await openFirstEntry(win);
  await capture(win, SCREENSHOTS[3].file);

  // 5 — Güvenlik raporu
  await clickRoute(win, 'report');
  await capture(win, SCREENSHOTS[4].file);

  // 6 — Şifre üretici penceresi
  const genWin = createPasswordCheckWindow();
  await waitForLoad(genWin);
  await exec(genWin, `
    (function() {
      if (typeof generatePassword === 'function') generatePassword();
      else document.getElementById('genGenerate')?.click();
    })();
  `);
  await delay(500);
  genWin.show();
  await delay(300);
  await capture(genWin, SCREENSHOTS[5].file);
  if (!genWin.isDestroyed()) genWin.close();

  // 7 — Ayarlar
  await clickRoute(win, 'settings');
  await capture(win, SCREENSHOTS[6].file);

  // 8 — Audit log (ayarlar içinde kaydır)
  await seedAuditLogs(win);
  await clickRoute(win, 'settings');
  await exec(win, 'if (typeof loadAuditLogs === "function") loadAuditLogs();');
  await delay(500);
  await scrollToAuditLog(win);
  await capture(win, SCREENSHOTS[7].file);

  console.log('Tüm ekran görüntüleri hazır.');
  app.quit();
}

module.exports = { run };
