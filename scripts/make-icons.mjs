#!/usr/bin/env node
// Generates simple PNG app icons (dumbbell glyph) with sharp from an inline SVG.
import sharp from 'sharp';
import fs from 'node:fs/promises';
const svg = (pad = 0) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#0f1115"/>
<g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)" fill="#3ddc84">
<rect x="96" y="176" width="48" height="160" rx="14"/><rect x="368" y="176" width="48" height="160" rx="14"/>
<rect x="56" y="210" width="40" height="92" rx="12"/><rect x="416" y="210" width="40" height="92" rx="12"/>
<rect x="144" y="236" width="224" height="40" rx="10"/></g></svg>`);
await fs.mkdir('public/icons', { recursive: true });
for (const [name, size, pad] of [['apple-touch-icon.png', 180, 0], ['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['maskable-512.png', 512, 0.2]]) {
  await sharp(svg(pad)).resize(size, size).png().toFile(`public/icons/${name}`);
}
await fs.writeFile('public/favicon.svg', svg(0));
console.log('icons written');
