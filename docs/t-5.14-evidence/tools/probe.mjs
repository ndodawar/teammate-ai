// Reads the COMPUTED style of the surfaces that are supposed to be glass, in the
// live browser, and prints one block per element. This is the audit probe: it
// answers "is the glass actually in the rendered page", not "is the word
// backdrop-filter present in the stylesheet".
//
// Usage: node docs/t-5.14-evidence/tools/probe.mjs <route> <theme>
import { spawn } from 'node:child_process';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`;
const BASE = 'http://localhost:3000';
const route = process.argv[2] ?? '/';
const theme = process.argv[3] ?? 'light';
const width = Number(process.argv[4] ?? 1440);
const height = Number(process.argv[5] ?? 900);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROBE = `
(() => {
  const props = ['backgroundColor','opacity','backdropFilter','borderTopWidth','borderTopColor',
    'boxShadow','zIndex','position','overflow','isolation'];
  const read = (el, name) => {
    if (!el) return { name, missing: true };
    const cs = getComputedStyle(el);
    const out = { name, cls: String(el.className || '').slice(0, 70) };
    for (const p of props) out[p] = cs[p];
    const r = el.getBoundingClientRect();
    out.rect = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    return out;
  };
  const q = (s) => document.querySelector(s);
  // How much the ground varies across a surface's own box. This is the number
  // that decides whether a blur can produce anything: a flat backdrop makes
  // backdrop-filter a no-op no matter what its radius is.
  const variance = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, blur: cs.backdropFilter, size: [Math.round(r.width), Math.round(r.height)] };
  };
  return {
    theme: document.documentElement.dataset.theme,
    viewport: [innerWidth, innerHeight],
    surfaces: [
      read(q('.site-nav-shell'), 'site-nav-shell'),
      read(q('.app-topbar'), 'app-topbar'),
      read(q('.nav-capsule'), 'nav-capsule'),
      read(q('.glass-panel'), 'glass-panel'),
      read(q('.rail-surface'), 'rail-surface'),
      read(q('.rail'), 'rail'),
      read(q('.workspace-column'), 'workspace-column'),
      read(q('.surface-card'), 'surface-card'),
      read(q('.app-canvas'), 'app-canvas'),
      read(q('.pinned-visual'), 'pinned-visual'),
    ],
    canvas: variance(document.body),
    counts: {
      glassPanel: document.querySelectorAll('.glass-panel').length,
      glassSolid: document.querySelectorAll('.glass-solid').length,
      blurred: [...document.querySelectorAll('*')].filter((el) => {
        const b = getComputedStyle(el).backdropFilter;
        return b && b !== 'none';
      }).map((el) => el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0]),
    },
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()
`;

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=9444', '--no-sandbox', '--disable-gpu',
    '--hide-scrollbars', '--window-size=1440,900',
    `--user-data-dir=/tmp/probe-${Date.now()}`, 'about:blank',
  ]);
  chrome.stderr.on('data', () => {});
  for (let i = 0; i < 80; i += 1) {
    try { await fetch('http://127.0.0.1:9444/json/version'); break; } catch { await sleep(250); }
  }
  const { webSocketDebuggerUrl } = await (await fetch('http://127.0.0.1:9444/json/version')).json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(); let sessionId = null;
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.reject(new Error(JSON.stringify(m.error)));
      else p.resolve(m.result);
    }
  });
  const send = (method, params = {}, sid = sessionId) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, { resolve: res, reject: rej });
    ws.send(JSON.stringify({ id: i, method, params, sessionId: sid ?? undefined }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, undefined);
  const attached = await send('Target.attachToTarget', { targetId, flatten: true }, undefined);
  sessionId = attached.sessionId;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
  await send('Page.navigate', { url: `${BASE}/` });
  await sleep(1000);
  await send('Runtime.evaluate', { expression: `localStorage.setItem('theme_preference','${theme}')` });
  await send('Page.navigate', { url: `${BASE}${route}` });
  await sleep(2600);
  const { result } = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
  console.log(JSON.stringify(result.value, null, 2));
  await send('Target.closeTarget', { targetId }, undefined);
  chrome.kill('SIGKILL');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
