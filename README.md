# VAULT — Password Manager

[![Electron](https://img.shields.io/badge/Electron-32-blueviolet.svg)](https://www.electronjs.org/)

> Modern, güvenli ve açık kaynaklı şifre yöneticisi. Masaüstü uygulaması ve tarayıcı eklentisi ile tam entegrasyonlu parola yönetimi.

**VAULT**, Windows 11 tasarım dili ile geliştirilmiş, harika bir kullanıcı deneyimi sunan şifre yöneticisidir. Masaüstü uygulaması ile parolalarınızı güvenli şekilde yönetin, Chrome eklentisi ile web sitelerinde otomatik doldurma ve kaydetme özelliklerinden yararlanın.

---

## Öne Çıkan Özellikler

### Güvenlik
- **AES-256-GCM Şifreleme** — Endüstri standardı askeri sınıf encryption
- **PBKDF2 Hashing** — SHA-512 ile güvenli parola hashleme (10K-1M iterations)
- **Have I Been Pwned API** — Parolalarınızın sızıntıya uğrayıp uğramadığını k-anonymity ile kontrol edin
- **Windows Hello** — Biyometrik kimlik doğrulama desteği
- **Clipboard Auto-Clear** — Panodaki parolalar 30 saniye sonra otomatik silinir

### Kullanıcı Arayüzü
- **Windows 11 Tasarımı** — Modern, sade ve etkileyici arayüz
- **Koyu Tema** — Gözler için rahat, profesyonel görünüm
- **Cyan Aksan Rengi** — Hoş ve konsisten renk şeması
- **Lucide Icons** — 577+ profesyonel ikon

### Parola Yönetimi
- **Kategorilere Göre Düzenleme** — Sosyal, İş, Finans, Eğlence, Alışveriş, E-posta, Diğer
- **2FA/TOTP Desteği** — İki faktörlü kimlik doğrulama (Demo modunda gerçek zamanlı sayaç)
- **CSV İçe Aktarma** — Vault, Bitwarden, Chrome, Firefox formatlarından veri taşıyın
- **Alan Adı Çıkarımı** — URL'den otomatik alan adı algılama
- **Eklentiler ve Notlar** — Her parola için ekstra bilgi ekleyin

### Tarayıcı Eklentisi
- **Otomatik Doldurma** — Giriş formlarını otomatik doldurun
- **Otomatik Kaydetme** — Yeni parolaları otomatik olarak VAULT'a kaydedin
- **Yerel İletişim** — Native Messaging ile güvenli masaüstü app iletişimi
- **Chrome MV3 Uyumlu** — Modern Chrome eklenti teknolojisi

---

## Başlarken

### Gereksinimler
- **Node.js** 14+ 
- **npm** 6+
- **Windows 10+** (ana platform)
- **Chrome** 90+ (eklenti için)

### Kurulum

1. **Depoyu klonlayın:**
```bash
git clone https://github.com/mertsah1ns/PasswordManager.git
cd PasswordManager
```

2. **Bağımlılıkları yükleyin:**
```bash
npm install
```

3. **Uygulamayı başlatın:**
```bash
npm start
```

### Tarayıcı Eklentisini Kurma

[Detaylı kurulum adımları için bakınız: `extension/README.md`](./extension/README.md)

Kısa özet:
```bash
# 1. VAULT masaüstü uygulamasını başlatın
npm start

# 2. Chrome'dan eklentiyi yükleyin
# chrome://extensions → Geliştirici Modu → Paketlenmemiş Öğe Yükle → extension/ klasörü

# 3. Eklenti ID'sini kopyalayıp Native Host'u kaydedin
node scripts/install-native-host.js <EXTENSION_ID>

# 4. Chrome'u yeniden başlatın
```

---

## Proje Yapısı

```
vault-password-manager/
├── 📄 package.json              # Proje metadata ve komutlar
├── 📄 README.md                 # Bu dosya
│
├── 📂 src/                      # Electron masaüstü uygulaması
│   ├── main.js                  # Electron ana process
│   ├── preload.js               # IPC güvenli köprüsü
│   ├── constants.js             # Merkezi sabit değerler
│   │
│   ├── 📂 lib/                  # Core kütüphaneler
│   │   ├── auth.js              # Kimlik doğrulama
│   │   ├── crypto.js            # Şifreleme/Şifre çözme
│   │   ├── vault.js             # Vault veri yönetimi
│   │   ├── hibp.js              # Have I Been Pwned API
│   │   ├── importCsv.js         # CSV içe aktarma
│   │   ├── utils.js             # Yardımcı fonksiyonlar
│   │   └── defaults.js          # Varsayılan vault yapısı
│   │
│   ├── 📂 ipc/                  # İşlemler arası iletişim
│   └── 📂 renderer/             # Arayüz (HTML/CSS/JS)
│       ├── index.html           # Ana pencere
│       ├── password-check.html  # Parola kontrol penceresi
│       ├── styles.css           # Tema ve tasarım
│       ├── renderer.js          # Arayüz mantığı
│       ├── utils.js             # Arayüz yardımcıları
│       └── lucide.min.js        # İkon kütüphanesi
│
├── 📂 extension/                # Chrome tarayıcı eklentisi
│   ├── manifest.json            # Eklenti yapılandırması
│   ├── background.js            # Service worker
│   ├── content.js               # İçerik script
│   ├── popup.js/html            # Eklenti popup
│   ├── README.md                # Eklenti kurulum rehberi
│   │
│   ├── 📂 native-host/          # Native Messaging Host
│   │   ├── vault-host.js        # JavaScript host (cross-platform)
│   │   ├── vault-host.bat       # Windows batch wrapper
│   │   ├── vault-host.sh        # Unix shell wrapper
│   │   └── com.vault.passwordmanager.json  # Manifest
│   │
│   └── 📂 icons/                # Eklenti ikonları (16, 48, 128px)
│
├── 📂 scripts/                  # Yapı ve yardımcı scriptler
│   ├── install-native-host.js   # Native host kaydetme
│   ├── generate-icon.js         # İkon PNG oluşturma
│   ├── benchmark-pbkdf2.js      # PBKDF2 performans testi
│   ├── fill-final-report.js     # Rapor oluşturma
│   ├── run-report-capture.js    # Ekran görüntüsü alma
│   └── 📂 lib/                  # Script yardımcıları
│
├── 📂 assets/                   # Uygulama kaynakları
│   ├── icon.svg                 # Logo (vektör)
│   └── icon.png                 # Logo (raster, build sonrası)
│
└── 📂 .git/                     # Git repository
```

---

## 🛠️ Kullanılabilir Komutlar

```bash
# Geliştirme
npm start              # Uygulamayı başlat (hızlı mod)
npm run dev            # Uygulamayı başlat (debug logging)

# İkon
npm run build-icon     # SVG'den PNG ikonlar oluştur

# Eklenti
npm run extension:install    # Native Messaging Host'u kaydet

# Benchmark & Raporlama
npm run benchmark:pbkdf2     # PBKDF2 performans testi
npm run report:template      # Rapor şablonu oluştur
npm run report:capture       # Uygulamadan ekran görüntüsü al
npm run report:build         # Tam rapor oluştur

# İleri raporlama
npm run report:fill          # Raporu doldur (manuel)
npm run report:40            # Kompakt 40-sayfa rapor
```

---

## Önemli Kütüphaneler

| Kütüphane | Versiyon | Amaç |
|-----------|----------|------|
| **Electron** | ^32.0.0 | Masaüstü uygulama framework'ü |
| **Lucide** | ^0.577.0 | 577+ profesyonel SVG ikonu |
| **Speakeasy** | ^2.0.0 | TOTP/2FA token oluşturma |
| **Sharp** | ^0.34.5 | İkon resimleri işleme (dev) |

---

## Şifreleme ve Güvenlik Detayları

### Şifreleme Algoritmaları
- **Vault Şifreleme:** AES-256-GCM (Authenticated Encryption)
- **Parola Hashing:** PBKDF2-SHA512
- **İterasyon Sayısı:** 100.000 (ayarlanabilir: 10K-1M)
- **Salt Uzunluğu:** 32 byte
- **Vault Key Uzunluğu:** 32 byte
- **IV Uzunluğu:** 12 byte
- **Auth Tag Uzunluğu:** 16 byte

### Vault Yapısı
```json
{
  "vault": [
    {
      "id": "uuid",
      "name": "Account Name",
      "url": "https://example.com",
      "username": "user@example.com",
      "password": "encrypted_password",
      "category": "sosyal",
      "notes": "Notlar",
      "attachments": [],
      "totp": "base32_secret"
    }
  ]
}
```

### Parola Kontrol (HIBP)
- **API:** Have I Been Pwned v3
- **Güvenlik:** k-anonymity (5 karakterlik SHA-1 hash gönderilir)
- **Timeout:** 8 saniye
- **User-Agent:** VAULT-Password-Manager

---

## 📊 Performans

### PBKDF2 Benchmark
```bash
npm run benchmark:pbkdf2
```

Tipik sonuçlar (Windows 11, Intel i7):
- 100K iterations: ~150-200ms
- 500K iterations: ~750-1000ms
- 1M iterations: ~1500-2000ms

### Rapor Oluşturma
- Tam rapor: ~500KB PDF
- Ekran görüntüleri: Otomatik
- Zamanı: ~2-3 dakika

---

## Katkıda Bulunma

Projemiz açık kaynaktır! Hataları bildirmek, özellik önerileri yapmak veya kod katkısı sağlamak istiyorsanız:

1. **Issue açın:** [Issues](https://github.com/yourusername/vault-password-manager/issues)
2. **Fork yapın:** Projeyi kendi hesabınıza çatallayın
3. **Branch oluşturun:** `git checkout -b feature/amazing-feature`
4. **Commit edin:** `git commit -m 'Add amazing feature'`
5. **Push yapın:** `git push origin feature/amazing-feature`
6. **Pull Request açın:** Main branch'e PR gönderin

---



## Uyarılar

- **Üretim Kullanımı:** Bu uygulama eğitim amaçlıdır. Üretim ortamında kullanmadan önce kapsamlı güvenlik denetimine tabi tutulmalıdır.
- **Yedekleme:** Vault verilerinizi düzenli olarak yedekleyin.
- **Ana Parola:** Ana parolanızı asla unutmayın — kurtarma yöntemi yoktur.
- **İzinler:** Windows'ta Registry değişiklik izni gerekir.

---

##  İletişim & Destek

- **Bug Raporları:** [GitHub Issues](https://github.com/mertsah1ns/PasswordManager/issues)
- **Özellik İstekleri:** [GitHub Discussions](https://github.com/mertsah1ns/PasswordManager/discussions)
- **Email:** your.email@example.com

---

##  Teşekkürler

- **Lucide** — Harika ikon kütüphanesi
- **Have I Been Pwned** — Parola sızıntı veritabanı
- **Electron** — Masaüstü app framework'ü
- **Açık kaynak topluluğu** — Desteği ve ilhami için

---

**VAULT ile parolalarınızı güvenli tutun. Açık, şeffaf ve denetlenebilir.** 🔐
