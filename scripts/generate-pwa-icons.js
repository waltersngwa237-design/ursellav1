import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

function createIconSvg(scaleMultiplier = 1) {
  // Base symbol is 32x32.
  // In 512x512 canvas:
  // scale = 11.5 => 32 * 11.5 = 368px (for standard icon)
  // scale = 9.2 => 32 * 9.2 = 294px (for maskable icon safe zone, safe diameter is 512 * 0.8 = 409px)
  const baseScale = 11.5 * scaleMultiplier;
  const targetDimension = 32 * baseScale;
  const offset = (512 - targetDimension) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none">
  <!-- Solid Dark Background filling 100% of the canvas without rounded/transparent corners -->
  <rect width="512" height="512" fill="#09090b" />

  <!-- Subtle Ambient Glow -->
  <radialGradient id="amb_glow" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#10B981" stop-opacity="0.25" />
    <stop offset="60%" stop-color="#059669" stop-opacity="0.08" />
    <stop offset="100%" stop-color="#059669" stop-opacity="0" />
  </radialGradient>
  <circle cx="256" cy="256" r="210" fill="url(#amb_glow)" />

  <defs>
    <!-- Primary Product Emerald Gradient -->
    <linearGradient id="ursella_emerald_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399" />
      <stop offset="45%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="ursella_emerald_core_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#A7F3D0" />
      <stop offset="100%" stop-color="#34D399" />
    </linearGradient>
    <filter id="ursella_glow_subtle" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#10B981" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Centered Ursella Symbol -->
  <g filter="url(#ursella_glow_subtle)" transform="translate(${offset}, ${offset}) scale(${baseScale})">
    <!-- 1. Central Mantle Dome -->
    <path
      d="M10.8 11.8 C10.8 6.6 13.1 4.5 16 4.5 C18.9 4.5 21.2 6.6 21.2 11.8 C21.2 14.2 19.8 16 16 16 C12.2 16 10.8 14.2 10.8 11.8 Z"
      fill="url(#ursella_emerald_grad)"
    />

    <!-- 2. Outer Tentacles Left & Right -->
    <path
      d="M11 9 C7.5 9.5 4.5 12 4.5 15.5 C4.5 19 6.8 21.5 8 21.5 C9.2 21.5 9.5 20.2 9 19 C8.2 17.2 7 15.8 7 14.2 C7 12.5 9.2 11 11.8 10.5 Z"
      fill="url(#ursella_emerald_grad)"
    />
    <path
      d="M21 9 C24.5 9.5 27.5 12 27.5 15.5 C27.5 19 25.2 21.5 24 21.5 C22.8 21.5 22.5 20.2 23 19 C23.8 17.2 25 15.8 25 14.2 C25 12.5 22.8 11 20.2 10.5 Z"
      fill="url(#ursella_emerald_grad)"
    />

    <!-- 3. Mid Tentacles Left & Right -->
    <path
      d="M12.5 13.5 C10.2 14.8 7.8 17.5 7.8 21 C7.8 24.2 10 26.5 11.5 26.5 C12.8 26.5 13.2 25 12.5 23.8 C11.5 22 10.2 20.5 10.2 19 C10.2 17.2 11.8 15.8 13.8 14.8 Z"
      fill="url(#ursella_emerald_grad)"
    />
    <path
      d="M19.5 13.5 C21.8 14.8 24.2 17.5 24.2 21 C24.2 24.2 22 26.5 20.5 26.5 C19.2 26.5 18.8 25 19.5 23.8 C20.5 22 21.8 20.5 21.8 19 C21.8 17.2 20.2 15.8 18.2 14.8 Z"
      fill="url(#ursella_emerald_grad)"
    />

    <!-- 4. Inner Tentacles ('U' shape) -->
    <path
      d="M14.2 15.2 C13 16.8 12.5 19.5 12.5 22.5 C12.5 25.8 14.2 27.5 16 27.5 C17.8 27.5 19.5 25.8 19.5 22.5 C19.5 19.5 19 16.8 17.8 15.2 C16.9 15.8 15.1 15.8 14.2 15.2 Z"
      fill="url(#ursella_emerald_grad)"
    />

    <!-- 5. Central Apex Core Diamond -->
    <path
      d="M16 7.5 L18.4 9.9 L16 12.3 L13.6 9.9 Z"
      fill="url(#ursella_emerald_core_grad)"
    />

    <!-- 6. Micro-Focal Point -->
    <circle cx="16" cy="9.9" r="0.75" fill="#FFFFFF" opacity="0.95" />
  </g>
</svg>`;
}

async function generateIcons() {
  const publicDir = path.resolve(process.cwd(), 'public');

  const standardSvg = Buffer.from(createIconSvg(1.0));
  const maskableSvg = Buffer.from(createIconSvg(0.78)); // 78% size so it sits firmly inside Android circular/squircle mask safe zone

  // 1. Standard 192x192
  await sharp(standardSvg)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  // 2. Maskable 192x192
  await sharp(maskableSvg)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-192x192.png'));
  console.log('Generated pwa-maskable-192x192.png');

  // 3. Standard 512x512
  await sharp(standardSvg)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  // 4. Maskable 512x512
  await sharp(maskableSvg)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png');

  // 5. Apple Touch Icon (180x180)
  await sharp(standardSvg)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
