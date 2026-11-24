// Capture the radial menu in its OPEN state, which the page-level screenshot
// harness cannot do (it never clicks).
//
// Usage: node docs/t-5.16-evidence/tools/shoot-open.mjs <label>
// Writes <label>/open-<vp>-<theme>.png plus the same routes with the menu closed.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`;
const BASE = 'http://localhost:3000';
const CODE = 'c7c3b1c0b05291c3c931a7d1';
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', process.argv[2] ?? 'open');
mkdirSync(OUT, { recursive: true });

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
  return {
    send: (method, params = {}, sessionId) =>
      new Promise((res2, rej) => {
        const i = ++id;
        pending.set(i, { resolve: res2, reject: rej });
        ws.send(JSON.stringify({ id: i, method, params, sessionId: sessionId ?? undefined }));
      }),
  };
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--user-data-dir=${process.env.CHROME_PROFILE_DIR ?? '/tmp/t-5.16-shot'}`,
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

  for (const theme of ['light', 'dark']) {
    for (const vp of VIEWPORTS) {
      for (const route of [`/p/${CODE}/tasks`, '/', '/how-it-works']) {
        const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
        await cdp.send('Page.enable', {}, sessionId);
        await cdp.send('Runtime.enable', {}, sessionId);
        await cdp.send(
          'Emulation.setDeviceMetricsOverride',
          { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile },
          sessionId,
        );
        await cdp.send('Page.navigate', { url: `${BASE}/` }, sessionId);
        await sleep(1200);
        await cdp.send(
          'Runtime.evaluate',
          { expression: `localStorage.setItem('theme_preference','${theme}')` },
          sessionId,
        );
        await cdp.send('Page.navigate', { url: `${BASE}${route}` }, sessionId);
        await sleep(4200);

        // Open the menu and let the 280ms opening + stagger finish.
        await cdp.send(
          'Runtime.evaluate',
          { expression: `document.querySelector('.radial-trigger')?.click()` },
          sessionId,
        );
        await sleep(700);

        const slug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/[/]/g, '_');
        const file = resolve(OUT, `open-${vp.name}-${theme}-${slug}.png`);
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        writeFileSync(file, Buffer.from(data, 'base64'));
        console.log(`saved ${file.replace(resolve(HERE, '..') + '/', '')}`);

        await cdp.send('Target.closeTarget', { targetId });
      }
    }
  }

  chrome.kill('SIGKILL');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
