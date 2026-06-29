#!/usr/bin/env node
/**
 * Visual scenario matrix for Local Business App Factory.
 *
 * This is a real-browser harness: it enumerates and can capture the customer-visible
 * states that source greps miss — viewport breakpoints, booking success, admin
 * states, compare tool states, and buyer-facing store pages.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const APPS_DIR = path.join(ROOT, 'apps');
const DEFAULT_RUN_ID = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

const VIEWPORTS = [
  { name: 'phone-narrow', width: 360, height: 740, deviceScaleFactor: 1, isMobile: true },
  { name: 'phone-standard', width: 390, height: 844, deviceScaleFactor: 1, isMobile: true },
  { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 1, isMobile: false },
  { name: 'laptop', width: 1366, height: 900, deviceScaleFactor: 1, isMobile: false },
  { name: 'desktop', width: 1440, height: 1100, deviceScaleFactor: 1, isMobile: false },
];

const SAMPLE_SLUGS = [
  'schiff-air-conditioning-heating-inc',
  'gary-s-plumbing-service-inc',
  'completely-wired',
];

const APP_CORE_STATES = [
  {
    state: 'app-top',
    label: 'Booking app first fold / hero',
    assertions: ['no-horizontal-overflow', 'css-loaded', 'hero-visible', 'primary-cta-visible', 'sticky-cta-on-mobile'],
  },
  {
    state: 'app-booking-form',
    label: 'Booking form before submit',
    hash: '#booking',
    assertions: ['no-horizontal-overflow', 'booking-form-visible', 'required-fields-visible', 'submit-visible'],
  },
  {
    state: 'app-booking-success',
    label: 'Booking success after a real form submit',
    hash: '#booking',
    setup: 'submit-booking',
    assertions: ['no-horizontal-overflow', 'booking-success-visible', 'booking-persisted', 'copy-button-visible'],
  },
];

const ADMIN_INTERACTIVE_STATES = [
  {
    state: 'app-admin-empty',
    label: 'Business owner admin dashboard with no bookings',
    query: '?admin=1',
    hash: '#admin',
    setup: 'admin-empty',
    assertions: ['no-horizontal-overflow', 'admin-visible', 'admin-empty-visible', 'admin-table-contained'],
  },
  {
    state: 'app-admin-with-booking',
    label: 'Business owner admin dashboard with one booking',
    query: '?admin=1',
    hash: '#admin',
    setup: 'admin-with-booking',
    assertions: ['no-horizontal-overflow', 'admin-visible', 'admin-booking-visible', 'admin-table-contained'],
  },
];

const ADMIN_PREVIEW_STATE = {
  state: 'app-admin-preview',
  label: 'Legacy owner admin dashboard preview block',
  hash: '#admin-dashboard',
  setup: 'admin-preview',
  assertions: ['no-horizontal-overflow', 'admin-preview-visible'],
};

const STORE_PAGES = [
  { state: 'storefront', file: 'index.html', label: 'Buyer storefront', assertions: ['no-horizontal-overflow', 'css-loaded', 'primary-cta-visible'] },
  { state: 'ai-menu', file: 'ai-integration-menu.html', label: 'AI integration menu', assertions: ['no-horizontal-overflow', 'css-loaded', 'primary-cta-visible'] },
  { state: 'buyer-faq', file: 'buyer-faq.html', label: 'Buyer FAQ', assertions: ['no-horizontal-overflow', 'css-loaded', 'primary-cta-visible'] },
  { state: 'link-pack', file: 'link-pack.html', label: 'Demo link pack', assertions: ['no-horizontal-overflow', 'css-loaded', 'link-list-visible'] },
];

function parseArgs(argv) {
  const args = { scope: 'sample', json: false, list: false, dryRun: false, runId: DEFAULT_RUN_ID, limit: null, offset: 0, headed: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--scope') args.scope = argv[++i] || args.scope;
    else if (a === '--json') args.json = true;
    else if (a === '--list') args.list = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--run-id') args.runId = argv[++i] || args.runId;
    else if (a === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (a === '--offset') args.offset = parseInt(argv[++i], 10);
    else if (a === '--headed') args.headed = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!['sample', 'all'].includes(args.scope)) throw new Error('--scope must be sample or all');
  if (args.limit !== null && (!Number.isFinite(args.limit) || args.limit < 1)) throw new Error('--limit must be a positive integer');
  if (!Number.isFinite(args.offset) || args.offset < 0) throw new Error('--offset must be a non-negative integer');
  return args;
}

function fileUrl(filePath, query = '', hash = '') {
  const url = pathToFileURL(filePath).href;
  return `${url}${query || ''}${hash || ''}`;
}

function slugFromFile(filePath) {
  return path.basename(filePath).replace(/-booking\.html$/, '');
}

function appFiles(scope) {
  const all = fs.readdirSync(APPS_DIR)
    .filter((f) => f.endsWith('-booking.html'))
    .sort()
    .map((f) => path.join(APPS_DIR, f));
  if (scope === 'all') return all;
  const bySlug = new Map(all.map((p) => [slugFromFile(p), p]));
  return SAMPLE_SLUGS.map((s) => bySlug.get(s)).filter(Boolean);
}

function compareBusinessSlugs(compareFile) {
  if (!fs.existsSync(compareFile)) return [];
  const html = fs.readFileSync(compareFile, 'utf8');
  const match = html.match(/const BIZ = \{([\s\S]*?)\n\};/);
  if (!match) return [];
  return Array.from(new Set(Array.from(match[1].matchAll(/"([^"]+)"\s*:\s*\{/g)).map((m) => m[1]))).sort();
}

function scenarioScreenshotRel(s, runId) {
  const safeSlug = s.slug || s.state;
  return path.join('artifacts', 'visual-scenarios', runId, 'screenshots', `${safeSlug}__${s.state}__${s.viewport}.png`);
}

function appCapabilities(app) {
  const html = fs.readFileSync(app, 'utf8');
  return {
    hasInteractiveAdmin: /id=["']admin-pass["']/i.test(html) && /id=["']admin-content["']/i.test(html),
    hasAdminPreview: /id=["']admin-dashboard["']/i.test(html),
  };
}

function addStateScenarios(scenarios, app, slug, states, runId) {
  for (const vp of VIEWPORTS) {
    for (const st of states) {
      const s = {
        type: 'booking-app',
        slug,
        page: path.relative(ROOT, app).replace(/\\/g, '/'),
        state: st.state,
        label: st.label,
        viewport: vp.name,
        viewport_size: { width: vp.width, height: vp.height },
        url: fileUrl(app, st.query || '', st.hash || ''),
        setup: st.setup || null,
        assertions: st.assertions,
      };
      s.screenshot = scenarioScreenshotRel(s, runId).replace(/\\/g, '/');
      scenarios.push(s);
    }
  }
}

function buildScenarioBundle(scope, runId) {
  const scenarios = [];
  const capabilityGaps = [];
  for (const app of appFiles(scope)) {
    const slug = slugFromFile(app);
    const caps = appCapabilities(app);
    addStateScenarios(scenarios, app, slug, APP_CORE_STATES, runId);
    if (caps.hasInteractiveAdmin) {
      addStateScenarios(scenarios, app, slug, ADMIN_INTERACTIVE_STATES, runId);
    } else if (caps.hasAdminPreview) {
      addStateScenarios(scenarios, app, slug, [ADMIN_PREVIEW_STATE], runId);
      capabilityGaps.push({
        slug,
        capability: 'interactive-admin',
        severity: 'product-gap',
        detail: 'Page exposes only a legacy admin-dashboard preview block, not password-gated booking management states.',
      });
    } else {
      capabilityGaps.push({
        slug,
        capability: 'interactive-admin',
        severity: 'product-gap',
        detail: 'No discoverable admin dashboard markers found in this generated app.',
      });
    }
  }

  const compareFile = path.join(ROOT, 'compare.html');
  if (fs.existsSync(compareFile)) {
    const compareRegistry = new Set(compareBusinessSlugs(compareFile));
    const appSlugs = appFiles(scope).map(slugFromFile);
    const requestedCompareSlugs = scope === 'all'
      ? appSlugs
      : SAMPLE_SLUGS.filter((s) => fs.existsSync(path.join(APPS_DIR, `${s}-booking.html`)));
    const compareSlugs = requestedCompareSlugs.filter((slug) => compareRegistry.has(slug));
    for (const slug of requestedCompareSlugs.filter((s) => !compareRegistry.has(s))) {
      capabilityGaps.push({
        slug,
        capability: 'compare-tool',
        severity: 'product-gap',
        detail: 'compare.html BIZ registry has no entry for this generated app, so no side-by-side sales scenario is claimed for it.',
      });
    }
    for (const slug of compareSlugs) {
      for (const vp of VIEWPORTS.filter((v) => v.name === 'phone-narrow' || v.name === 'desktop')) {
        const state = vp.name === 'desktop' ? 'compare-desktop' : 'compare-mobile';
        const s = {
          type: 'compare-tool', slug, page: 'compare.html', state,
          label: `Compare tool ${vp.name}`,
          viewport: vp.name, viewport_size: { width: vp.width, height: vp.height },
          url: fileUrl(compareFile, `?biz=${encodeURIComponent(slug)}`, ''),
          setup: null,
          assertions: ['no-horizontal-overflow', 'compare-frames-visible', 'compare-loaded-business', 'compare-our-frame-matches-slug', 'device-controls-visible'],
        };
        s.screenshot = scenarioScreenshotRel(s, runId).replace(/\\/g, '/');
        scenarios.push(s);
      }
    }
  }

  for (const page of STORE_PAGES) {
    const p = path.join(ROOT, page.file);
    if (!fs.existsSync(p)) continue;
    for (const vp of VIEWPORTS) {
      const s = {
        type: 'buyer-store', slug: page.state, page: page.file, state: page.state,
        label: page.label,
        viewport: vp.name, viewport_size: { width: vp.width, height: vp.height },
        url: fileUrl(p), setup: null, assertions: page.assertions,
      };
      s.screenshot = scenarioScreenshotRel(s, runId).replace(/\\/g, '/');
      scenarios.push(s);
    }
  }
  return { scenarios, capabilityGaps };
}

function matrix(scope, runId) {
  const bundle = buildScenarioBundle(scope, runId);
  const scenarios = bundle.scenarios;
  return {
    schema_version: 'visual_scenario_matrix_v0.1',
    generated_at: new Date().toISOString(),
    repo: ROOT,
    scope,
    viewports: VIEWPORTS,
    app_count: appFiles(scope).length,
    scenario_count: scenarios.length,
    capability_gaps: bundle.capabilityGaps,
    scenarios,
  };
}

async function waitForPageReady(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function routeLocalPortfolioAssets(page) {
  await page.route('https://fonts.googleapis.com/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/css', body: '/* deterministic visual-test font fallback */' });
  });
  await page.route('https://fonts.gstatic.com/**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route('https://formsubmit.co/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, visualScenarioMock: true }) });
  });
  await page.route('https://kexemi.github.io/evansville-booking-sites/**', async (route) => {
    try {
      const requestUrl = new URL(route.request().url());
      const prefix = '/evansville-booking-sites/';
      const idx = requestUrl.pathname.indexOf(prefix);
      if (idx === -1) return route.continue();
      const rel = decodeURIComponent(requestUrl.pathname.slice(idx + prefix.length));
      const localPath = path.join(ROOT, rel || 'index.html');
      if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
        return route.fulfill({ path: localPath });
      }
    } catch (e) {
      // Fall through to the network when local routing cannot resolve safely.
    }
    return route.continue();
  });
}

