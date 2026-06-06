const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const SCREENSHOTS_DIR = path.join(ROOT, 'docs/screenshots');

const SCREENSHOTS = [
  { id: '01-lock-setup', title: 'Kilit kurulum ekranı', desc: 'İlk çalıştırmada master şifre oluşturma.', file: '01-lock-setup.png' },
  { id: '02-lock-unlock', title: 'Kilit giriş ekranı', desc: 'Kasa kilidi açılırken master şifre girişi.', file: '02-lock-unlock.png' },
  { id: '03-main-home', title: 'Ana ekran', desc: 'Parola listesi, arama ve kategori filtreleri.', file: '03-main-home.png' },
  { id: '04-entry-detail', title: 'Parola detayı', desc: 'Kayıt görüntüleme, düzenleme ve kopyalama.', file: '04-entry-detail.png' },
  { id: '05-security-report', title: 'Güvenlik raporu', desc: '0–100 güvenlik skoru ve zayıf/tekrar parola analizi.', file: '05-security-report.png' },
  { id: '06-password-generator', title: 'Şifre üretici', desc: 'Uzunluk, karakter seti ve güç göstergesi.', file: '06-password-generator.png' },
  { id: '07-settings', title: 'Ayarlar', desc: 'Otomatik kilitleme, PBKDF2 testi, CSV import/export.', file: '07-settings.png' },
  { id: '08-audit-log', title: 'Audit log', desc: 'Son güvenlik olayları listesi.', file: '08-audit-log.png' },
];

const CODE_FILES = [
  { path: 'package.json', purpose: 'Bağımlılıklar ve npm script tanımları.' },
  { path: 'src/constants.js', purpose: 'Uygulama sabitleri ve yapılandırma değerleri.' },
  { path: 'src/main.js', purpose: 'Ana süreç, IPC kanalları, vault, HIBP, import/export.' },
  { path: 'src/preload.js', purpose: 'contextBridge ile güvenli renderer API.' },
  { path: 'src/lib/auth.js', purpose: 'Master şifre doğrulama ve oturum yönetimi.' },
  { path: 'src/lib/crypto.js', purpose: 'PBKDF2, AES-256-GCM şifreleme/çözme.' },
  { path: 'src/lib/vault.js', purpose: 'Şifreli kasa okuma/yazma ve kayıt işlemleri.' },
  { path: 'src/lib/defaults.js', purpose: 'Varsayılan kasa yapısı ve başlangıç verileri.' },
  { path: 'src/lib/utils.js', purpose: 'Ortak yardımcı fonksiyonlar.' },
  { path: 'src/lib/hibp.js', purpose: 'Have I Been Pwned k-anonymity sızıntı kontrolü.' },
  { path: 'src/lib/importCsv.js', purpose: 'VAULT, Bitwarden, Chrome, Firefox CSV içe aktarma.' },
  { path: 'src/renderer/index.html', purpose: 'Ana arayüz HTML yapısı ve bileşenler.' },
  { path: 'src/renderer/styles.css', purpose: 'Arayüz stilleri, tema ve düzen.' },
  { path: 'src/renderer/utils.js', purpose: 'Renderer tarafı yardımcı fonksiyonlar.' },
  { path: 'src/renderer/renderer.js', purpose: 'UI mantığı, IPC çağrıları, güvenlik raporu.' },
  { path: 'src/renderer/password-check.html', purpose: 'Şifre üretici penceresi HTML.' },
  { path: 'src/renderer/password-check.js', purpose: 'Şifre üretici ve güç hesaplama mantığı.' },
];

