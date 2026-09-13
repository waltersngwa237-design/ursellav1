import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Canonical Ursella Interwoven Ribbon U Symbol (transparent, scalable)
function getCanonicalSymbolSvg(size = 32) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" fill="none">
  <defs>
    <!-- Primary Electric / Royal Blue Gradient -->
    <linearGradient id="ur_ribbon_left_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="35%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>

    <!-- Deep Navy to Electric Gradient for dimensional depth -->
    <linearGradient id="ur_ribbon_right_grad" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#60A5FA"/>
      <stop offset="45%" stop-color="#1E40AF"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>

    <!-- Accent Cyan Gradient for the inner return loop -->
    <linearGradient id="ur_ribbon_fold_grad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#06B6D4"/>
      <stop offset="50%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>

    <!-- Core highlight -->
    <linearGradient id="ur_core_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#93C5FD"/>
    </linearGradient>

    <!-- Drop shadow for depth -->
    <filter id="ur_shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.2" stdDeviation="1.5" flood-color="#2563EB" flood-opacity="0.45"/>
    </filter>
  </defs>

  <g filter="url(#ur_shadow)">
    <!-- 1. Right Ribbon Strand: Underweave Loop -->
    <path
      d="M22 4 C22 3.45 22.45 3 23 3 H26 C26.55 3 27 3.45 27 4 V18 C27 23.5 22.5 28 16 28 C12.8 28 9.8 26.5 7.8 24.2 L11.2 20.8 C12.4 22.2 14.1 23 16 23 C19.3 23 22 20.3 22 17 V4 Z"
      fill="url(#ur_ribbon_right_grad)"
    />

    <!-- 2. Optical Under-Weave Depth Shadow -->
    <path
      d="M12.8 22.2 C13.7 23 14.8 23.4 16 23.4 L17.2 20.2 C16.2 20.2 15.2 19.8 14.4 19.2 Z"
      fill="#0B132B"
      opacity="0.85"
    />

    <!-- 3. Left Ribbon Strand: Main Foreground Loop -->
    <path
      d="M5 4 C5 3.45 5.45 3 6 3 H9 C9.55 3 10 3.45 10 4 V17 C10 20.3 12.7 23 16 23 C17.8 23 19.4 22.2 20.5 20.9 L23.8 24.2 C21.8 26.5 19.1 28 16 28 C9.5 28 5 23.5 5 18 V4 Z"
      fill="url(#ur_ribbon_left_grad)"
    />

    <!-- 4. Upper Interlocking Crest Ribbon Fold -->
    <path
      d="M10 13.5 C10 11.2 12.4 9.2 16 9.2 C19.6 9.2 22 11.2 22 13.5 L19.8 14.6 C19.8 13.2 18.2 11.8 16 11.8 C13.8 11.8 12.2 13.2 12.2 14.6 Z"
      fill="url(#ur_ribbon_fold_grad)"
    />

    <!-- 5. Central Luminous Core Focal Node -->
    <circle cx="16" cy="15.5" r="1" fill="url(#ur_core_grad)" />
  </g>