async function setupScenario(page, s) {
  await page.evaluate(() => {
    try { localStorage.removeItem('bookings'); localStorage.removeItem('evb_bookings'); localStorage.removeItem('evb_reviews'); } catch (e) {}
  }).catch(() => {});

  if (s.setup === 'submit-booking') {
    await page.locator('#booking-form').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await fillBookingForm(page);
    await page.locator('#booking-form').evaluate((form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))).catch(async () => {
      await page.click('#submit-btn', { timeout: 3000 }).catch(() => {});
    });
    await page.waitForTimeout(500);
    await page.locator('#success-msg').scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  } else if (s.setup === 'admin-empty') {
    await openAdmin(page);
  } else if (s.setup === 'admin-with-booking') {
    await page.evaluate(() => {
      localStorage.setItem('bookings', JSON.stringify([{
        id: 1001,
        business: 'Scenario Test Business',
        customerName: 'Scenario Test Customer',
        phone: '(812) 555-0123',
        email: 'scenario@example.com',
        service: 'Scenario Visual QA',
        date: '2026-07-01',
        time: '10:30',
        notes: 'Stored booking inserted by visual scenario matrix',
        createdAt: '2026-06-29T17:00:00.000Z'
      }]));
    });
    await openAdmin(page);
  } else if (s.setup === 'admin-preview') {
    await page.locator('#admin-dashboard').scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  } else if (s.state === 'app-booking-form') {
    await page.locator('#booking-form').scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  }
}

