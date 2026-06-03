// Generates public/og-image.png via puppeteer (headless Chromium).
const puppeteer = require('puppeteer')
const path = require('path')

const W = 1200
const H = 630

const html = /* html */`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  * { margin:0; padding:0; box-sizing:border-box; }

  body {
    width: ${W}px; height: ${H}px; overflow: hidden;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
    background: linear-gradient(135deg, #2DBF8A 0%, #1A9E72 50%, #1A7A59 100%);
    display: flex;
    align-items: center;
    position: relative;
  }

  /* ── Diagonal stripe pattern overlay ── */
  body::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 22px,
      rgba(0,0,0,0.09) 22px,
      rgba(0,0,0,0.09) 26px
    );
    pointer-events: none;
    z-index: 0;
  }

  /* ── Decorative rings ── */
  .ring {
    position: absolute;
    border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,0.13);
    pointer-events: none;
  }

  /* ── Left content ── */
  .left {
    flex: 1;
    padding: 64px 56px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
    z-index: 1;
  }

  .logo {
    font-size: 108px;
    font-weight: 900;
    color: #fff;
    letter-spacing: -5px;
    line-height: 0.95;
    margin-bottom: 22px;
    text-shadow: 0 4px 32px rgba(0,0,0,0.18);
  }

  .tagline {
    font-size: 27px;
    font-weight: 500;
    color: rgba(255,255,255,0.88);
    line-height: 1.45;
    margin-bottom: 44px;
    max-width: 420px;
  }

  .pills {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: 100px;
    background: rgba(255,255,255,0.16);
    border: 1px solid rgba(255,255,255,0.30);
    color: #fff;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: 0.01em;
    backdrop-filter: blur(4px);
  }

  /* ── Right: phone mockup ── */
  .right {
    width: 360px;
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    padding-right: 54px;
    position: relative;
    z-index: 1;
  }

  .phone {
    width: 242px;
    height: 490px;
    background: #F0FAF6;
    border-radius: 46px;
    border: 2px solid rgba(255,255,255,0.55);
    box-shadow:
      0 0 0 6px rgba(255,255,255,0.18),
      inset 0 1px 0 rgba(255,255,255,0.8);
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Dynamic island */
  .island {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    width: 88px;
    height: 28px;
    background: #111827;
    border-radius: 20px;
    z-index: 10;
  }

  .screen {
    flex: 1;
    padding: 52px 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: hidden;
    background: #F0FAF6;
  }

  /* Phone header */
  .ph-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2px;
  }
  .ph-logo  { font-size: 12px; font-weight: 800; color: #1A7A59; }
  .ph-chip  {
    font-size: 8px; font-weight: 700;
    background: rgba(45,191,138,0.18); color: #1A7A59;
    padding: 2px 7px; border-radius: 100px;
  }

  /* Gauge card */
  .gauge-card {
    background: #ffffff;
    border-radius: 18px;
    padding: 14px 14px 12px;
    border: 1px solid #C8EAD9;
  }
  .gc-label {
    font-size: 8px; font-weight: 700;
    color: #6b7280; text-transform: uppercase;
    letter-spacing: 0.07em; margin-bottom: 10px;
  }
  .gc-gauge { display: flex; justify-content: center; margin-bottom: 10px; }
  .gc-row {
    display: flex;
    justify-content: space-between;
    font-size: 8.5px; color: #6b7280;
  }
  .gc-row b { color: #111827; font-weight: 700; }

  /* Trip cards */
  .trip {
    background: #ffffff;
    border-radius: 13px;
    padding: 9px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #C8EAD9;
  }
  .trip-flag  { font-size: 18px; line-height: 1; }
  .trip-info  { flex: 1; min-width: 0; }
  .trip-name  { font-size: 10px; font-weight: 700; color: #111827; }
  .trip-dates { font-size: 8px; color: #9ca3af; margin-top: 1px; }
  .trip-badge {
    font-size: 8.5px; font-weight: 700; color: #1A7A59;
    background: rgba(45,191,138,0.15);
    padding: 2px 7px; border-radius: 100px;
    white-space: nowrap;
  }

  /* Reset card */
  .reset-card {
    background: rgba(45,191,138,0.1);
    border-radius: 12px;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid rgba(45,191,138,0.3);
  }
  .rc-label { font-size: 8px; color: #1A7A59; font-weight: 600; }
  .rc-date  { font-size: 8px; color: #2DBF8A; font-weight: 600; }
</style>
</head>
<body>

  <!-- Decorative rings -->
  <div class="ring" style="width:560px;height:560px;top:-240px;right:-80px;"></div>
  <div class="ring" style="width:360px;height:360px;bottom:-180px;right:60px;"></div>
  <div class="ring" style="width:220px;height:220px;top:60px;left:-90px;opacity:0.5"></div>

  <!-- Left -->
  <div class="left">
    <div class="logo">Visato</div>
    <div class="tagline">Track your Schengen days.<br>Travel freely.</div>
    <div class="pills">
      <div class="pill">✦ Free</div>
      <div class="pill">196 countries</div>
      <div class="pill">EN / UK / RU</div>
    </div>
  </div>

  <!-- Right: phone -->
  <div class="right">
    <div class="phone">
      <div class="island"></div>
      <div class="screen">

        <!-- Header -->
        <div class="ph-header">
          <span class="ph-logo">🌍 Visato</span>
          <span class="ph-chip">90 / 180</span>
        </div>

        <!-- Gauge -->
        <div class="gauge-card">
          <div class="gc-label">Schengen</div>
          <div class="gc-gauge">
            <svg width="96" height="96" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" fill="none"
                stroke="#C8EAD9" stroke-width="9"/>
              <circle cx="50" cy="50" r="38" fill="none"
                stroke="#2DBF8A" stroke-width="9"
                stroke-linecap="round"
                stroke-dasharray="238.76"
                stroke-dashoffset="62"
                transform="rotate(-90 50 50)"/>
              <text x="50" y="44" text-anchor="middle"
                font-size="23" font-weight="800" fill="#1A7A59"
                font-family="Inter,-apple-system,sans-serif">67</text>
              <text x="50" y="57" text-anchor="middle"
                font-size="8" fill="#6b7280"
                font-family="Inter,-apple-system,sans-serif">days left</text>
              <text x="50" y="67" text-anchor="middle"
                font-size="7" fill="#9ca3af"
                font-family="Inter,-apple-system,sans-serif">out of 90</text>
            </svg>
          </div>
          <div class="gc-row">
            <span>Used <b>23d</b></span>
            <span>Safe until <b>Jul 14</b></span>
          </div>
        </div>

        <!-- Trips -->
        <div class="trip">
          <span class="trip-flag">🇫🇷</span>
          <div class="trip-info">
            <div class="trip-name">France</div>
            <div class="trip-dates">Mar 5 – Mar 19</div>
          </div>
          <span class="trip-badge">15d</span>
        </div>

        <div class="trip">
          <span class="trip-flag">🇩🇪</span>
          <div class="trip-info">
            <div class="trip-name">Germany</div>
            <div class="trip-dates">May 1 – May 8</div>
          </div>
          <span class="trip-badge">8d</span>
        </div>

        <!-- Reset hint -->
        <div class="reset-card">
          <span class="rc-label">↑ +15d releases</span>
          <span class="rc-date">Sep 5</span>
        </div>

      </div>
    </div>
  </div>

</body>
</html>`

;(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 })
  await page.setContent(html, { waitUntil: 'networkidle0' })

  // Wait for Google Fonts to load (fallback to system fonts after 3s)
  await page.evaluate(() => document.fonts.ready)

  const outPath = path.resolve(__dirname, '../public/og-image.png')
  await page.screenshot({ path: outPath, type: 'png', clip: { x: 0, y: 0, width: W, height: H } })
  await browser.close()
  console.log('Saved', outPath)
})()