/** ~40 sayfa hedefi: büyük dosyalar özet, CSS hariç, temel kaynak dosyaları */
const CODE_FILES_COMPACT_40 = [
  { path: 'package.json', purpose: 'Bağımlılıklar ve npm script tanımları.', maxLines: null },
  { path: 'src/constants.js', purpose: 'Uygulama sabitleri.', maxLines: null },
  { path: 'src/main.js', purpose: 'Ana süreç, IPC, vault, HIBP (özet).', maxLines: 48 },
  { path: 'src/preload.js', purpose: 'contextBridge güvenli API.', maxLines: null },
  { path: 'src/lib/crypto.js', purpose: 'PBKDF2 ve AES-256-GCM.', maxLines: null },
  { path: 'src/lib/vault.js', purpose: 'Şifreli kasa işlemleri.', maxLines: null },
  { path: 'src/lib/hibp.js', purpose: 'HIBP k-anonymity kontrolü.', maxLines: null },
  { path: 'src/lib/importCsv.js', purpose: 'CSV içe aktarma.', maxLines: null },
  { path: 'src/renderer/index.html', purpose: 'Ana arayüz HTML (özet).', maxLines: 42 },
  { path: 'src/renderer/renderer.js', purpose: 'UI mantığı ve güvenlik raporu (özet).', maxLines: 48 },
  { path: 'src/renderer/password-check.js', purpose: 'Şifre üretici mantığı.', maxLines: null },
];

const COMPACT_40_NOTE = 'Bu bölümde her dosyanın özet kodu yer alır. Tam kaynak kod proje klasöründe ve teslim edilen arşivde bulunur.';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncateCode(code, maxLines, filePath) {
  const lines = code.split('\n');
  if (!maxLines || lines.length <= maxLines) return code;
  const head = lines.slice(0, maxLines).join('\n');
  const omitted = lines.length - maxLines;
  return `${head}\n\n/* ... ${omitted} satır atlandı — tam dosya: ${filePath} */`;
}

function readCodeFiles(fileList = CODE_FILES) {
  const codes = {};
  for (const item of fileList) {
    const full = path.join(ROOT, item.path);
    const raw = fs.existsSync(full)
      ? fs.readFileSync(full, 'utf8')
      : `[Dosya bulunamadı: ${item.path}]`;
    codes[item.path] = truncateCode(raw, item.maxLines ?? null, item.path);
  }
  return codes;
}