async function fillBookingForm(page) {
  const selectors = [
    ['#customer-name', 'Scenario Test Customer'],
    ['#customer-phone', '(812) 555-0123'],
    ['#customer-email', 'scenario@example.com'],
    ['#notes', 'Scenario visual QA booking test.'],
  ];
  for (const [sel, val] of selectors) {
    if (await page.locator(sel).count()) await page.fill(sel, val).catch(() => {});
  }
  if (await page.locator('#service').count()) {
    await page.selectOption('#service', { index: 1 }).catch(() => {});
  }
  if (await page.locator('#date').count()) await page.fill('#date', '2026-07-01').catch(() => {});
  if (await page.locator('#time').count()) await page.fill('#time', '10:30').catch(() => {});
}

async function openAdmin(page) {
  await page.evaluate(() => {
    const admin = document.getElementById('admin');
    if (admin) admin.classList.remove('hidden');
  }).catch(() => {});
  await page.locator('#admin').scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  const password = await page.evaluate(() => {
    const phone = document.getElementById('business-phone')?.value || document.body.innerText.match(/\(\d{3}\)\s*\d{3}-\d{4}/)?.[0] || '';
    return phone.replace(/\D/g, '').slice(-6);
  }).catch(() => '');
  if (await page.locator('#admin-pass').count()) await page.fill('#admin-pass', password).catch(() => {});
  await page.evaluate(() => { if (typeof adminLogin === 'function') adminLogin(); }).catch(async () => {
    await page.getByText('Access Dashboard').click({ timeout: 3000 }).catch(() => {});
  });
  await page.waitForTimeout(300);
}

