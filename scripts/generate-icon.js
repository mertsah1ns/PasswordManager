#!/usr/bin/env node
/* SVG'den PNG oluşturmak için: npm run build-icon
 * Önce: npm install sharp --save-dev */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../assets/icon.svg');
const outPath = path.join(__dirname, '../assets/icon.png');
const svg = fs.readFileSync(svgPath);

const extDir = path.join(__dirname, '../extension/icons');
fs.mkdirSync(extDir, { recursive: true });

Promise.all([
  sharp(Buffer.from(svg)).png().resize(256, 256).toFile(outPath),
  sharp(Buffer.from(svg)).png().resize(16, 16).toFile(path.join(extDir, '16.png')),
  sharp(Buffer.from(svg)).png().resize(48, 48).toFile(path.join(extDir, '48.png')),
  sharp(Buffer.from(svg)).png().resize(128, 128).toFile(path.join(extDir, '128.png'))
])
  .then(() => console.log('İkonlar oluşturuldu: assets/icon.png, extension/icons/'))
  .catch(err => console.error(err));
