/**
 * Boş şablon Word belgesi üretir.
 * Dolu rapor için: node scripts/fill-final-report.js --capture
 */
const path = require('path');
const { buildReportHtml, writeReportFile } = require('./lib/report-shared');

const out = path.join(__dirname, '../docs/FINAL-Password-Manager-Rapor.doc');
const html = buildReportHtml({ filled: false });
const written = writeReportFile(out, html);
console.log('Şablon oluşturuldu:', written);