function isIgnorableConsoleEvent(event, scenario) {
  const text = event.text || '';
  const url = event.url || '';
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(url)) return true;
  if (/Failed to load resource: the server responded with a status of 429/i.test(text)) return true;
  if (scenario.type === 'compare-tool' && /Refused to display|X-Frame-Options|frame-ancestors|wp is not defined|jQuery is not defined|ERR_NAME_NOT_RESOLVED|Cannot read properties of null \(reading 'appendChild'\)/i.test(text)) return true;
  return false;
}

async function collectAssertions(page, s, consoleEvents, screenshotAbs) {
  const dom = await page.evaluate((scenario) => {
    const html = document.documentElement.outerHTML;
    const body = document.body;
    const doc = document.documentElement;
    const visible = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const cs = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    const text = body ? body.innerText : '';
    const sticky = document.querySelector('.sticky-cta');
    const stickyRect = sticky ? sticky.getBoundingClientRect() : null;
    const primaryCta = Array.from(document.querySelectorAll('a,button')).some((el) => /book|call|access|menu|demo|contact/i.test(el.innerText || el.textContent || '') && el.getBoundingClientRect().width > 0);
    const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => l.href || l.getAttribute('href'));
    const scripts = Array.from(document.querySelectorAll('script')).map((scr) => ({ src: scr.src || '', inlineLength: scr.src ? 0 : (scr.textContent || '').length }));
    return {
      title: document.title,
      textSample: text.slice(0, 800),
      scrollWidth: Math.max(doc.scrollWidth, body ? body.scrollWidth : 0),
      clientWidth: doc.clientWidth,
      bodyFontSize: parseFloat(window.getComputedStyle(body).fontSize || '0'),
      bodyFontFamily: window.getComputedStyle(body).fontFamily || '',
      bodyBg: window.getComputedStyle(body).backgroundColor || '',
      cssLinks,
      styleSheets: document.styleSheets.length,
      scriptCount: scripts.length,
      inlineScriptCount: scripts.filter((x) => x.inlineLength > 0).length,
      inlineScriptBytes: scripts.reduce((sum, x) => sum + x.inlineLength, 0),
      inlineHandlerCount: (html.match(/\son[a-z]+=/gi) || []).length,
      hasTailwindCdn: /cdn\.tailwindcss\.com/i.test(html),
      hasHero: visible('.hero') || visible('header') || /hero/i.test(html),
      hasStickyCta: visible('.sticky-cta'),
      stickyRect,
      hasPrimaryCta: primaryCta,
      hasBookingForm: visible('#booking-form'),
      hasRequiredBookingFields: Boolean(document.querySelector('#customer-name') && document.querySelector('#customer-phone') && document.querySelector('#service')),
      hasSubmitButton: Array.from(document.querySelectorAll('button,input[type="submit"]')).some((el) => /submit booking|confirm booking/i.test(el.innerText || el.value || el.textContent || '')),
      hasSuccess: visible('#success-msg') && /Booking Submitted/i.test(text),
      bookingsCount: (() => { try { return JSON.parse(localStorage.getItem('bookings') || '[]').length; } catch(e) { return -1; } })(),
      hasCopyButton: Array.from(document.querySelectorAll('button,a')).some((el) => /copy details/i.test(el.innerText || el.textContent || '')),
      hasAdmin: visible('#admin'),
      hasAdminContent: visible('#admin-content'),
      hasAdminPreview: visible('#admin-dashboard') && /Admin Dashboard|Owner preview/i.test(text),
      hasAdminEmpty: /No bookings yet/i.test(text),
      hasAdminBooking: /Scenario Test Customer/i.test(text),
      adminTableOverflow: (() => { const el = document.querySelector('.admin-table, table'); return el ? el.scrollWidth > (el.parentElement?.clientWidth || el.clientWidth) + 2 : false; })(),
      compareFrames: document.querySelectorAll('iframe').length,
      compareSelectedBiz: document.querySelector('#biz-select')?.value || '',
      compareBizInfoVisible: visible('#biz-info'),
      compareBizNameText: document.querySelector('#biz-name')?.textContent || '',
      compareOurFrameSrc: document.querySelector('#our-frame')?.getAttribute('src') || '',
      deviceControls: Array.from(document.querySelectorAll('.device-btn')).map((el) => el.dataset.label || el.textContent || '').join(' '),
      linkCount: document.querySelectorAll('a[href]').length,
      state: scenario.state,
    };
  }, s);

  const blockingConsoleErrors = consoleEvents.filter((e) => e.type === 'error' && !isIgnorableConsoleEvent(e, s));
  const ignoredConsoleErrors = consoleEvents.filter((e) => e.type === 'error' && isIgnorableConsoleEvent(e, s));

  const checks = [];
  const add = (name, passed, detail) => checks.push({ name, passed: Boolean(passed), detail });
  add('no-horizontal-overflow', dom.scrollWidth <= dom.clientWidth + 2, `${dom.scrollWidth}px scrollWidth vs ${dom.clientWidth}px clientWidth`);
  add('css-loaded', dom.styleSheets > 0 && !/Times New Roman/i.test(dom.bodyFontFamily), `${dom.styleSheets} stylesheets; font=${dom.bodyFontFamily}`);
  add('no-tailwind-cdn', !dom.hasTailwindCdn, dom.hasTailwindCdn ? 'Tailwind CDN present' : 'Tailwind CDN absent');
  add('body-font-readable', dom.bodyFontSize >= 14, `body font ${dom.bodyFontSize}px`);
  add('screenshot-written', fs.existsSync(screenshotAbs) && fs.statSync(screenshotAbs).size > 5000, fs.existsSync(screenshotAbs) ? `${fs.statSync(screenshotAbs).size} bytes` : 'missing');
  add('console-clean', blockingConsoleErrors.length === 0, blockingConsoleErrors.map((e) => e.text).slice(0, 5));

  if (s.assertions.includes('hero-visible')) add('hero-visible', dom.hasHero, 'hero/header visible');
  if (s.assertions.includes('primary-cta-visible')) add('primary-cta-visible', dom.hasPrimaryCta, 'visible CTA text detected');
  if (s.assertions.includes('sticky-cta-on-mobile') && s.viewport.startsWith('phone')) add('sticky-cta-on-mobile', dom.hasStickyCta, JSON.stringify(dom.stickyRect));
  if (s.assertions.includes('booking-form-visible')) add('booking-form-visible', dom.hasBookingForm, 'booking form visible');
  if (s.assertions.includes('required-fields-visible')) add('required-fields-visible', dom.hasRequiredBookingFields, 'customer-name + customer-phone + service controls exist');
  if (s.assertions.includes('submit-visible')) add('submit-visible', dom.hasSubmitButton, 'submit/confirm booking control exists');
  if (s.assertions.includes('booking-success-visible')) add('booking-success-visible', dom.hasSuccess, dom.textSample.slice(0, 300));
  if (s.assertions.includes('booking-persisted')) add('booking-persisted', dom.bookingsCount >= 1, `${dom.bookingsCount} bookings`);
  if (s.assertions.includes('copy-button-visible')) add('copy-button-visible', dom.hasCopyButton, 'copy details button');
  if (s.assertions.includes('admin-visible')) add('admin-visible', dom.hasAdmin && dom.hasAdminContent, `admin=${dom.hasAdmin} content=${dom.hasAdminContent}`);
  if (s.assertions.includes('admin-preview-visible')) add('admin-preview-visible', dom.hasAdminPreview, dom.textSample.slice(0, 300));
  if (s.assertions.includes('admin-empty-visible')) add('admin-empty-visible', dom.hasAdminEmpty, dom.textSample.slice(0, 300));
  if (s.assertions.includes('admin-booking-visible')) add('admin-booking-visible', dom.hasAdminBooking, dom.textSample.slice(0, 300));
  if (s.assertions.includes('admin-table-contained')) add('admin-table-contained', !dom.adminTableOverflow || s.viewport.startsWith('phone'), `admin table overflow=${dom.adminTableOverflow}`);
  if (s.assertions.includes('compare-frames-visible')) add('compare-frames-visible', dom.compareFrames >= 2, `${dom.compareFrames} iframes`);
  if (s.assertions.includes('compare-loaded-business')) add('compare-loaded-business', dom.compareBizInfoVisible && dom.compareSelectedBiz === s.slug, `selected=${dom.compareSelectedBiz}; infoVisible=${dom.compareBizInfoVisible}; name=${dom.compareBizNameText}`);
  if (s.assertions.includes('compare-our-frame-matches-slug')) add('compare-our-frame-matches-slug', dom.compareOurFrameSrc.includes(`${s.slug}-booking.html`), dom.compareOurFrameSrc);
  if (s.assertions.includes('device-controls-visible')) add('device-controls-visible', /desktop/i.test(dom.deviceControls) && /tablet/i.test(dom.deviceControls) && /mobile/i.test(dom.deviceControls), dom.deviceControls);
  if (s.assertions.includes('link-list-visible')) add('link-list-visible', dom.linkCount >= 3, `${dom.linkCount} links`);

  const risks = [];
  const remoteCss = dom.cssLinks.filter((href) => /^https?:/i.test(href));
  if (remoteCss.length) risks.push({ type: 'remote_css_dependency', detail: remoteCss });
  if (ignoredConsoleErrors.length) risks.push({ type: 'ignored_third_party_console_error', detail: ignoredConsoleErrors.map((e) => e.text).slice(0, 5) });
  if (dom.inlineScriptCount > 0) risks.push({ type: 'inline_script_framework_drift', detail: `${dom.inlineScriptCount} inline script(s), ${dom.inlineScriptBytes} bytes` });
  if (dom.inlineHandlerCount > 0) risks.push({ type: 'inline_event_handlers', detail: `${dom.inlineHandlerCount} inline on* handlers` });
  if (s.type === 'booking-app' && !dom.cssLinks.some((href) => /design\.css/i.test(href))) risks.push({ type: 'missing_design_css_link', detail: dom.cssLinks });

  const failed = checks.filter((c) => !c.passed);
  return {
    ...s,
    status: failed.length ? 'FAIL' : 'PASS',
    failed_checks: failed,
    checks,
    risks,
    dom,
    console_events: consoleEvents,
  };
}

