/**
 * VAULT — Ana Electron süreci
 * Modüler yapı: constants, lib (auth, crypto, vault, defaults, utils)
 */

const { app, BrowserWindow, ipcMain, clipboard, shell, dialog, Tray, nativeImage, Notification, Menu, safeStorage } = require('electron');
const speakeasy = require('speakeasy');
const path = require('path');
const fs = require('fs');
const http = require('http');

const { APP, CRYPTO, WINDOW, EXTENSION, FILES } = require('./constants');
const { loadAuth, saveAuth } = require('./lib/auth');
const {
  hashPassword,
  verifyPassword,
  getPbkdf2Iterations,
  deriveVaultKey,
  encryptVault,
  decryptVault,
  isVaultEncrypted,
} = require('./lib/crypto');
const {
  vaultPath,
  userDataPath,
  attachmentsPath,
  loadVault,
  saveVault,
  normalizeVault,
} = require('./lib/vault');
const { getEmptyVault } = require('./lib/defaults');
const { extractDomain } = require('./lib/utils');
const { checkPasswordBreach, scanPasswords } = require('./lib/hibp');
const { importCsvRows } = require('./lib/importCsv');

let mainWindow;
let passwordCheckWindow = null;
let tray = null;
let vaultKey = null;
let tempVaultKey = null;
let clipboardClearTimer = null;

