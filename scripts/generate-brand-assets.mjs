import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

/**
 * Builds the canonical Ursella Vector Emblem.
 * Viewbox: 0 0 32 32
 * 
 * Geometry:
 * - Mathematical 6px constant stroke width across left pillar, bottom semicircular sweep, and right pillar.
 * - Symmetrical counter (width 9px).
 * - Left foundation pillar has a refined top fillet.
 * - Right pillar ascends dynamically with a 45° angle cut (dx=6, dy=6) that forms a forward-momentum chevron.
 * - An integrated architectural facet highlights the 45° apex.
 * - The center counter features the Ursella Keystone Diamond (the geometric seed for the AI Advisor).
 */
export function buildUrsellaSvg({
  size = 32,
  theme = 'emerald', // 'emerald' | 'light' | 'mono-black' | 'mono-white'
  showBg = false,
  bgRadius = 0,
}) {
  const isWhite = theme === 'mono-white';
  const isBlack = theme === 'mono-black';
  const isLight = theme === 'light';

  const uid = Math.random().toString(36).substring(2, 8);
  const gradPriId = `ur_pri_${uid}`;
  const gradFacetId = `ur_facet_${uid}`;
  const gradGemId = `ur_gem_${uid}`;

  let fillPri = `url(#${gradPriId})`;
  let fillFacet = `url(#${gradFacetId})`;
  let fillGem = `url(#${gradGemId})`;

  if (isWhite) {
    fillPri = '#FFFFFF';
    fillFacet = '#E2E8F0';
    fillGem = '#FFFFFF';
  } else if (isBlack) {
    fillPri = '#09090B';
    fillFacet = '#27272A';
    fillGem = '#09090B';
  }

  let defs = '';
  if (!isWhite && !isBlack) {
    if (isLight) {
      defs = `
        <defs>
          <linearGradient id="${gradPriId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#10B981" />
            <stop offset="60%" stop-color="#059669" />
            <stop offset="100%" stop-color="#047857" />
          </linearGradient>
          <linearGradient id="${gradFacetId}" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#059669" />
            <stop offset="50%" stop-color="#10B981" />
            <stop offset="100%" stop-color="#34D399" />
          </linearGradient>
          <linearGradient id="${gradGemId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#047857" />
            <stop offset="100%" stop-color="#065F46" />
          </linearGradient>
        </defs>
      `;
    } else {
      // Default Obsidian / Emerald theme
      defs = `
        <defs>
          <linearGradient id="${gradPriId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#34D399" />
            <stop offset="35%" stop-color="#10B981" />
            <stop offset="100%" stop-color="#059669" />
          </linearGradient>
          <linearGradient id="${gradFacetId}" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#059669" />
            <stop offset="50%" stop-color="#10B981" />
            <stop offset="100%" stop-color="#6EE7B7" />
          </linearGradient>
          <linearGradient id="${gradGemId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ECFDF5" />
            <stop offset="50%" stop-color="#6EE7B7" />
            <stop offset="100%" stop-color="#10B981" />
          </linearGradient>
        </defs>
      `;
    }
  }

  const bg = showBg ? `<rect width="32" height="32" rx="${bgRadius}" fill="#090d16" />` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" fill="none">
    ${defs}
    ${bg}
    <!-- Architectural U Foundation (Constant 6px Stroke Geometry) -->
    <path
      d="M 5.5 6 C 5.5 4.9 6.4 4 7.5 4 H 11.5 V 17 C 11.5 19.485 13.515 21.5 16 21.5 C 18.485 21.5 20.5 19.485 20.5 17 V 10 L 26.5 4 V 17 C 26.5 22.799 21.799 27.5 16 27.5 C 10.201 27.5 5.5 22.799 5.5 17 Z"
      fill="${fillPri}"
    />

    <!-- Apex Dynamic Growth Facet (45° Angle Chamfer Highlight) -->
    <path
      d="M 20.5 10 L 26.5 4 V 10 L 20.5 16 Z"
      fill="${fillFacet}"
      opacity="${isWhite ? '0.85' : isBlack ? '0.7' : '0.95'}"
    />

    <!-- Keystone Intelligence Core (Unified AI Diamond) -->
    <path
      d="M 16 6.2 L 19 10.5 L 16 14.8 L 13 10.5 Z"
      fill="${fillGem}"
    />
  </svg>`;
}

async function main() {
  console.log('Generating production brand assets...');

  // 1. Generate favicon.svg (crisp 32x32)
  const faviconSvg = buildUrsellaSvg({ size: 32, theme: 'emerald', showBg: false });
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg);
  console.log('✔ Generated favicon.svg');

  // 2. Generate icon.svg (512x512 with obsidian canvas and ambient radial glow)
  const iconSvg512 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
    <rect width="512" height="512" fill="#090d16" />
    <radialGradient id="icon_radial" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#10B981" stop-opacity="0.25" />
      <stop offset="60%" stop-color="#059669" stop-opacity="0.06" />
      <stop offset="100%" stop-color="#090d16" stop-opacity="0" />
    </radialGradient>
    <circle cx="256" cy="256" r="230" fill="url(#icon_radial)" />
    <defs>
      <linearGradient id="pwa_pri" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#34D399" />
        <stop offset="35%" stop-color="#10B981" />
        <stop offset="100%" stop-color="#059669" />
      </linearGradient>
      <linearGradient id="pwa_facet" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#059669" />
        <stop offset="50%" stop-color="#10B981" />
        <stop offset="100%" stop-color="#6EE7B7" />
      </linearGradient>
      <linearGradient id="pwa_gem" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ECFDF5" />
        <stop offset="50%" stop-color="#6EE7B7" />
        <stop offset="100%" stop-color="#10B981" />
      </linearGradient>
    </defs>
    <!-- Scaled centered mark (32x32 scaled to 360x360, centered at 256, 256) -->
    <g transform="translate(76, 76) scale(11.25)">
      <path
        d="M 5.5 6 C 5.5 4.9 6.4 4 7.5 4 H 11.5 V 17 C 11.5 19.485 13.515 21.5 16 21.5 C 18.485 21.5 20.5 19.485 20.5 17 V 10 L 26.5 4 V 17 C 26.5 22.799 21.799 27.5 16 27.5 C 10.201 27.5 5.5 22.799 5.5 17 Z"
        fill="url(#pwa_pri)"
      />
      <path
        d="M 20.5 10 L 26.5 4 V 10 L 20.5 16 Z"
        fill="url(#pwa_facet)"
        opacity="0.95"
      />
      <path
        d="M 16 6.2 L 19 10.5 L 16 14.8 L 13 10.5 Z"
        fill="url(#pwa_gem)"
      />
    </g>
  </svg>`;
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), iconSvg512);
  console.log('✔ Generated icon.svg');

  // Maskable SVG with safe margin padding (scaled down to fit within inner 80% circle)
  const maskableSvg512 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
    <rect width="512" height="512" fill="#090d16" />
    <defs>
      <linearGradient id="pwa_m_pri" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#34D399" />
        <stop offset="35%" stop-color="#10B981" />
        <stop offset="100%" stop-color="#059669" />
      </linearGradient>
      <linearGradient id="pwa_m_facet" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#059669" />
        <stop offset="50%" stop-color="#10B981" />
        <stop offset="100%" stop-color="#6EE7B7" />
      </linearGradient>
      <linearGradient id="pwa_m_gem" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ECFDF5" />
        <stop offset="50%" stop-color="#6EE7B7" />
        <stop offset="100%" stop-color="#10B981" />
      </linearGradient>
    </defs>
    <!-- Scaled with safe margins for Android adaptive icons -->
    <g transform="translate(106, 106) scale(9.375)">
      <path
        d="M 5.5 6 C 5.5 4.9 6.4 4 7.5 4 H 11.5 V 17 C 11.5 19.485 13.515 21.5 16 21.5 C 18.485 21.5 20.5 19.485 20.5 17 V 10 L 26.5 4 V 17 C 26.5 22.799 21.799 27.5 16 27.5 C 10.201 27.5 5.5 22.799 5.5 17 Z"
        fill="url(#pwa_m_pri)"
      />
      <path
        d="M 20.5 10 L 26.5 4 V 10 L 20.5 16 Z"
        fill="url(#pwa_m_facet)"
        opacity="0.95"
      />
      <path
        d="M 16 6.2 L 19 10.5 L 16 14.8 L 13 10.5 Z"
        fill="url(#pwa_m_gem)"
      />
    </g>
  </svg>`;

  // 3. Render raster PNGs via sharp
  await sharp(Buffer.from(iconSvg512)).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('✔ Rendered pwa-512x512.png');

  await sharp(Buffer.from(iconSvg512)).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('✔ Rendered pwa-192x192.png');

  await sharp(Buffer.from(iconSvg512)).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✔ Rendered apple-touch-icon.png');

  await sharp(Buffer.from(maskableSvg512)).resize(512, 512).png().toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('✔ Rendered pwa-maskable-512x512.png');

  await sharp(Buffer.from(maskableSvg512)).resize(192, 192).png().toFile(path.join(publicDir, 'pwa-maskable-192x192.png'));
  console.log('✔ Rendered pwa-maskable-192x192.png');

  console.log('All brand assets successfully generated!');
}

main().catch(console.error);