async function runMatrix(args) {
  let m = matrix(args.scope, args.runId);
  if (args.offset || args.limit !== null) {
    const start = args.offset || 0;
    const end = args.limit === null ? undefined : start + args.limit;
    m.scenarios = m.scenarios.slice(start, end);
  }
  const outDir = path.join(ROOT, 'artifacts', 'visual-scenarios', args.runId);
  const screenshotDir = path.join(outDir, 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });

  if (args.dryRun) {
    const report = buildReport(m, [], args, 'DRY_RUN_PASS');
    writeReports(report, outDir);
    return report;
  }

  const { chromium } = require('playwright');
  const executablePath = fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : undefined;
  const browser = await chromium.launch({ headless: !args.headed, executablePath });
  const results = [];

  try {
    for (const s of m.scenarios) {
      const vp = VIEWPORTS.find((v) => v.name === s.viewport);
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile });
      const consoleEvents = [];
      page.on('console', (msg) => consoleEvents.push({ type: msg.type(), text: msg.text().slice(0, 500), url: msg.location().url || '' }));
      page.on('pageerror', (err) => consoleEvents.push({ type: 'error', text: err.message.slice(0, 500), url: '' }));
      page.on('dialog', async (dialog) => { await dialog.dismiss().catch(() => {}); });
      await routeLocalPortfolioAssets(page);
      const screenshotAbs = path.join(ROOT, s.screenshot);
      fs.mkdirSync(path.dirname(screenshotAbs), { recursive: true });
      try {
        await page.goto(s.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await waitForPageReady(page);
        await setupScenario(page, s);
        await page.screenshot({ path: screenshotAbs, fullPage: true });
        results.push(await collectAssertions(page, s, consoleEvents, screenshotAbs));
      } catch (err) {
        results.push({ ...s, status: 'ERROR', error: String(err.stack || err.message || err), failed_checks: [{ name: 'scenario-error', passed: false, detail: String(err.message || err) }], checks: [], risks: [], console_events: consoleEvents });
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => r.status !== 'PASS');
  const verdict = failed.length ? 'VISUAL_SCENARIO_FAIL' : 'VISUAL_SCENARIO_PASS';
  const report = buildReport(m, results, args, verdict);
  writeReports(report, outDir);
  return report;
}

