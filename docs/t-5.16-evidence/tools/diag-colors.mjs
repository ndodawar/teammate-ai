// Measure the OPEN hub's colours in both themes (T-5.16).
import { spawn } from 'node:child_process';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`;
const BASE = 'http://localhost:3000';
const CODE = 'c7c3b1c0b05291c3c931a7d1';
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
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
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

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--user-data-dir=/tmp/t-5.16-colors',
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
  const out = {};

  for (const theme of ['light', 'dark']) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: sid } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sid);
    await cdp.send('Runtime.enable', {}, sid);
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
      sid,
    );
    await cdp.send('Page.navigate', { url: `${BASE}/` }, sid);
    await sleep(1200);
    await cdp.send('Runtime.evaluate', { expression: `localStorage.setItem('theme_preference','${theme}')` }, sid);
    await cdp.send('Page.navigate', { url: `${BASE}/p/${CODE}/tasks` }, sid);
    await sleep(4200);
    await cdp.send('Runtime.evaluate', { expression: `document.querySelector('.radial-trigger')?.click()` }, sid);
    await sleep(700);

    const { result } = await cdp.send(
      'Runtime.evaluate',
      {
        expression: `(() => {
          const t = document.querySelector('.radial-trigger');
          const cs = getComputedStyle(t);
          const root = getComputedStyle(document.documentElement);
          const x = document.querySelector('.radial-trigger-x');
          const link = document.querySelector('.radial-link[data-active="true"]');
          return {
            dataTheme: document.documentElement.dataset.theme,
            rootInk: root.getPropertyValue('--ink').trim(),
            rootPaper: root.getPropertyValue('--paper').trim(),
            rootAccent: root.getPropertyValue('--accent').trim(),
            hubBg: cs.backgroundColor,
            hubColor: cs.color,
            xColor: x ? getComputedStyle(x).color : null,
            xStroke: x ? getComputedStyle(x.querySelector('svg')).stroke : null,
            activeBg: link ? getComputedStyle(link).backgroundColor : null,
            activeColor: link ? getComputedStyle(link).color : null,
          };
        })()`,
        returnByValue: true,
      },
      sid,
    );
    out[theme] = result.value;
    await cdp.send('Target.closeTarget', { targetId });
  }

  console.log(JSON.stringify(out, null, 2));
  chrome.kill('SIGKILL');
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
