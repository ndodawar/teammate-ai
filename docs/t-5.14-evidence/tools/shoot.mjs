// Screenshot harness for the T-5.14 visual audit.
//
// Drives the Chrome binary that already exists on this machine over CDP, so no
// package is added to the project. Usage:
//
//   node docs/t-5.14-evidence/tools/shoot.mjs <before|after> <code> [route ...]
//
// Writes one PNG per route x viewport x theme into docs/t-5.14-evidence/<label>/
// and a manifest.json next to them.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`;
const BASE = 'http://localhost:3000';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const label = process.argv[2] ?? 'after';
const code = process.argv[3] ?? '';
const routes = process.argv.slice(4);
if (routes.length === 0) routes.push('/');

const OUT = resolve(ROOT, label);
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];
const THEMES = ['light', 'dark'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  const res = await fetch('http://127.0.0.1:9222/json/version');
  const { webSocketDebuggerUrl } = await res.json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener('open', r);
    ws.addEventListener('error', j);
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: res2, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else res2(msg.result);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((res2, rej) => {
      const i = ++id;
      pending.set(i, { resolve: res2, reject: rej });
      ws.send(JSON.stringify({ id: i, method, params, sessionId: sessionId ?? undefined }));
    });
  return { send };
}

async function waitReady(cdp, sid, ms) {
  await sleep(ms);
  for (let i = 0; i < 40; i += 1) {
    const { result } = await cdp.send(
      'Runtime.evaluate',
      { expression: 'document.fonts.status', returnByValue: true },
      sid,
    );
    if (result.value === 'loaded') break;
    await sleep(120);
  }
  await sleep(500);
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    // Keep the Chrome profile OUTSIDE the repo: it contains a Unix socket that
    // Turbopack tries to read as a CSS module and panics on.
    `--user-data-dir=${process.env.CHROME_PROFILE_DIR ?? '/tmp/t-5.14-chrome-profile'}`,
    'about:blank',
  ]);
  chrome.stderr.on('data', () => {});
  for (let i = 0; i < 80; i += 1) {
    try {
      await fetch('http://127.0.0.1:9222/json/version');
      break;
    } catch {
      await sleep(250);
    }
  }

  const cdp = await connect();
  const results = [];

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      for (const route of routes) {
        const slug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/[/?=&]/g, '_');
        const file = resolve(OUT, `${vp.name}-${theme}-${slug}.png`);

        const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
        await cdp.send('Page.enable', {}, sessionId);
        await cdp.send('Runtime.enable', {}, sessionId);
        await cdp.send(
          'Emulation.setDeviceMetricsOverride',
          { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile },
          sessionId,
        );

        // Seed the stored preference first, then navigate for real, so the
        // pre-hydration theme script applies before the first paint.
        await cdp.send('Page.navigate', { url: `${BASE}/` }, sessionId);
        await waitReady(cdp, sessionId, 500);
        await cdp.send(
          'Runtime.evaluate',
          { expression: `localStorage.setItem('theme_preference','${theme}')` },
          sessionId,
        );
        const routePath = route.includes('{code}') ? route.replace('{code}', code) : route;
        await cdp.send('Page.navigate', { url: `${BASE}${routePath}` }, sessionId);
        await waitReady(cdp, sessionId, 4000);

        const { cssContentSize } = await cdp.send('Page.getLayoutMetrics', {}, sessionId);
        const height = Math.min(Math.ceil(cssContentSize.height), 9000);

        /*
         * Grow the emulated viewport to the full page height, let the layout
         * settle, then take a plain viewport capture.
         *
         * `captureBeyondViewport: true` was doing this implicitly, and it
         * re-ran layout DURING the capture. The re-layout briefly reported a
         * smaller effective width, the `lg:` media query stopped matching for
         * that frame, and the screenshot rendered the mobile layout inside a
         * 1440px frame: the fixed rail then sat on top of the page content.
         * The DOM was always correct (`h1` measured at x=348 with the rail
         * ending at x=272), so this was purely a capture artifact — but it
         * produced evidence that looked like a real overlap bug. Resizing
         * explicitly and waiting keeps the measured layout and the painted
         * layout identical.
         */
        await cdp.send(
          'Emulation.setDeviceMetricsOverride',
          { width: vp.width, height, deviceScaleFactor: 1, mobile: vp.mobile },
          sessionId,
        );
        await sleep(600);
        const { data } = await cdp.send(
          'Page.captureScreenshot',
          { format: 'png' },
          sessionId,
        );
        writeFileSync(file, Buffer.from(data, 'base64'));
        results.push({ file: file.replace(`${ROOT}/`, ''), route: routePath, theme, vp: vp.name, height });
        console.log(`saved ${file.replace(`${ROOT}/`, '')} (${height}px)`);

        await cdp.send('Target.closeTarget', { targetId });
      }
    }
  }

  writeFileSync(resolve(OUT, 'manifest.json'), JSON.stringify(results, null, 2));
  chrome.kill('SIGKILL');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