function readScreenshotDataUri(filename) {
  const full = path.join(SCREENSHOTS_DIR, filename);
  if (!fs.existsSync(full)) return null;
  const buf = fs.readFileSync(full);
  const ext = path.extname(filename).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function runPbkdf2Benchmark() {
  const crypto = require('crypto');
  const { CRYPTO } = require(path.join(ROOT, 'src/constants'));
  const iterations = [50_000, 100_000, 200_000, 500_000];
  const password = 'benchmark-test-password';
  const salt = crypto.randomBytes(CRYPTO.SALT_LENGTH).toString('hex');
  const results = [];

  for (const it of iterations) {
    const start = process.hrtime.bigint();
    crypto.pbkdf2Sync(password, salt, it, CRYPTO.KEY_LENGTH, CRYPTO.HASH_ALGORITHM);
    const ms = Math.round(Number(process.hrtime.bigint() - start) / 1e6 * 100) / 100;
    results.push({ iterations: it, ms });
  }
  return results;
}

function pbkdf2TableRows(results) {
  if (!results?.length) {
    return `<tr><td>50.000</td><td>________</td><td>____</td></tr>
<tr><td>100.000</td><td>________</td><td>____</td></tr>
<tr><td>200.000</td><td>________</td><td>____</td></tr>
<tr><td>500.000</td><td>________</td><td>____</td></tr>`;
  }
  return results.map((r) => {
    const label = r.iterations.toLocaleString('tr-TR');
    return `<tr><td>${label}</td><td>${r.ms}</td><td>Otomatik ölçüm</td></tr>`;
  }).join('\n');
}

function shotBlock(n, meta, imageDataUri, onePerPage = false) {
  const area = imageDataUri
    ? `<img class="shot-img" src="${imageDataUri}" alt="${escapeHtml(meta.title)}" />`
    : `<div class="shot-missing">[ Görsel bulunamadı: docs/screenshots/${meta.file} ]</div>`;
  const breakBefore = onePerPage && n > 1 ? '<div class="pagebreak"></div>' : '';
  return `${breakBefore}
<div class="shot">
  <div class="shot-header">
    <span class="shot-num">${n}</span>
    <span class="shot-title">${escapeHtml(meta.title)}</span>
  </div>
  <p class="shot-desc">${escapeHtml(meta.desc)}</p>
  <div class="shot-area">${area}</div>
</div>`;
}

function codeBlock(n, item, code, compact = false) {
  const truncated = code.includes('satır atlandı');
  const tag = truncated ? ' <span class="code-truncated">(özet)</span>' : '';
  return `
<div class="code-block${compact ? ' code-block-compact' : ''}">
  <h3>12.${n} ${escapeHtml(item.path)}${tag}</h3>
  <p class="code-purpose"><b>Amaç:</b> ${escapeHtml(item.purpose)}</p>
  <div class="code-label">Dosya: ${escapeHtml(item.path)}</div>
  <pre class="code-slot${compact ? ' code-slot-compact' : ''}">${escapeHtml(code)}</pre>
</div>`;
}

function buildReportHtml({
  codes = {},
  images = {},
  pbkdf2Results = null,
  filled = false,
  compact40 = false,
  codeFileList = CODE_FILES,
  codeSectionNote = '',
} = {}) {
  const guide = filled
    ? `<div class="guide">
<p><b>Otomatik doldurulmuş belge</b> — ${new Date().toLocaleString('tr-TR')}${compact40 ? ' — <b>40 sayfa sürümü</b>' : ''}</p>
<p>Kodlar ve görseller script ile eklenmiştir. Word'de <i>Farklı Kaydet → .docx</i> ile kaydedin.</p>
</div>`
    : `<div class="guide">
<p><b>Bu belge nasıl doldurulur?</b></p>
<p class="guide-step"><b>Otomatik:</b> <code>npm run report:fill</code> veya <code>node scripts/fill-final-report.js --capture</code></p>
<p class="guide-step"><b>Manuel:</b> Bölüm 11 görselleri, Bölüm 12 kodları kutulara yapıştırın.</p>
</div>`;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="ProgId" content="Word.Document" />
<title>Password Manager — Final Raporu</title>
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.45;color:#1a1a1a;margin:2cm}
h1{font-size:24pt;text-align:center;margin:0 0 8pt;color:#1e3a5f}
h2{font-size:16pt;margin:22pt 0 10pt;color:#1e3a5f;border-bottom:2px solid #2d6a9f;padding-bottom:5pt}
h3{font-size:13pt;margin:16pt 0 6pt;color:#2d4a6f}
p{margin:0 0 8pt;text-align:justify}
.subtitle{text-align:center;font-size:13pt;color:#555;margin-bottom:28pt}
.meta{margin:4pt 0}
.meta b{display:inline-block;width:200pt;color:#333}
.pagebreak{page-break-after:always}
.cover-bar{height:6pt;background:#1e3a5f;margin-bottom:24pt}
.cover-box{border:1px solid #c5d4e8;background:#f0f6fc;padding:16pt 20pt;margin-top:20pt}
.cover-box p{margin:6pt 0}
.guide{border-left:4pt solid #2d6a9f;background:#f7fafd;padding:12pt 16pt;margin:14pt 0}
.guide p{margin:4pt 0}
.guide-step{margin:6pt 0 6pt 18pt}
.shot{border:1px solid #c8d6e5;background:#fafcfe;padding:12pt 14pt;margin:12pt 0;page-break-inside:avoid}
.shot-header{margin-bottom:6pt}
.shot-num{display:inline-block;background:#2d6a9f;color:#fff;font-weight:bold;width:22pt;height:22pt;line-height:22pt;text-align:center;margin-right:10pt;font-size:11pt}
.shot-title{font-weight:bold;font-size:12pt;color:#1e3a5f}
.shot-desc{font-size:11pt;color:#555;margin:0 0 8pt}
.shot-area{border:1px solid #c5d4e8;background:#fff;padding:8pt;text-align:center}
.shot-img{max-width:100%;height:auto;border:1px solid #ddd}
.shot-missing{border:2px dashed #7ba3c9;background:#eef4fa;min-height:100pt;padding:20pt;color:#5a7a9a;font-size:11pt}
.code-block{margin:14pt 0;page-break-inside:avoid}
.code-purpose{font-size:11pt;color:#444;margin-bottom:6pt}
.code-label{font-family:Consolas,monospace;font-size:9pt;color:#2d6a9f;background:#e8f0f8;padding:4pt 8pt;display:inline-block;margin-bottom:4pt;border:1px solid #c5d4e8}
.code-slot{font-family:Consolas,Courier New,monospace;font-size:8pt;border:1px solid #ccc;background:#f8f8f8;padding:10pt;margin:4pt 0 0;color:#222;white-space:pre-wrap;overflow-wrap:break-word}
.code-slot-compact{font-size:7pt;padding:8pt;line-height:1.25}
.code-block-compact{margin:10pt 0}
.code-truncated{font-size:10pt;color:#888;font-weight:normal}
table{border-collapse:collapse;width:100%;margin:10pt 0;font-size:11pt}
th,td{border:1px solid #bbb;padding:7pt 9pt;text-align:left}
th{background:#e8f0f8;color:#1e3a5f}
.toc li{margin:4pt 0}
.section-note{font-size:10pt;color:#666;font-style:italic;margin-bottom:10pt}
</style>
</head>
<body>

<div class="cover-bar"></div>
<h1>Password Manager (VAULT)</h1>
<p class="subtitle">Final Proje Raporu</p>

<div class="cover-box">
<p class="meta"><b>Proje adı</b> Password Manager</p>
<p class="meta"><b>Öğrenci adı / numarası</b> Mert Şahin — 202213171902</p>
<p class="meta"><b>Danışman hoca</b> Doç. Dr. Hasan TEMURTAŞ</p>
<p class="meta"><b>Teslim tarihi</b> ____________________</p>
</div>

${guide}

<div class="pagebreak"></div>

<h2>İçindekiler</h2>
<ol class="toc">
<li>Özet</li><li>Giriş ve Amaç</li><li>Yöntem ve Mimari</li><li>Güvenlik ve Kriptografi</li>
<li>Güvenlik Skoru</li><li>HIBP Entegrasyonu</li><li>Audit Log</li><li>CSV Import</li>
<li>PBKDF2 Performans Testi</li><li>STRIDE Tehdit Modeli</li><li>Ekran Görselleri</li>
<li>Proje Kaynak Kodları</li>
</ol>

<div class="pagebreak"></div>

<h2>1. Özet</h2>
<p>Bu proje, Electron tabanlı bir masaüstü parola yöneticisi (VAULT) geliştirmeyi hedefler. Kullanıcı verileri master şifre ile korunur; PBKDF2 anahtar türetme ve AES-256-GCM ile şifreli olarak yerel diske kaydedilir. Final sürümde güvenlik skoru paneli, Have I Been Pwned (HIBP) sızıntı taraması, şifreli audit log, çoklu CSV içe aktarma ve PBKDF2 performans ölçümü eklenmiştir.</p>

<h2>2. Giriş ve Amaç</h2>
<p>Günümüzde zayıf, tekrarlayan ve sızıntıya uğramış parolalar önemli bir siber güvenlik riski oluşturmaktadır. Projenin amacı; kullanıcıların parolalarını güvenli biçimde saklamasını, kolayca yönetmesini ve güvenlik farkındalığını artıracak raporlama araçları sunmaktır.</p>

<h2>3. Yöntem ve Mimari</h2>
<p>Uygulama Electron mimarisi üzerine kuruludur. main.js ana süreçte dosya, kripto ve IPC işlemlerini yürütür. preload.js contextBridge ile sınırlı bir API sunar. Renderer katmanı HTML/CSS/JS ile kullanıcı arayüzünü oluşturur.</p>
<table>
<tr><th>Katman</th><th>Dosya</th><th>Görev</th></tr>
<tr><td>Ana süreç</td><td>src/main.js</td><td>IPC, vault, HIBP, import/export</td></tr>
<tr><td>Köprü</td><td>src/preload.js</td><td>Güvenli API yüzeyi</td></tr>
<tr><td>Arayüz</td><td>src/renderer/*</td><td>Liste, form, rapor, ayarlar</td></tr>
<tr><td>Kütüphane</td><td>src/lib/*</td><td>Auth, crypto, vault, HIBP, CSV</td></tr>
</table>

<h2>4. Güvenlik ve Kriptografi</h2>
<p>Master şifre PBKDF2 (SHA-512) ile anahtara dönüştürülür. Kasa verisi AES-256-GCM ile şifrelenir; bütünlük GCM authentication tag ile doğrulanır.</p>

<h2>5. Güvenlik Skoru (0–100)</h2>
<p>Dashboard; zayıf parolalar (%30), tekrarlayan parolalar (%25), eski kayıtlar (%10), HIBP sızıntıları (%15) ve 2FA kullanımı (maks. %10) bileşenlerinden hesaplanır.</p>

<h2>6. HIBP Entegrasyonu</h2>
<p>Have I Been Pwned API'si k-anonymity modeli ile kullanılır; tam parola veya hash gönderilmez.</p>

<h2>7. Audit Log</h2>
<p>Güvenlik olayları şifreli kasa içinde tutulur. Son 100 kayıt arayüzde listelenir.</p>

<h2>8. CSV Import</h2>
<p>VAULT, Bitwarden, Chrome ve Firefox dışa aktarma formatları desteklenir.</p>

<h2>9. PBKDF2 Performans Testi</h2>
<table>
<tr><th>Iterasyon</th><th>Süre (ms)</th><th>Not</th></tr>
${pbkdf2TableRows(pbkdf2Results)}
</table>

<h2>10. STRIDE Tehdit Modeli</h2>
<table>
<tr><th>Tehdit</th><th>Bileşen</th><th>Önlem</th></tr>
<tr><td>Spoofing</td><td>Kasa kilidi</td><td>Master şifre, isteğe bağlı 2FA</td></tr>
<tr><td>Tampering</td><td>vault.json</td><td>AES-256-GCM, GCM tag doğrulama</td></tr>
<tr><td>Repudiation</td><td>İşlem kayıtları</td><td>Şifreli audit log</td></tr>
<tr><td>Information Disclosure</td><td>Parola / API</td><td>contextIsolation, HIBP k-anonymity</td></tr>
<tr><td>Denial of Service</td><td>HIBP taraması</td><td>Rate limit, zaman aşımı</td></tr>
<tr><td>Elevation of Privilege</td><td>Renderer</td><td>nodeIntegration kapalı, preload whitelist</td></tr>
</table>

<div class="pagebreak"></div>

<h2>11. Ekran Görselleri</h2>
${compact40 ? '<p class="section-note">Her görsel ayrı sayfada yer alacak şekilde düzenlenmiştir.</p>' : ''}
${SCREENSHOTS.map((s, i) => shotBlock(i + 1, s, images[s.file] || null, compact40)).join('')}

<div class="pagebreak"></div>

<h2>12. Proje Kaynak Kodları</h2>
${codeSectionNote ? `<p class="section-note">${escapeHtml(codeSectionNote)}</p>` : ''}
${codeFileList.map((f, i) => codeBlock(i + 1, f, codes[f.path] || `[Kod yüklenemedi: ${f.path}]`, compact40)).join('')}

</body>
</html>`;
}

function writeReportFile(outPath, html) {
  try {
    fs.writeFileSync(outPath, html, { encoding: 'utf8' });
    return outPath;
  } catch (err) {
    if (err.code === 'EBUSY') {
      const alt = outPath.replace(/\.doc$/i, '-DOLU.doc');
      fs.writeFileSync(alt, html, { encoding: 'utf8' });
      return alt;
    }
    throw err;
  }
}

module.exports = {
  ROOT,
  SCREENSHOTS_DIR,
  SCREENSHOTS,
  CODE_FILES,
  CODE_FILES_COMPACT_40,
  COMPACT_40_NOTE,
  escapeHtml,
  truncateCode,
  readCodeFiles,
  readScreenshotDataUri,
  runPbkdf2Benchmark,
  buildReportHtml,
  writeReportFile,
};
