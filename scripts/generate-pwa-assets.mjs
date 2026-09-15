import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

async function generatePwaAssets() {
  console.log('Generating PWA Splash and Screenshot assets...');

  // 1. Apple Splash Portrait (1170 x 2532)
  const splashWidth = 1170;
  const splashHeight = 2532;
  const splashSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${splashWidth}" height="${splashHeight}" viewBox="0 0 ${splashWidth} ${splashHeight}">
      <defs>
        <radialGradient id="bgGlow" cx="50%" cy="46%" r="40%">
          <stop offset="0%" stop-color="#10B981" stop-opacity="0.12" />
          <stop offset="60%" stop-color="#059669" stop-opacity="0.04" />
          <stop offset="100%" stop-color="#090D16" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="markPri" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#34D399" />
          <stop offset="35%" stop-color="#10B981" />
          <stop offset="100%" stop-color="#059669" />
        </linearGradient>
        <linearGradient id="markFacet" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#059669" />
          <stop offset="50%" stop-color="#10B981" />
          <stop offset="100%" stop-color="#6EE7B7" />
        </linearGradient>
        <linearGradient id="markGem" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ECFDF5" />
          <stop offset="50%" stop-color="#6EE7B7" />
          <stop offset="100%" stop-color="#10B981" />
        </linearGradient>
      </defs>

      <!-- Background Canvas -->
      <rect width="${splashWidth}" height="${splashHeight}" fill="#090D16" />
      <circle cx="585" cy="1160" r="500" fill="url(#bgGlow)" />

      <!-- Center Brand Mark -->
      <g transform="translate(485, 1020) scale(6.25)">
        <!-- U Foundation -->
        <path
          d="M 5.5 6 C 5.5 4.9 6.4 4 7.5 4 H 11.5 V 17 C 11.5 19.485 13.515 21.5 16 21.5 C 18.485 21.5 20.5 19.485 20.5 17 V 10 L 26.5 4 V 17 C 26.5 22.799 21.799 27.5 16 27.5 C 10.201 27.5 5.5 22.799 5.5 17 Z"
          fill="url(#markPri)"
        />
        <!-- Growth Facet -->
        <path
          d="M 20.5 10 L 26.5 4 V 10 L 20.5 16 Z"
          fill="url(#markFacet)"
          opacity="0.95"
        />
        <!-- Keystone Diamond -->
        <path
          d="M 16 6.2 L 19 10.5 L 16 14.8 L 13 10.5 Z"
          fill="url(#markGem)"
        />
      </g>

      <!-- Brand Wordmark & Tagline -->
      <text x="585" y="1300" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" font-weight="800" fill="#FFFFFF" text-anchor="middle" letter-spacing="-1">Ursella</text>
      <text x="585" y="1345" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="19" font-weight="600" fill="#10B981" text-anchor="middle" letter-spacing="4">BUSINESS OPERATING INTELLIGENCE</text>

      <!-- Bottom System Status -->
      <text x="585" y="2400" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="500" fill="#52525B" text-anchor="middle" letter-spacing="1">OFFLINE-FIRST COMMERCE OS</text>
    </svg>
  `;

  await sharp(Buffer.from(splashSvg))
    .png({ quality: 90, compressionLevel: 8 })
    .toFile(path.join(publicDir, 'apple-splash-portrait.png'));
  console.log('✓ Created apple-splash-portrait.png');

  // 2. Desktop Manifest Screenshot (1280 x 720)
  const dtWidth = 1280;
  const dtHeight = 720;
  const dtSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${dtWidth}" height="${dtHeight}" viewBox="0 0 ${dtWidth} ${dtHeight}">
      <defs>
        <linearGradient id="dtBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#090D16" />
          <stop offset="100%" stop-color="#0F172A" />
        </linearGradient>
        <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#10B981" />
          <stop offset="100%" stop-color="#047857" />
        </linearGradient>
        <linearGradient id="markPri" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#34D399" />
          <stop offset="35%" stop-color="#10B981" />
          <stop offset="100%" stop-color="#059669" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${dtWidth}" height="${dtHeight}" fill="url(#dtBg)" />

      <!-- Left Sidebar -->
      <rect x="0" y="0" width="220" height="${dtHeight}" fill="#0A0E17" stroke="#1E293B" stroke-width="1" />
      
      <!-- Sidebar Brand -->
      <circle cx="36" cy="36" r="14" fill="#10B981" fill-opacity="0.15" />
      <g transform="translate(24, 24) scale(0.75)">
        <path d="M 5.5 6 C 5.5 4.9 6.4 4 7.5 4 H 11.5 V 17 C 11.5 19.485 13.515 21.5 16 21.5 C 18.485 21.5 20.5 19.485 20.5 17 V 10 L 26.5 4 V 17 C 26.5 22.799 21.799 27.5 16 27.5 C 10.201 27.5 5.5 22.799 5.5 17 Z" fill="url(#markPri)" />
      </g>
      <text x="56" y="41" font-family="sans-serif" font-size="16" font-weight="bold" fill="#FFFFFF">Ursella</text>
      <rect x="115" y="29" width="36" height="16" rx="4" fill="#10B981" fill-opacity="0.2" />
      <text x="133" y="40" font-family="sans-serif" font-size="9" font-weight="bold" fill="#34D399" text-anchor="middle">PRO</text>

      <!-- Sidebar Items -->
      <rect x="12" y="80" width="196" height="34" rx="8" fill="#10B981" fill-opacity="0.15" />
      <text x="36" y="102" font-family="sans-serif" font-size="13" font-weight="600" fill="#34D399">Point of Sale (POS)</text>

      <text x="36" y="142" font-family="sans-serif" font-size="13" font-weight="500" fill="#94A3B8">Inventory &amp; Stock</text>
      <text x="36" y="178" font-family="sans-serif" font-size="13" font-weight="500" fill="#94A3B8">AI Advisor</text>
      <text x="36" y="214" font-family="sans-serif" font-size="13" font-weight="500" fill="#94A3B8">Financial Analytics</text>
      <text x="36" y="250" font-family="sans-serif" font-size="13" font-weight="500" fill="#94A3B8">Customers &amp; Debt</text>
      <text x="36" y="286" font-family="sans-serif" font-size="13" font-weight="500" fill="#94A3B8">Expenses</text>
      <text x="36" y="322" font-family="sans-serif" font-size="13" font-weight="500" fill="#94A3B8">End-of-Day Z-Report</text>

      <!-- Top Header -->
      <rect x="220" y="0" width="${dtWidth - 220}" height="56" fill="#090D16" fill-opacity="0.7" stroke="#1E293B" stroke-width="1" />
      <text x="250" y="34" font-family="sans-serif" font-size="15" font-weight="700" fill="#F8FAFC">Main Store Register #01</text>
      <circle cx="1060" cy="28" r="4" fill="#10B981" />
      <text x="1072" y="32" font-family="sans-serif" font-size="11" font-weight="600" fill="#10B981">Offline Ready • Synchronized</text>

      <!-- Main Workspace: POS Register & Metrics -->
      <rect x="240" y="80" width="310" height="110" rx="12" fill="#0F172A" stroke="#1E293B" stroke-width="1" />
      <text x="260" y="112" font-family="sans-serif" font-size="12" font-weight="600" fill="#94A3B8">TODAY'S REVENUE</text>
      <text x="260" y="152" font-family="sans-serif" font-size="28" font-weight="800" fill="#FFFFFF">$4,850.00</text>
      <text x="440" y="150" font-family="sans-serif" font-size="12" font-weight="bold" fill="#10B981">+18.4%</text>

      <rect x="570" y="80" width="310" height="110" rx="12" fill="#0F172A" stroke="#1E293B" stroke-width="1" />
      <text x="590" y="112" font-family="sans-serif" font-size="12" font-weight="600" fill="#94A3B8">COMPLETED SALES</text>
      <text x="590" y="152" font-family="sans-serif" font-size="28" font-weight="800" fill="#FFFFFF">142 Orders</text>
      <text x="770" y="150" font-family="sans-serif" font-size="12" font-weight="bold" fill="#10B981">Live FIFO</text>

      <rect x="900" y="80" width="350" height="110" rx="12" fill="#0F172A" stroke="#1E293B" stroke-width="1" />
      <text x="920" y="112" font-family="sans-serif" font-size="12" font-weight="600" fill="#94A3B8">AI ADVISOR BRIEF</text>
      <text x="920" y="138" font-family="sans-serif" font-size="13" font-weight="600" fill="#E2E8F0">Restock Premium Espresso beans.</text>
      <text x="920" y="158" font-family="sans-serif" font-size="11" font-weight="500" fill="#10B981">Estimated stockout in 1.4 days</text>

      <!-- Cart & Catalog Grid -->
      <rect x="240" y="210" width="640" height="480" rx="12" fill="#0F172A" stroke="#1E293B" stroke-width="1" />
      <text x="260" y="244" font-family="sans-serif" font-size="14" font-weight="700" fill="#FFFFFF">Fast Item Catalog</text>
      
      <!-- Catalog Grid Items -->
      <rect x="260" y="266" width="180" height="90" rx="8" fill="#1E293B" />
      <text x="276" y="300" font-family="sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">Espresso Blend</text>
      <text x="276" y="322" font-family="sans-serif" font-size="12" font-weight="600" fill="#10B981">$18.50</text>

      <rect x="460" y="266" width="180" height="90" rx="8" fill="#1E293B" />
      <text x="476" y="300" font-family="sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">Artisan Roast 1kg</text>
      <text x="476" y="322" font-family="sans-serif" font-size="12" font-weight="600" fill="#10B981">$34.00</text>

      <rect x="660" y="266" width="200" height="90" rx="8" fill="#1E293B" />
      <text x="676" y="300" font-family="sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">Cold Brew Nitro</text>
      <text x="676" y="322" font-family="sans-serif" font-size="12" font-weight="600" fill="#10B981">$6.50</text>

      <!-- Right Active Register Checkout Cart -->
      <rect x="900" y="210" width="350" height="480" rx="12" fill="#0F172A" stroke="#1E293B" stroke-width="1" />
      <text x="924" y="244" font-family="sans-serif" font-size="15" font-weight="700" fill="#FFFFFF">Current Ticket #084</text>

      <line x1="924" y1="265" x2="1226" y2="265" stroke="#334155" stroke-width="1" />
      <text x="924" y="300" font-family="sans-serif" font-size="13" fill="#E2E8F0">1x Espresso Blend</text>
      <text x="1226" y="300" font-family="sans-serif" font-size="13" font-weight="600" fill="#FFFFFF" text-anchor="end">$18.50</text>
      <text x="924" y="336" font-family="sans-serif" font-size="13" fill="#E2E8F0">2x Cold Brew Nitro</text>
      <text x="1226" y="336" font-family="sans-serif" font-size="13" font-weight="600" fill="#FFFFFF" text-anchor="end">$13.00</text>

      <line x1="924" y1="520" x2="1226" y2="520" stroke="#334155" stroke-width="1" />
      <text x="924" y="555" font-family="sans-serif" font-size="13" fill="#94A3B8">Subtotal</text>
      <text x="1226" y="555" font-family="sans-serif" font-size="13" fill="#E2E8F0" text-anchor="end">$31.50</text>
      <text x="924" y="585" font-family="sans-serif" font-size="18" font-weight="800" fill="#FFFFFF">Total Due</text>
      <text x="1226" y="585" font-family="sans-serif" font-size="20" font-weight="800" fill="#10B981" text-anchor="end">$31.50</text>

      <rect x="924" y="615" width="302" height="50" rx="10" fill="#10B981" />
      <text x="1075" y="646" font-family="sans-serif" font-size="15" font-weight="700" fill="#FFFFFF" text-anchor="middle">Charge $31.50 (Cash/Card)</text>
    </svg>
  `;

  await sharp(Buffer.from(dtSvg))
    .png({ quality: 90 })
    .toFile(path.join(publicDir, 'screenshot-desktop.png'));
  console.log('✓ Created screenshot-desktop.png');

  // 3. Mobile Manifest Screenshot (720 x 1280)
  const mbWidth = 720;
  const mbHeight = 1280;
  const mbSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${mbWidth}" height="${mbHeight}" viewBox="0 0 ${mbWidth} ${mbHeight}">
      <defs>
        <linearGradient id="mbBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#090D16" />
          <stop offset="100%" stop-color="#0F172A" />
        </linearGradient>
        <linearGradient id="markPri" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#34D399" />
          <stop offset="35%" stop-color="#10B981" />
          <stop offset="100%" stop-color="#059669" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${mbWidth}" height="${mbHeight}" fill="url(#mbBg)" />

      <!-- Top Header -->
      <rect x="0" y="0" width="${mbWidth}" height="80" fill="#090D16" stroke="#1E293B" stroke-width="1" />
      
      <!-- Brand & Title -->
      <g transform="translate(30, 24) scale(0.9)">
        <path d="M 5.5 6 C 5.5 4.9 6.4 4 7.5 4 H 11.5 V 17 C 11.5 19.485 13.515 21.5 16 21.5 C 18.485 21.5 20.5 19.485 20.5 17 V 10 L 26.5 4 V 17 C 26.5 22.799 21.799 27.5 16 27.5 C 10.201 27.5 5.5 22.799 5.5 17 Z" fill="url(#markPri)" />
      </g>
      <text x="68" y="47" font-family="sans-serif" font-size="20" font-weight="800" fill="#FFFFFF">Ursella</text>
      <rect x="150" y="32" width="46" height="20" rx="5" fill="#10B981" fill-opacity="0.2" />
      <text x="173" y="46" font-family="sans-serif" font-size="11" font-weight="bold" fill="#34D399" text-anchor="middle">BETA</text>

      <rect x="520" y="26" width="170" height="32" rx="16" fill="#10B981" fill-opacity="0.15" stroke="#10B981" stroke-opacity="0.3" />
      <circle cx="538" cy="42" r="4" fill="#10B981" />
      <text x="550" y="47" font-family="sans-serif" font-size="12" font-weight="bold" fill="#34D399">Offline Sync Ready</text>

      <!-- Key Metrics Card -->
      <rect x="30" y="105" width="660" height="140" rx="16" fill="#0F172A" stroke="#1E293B" stroke-width="1" />
      <text x="60" y="145" font-family="sans-serif" font-size="13" font-weight="600" fill="#94A3B8">TODAY'S REVENUE</text>
      <text x="60" y="195" font-family="sans-serif" font-size="36" font-weight="900" fill="#FFFFFF">$4,850.00</text>
      <text x="600" y="190" font-family="sans-serif" font-size="15" font-weight="bold" fill="#10B981" text-anchor="end">+18.4% vs yday</text>

      <!-- AI Advisor Banner -->
      <rect x="30" y="265" width="660" height="120" rx="16" fill="#064E3B" fill-opacity="0.3" stroke="#059669" stroke-opacity="0.5" stroke-width="1" />
      <text x="60" y="305" font-family="sans-serif" font-size="14" font-weight="bold" fill="#34D399">AI Proactive Insight</text>
      <text x="60" y="340" font-family="sans-serif" font-size="15" font-weight="500" fill="#ECFDF5">Coffee beans demand surge predicted for weekend peak.</text>
      <text x="60" y="365" font-family="sans-serif" font-size="12" font-weight="500" fill="#6EE7B7">Recommended action: Prepare 3 additional batch grinds.</text>

      <!-- Quick Action POS Grid -->
      <text x="30" y="425" font-family="sans-serif" font-size="18" font-weight="800" fill="#FFFFFF">POS Quick Register</text>

      <rect x="30" y="445" width="315" height="110" rx="14" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="50" y="485" font-family="sans-serif" font-size="16" font-weight="bold" fill="#FFFFFF">Espresso Blend</text>
      <text x="50" y="525" font-family="sans-serif" font-size="18" font-weight="800" fill="#10B981">$18.50</text>

      <rect x="375" y="445" width="315" height="110" rx="14" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="395" y="485" font-family="sans-serif" font-size="16" font-weight="bold" fill="#FFFFFF">Artisan Roast</text>
      <text x="395" y="525" font-family="sans-serif" font-size="18" font-weight="800" fill="#10B981">$34.00</text>

      <rect x="30" y="575" width="315" height="110" rx="14" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="50" y="615" font-family="sans-serif" font-size="16" font-weight="bold" fill="#FFFFFF">Cold Brew Nitro</text>
      <text x="50" y="655" font-family="sans-serif" font-size="18" font-weight="800" fill="#10B981">$6.50</text>

      <rect x="375" y="575" width="315" height="110" rx="14" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="395" y="615" font-family="sans-serif" font-size="16" font-weight="bold" fill="#FFFFFF">Oat Latte</text>
      <text x="395" y="655" font-family="sans-serif" font-size="18" font-weight="800" fill="#10B981">$5.75</text>

      <!-- Current Ticket Card -->
      <rect x="30" y="720" width="660" height="380" rx="16" fill="#0F172A" stroke="#1E293B" stroke-width="1" />
      <text x="60" y="765" font-family="sans-serif" font-size="16" font-weight="bold" fill="#FFFFFF">Current Ticket (2 items)</text>
      <text x="60" y="810" font-family="sans-serif" font-size="14" fill="#CBD5E1">1x Espresso Blend</text>
      <text x="660" y="810" font-family="sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF" text-anchor="end">$18.50</text>
      <text x="60" y="850" font-family="sans-serif" font-size="14" fill="#CBD5E1">2x Cold Brew Nitro</text>
      <text x="660" y="850" font-family="sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF" text-anchor="end">$13.00</text>
      <line x1="60" y1="880" x2="660" y2="880" stroke="#334155" />
      <text x="60" y="930" font-family="sans-serif" font-size="20" font-weight="900" fill="#FFFFFF">Total</text>
      <text x="660" y="930" font-family="sans-serif" font-size="24" font-weight="900" fill="#10B981" text-anchor="end">$31.50</text>

      <rect x="60" y="970" width="600" height="64" rx="14" fill="#10B981" />
      <text x="360" y="1010" font-family="sans-serif" font-size="18" font-weight="bold" fill="#FFFFFF" text-anchor="middle">Complete Sale ($31.50)</text>

      <!-- Bottom Nav Bar -->
      <rect x="0" y="1180" width="${mbWidth}" height="100" fill="#090D16" stroke="#1E293B" stroke-width="1" />
      <circle cx="90" cy="1225" r="5" fill="#10B981" />
      <text x="90" y="1245" font-family="sans-serif" font-size="11" font-weight="bold" fill="#10B981" text-anchor="middle">Sell</text>
      <text x="225" y="1245" font-family="sans-serif" font-size="11" fill="#64748B" text-anchor="middle">Stock</text>
      <text x="360" y="1245" font-family="sans-serif" font-size="11" fill="#64748B" text-anchor="middle">AI</text>
      <text x="495" y="1245" font-family="sans-serif" font-size="11" fill="#64748B" text-anchor="middle">Analytics</text>
      <text x="630" y="1245" font-family="sans-serif" font-size="11" fill="#64748B" text-anchor="middle">More</text>
    </svg>
  `;

  await sharp(Buffer.from(mbSvg))
    .png({ quality: 90 })
    .toFile(path.join(publicDir, 'screenshot-mobile.png'));
  console.log('✓ Created screenshot-mobile.png');

  console.log('PWA splash and screenshot generation completed successfully.');
}

generatePwaAssets().catch((err) => {
  console.error('PWA asset generation failed:', err);
  process.exit(1);
});