function buildReport(m, results, args, verdict) {
  const riskCounts = {};
  for (const r of results) {
    for (const risk of r.risks || []) riskCounts[risk.type] = (riskCounts[risk.type] || 0) + 1;
  }
  return {
    schema_version: 'visual_scenario_report_v0.1',
    generated_at: new Date().toISOString(),
    repo: ROOT,
    scope: args.scope,
    run_id: args.runId,
    verdict,
    scenario_count: m.scenarios.length,
    passed_count: results.filter((r) => r.status === 'PASS').length,
    failed_count: results.filter((r) => r.status !== 'PASS').length,
    app_count: m.app_count,
    viewports: VIEWPORTS.map((v) => v.name),
    capability_gaps: m.capability_gaps || [],
    semantic_review_note: 'This harness proves browser/pixel/layout and interaction-state assertions. It does not replace human/vision taste review for whether the page feels premium.',
    risk_counts: riskCounts,
    failures: results.filter((r) => r.status !== 'PASS').map((r) => ({ scenario: `${r.slug || r.page} ${r.state} ${r.viewport}`, screenshot: r.screenshot, failed_checks: r.failed_checks || [], error: r.error || null })).slice(0, 200),
    scenarios: results.length ? results : m.scenarios.map((s) => ({ ...s, status: 'DRY' })),
    artifacts: {
      json_report: path.join('artifacts', 'visual-scenarios', args.runId, 'visual-scenario-report.json').replace(/\\/g, '/'),
      markdown_report: path.join('artifacts', 'visual-scenarios', args.runId, 'visual-scenario-report.md').replace(/\\/g, '/'),
      manifest: path.join('artifacts', 'visual-scenarios', args.runId, 'visual-scenario-manifest.json').replace(/\\/g, '/'),
      screenshot_dir: path.join('artifacts', 'visual-scenarios', args.runId, 'screenshots').replace(/\\/g, '/'),
    },
  };
}

