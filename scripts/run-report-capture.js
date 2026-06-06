/**
 * Electron giriş noktası — uygulamayı açıp ekran görüntülerini alır.
 * Kullanım: electron scripts/run-report-capture.js
 */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

process.env.VAULT_REPORT_CAPTURE = '1';

const captureDataDir = path.join(__dirname, '../docs/.report-capture-data');
fs.rmSync(captureDataDir, { recursive: true, force: true });
fs.mkdirSync(captureDataDir, { recursive: true });
app.setPath('userData', captureDataDir);

require(path.join(__dirname, '../src/main.js'));
