# VAULT Tarayıcı Eklentisi

Chrome eklentisi ile tarayıcıda otomatik parola doldurma ve yeni parolaları kaydetme.

## Kurulum

### 1. VAULT uygulamasını çalıştırın
Masaüstü uygulaması açık olmalı. Eklenti VAULT ile yerel bağlantı kurar.

### 2. Chrome'a eklentiyi yükleyin
1. Chrome'da `chrome://extensions` adresine gidin
2. **Geliştirici modu**'nu açın
3. **Paketlenmemiş öğe yükle** → `extension` klasörünü seçin
4. Eklenti yüklendikten sonra **Extension ID**'yi kopyalayın (örn: `abcdefghijklmnopqrstuvwxyz`)

### 3. Native Messaging Host'u kaydedin
```bash
node scripts/install-native-host.js YOUR_EXTENSION_ID
```
Örnek:
```bash
node scripts/install-native-host.js abcdefghijklmnopqrstuvwxyz
```

### 4. Chrome'u yeniden başlatın (veya eklentiyi yeniden yükleyin)

## Özellikler

- **Otomatik doldurma:** Giriş formlarına tıkladığınızda, VAULT'ta kayıtlı parola varsa otomatik doldurulur
- **Parola kaydetme:** Bir siteye giriş yaptığınızda (form gönderildiğinde) parola otomatik VAULT'a eklenir
- **Manuel doldurma:** Eklenti simgesine tıklayıp "Bu sayfayı doldur" ile manuel doldurma

## Gereksinimler

- VAULT masaüstü uygulaması açık ve kasa kilidi açık olmalı
- Windows: Registry yazma izni (install script için)