function runWindowsHelloPrompt() {
  const { exec } = require('child_process');
  const psPath = path.join(userDataPath, 'win_hello_prompt.ps1');
  const psScript = `try {
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;

    public class HelloVerifier {
        [DllImport("credui.dll", CharSet = CharSet.Unicode)]
        private static extern int CredUIPromptForWindowsCredentials(
            ref CREDUI_INFO pUiInfo,
            int dwAuthError,
            ref uint pulAuthPackage,
            IntPtr pvInAuthBuffer,
            uint ulInAuthBufferSize,
            out IntPtr ppvOutAuthBuffer,
            out uint pulOutAuthBufferSize,
            ref bool pfSave,
            uint dwFlags);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct CREDUI_INFO {
            public int cbSize;
            public IntPtr hwndParent;
            public string pszMessageText;
            public string pszCaptionText;
            public IntPtr hbmBanner;
        }

        public static string Verify() {
            CREDUI_INFO uiInfo = new CREDUI_INFO();
            uiInfo.cbSize = Marshal.SizeOf(uiInfo);
            uiInfo.hwndParent = IntPtr.Zero;
            uiInfo.pszMessageText = "VAULT sifre kasasina erisim icin dogrulanin.";
            uiInfo.pszCaptionText = "VAULT Biyometrik Kimlik Dogrulama";
            uiInfo.hbmBanner = IntPtr.Zero;

            uint authPackage = 0;
            IntPtr outAuthBuffer = IntPtr.Zero;
            uint outAuthBufferSize = 0;
            bool save = false;

            int result = CredUIPromptForWindowsCredentials(
                ref uiInfo,
                0,
                ref authPackage,
                IntPtr.Zero,
                0,
                out outAuthBuffer,
                out outAuthBufferSize,
                ref save,
                0x1); // CREDUIWIN_GENERIC

            if (result == 0) return "Verified";
            if (result == 1223) return "Canceled";
            return "Failed:" + result;
        }
    }
"@
    [HelloVerifier]::Verify()
} catch {
    Write-Output "Error: $_"
}`;

  if (!fs.existsSync(psPath) || fs.readFileSync(psPath, 'utf8') !== psScript) {
    fs.writeFileSync(psPath, psScript, 'utf8');
  }

  return new Promise((resolve) => {
    exec(`powershell -ExecutionPolicy Bypass -File "${psPath}"`, (err, stdout) => {
      if (err) {
        resolve({ ok: false, error: err.message });
      } else {
        const res = (stdout || '').trim();
        if (res === 'Verified') {
          resolve({ ok: true });
        } else if (res === 'Canceled') {
          resolve({ ok: false, canceled: true });
        } else {
          resolve({ ok: false, error: res });
        }
      }
    });
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, '../assets/icon.png');
  const hasIcon = fs.existsSync(iconPath);

  mainWindow = new BrowserWindow({
    width: WINDOW.MAIN.width,
    height: WINDOW.MAIN.height,
    minWidth: WINDOW.MAIN.minWidth,
    minHeight: WINDOW.MAIN.minHeight,
    icon: hasIcon ? iconPath : undefined,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#f8f9fc',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../src/renderer/index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized'));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:unmaximized'));
  mainWindow.on('close', (e) => {
    if (tray && !app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  if (tray) return;
  const iconPath = path.join(__dirname, '../assets/icon.png');
  let icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVQ4T2NkYGD4z0ABYBzVMKphVMOohoGu4T8DgwIDAwMDw38G8gEjowIDAwMDw38G8gEjIwMDAwBQfQcFjGpqawAAAABJRU5ErkJggg==');
  if (!icon || icon.isEmpty()) icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVQ4T2NkYGD4z0ABYBzVMKphVMOohoGu4T8DgwIDAwMDw38G8gEjowIDAwMDw38G8gEjIwMDAwBQfQcFjGpqawAAAABJRU5ErkJggg==');
  tray = new Tray(icon);
  tray.setToolTip(APP.NAME);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'VAULT Aç', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: 'Kilitle', click: () => { mainWindow?.show(); mainWindow?.webContents?.send('app:lock'); } },
    { type: 'separator' },
    { label: 'Çıkış', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

function createPasswordCheckWindow() {
  if (passwordCheckWindow && !passwordCheckWindow.isDestroyed()) {
    passwordCheckWindow.focus();
    return;
  }
  const iconPath = path.join(__dirname, '../assets/icon.png');
  const hasIcon = fs.existsSync(iconPath);
  passwordCheckWindow = new BrowserWindow({
    width: WINDOW.PASSWORD_CHECK.width,
    height: WINDOW.PASSWORD_CHECK.height,
    minWidth: WINDOW.PASSWORD_CHECK.minWidth,
    minHeight: WINDOW.PASSWORD_CHECK.minHeight,
    icon: hasIcon ? iconPath : undefined,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#f8f9fc',
    title: 'Şifre Üret — VAULT',
  });
  passwordCheckWindow.loadFile(path.join(__dirname, '../src/renderer/password-check.html'));
  passwordCheckWindow.on('closed', () => { passwordCheckWindow = null; });
  passwordCheckWindow.on('maximize', () => passwordCheckWindow?.webContents?.send('window:maximized'));
  passwordCheckWindow.on('unmaximize', () => passwordCheckWindow?.webContents?.send('window:unmaximized'));
}

function startExtensionServer() {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405); res.end(); return;
    }
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      let msg;
      try { msg = JSON.parse(body || '{}'); } catch { res.writeHead(400); res.end(JSON.stringify({ ok: false, error: 'Geçersiz JSON' })); return; }
      const send = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
      if (msg.action === 'getCredentials') {
        if (!vaultKey) return send({ ok: false, error: 'VAULT kilitli. Önce kasayı açın.', locked: true });
        try {
          const vault = loadVault(vaultKey);
          const pageDom = extractDomain(msg.url || '');
          const matches = vault.entries.filter((e) => {
            const entryDom = extractDomain(e.url);
            return entryDom && (pageDom === entryDom || pageDom.endsWith('.' + entryDom) || entryDom.endsWith('.' + pageDom));
          });
          const entry = matches[0];
          if (!entry) return send({ ok: false, error: 'Bu site için kayıtlı parola yok' });
          send({ ok: true, entry: { username: entry.username || '', password: entry.password || '' } });
        } catch (e) {
          send({ ok: false, error: e.message === 'VAULT_LOCKED' ? 'Kasa kilitli' : 'Hata' });
        }
      } else if (msg.action === 'offerSave') {
        if (!vaultKey) return send({ ok: false, error: 'VAULT kilitli. Önce kasayı açın.', locked: true });
        try {
          const url = (msg.url || '').trim() || msg.tabUrl || '';
          const username = (msg.username || '').trim();
          const password = msg.password || '';
          const name = (msg.name || '').trim() || extractDomain(url) || 'Site';
          if (!password) return send({ ok: false, error: 'Şifre boş' });
          mainWindow?.show();
          mainWindow?.focus();
          mainWindow?.webContents?.send('extension:offerSave', { url: url || `https://${extractDomain(url)}`, username, password, name });
          send({ ok: true });
        } catch (e) {
          send({ ok: false, error: e.message || 'Hata' });
        }
      } else {
        send({ ok: false, error: 'Bilinmeyen işlem' });
      }
    });
  });
  server.listen(EXTENSION.PORT, '127.0.0.1', () => {});
  server.on('error', () => {});
}

function loadRemindersSent() {
  try {
    return JSON.parse(fs.readFileSync(path.join(userDataPath, FILES.REMINDERS), 'utf8'));
  } catch {
    return {};
  }
}

function saveReminderSent(paymentId, dateStr) {
  const p = path.join(userDataPath, FILES.REMINDERS);
  const o = loadRemindersSent();
  o[paymentId] = dateStr;
  fs.writeFileSync(p, JSON.stringify(o), 'utf8');
}

const isReportCapture = process.env.VAULT_REPORT_CAPTURE === '1';

app.whenReady().then(() => {
  createWindow();
  if (isReportCapture) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        require(path.join(__dirname, '../scripts/lib/report-screenshot-runner'))
          .run({ mainWindow, app })
          .catch((err) => {
            console.error('Rapor ekran görüntüsü hatası:', err);
            app.quit(1);
          });
      }, 1200);
    });
  } else {
    createTray();
    startExtensionServer();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  mainWindow?.show();
});

// ——— IPC Handlers ———

ipcMain.handle('copy-to-clipboard', (_, text, clearAfterSeconds = 0) => {
  clipboard.writeText(text);
  if (clipboardClearTimer) clearTimeout(clipboardClearTimer);
  clipboardClearTimer = null;
  if (clearAfterSeconds > 0) {
    clipboardClearTimer = setTimeout(() => {
      if (clipboard.readText() === text) clipboard.clear();
      clipboardClearTimer = null;
    }, clearAfterSeconds * 1000);
  }
  return true;
});