</svg>`;
}

// 512x512 Dark App Canvas Icon SVG
function getIconSvg(size = 512, isMaskable = false) {
  // Safe zone for maskable icon is centered ~70% size, normal icon ~75%
  const scale = isMaskable ? 10.5 : 12;
  const translate = isMaskable ? 88 : 64;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}" fill="none">
  <!-- Solid Dark Navy/Zinc Canvas for PWA & App Icons -->
  <rect width="512" height="512" fill="#090d16" />

  <!-- Subtle Radial Ambient Blue Glow -->
  <radialGradient id="amb_blue_glow" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#2563EB" stop-opacity="0.32" />
    <stop offset="55%" stop-color="#1D4ED8" stop-opacity="0.12" />
    <stop offset="100%" stop-color="#090d16" stop-opacity="0" />
  </radialGradient>
  <circle cx="256" cy="256" r="220" fill="url(#amb_blue_glow)" />

  <defs>
    <!-- Primary Electric / Royal Blue Gradient -->
    <linearGradient id="pwa_ribbon_l" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="35%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>

    <linearGradient id="pwa_ribbon_r" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#60A5FA"/>
      <stop offset="45%" stop-color="#1E40AF"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>

    <linearGradient id="pwa_ribbon_f" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#06B6D4"/>
      <stop offset="50%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#38BDF8"/>
    </linearGradient>

    <linearGradient id="pwa_core" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#93C5FD"/>
    </linearGradient>

    <filter id="pwa_glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#2563EB" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Scaled Centered Ursella Ribbon Mark -->
  <g filter="url(#pwa_glow)" transform="translate(${translate}, ${translate}) scale(${scale})">
    <!-- Right Ribbon Underweave -->
    <path
      d="M22 4 C22 3.45 22.45 3 23 3 H26 C26.55 3 27 3.45 27 4 V18 C27 23.5 22.5 28 16 28 C12.8 28 9.8 26.5 7.8 24.2 L11.2 20.8 C12.4 22.2 14.1 23 16 23 C19.3 23 22 20.3 22 17 V4 Z"
      fill="url(#pwa_ribbon_r)"
    />

    <!-- Optical Depth Shadow -->
    <path
      d="M12.8 22.2 C13.7 23 14.8 23.4 16 23.4 L17.2 20.2 C16.2 20.2 15.2 19.8 14.4 19.2 Z"
      fill="#0B132B"
      opacity="0.85"
    />

    <!-- Left Ribbon Foreground -->
    <path
      d="M5 4 C5 3.45 5.45 3 6 3 H9 C9.55 3 10 3.45 10 4 V17 C10 20.3 12.7 23 16 23 C17.8 23 19.4 22.2 20.5 20.9 L23.8 24.2 C21.8 26.5 19.1 28 16 28 C9.5 28 5 23.5 5 18 V4 Z"
      fill="url(#pwa_ribbon_l)"
    />

    <!-- Upper Interlocking Crest Ribbon Fold -->
    <path
      d="M10 13.5 C10 11.2 12.4 9.2 16 9.2 C19.6 9.2 22 11.2 22 13.5 L19.8 14.6 C19.8 13.2 18.2 11.8 16 11.8 C13.8 11.8 12.2 13.2 12.2 14.6 Z"
      fill="url(#pwa_ribbon_f)"
    />

    <!-- Central Core -->
    <circle cx="16" cy="15.5" r="1" fill="url(#pwa_core)" />
  </g>
</svg>`;
}

async function main() {
  const publicDir = path.resolve(process.cwd(), 'public');

  // 1. Write favicon.svg (Vector)
  const faviconSvg = getCanonicalSymbolSvg(32);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg, 'utf-8');
  console.log('Updated public/favicon.svg');

  // 2. Write icon.svg (512x512 Dark Theme Vector)
  const iconSvg = getIconSvg(512, false);
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), iconSvg, 'utf-8');
  console.log('Updated public/icon.svg');

  // 3. Generate PNGs using Sharp
  const pwaSvgBuffer = Buffer.from(iconSvg);
  const maskableSvgBuffer = Buffer.from(getIconSvg(512, true));

  // pwa-512x512.png
  await sharp(pwaSvgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Generated public/pwa-512x512.png');

  // pwa-192x192.png
  await sharp(pwaSvgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Generated public/pwa-192x192.png');

  // pwa-maskable-512x512.png
  await sharp(maskableSvgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated public/pwa-maskable-512x512.png');

  // pwa-maskable-192x192.png
  await sharp(maskableSvgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-192x192.png'));
  console.log('Generated public/pwa-maskable-192x192.png');

  // apple-touch-icon.png (180x180)
  await sharp(pwaSvgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated public/apple-touch-icon.png');

  console.log('All brand assets successfully built!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
