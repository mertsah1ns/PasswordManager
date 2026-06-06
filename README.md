# VAULT — Password Manager

Windows 11 tarzında Electron şifre yöneticisi uygulaması.

## Kurulum

```bash
npm install
npm start
```

## Özellikler

- **Lucide ikon paketi** — Tüm arayüz ikonları Lucide kütüphanesinden
- **VAULT tasarımı** — Koyu tema, cyan aksan rengi, Windows benzeri layout
- **2FA/TOTP simülasyonu** — Demo amaçlı gerçek zamanlı sayaç
- **Panoya kopyalama** — Electron clipboard API ile güvenli kopyalama

## Proje Yapısı

```
PasswordManager/
├── src/
│   ├── main.js        # Electron ana process
│   ├── preload.js     # IPC köprüsü
│   └── renderer/
│       ├── index.html
│       ├── styles.css
│       ├── renderer.js
│       └── lucide.min.js
├── assets/
│   ├── icon.svg       # Uygulama logosu (V + anahtar deliği)
│   └── icon.png       # npm run build-icon ile oluşturulur
└── package.json
```

## İkon Oluşturma

Uygulama penceresi ikonu için PNG oluşturmak isterseniz:

```bash
npm install sharp --save-dev
npm run build-icon
```

## Teknolojiler

- Electron 32
- Lucide Icons
- Barlow / Bebas Neue fontları