ipcMain.handle('auth:hasMasterPassword', () => !!loadAuth()?.hash);

ipcMain.handle('auth:setMasterPassword', (_, password) => {
  if (!password || password.length < 6) return { ok: false, error: 'En az 6 karakter gerekli' };
  const { salt, hash, pbkdf2Iterations } = hashPassword(password);
  saveAuth({ salt, hash, pbkdf2Iterations });
  vaultKey = deriveVaultKey(password, salt, pbkdf2Iterations);
  if (fs.existsSync(vaultPath)) {
    try {
      const raw = fs.readFileSync(vaultPath, 'utf8');
      if (!isVaultEncrypted(raw)) {
        const v = normalizeVault(JSON.parse(raw));
        fs.writeFileSync(vaultPath, encryptVault(JSON.stringify(v, null, 2), vaultKey), 'utf8');
      }
    } catch { /* migrate on next save */ }
  }
  return { ok: true };
});

ipcMain.handle('auth:verifyPassword', (_, password) => {
  const auth = loadAuth();
  if (!auth) return { ok: false, error: 'Master şifre ayarlanmamış' };
  if (!verifyPassword(password, auth)) return { ok: false, error: 'Yanlış şifre' };
  const derived = deriveVaultKey(password, auth.salt, getPbkdf2Iterations(auth));
  if (auth.totpSecret) {
    tempVaultKey = derived;
    return { ok: true, requires2fa: true };
  }
  vaultKey = derived;
  return { ok: true };
});

ipcMain.handle('auth:lock', () => {
  vaultKey = null;
  tempVaultKey = null;
  return true;
});

ipcMain.handle('auth:changeMasterPassword', (_, currentPw, newPw) => {
  const auth = loadAuth();
  if (!auth) return { ok: false, error: 'Master şifre ayarlanmamış' };
  if (!verifyPassword(currentPw, auth)) return { ok: false, error: 'Mevcut şifre yanlış' };
  if (!newPw || newPw.length < 6) return { ok: false, error: 'Yeni şifre en az 6 karakter olmalı' };
  const it = getPbkdf2Iterations(auth);
  const oldKey = deriveVaultKey(currentPw, auth.salt, it);
  let vaultData;
  if (fs.existsSync(vaultPath)) {
    const raw = fs.readFileSync(vaultPath, 'utf8');
    vaultData = isVaultEncrypted(raw)
      ? JSON.parse(decryptVault(raw, oldKey))
      : JSON.parse(raw);
  } else {
    vaultData = getEmptyVault();
  }
  const { salt, hash, pbkdf2Iterations } = hashPassword(newPw, it);
  saveAuth({ salt, hash, pbkdf2Iterations });
  vaultKey = deriveVaultKey(newPw, salt, pbkdf2Iterations);
  fs.writeFileSync(vaultPath, encryptVault(JSON.stringify(normalizeVault(vaultData), null, 2), vaultKey), 'utf8');
  return { ok: true };
});

ipcMain.handle('auth:isBioAvailable', () => {
  return process.platform === 'win32' && safeStorage.isEncryptionAvailable();
});

ipcMain.handle('auth:getBioStatus', () => {
  const auth = loadAuth();
  return !!(auth && auth.bioEnabled && auth.bioKey);
});

ipcMain.handle('auth:enableBio', async (_, password) => {
  const auth = loadAuth();
  if (!auth) return { ok: false, error: 'Master şifre ayarlanmamış' };
  if (!verifyPassword(password, auth)) return { ok: false, error: 'Yanlış şifre' };
  if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: 'Sistem güvenli depolama birimi kullanılamıyor' };

  const bioResult = await runWindowsHelloPrompt();
  if (!bioResult.ok) {
    if (bioResult.canceled) return { ok: false, canceled: true };
    return { ok: false, error: 'Biyometrik doğrulama başarısız: ' + bioResult.error };
  }

  try {
    const enc = safeStorage.encryptString(password);
    auth.bioEnabled = true;
    auth.bioKey = enc.toString('hex');
    saveAuth(auth);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('auth:disableBio', () => {
  const auth = loadAuth();
  if (auth) {
    auth.bioEnabled = false;
    delete auth.bioKey;
    saveAuth(auth);
  }
  return true;
});

ipcMain.handle('auth:unlockBiometric', async () => {
  const auth = loadAuth();
  if (!auth || !auth.bioEnabled || !auth.bioKey) {
    return { ok: false, error: 'Biyometrik giriş aktif değil' };
  }

  const bioResult = await runWindowsHelloPrompt();
  if (!bioResult.ok) {
    if (bioResult.canceled) return { ok: false, canceled: true };
    return { ok: false, error: 'Biyometrik doğrulama başarısız' };
  }

  try {
    const password = safeStorage.decryptString(Buffer.from(auth.bioKey, 'hex'));
    const derived = deriveVaultKey(password, auth.salt, getPbkdf2Iterations(auth));
    if (auth.totpSecret) {
      tempVaultKey = derived;
      return { ok: true, requires2fa: true };
    }
    vaultKey = derived;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Şifre çözme hatası: ' + e.message };
  }
});

ipcMain.handle('auth:get2faStatus', () => {
  const auth = loadAuth();
  return !!(auth && auth.totpSecret);
});

ipcMain.handle('auth:setup2fa', (_, password) => {
  const auth = loadAuth();
  if (!auth) return { ok: false, error: 'Master şifre ayarlanmamış' };
  if (!verifyPassword(password, auth)) return { ok: false, error: 'Yanlış şifre' };

  const secret = speakeasy.generateSecret({
    name: 'VAULT (' + (app.getPath('username') || 'Kullanıcı') + ')',
    length: 20
  });

  return { ok: true, secret: secret.base32 };
});

ipcMain.handle('auth:enable2fa', (_, password, secret, code) => {
  const auth = loadAuth();
  if (!auth) return { ok: false, error: 'Master şifre ayarlanmamış' };
  if (!verifyPassword(password, auth)) return { ok: false, error: 'Yanlış şifre' };

  const verified = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: String(code).trim(),
    window: 1
  });

  if (!verified) return { ok: false, error: 'Doğrulama kodu hatalı' };

  auth.totpSecret = secret;
  saveAuth(auth);
  return { ok: true };
});

