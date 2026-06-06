#!/usr/bin/env node
/**
 * VAULT Native Messaging Host kurulumu (Windows)
 * Kullanım: node scripts/install-native-host.js [extension-id]
 * Extension ID: chrome://extensions adresinde "ID" olarak görünür
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const extensionId = process.argv[2] || 'YOUR_EXTENSION_ID';
const projectRoot = path.join(__dirname, '..');
const nativeHostDir = path.join(projectRoot, 'extension', 'native-host');
const manifestPath = path.join(nativeHostDir, 'com.vault.passwordmanager.json');
const hostPath = process.platform === 'win32'
  ? path.join(nativeHostDir, 'vault-host.bat')
  : path.join(nativeHostDir, 'vault-host.sh');

const absHostPath = path.resolve(hostPath);
const manifest = {
  name: 'com.vault.passwordmanager',
  description: 'VAULT Şifre Yöneticisi Native Messaging Host',
  path: process.platform === 'win32' ? absHostPath.replace(/\//g, '\\') : absHostPath,
  type: 'stdio',
  allowed_origins: [`chrome-extension://${extensionId}/`]
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log('Native host manifest güncellendi.');

if (process.platform === 'win32') {
  const registryKey = 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.vault.passwordmanager';
  const manifestPathWin = manifestPath.replace(/\//g, '\\');
  try {
    execSync(`reg add "${registryKey}" /ve /d "${manifestPathWin}" /f`, { stdio: 'inherit' });
    console.log('Registry kaydı tamamlandı.');
    console.log('\nKurulum bitti. Chrome eklentisini yeniden yükleyin.');
  } catch (e) {
    console.error('Registry yazma hatası. Yönetici olarak çalıştırmayı deneyin.');
  }
} else if (process.platform === 'darwin') {
  const destDir = path.join(process.env.HOME, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts');
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(manifestPath, path.join(destDir, 'com.vault.passwordmanager.json'));
  try { fs.chmodSync(path.join(nativeHostDir, 'vault-host.sh'), 0o755); } catch {}
  console.log('macOS: Manifest kopyalandı.');
} else {
  const destDir = path.join(process.env.HOME, '.config', 'google-chrome', 'NativeMessagingHosts');
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(manifestPath, path.join(destDir, 'com.vault.passwordmanager.json'));
  try { fs.chmodSync(path.join(nativeHostDir, 'vault-host.sh'), 0o755); } catch {}
  console.log('Linux: Manifest kopyalandı.');
}