function writeReports(report, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'visual-scenario-report.json');
  const mdPath = path.join(outDir, 'visual-scenario-report.md');
  const manifestPath = path.join(outDir, 'visual-scenario-manifest.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, renderMarkdown(report));
  fs.writeFileSync(manifestPath, JSON.stringify(renderManifest(report), null, 2));
}

function renderManifest(report) {
  return {
    schema_version: 'visual_scenario_manifest_v0.1',
    run_id: report.run_id,
    scope: report.scope,
    generated_at: report.generated_at,
    verdict: report.verdict,
    scenario_count: report.scenario_count,
    passed_count: report.passed_count,
    failed_count: report.failed_count,
    app_count: report.app_count,
    viewports: report.viewports,
    capability_gap_count: (report.capability_gaps || []).length,
    capability_gaps: report.capability_gaps || [],
    artifacts: report.artifacts,
    scenarios: report.scenarios.map((s) => ({
      slug: s.slug || null,
      page: s.page || null,
      type: s.type || null,
      state: s.state,
      viewport: s.viewport,
      label: s.label,
      status: s.status,
      screenshot: s.screenshot || null,
      assertions: s.assertions || [],
      risk_types: (s.risks || []).map((r) => r.type),
      failed_checks: s.failed_checks || [],
    })),
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# Visual Scenario Report — ${report.run_id}`);
  lines.push('');
  lines.push(`**Verdict:** ${report.verdict}`);
  lines.push(`**Scope:** ${report.scope}`);
  lines.push(`**Scenarios:** ${report.scenario_count}`);
  lines.push(`**Passed / Failed:** ${report.passed_count} / ${report.failed_count}`);
  lines.push(`**Viewports:** ${report.viewports.join(', ')}`);
  lines.push('');
  lines.push(`> ${report.semantic_review_note}`);
  lines.push('');
  lines.push('## Framework / CSS Risk Counts');
  lines.push('');
  if (Object.keys(report.risk_counts).length === 0) lines.push('- None detected.');
  for (const [k, v] of Object.entries(report.risk_counts)) lines.push(`- ${k}: ${v}`);
  lines.push('');
  lines.push('## Product Capability Gaps');
  lines.push('');
  if (!report.capability_gaps || report.capability_gaps.length === 0) lines.push('- None detected.');
  for (const g of (report.capability_gaps || []).slice(0, 80)) lines.push(`- **${g.slug}** — ${g.capability}: ${g.detail}`);
  if ((report.capability_gaps || []).length > 80) lines.push(`- ... ${(report.capability_gaps || []).length - 80} more capability gaps omitted from Markdown; see JSON.`);
  lines.push('');
  lines.push('## Failures');
  lines.push('');
  if (!report.failures.length) lines.push('- None.');
  for (const f of report.failures.slice(0, 50)) {
    lines.push(`- **${f.scenario}** — ${f.screenshot || ''}`);
    for (const c of f.failed_checks || []) lines.push(`  - ${c.name}: ${JSON.stringify(c.detail)}`);
    if (f.error) lines.push(`  - error: ${f.error}`);
  }
  lines.push('');
  lines.push('## Scenario Manifest');
  lines.push('');
  for (const s of report.scenarios.slice(0, 120)) lines.push(`- ${s.status} — ${s.slug || s.page} / ${s.state} / ${s.viewport} / ${s.screenshot || ''}`);
  if (report.scenarios.length > 120) lines.push(`- ... ${report.scenarios.length - 120} more scenarios omitted from Markdown; see JSON.`);
  return lines.join('\n');
}

function printHelp() {
  console.log(`Usage:
  node scripts/visual_scenario_matrix.js --list --scope sample --json
  node scripts/visual_scenario_matrix.js --scope sample --dry-run --run-id test --json
  node scripts/visual_scenario_matrix.js --scope sample --limit 25 --run-id smoke --json
  node scripts/visual_scenario_matrix.js --scope all --run-id full-visual --json

Options:
  --scope sample|all  sample = representative businesses, all = every apps/*-booking.html
  --list              print matrix only; no artifacts
  --dry-run           write report/manifest without launching browser
  --limit N           run only N scenarios from the matrix
  --offset N          skip the first N scenarios, for sharded full capture
  --run-id ID         artifact folder name under artifacts/visual-scenarios/
  --headed            show browser window
  --json              print JSON
`);
}

(async () => {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { printHelp(); return; }
    if (args.list) {
      const m = matrix(args.scope, args.runId);
      if (args.json) console.log(JSON.stringify(m, null, 2));
      else console.log(`visual_scenario_matrix ${m.scope}: ${m.scenario_count} scenarios across ${m.app_count} apps`);
      return;
    }
    const report = await runMatrix(args);
    const summary = {
      schema_version: report.schema_version,
      verdict: report.verdict,
      scope: report.scope,
      run_id: report.run_id,
      scenario_count: report.scenario_count,
      passed_count: report.passed_count,
      failed_count: report.failed_count,
      capability_gap_count: (report.capability_gaps || []).length,
      risk_counts: report.risk_counts,
      artifacts: report.artifacts,
    };
    if (args.json) console.log(JSON.stringify(summary, null, 2));
    else console.log(`${summary.verdict}: ${summary.passed_count}/${summary.scenario_count} passed; report=${summary.artifacts.json_report}`);
    process.exit(report.failed_count ? 1 : 0);
  } catch (err) {
    console.error(err.stack || err.message || String(err));
    process.exit(2);
  }
})();