ipcMain.handle('auth:disable2fa', (_, password) => {
  const auth = loadAuth();
  if (!auth) return { ok: false, error: 'Master şifre ayarlanmamış' };
  if (!verifyPassword(password, auth)) return { ok: false, error: 'Yanlış şifre' };

  delete auth.totpSecret;
  saveAuth(auth);
  return { ok: true };
});

ipcMain.handle('auth:verify2fa', (_, code) => {
  const auth = loadAuth();
  if (!auth || !auth.totpSecret) return { ok: false, error: 'İki adımlı doğrulama kurulmamış' };
  if (!tempVaultKey) return { ok: false, error: 'Geçersiz oturum. Önce şifrenizi girin.' };

  const verified = speakeasy.totp.verify({
    secret: auth.totpSecret,
    encoding: 'base32',
    token: String(code).trim(),
    window: 1
  });

  if (verified) {
    vaultKey = tempVaultKey;
    tempVaultKey = null;
    return { ok: true };
  } else {
    return { ok: false, error: 'Hatalı doğrulama kodu' };
  }
});


ipcMain.handle('encryption:getSettings', () => {
  const auth = loadAuth();
  if (!auth) return { iterations: CRYPTO.PBKDF2_ITERATIONS_DEFAULT };
  return { iterations: getPbkdf2Iterations(auth) };
});

ipcMain.handle('encryption:applySettings', async (_, password, newIterations) => {
  const auth = loadAuth();
  if (!auth) return { ok: false, error: 'Kasa kurulmamış' };
  if (!verifyPassword(password, auth)) return { ok: false, error: 'Yanlış şifre' };
  const it = parseInt(newIterations, 10);
  if (it < CRYPTO.PBKDF2_ITERATIONS_MIN || it > CRYPTO.PBKDF2_ITERATIONS_MAX) {
    return { ok: false, error: 'Geçersiz değer (10.000–1.000.000)' };
  }
  if (it === getPbkdf2Iterations(auth)) return { ok: true };
  try {
    const { salt, hash, pbkdf2Iterations } = hashPassword(password, it);
    saveAuth({ salt, hash, pbkdf2Iterations });
    vaultKey = deriveVaultKey(password, salt, pbkdf2Iterations);
    const vault = loadVault(vaultKey);
    saveVault(vault, vaultKey);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('open:passwordCheck', () => {
  createPasswordCheckWindow();
  return true;
});

ipcMain.handle('shell:openExternal', (_, url) => {
  if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle('app:getVersion', () => APP.VERSION);
ipcMain.handle('app:getDataPath', () => userDataPath);

ipcMain.handle('extension:installHost', (_, extensionId) => {
  if (!extensionId || typeof extensionId !== 'string') return Promise.resolve({ ok: false, error: 'Extension ID gerekli' });
  const extId = extensionId.trim();
  if (extId.length < 10) return Promise.resolve({ ok: false, error: 'Geçerli bir Extension ID girin' });
  const { exec } = require('child_process');
  const scriptPath = path.join(__dirname, '../scripts/install-native-host.js');
  const cwd = path.join(__dirname, '..');
  const cmd = `"${process.execPath}" "${scriptPath}" "${extId}"`;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ ok: false, error: 'Zaman aşımı (15 sn). Kurulumu Kontrol Et ile durumu kontrol edin.' });
    }, EXTENSION.INSTALL_TIMEOUT_MS);
    exec(cmd, { cwd, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      clearTimeout(timeout);
      if (err) resolve({ ok: false, error: (stderr || err.message || 'Kurulum başarısız').toString().slice(0, 200) });
      else resolve({ ok: true });
    });
  });
});

