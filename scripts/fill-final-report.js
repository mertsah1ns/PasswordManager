/**
 * Final raporu otomatik doldurur: ekran görüntüleri + kaynak kodları + PBKDF2 tablosu.
 *
 * Kullanım:
 *   node scripts/fill-final-report.js              # mevcut görseller + kodlar
 *   node scripts/fill-final-report.js --capture    # önce ekran görüntüsü al, sonra doldur
 *   node scripts/fill-final-report.js --no-benchmark
 *   node scripts/fill-final-report.js --template   # boş şablon (generate-final-doc ile aynı)
 *   node scripts/fill-final-report.js --compact-40   # ~40 sayfa: kod özetleri + görseller
 *   node scripts/fill-final-report.js --code-lines=50  # her dosyadan max 50 satır
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  ROOT,
  SCREENSHOTS_DIR,
  SCREENSHOTS,
  CODE_FILES,
  CODE_FILES_COMPACT_40,
  COMPACT_40_NOTE,
  readCodeFiles,
  readScreenshotDataUri,
  runPbkdf2Benchmark,
  buildReportHtml,
  writeReportFile,
} = require('./lib/report-shared');

const args = process.argv.slice(2);
const doCapture = args.includes('--capture');
const noBenchmark = args.includes('--no-benchmark');
const templateOnly = args.includes('--template');
const compact40 = args.includes('--compact-40');
const codeLinesArg = args.find((a) => a.startsWith('--code-lines='));
const globalCodeLines = codeLinesArg ? parseInt(codeLinesArg.split('=')[1], 10) : null;
const outArg = args.find((a) => a.startsWith('--output='));
const defaultOut = compact40
  ? path.join(ROOT, 'docs/FINAL-Password-Manager-Rapor-40sayfa.doc')
  : path.join(ROOT, 'docs/FINAL-Password-Manager-Rapor-DOLU.doc');
const outPath = outArg ? path.resolve(outArg.split('=')[1]) : defaultOut;

function resolveCodeFileList() {
  if (compact40) return CODE_FILES_COMPACT_40;
  if (globalCodeLines) {
    return CODE_FILES.map((f) => ({ ...f, maxLines: globalCodeLines }));
  }
  return CODE_FILES;
}

function runScreenshotCapture() {
  const electronBin = path.join(ROOT, 'node_modules/electron/cli.js');
  if (!fs.existsSync(electronBin)) {
    console.error('Electron bulunamadı. Önce: npm install');
    process.exit(1);
  }
  console.log('Electron ile ekran görüntüleri alınıyor...');
  const result = spawnSync(process.execPath, [electronBin, path.join(ROOT, 'scripts/run-report-capture.js')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, VAULT_REPORT_CAPTURE: '1' },
  });
  if (result.status !== 0) {
    console.error('Ekran görüntüsü alma başarısız (kod:', result.status, ')');
    process.exit(result.status || 1);
  }
}

function loadImages() {
  const images = {};
  let found = 0;
  for (const shot of SCREENSHOTS) {
    const uri = readScreenshotDataUri(shot.file);
    if (uri) {
      images[shot.file] = uri;
      found++;
    } else {
      console.warn('  ⚠ Görsel yok:', path.join('docs/screenshots', shot.file));
    }
  }
  return { images, found };
}

function main() {
  if (doCapture) {
    runScreenshotCapture();
  }

  if (templateOnly) {
    const html = buildReportHtml({ filled: false });
    const written = writeReportFile(path.join(ROOT, 'docs/FINAL-Password-Manager-Rapor.doc'), html);
    console.log('Şablon oluşturuldu:', written);
    return;
  }

  const codeFileList = resolveCodeFileList();
  console.log('Kaynak kodları okunuyor...', compact40 ? '(40 sayfa modu)' : '');
  const codes = readCodeFiles(codeFileList);
  const codeCount = Object.keys(codes).length;
  console.log(`  ${codeCount} dosya yüklendi`);

  const { images, found } = loadImages();
  if (found === 0 && !doCapture) {
    console.warn('Hiç görsel bulunamadı. --capture ile alın veya docs/screenshots/ klasörüne PNG koyun.');
  } else {
    console.log(`  ${found}/${SCREENSHOTS.length} görsel yüklendi`);
  }

  let pbkdf2Results = null;
  if (!noBenchmark) {
    console.log('PBKDF2 benchmark çalıştırılıyor...');
    pbkdf2Results = runPbkdf2Benchmark();
    pbkdf2Results.forEach((r) => {
      console.log(`  ${r.iterations.toLocaleString('tr-TR')} → ${r.ms} ms`);
    });
  }

  const html = buildReportHtml({
    codes,
    images,
    pbkdf2Results,
    filled: true,
    compact40,
    codeFileList,
    codeSectionNote: compact40 ? COMPACT_40_NOTE : '',
  });
  const written = writeReportFile(outPath, html);
  const sizeMb = (fs.statSync(written).size / (1024 * 1024)).toFixed(2);
  console.log('Rapor oluşturuldu:', written, `(${sizeMb} MB)`);
  if (compact40) {
    console.log('40 sayfa hedefi için Word\'de Görünüm → Yazdırma Düzeni ile sayfa sayısını kontrol edin.');
  }
  console.log('Word\'de açıp Farklı Kaydet → .docx ile kaydedin.');
}

main();
