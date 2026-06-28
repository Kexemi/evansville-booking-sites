const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const repo = 'C:/Users/receg/AI-OS/Repos/Local-Business/evansville-booking-sites';
const outDir = path.join(repo, 'artifacts', 'store-ready-20260628', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const pages = [
  ['storefront', 'file:///' + repo.replace(/\\/g, '/') + '/index.html'],
  ['ai-menu', 'file:///' + repo.replace(/\\/g, '/') + '/ai-integration-menu.html'],
  ['pricing', 'file:///' + repo.replace(/\\/g, '/') + '/pricing-offer-sheet.html'],
  ['faq', 'file:///' + repo.replace(/\\/g, '/') + '/buyer-faq.html'],
  ['scripts', 'file:///' + repo.replace(/\\/g, '/') + '/sales-scripts.html'],
  ['link-pack', 'file:///' + repo.replace(/\\/g, '/') + '/link-pack.html'],
  ['schiff-demo', 'file:///' + repo.replace(/\\/g, '/') + '/apps/schiff-air-conditioning-heating-inc-booking.html'],
  ['gary-demo', 'file:///' + repo.replace(/\\/g, '/') + '/apps/gary-s-plumbing-service-inc-booking.html'],
  ['completely-demo', 'file:///' + repo.replace(/\\/g, '/') + '/apps/completely-wired-booking.html']
];

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  const manifest = [];
  for (const [name, url] of pages) {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const title = await page.title();
    const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const out = path.join(outDir, name + '.png');
    await page.screenshot({ path: out, fullPage: true });
    manifest.push({ name, url, title, screenshot: out, text_sample: bodyText.slice(0, 300) });
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ captured: manifest.length, outDir }, null, 2));
})();