ipcMain.handle('extension:verifyInstall', () => {
  const nativeHostDir = path.join(__dirname, '../extension/native-host');
  const manifestPath = path.join(nativeHostDir, 'com.vault.passwordmanager.json');
  const batPath = path.join(nativeHostDir, 'vault-host.bat');
  const jsPath = path.join(nativeHostDir, 'vault-host.js');
  const checks = [];
  if (!fs.existsSync(manifestPath)) checks.push('Manifest dosyası bulunamadı');
  else {
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (!m.path) checks.push('Manifest: path eksik');
      if (!Array.isArray(m.allowed_origins) || !m.allowed_origins.length) checks.push('Manifest: allowed_origins eksik');
    } catch { checks.push('Manifest geçersiz JSON'); }
  }
  if (process.platform === 'win32') {
    if (!fs.existsSync(batPath)) checks.push('vault-host.bat bulunamadı');
    if (!fs.existsSync(jsPath)) checks.push('vault-host.js bulunamadı');
    try {
      const { execSync } = require('child_process');
      execSync('reg query "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.vault.passwordmanager" /ve', { stdio: 'pipe', timeout: 3000 });
    } catch { checks.push('Registry kaydı yok — Native Host Kur çalıştırın'); }
  } else {
    if (!fs.existsSync(path.join(nativeHostDir, 'vault-host.sh'))) checks.push('vault-host.sh bulunamadı');
  }
  return { ok: checks.length === 0, checks, message: checks.length === 0 ? 'Kurulum tamam.' : checks.join(' • ') };
});

ipcMain.handle('extension:getExtensionPath', () => path.join(__dirname, '../extension'));
ipcMain.handle('extension:openExtensionFolder', () => {
  const extPath = path.join(__dirname, '../extension');
  if (fs.existsSync(extPath)) shell.showItemInFolder(path.join(extPath, 'manifest.json'));
  return true;
});

ipcMain.handle('reminders:check', () => {
  if (!vaultKey) return;
  try {
    const vault = loadVault(vaultKey);
    const payments = vault.payments || [];
    const cards = (vault.cards || []).reduce((acc, c) => { acc[c.id] = c; return acc; }, {});
    const today = new Date();
    const day = today.getDate();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDate();
    const todayStr = today.toISOString().slice(0, 10);
    const sent = loadRemindersSent();
    for (const p of payments) {
      const dueDay = parseInt(p.dueDay, 10) || 15;
      const card = cards[p.cardId];
      const cardName = card ? `${card.name || 'Kart'} •••• ${card.numberLast4 || '****'}` : 'Kart';
      const amount = (p.amount != null ? p.amount : 0).toFixed(2);
      const curr = p.currency || 'TRY';
      const title = `${p.name || 'Ödeme'} — ${amount} ${curr}`;
      if (dueDay === day && sent[p.id] !== todayStr && Notification.isSupported()) {
        new Notification({ title: 'VAULT — Ödeme Vadesi Bugün', body: `${title}\n${cardName}` }).show();
        saveReminderSent(p.id, todayStr);
      } else if (dueDay === tomorrowDay && sent[p.id] !== todayStr && Notification.isSupported()) {
        new Notification({ title: 'VAULT — Ödeme Vadesi Yarın', body: `${title}\n${cardName}` }).show();
        saveReminderSent(p.id, todayStr);
      }
    }
  } catch { /* vault locked or error */ }
});

ipcMain.handle('window:minimize', (e) => require('electron').BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.handle('window:maximize', (e) => {
  const w = require('electron').BrowserWindow.fromWebContents(e.sender);
  if (w?.isMaximized()) w.unmaximize();
  else w?.maximize();
});
ipcMain.handle('window:close', (e) => require('electron').BrowserWindow.fromWebContents(e.sender)?.close());

ipcMain.handle('vault:getTotpCode', (_, entryId) => {
  try {
    const vault = loadVault(vaultKey);
    const entry = vault.entries.find((e) => e.id === entryId);
    if (!entry?.totpSecret) return null;
    const secret = String(entry.totpSecret).replace(/\s/g, '').toUpperCase();
    if (!secret) return null;
    const code = speakeasy.totp({ secret, encoding: 'base32' });
    const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
    return { code, remaining };
  } catch { return null; }
});

ipcMain.handle('vault:getEntries', () => loadVault(vaultKey).entries);
ipcMain.handle('vault:getEntry', (_, id) => loadVault(vaultKey).entries.find((e) => e.id === id) || null);

ipcMain.handle('vault:saveEntry', (_, entry) => {
  const vault = loadVault(vaultKey);
  const idx = vault.entries.findIndex((e) => e.id === entry.id);
  const now = new Date().toISOString().slice(0, 10);
  const updated = { ...entry, updatedAt: now };
  if (idx >= 0) vault.entries[idx] = updated;
  else { updated.id = String(vault.nextId++); updated.createdAt = now; vault.entries.push(updated); }
  saveVault(vault, vaultKey);
  return updated;
});

ipcMain.handle('vault:deleteEntry', (_, id) => {
  const vault = loadVault(vaultKey);
  vault.entries = vault.entries.filter((e) => e.id !== id);
  saveVault(vault, vaultKey);
  return true;
});

ipcMain.handle('encryption:checkPasswordBreach', async (_, password) => checkPasswordBreach(password));

ipcMain.handle('encryption:scanEntriesBreaches', async () => {
  if (!vaultKey) return { ok: false, error: 'Kasa kilitli' };
  try {
    const vault = loadVault(vaultKey);
    const items = vault.entries
      .filter((e) => e.password)
      .map((e) => ({ id: e.id, name: e.name || 'Kayıt', password: e.password }));
    const breaches = await scanPasswords(items);
    return { ok: true, breaches, scanned: items.length };
  } catch (e) {
    return { ok: false, error: e.message || 'Tarama hatası' };
  }
});

ipcMain.handle('encryption:benchmarkPbdkf2', (_, iterationsList) => {
  const cryptoMod = require('crypto');
  const list = Array.isArray(iterationsList) && iterationsList.length
    ? iterationsList.map((n) => parseInt(n, 10)).filter((n) => n >= CRYPTO.PBKDF2_ITERATIONS_MIN && n <= CRYPTO.PBKDF2_ITERATIONS_MAX)
    : [50_000, 100_000, 200_000, 500_000];
  const password = 'vault-benchmark';
  const salt = cryptoMod.randomBytes(CRYPTO.SALT_LENGTH).toString('hex');
  const results = list.map((it) => {
    const start = process.hrtime.bigint();
    cryptoMod.pbkdf2Sync(password, salt, it, CRYPTO.KEY_LENGTH, CRYPTO.HASH_ALGORITHM);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    return { iterations: it, ms: Math.round(ms * 100) / 100 };
  });
  return { ok: true, results };
});

ipcMain.handle('vault:addLog', (_, action, details = '') => {
  if (!vaultKey) return false;
  try {
    const vault = loadVault(vaultKey);
    if (!vault.logs) vault.logs = [];
    const newLog = {
      action,
      details,
      timestamp: new Date().toISOString()
    };
    vault.logs.push(newLog);
    if (vault.logs.length > 100) {
      vault.logs.shift();
    }
    saveVault(vault, vaultKey);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('vault:getLogs', () => {
  if (!vaultKey) return [];
  try {
    const vault = loadVault(vaultKey);
    return vault.logs || [];
  } catch {
    return [];
  }
});

ipcMain.handle('vault:clearLogs', () => {
  if (!vaultKey) return false;
  try {
    const vault = loadVault(vaultKey);
    vault.logs = [];
    saveVault(vault, vaultKey);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('vault:getAttachments', () => {
  if (!vaultKey) return [];
  try {
    const vault = loadVault(vaultKey);
    return vault.attachments || [];
  } catch {
    return [];
  }
});

ipcMain.handle('vault:saveAttachment', async () => {
  if (!vaultKey) return { ok: false, error: 'Kasa kilitli' };
  const w = BrowserWindow.getFocusedWindow() || mainWindow;
  const { filePaths, canceled } = await dialog.showOpenDialog(w, {
    properties: ['openFile'],
    title: 'Dosya Ekle'
  });
  if (canceled || !filePaths?.length) return { ok: false, canceled: true };
  const sourcePath = filePaths[0];
  try {
    const crypto = require('crypto');
    const fileName = path.basename(sourcePath);
    const stats = fs.statSync(sourcePath);
    const fileSize = stats.size;
    
    if (fileSize > 15 * 1024 * 1024) {
      return { ok: false, error: 'Dosya boyutu 15MB\'dan büyük olamaz' };
    }
    
    const fileBuf = fs.readFileSync(sourcePath);
    
    const iv = crypto.randomBytes(CRYPTO.GCM_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', vaultKey, iv);
    const encrypted = Buffer.concat([cipher.update(fileBuf), cipher.final()]);
    const tag = cipher.getAuthTag();
    const finalData = Buffer.concat([iv, tag, encrypted]);
    
    const fileId = crypto.randomBytes(16).toString('hex');
    const destPath = path.join(attachmentsPath, fileId);
    fs.writeFileSync(destPath, finalData);
    
    const vault = loadVault(vaultKey);
    if (!vault.attachments) vault.attachments = [];
    
    const attachment = {
      id: fileId,
      name: fileName,
      size: fileSize,
      createdAt: new Date().toISOString()
    };
    
    vault.attachments.push(attachment);
    saveVault(vault, vaultKey);
    
    if (!vault.logs) vault.logs = [];
    vault.logs.push({
      action: 'Dosya eklendi',
      details: `${fileName} (${(fileSize/1024).toFixed(1)} KB)`,
      timestamp: new Date().toISOString()
    });
    saveVault(vault, vaultKey);
    
    return { ok: true, attachment };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('vault:downloadAttachment', async (_, fileId) => {
  if (!vaultKey) return { ok: false, error: 'Kasa kilitli' };
  try {
    const crypto = require('crypto');
    const vault = loadVault(vaultKey);
    const attachment = vault.attachments?.find(a => a.id === fileId);
    if (!attachment) return { ok: false, error: 'Dosya bulunamadı' };
    
    const filePath = path.join(attachmentsPath, fileId);
    if (!fs.existsSync(filePath)) return { ok: false, error: 'Dosya fiziksel olarak diskte bulunamadı' };
    
    const w = BrowserWindow.getFocusedWindow() || mainWindow;
    const { filePath: savePath, canceled } = await dialog.showSaveDialog(w, {
      defaultPath: attachment.name,
      title: 'Dosyayı Kaydet'
    });
    if (canceled || !savePath) return { ok: false, canceled: true };
    
    const rawData = fs.readFileSync(filePath);
    
    const iv = rawData.subarray(0, CRYPTO.GCM_IV_LENGTH);
    const tag = rawData.subarray(CRYPTO.GCM_IV_LENGTH, CRYPTO.GCM_IV_LENGTH + CRYPTO.GCM_TAG_LENGTH);
    const enc = rawData.subarray(CRYPTO.GCM_IV_LENGTH + CRYPTO.GCM_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
    
    fs.writeFileSync(savePath, decrypted);
    
    if (!vault.logs) vault.logs = [];
    vault.logs.push({
      action: 'Dosya indirildi',
      details: attachment.name,
      timestamp: new Date().toISOString()
    });
    saveVault(vault, vaultKey);
    
    return { ok: true, path: savePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('vault:deleteAttachment', async (_, fileId) => {
  if (!vaultKey) return { ok: false, error: 'Kasa kilitli' };
  try {
    const vault = loadVault(vaultKey);
    const attachmentIdx = vault.attachments?.findIndex(a => a.id === fileId);
    if (attachmentIdx === -1 || attachmentIdx == null) return { ok: false, error: 'Dosya bulunamadı' };
    
    const attachment = vault.attachments[attachmentIdx];
    const filePath = path.join(attachmentsPath, fileId);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    vault.attachments.splice(attachmentIdx, 1);
    
    if (!vault.logs) vault.logs = [];
    vault.logs.push({
      action: 'Dosya silindi',
      details: attachment.name,
      timestamp: new Date().toISOString()
    });
    saveVault(vault, vaultKey);
    
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('vault:getCards', () => loadVault(vaultKey).cards || []);
ipcMain.handle('vault:saveCard', (_, card) => {
  const vault = loadVault(vaultKey);
  if (!vault.cards) vault.cards = [];
  const num = String(card.number || '').replace(/\D/g, '');
  const numberLast4 = num.length >= 4 ? num.slice(-4) : (card.numberLast4 || '****');
  const idx = vault.cards.findIndex((c) => c.id === card.id);
  const now = new Date().toISOString().slice(0, 10);
  const updated = { ...card, number: num || card.number, numberLast4, updatedAt: now, icon: card.icon || '💳' };
  if (idx >= 0) vault.cards[idx] = updated;
  else { updated.id = 'c' + (vault.nextCardId || 1); vault.nextCardId = (vault.nextCardId || 1) + 1; updated.createdAt = now; vault.cards.push(updated); }
  saveVault(vault, vaultKey);
  return updated;
});
ipcMain.handle('vault:deleteCard', (_, id) => {
  const vault = loadVault(vaultKey);
  if (vault.cards) vault.cards = vault.cards.filter((c) => c.id !== id);
  saveVault(vault, vaultKey);
  return true;
});

ipcMain.handle('vault:getNotes', () => loadVault(vaultKey).notes || []);
ipcMain.handle('vault:saveNote', (_, note) => {
  const vault = loadVault(vaultKey);
  if (!vault.notes) vault.notes = [];
  const idx = vault.notes.findIndex((n) => n.id === note.id);
  const now = new Date().toISOString().slice(0, 10);
  const updated = { ...note, icon: note.icon || '📝', updatedAt: now };
  if (idx >= 0) vault.notes[idx] = updated;
  else { updated.id = 'n' + (vault.nextNoteId || 1); vault.nextNoteId = (vault.nextNoteId || 1) + 1; updated.createdAt = now; vault.notes.push(updated); }
  saveVault(vault, vaultKey);
  return updated;
});
ipcMain.handle('vault:deleteNote', (_, id) => {
  const vault = loadVault(vaultKey);
  if (vault.notes) vault.notes = vault.notes.filter((n) => n.id !== id);
  saveVault(vault, vaultKey);
  return true;
});

ipcMain.handle('vault:getPayments', () => loadVault(vaultKey).payments || []);
ipcMain.handle('vault:savePayment', (_, payment) => {
  const vault = loadVault(vaultKey);
  if (!vault.payments) vault.payments = [];
  const idx = vault.payments.findIndex((p) => p.id === payment.id);
  const now = new Date().toISOString().slice(0, 10);
  const updated = { ...payment, recurring: payment.recurring || 'monthly', updatedAt: now };
  if (idx >= 0) vault.payments[idx] = updated;
  else { updated.id = 'p' + (vault.nextPaymentId || 1); vault.nextPaymentId = (vault.nextPaymentId || 1) + 1; updated.createdAt = now; vault.payments.push(updated); }
  saveVault(vault, vaultKey);
  return updated;
});
ipcMain.handle('vault:deletePayment', (_, id) => {
  const vault = loadVault(vaultKey);
  if (vault.payments) vault.payments = vault.payments.filter((p) => p.id !== id);
  saveVault(vault, vaultKey);
  return true;
});

ipcMain.handle('vault:createBackup', async () => {
  const w = BrowserWindow.getFocusedWindow() || mainWindow;
  const defaultName = `vault-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  const { filePath, canceled } = await dialog.showSaveDialog(w, {
    defaultPath: defaultName,
    filters: [{ name: 'Vault Yedek', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    if (fs.existsSync(vaultPath)) fs.copyFileSync(vaultPath, filePath);
    else {
      const empty = getEmptyVault();
      const data = vaultKey ? encryptVault(JSON.stringify(normalizeVault(empty), null, 2), vaultKey) : JSON.stringify(empty, null, 2);
      fs.writeFileSync(filePath, data, 'utf8');
    }
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('vault:exportToFile', async (_, format) => {
  const w = BrowserWindow.getFocusedWindow() || mainWindow;
  const vault = loadVault(vaultKey);
  const defaultName = `vault-export-${new Date().toISOString().slice(0, 10)}.${format === 'csv' ? 'csv' : 'json'}`;
  const { filePath, canceled } = await dialog.showSaveDialog(w, {
    defaultPath: defaultName,
    filters: format === 'csv' ? [{ name: 'CSV', extensions: ['csv'] }] : [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    if (format === 'csv') {
      const header = 'name,url,username,password,notes,category,tags\n';
      const rows = vault.entries.map((e) =>
        `"${(e.name || '').replace(/"/g, '""')}","${(e.url || '').replace(/"/g, '""')}","${(e.username || '').replace(/"/g, '""')}","${(e.password || '').replace(/"/g, '""')}","${(e.notes || '').replace(/"/g, '""')}","${(e.category || '').replace(/"/g, '""')}","${(e.tags || []).join(',').replace(/"/g, '""')}"`
      ).join('\n');
      fs.writeFileSync(filePath, '\uFEFF' + header + rows, 'utf8');
    } else {
      fs.writeFileSync(filePath, JSON.stringify(vault, null, 2), 'utf8');
    }
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

function parseCsv(text) {
  const lines = [];
  let currentLine = [];
  let currentField = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentLine.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentLine.push(currentField);
      lines.push(currentLine);
      currentLine = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentLine.length > 0 || currentField !== '') {
    currentLine.push(currentField);
    lines.push(currentLine);
  }
  return lines;
}

ipcMain.handle('vault:importFromFile', async () => {
  const w = BrowserWindow.getFocusedWindow() || mainWindow;
  const { filePaths, canceled } = await dialog.showOpenDialog(w, {
    properties: ['openFile'],
    filters: [{ name: 'JSON veya CSV', extensions: ['json', 'csv'] }],
  });
  if (canceled || !filePaths?.length) return { ok: false, canceled: true };
  const filePath = filePaths[0];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const vault = loadVault(vaultKey);
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.json') {
      const data = JSON.parse(raw);
      const merge = (dst, src, nextKey) => {
        if (!Array.isArray(src)) return;
        if (vault[nextKey] == null || isNaN(vault[nextKey])) {
          const maxNum = Math.max(0, ...dst.map((x) => parseInt(String(x.id).replace(/\D/g, ''), 10) || 0));
          vault[nextKey] = maxNum + 1;
        }
        const prefix = nextKey === 'nextId' ? '' : nextKey === 'nextCardId' ? 'c' : nextKey === 'nextNoteId' ? 'n' : 'p';
        src.forEach((item) => {
          const idx = dst.findIndex((x) => x.id === item.id);
          const merged = { ...item };
          if (idx >= 0) dst[idx] = merged;
          else { merged.id = prefix + (vault[nextKey]++); dst.push(merged); }
        });
      };
      if (data.entries?.length) merge(vault.entries, data.entries, 'nextId');
      if (data.cards?.length) merge(vault.cards, data.cards, 'nextCardId');
      if (data.notes?.length) merge(vault.notes, data.notes, 'nextNoteId');
      if (data.payments?.length) merge(vault.payments, data.payments, 'nextPaymentId');
    } else if (ext === '.csv') {
      const rows = parseCsv(raw.replace(/^\uFEFF/, ''));
      const imported = importCsvRows(rows, vault.entries);
      if (!imported.ok) return imported;
      const maxId = Math.max(0, ...vault.entries.map((e) => parseInt(String(e.id).replace(/\D/g, ''), 10) || 0));
      let nextId = maxId + 1;
      imported.entries.forEach((entry) => {
        vault.entries.push({ ...entry, id: String(nextId++) });
      });
      vault.nextId = nextId;
      if (!vault.logs) vault.logs = [];
      vault.logs.push({
        action: 'Veri içe aktarıldı',
        details: `${imported.formatLabel}: ${imported.entries.length} kayıt (${imported.skipped} atlandı)`,
        timestamp: new Date().toISOString(),
      });
      if (vault.logs.length > 100) vault.logs.shift();
      saveVault(vault, vaultKey);
      return {
        ok: true,
        count: imported.entries.length,
        format: imported.format,
        formatLabel: imported.formatLabel,
        skipped: imported.skipped,
      };
    }
    saveVault(vault, vaultKey);
    return { ok: true, count: vault.entries.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
