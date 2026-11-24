// Measure whether the fixed hub covers real page content on the PUBLIC routes,
// where there is no workspace shell to reserve space.
//
// The dimmed open-state screenshot makes the hero look covered; this checks the
// actual rectangles instead of judging pixels. A hit is any element that is not
// part of the sidebar and whose box intersects the hub's 56px circle.
import { spawn } from 'node:child_process';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`;
const BASE = 'http://localhost:3000';
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
    '--user-data-dir=/tmp/t-5.16-content',
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

  for (const route of [
    '/',
    '/how-it-works',
    '/p/c7c3b1c0b05291c3c931a7d1/members',
    '/p/c7c3b1c0b05291c3c931a7d1/tasks',
    '/p/c7c3b1c0b05291c3c931a7d1/result',
  ]) {
    for (const vp of [
      { name: 'desktop', width: 1440, height: 900, mobile: false },
      { name: 'mobile', width: 390, height: 844, mobile: true },
    ]) {
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId: sid } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      await cdp.send('Page.enable', {}, sid);
      await cdp.send('Runtime.enable', {}, sid);
      await cdp.send(
        'Emulation.setDeviceMetricsOverride',
        { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile },
        sid,
      );
      await cdp.send('Page.navigate', { url: `${BASE}${route}` }, sid);
      await sleep(4200);

      const { result } = await cdp.send(
        'Runtime.evaluate',
        {
          expression: `(() => {
            const hub = document.querySelector('.radial-trigger').getBoundingClientRect();
            const cx = hub.left + hub.width/2, cy = hub.top + hub.height/2;
            const R = hub.width/2 + 4; // a little air around the circle
            const hits = [];
            // Walk every text-bearing element and test its box against the circle.
            for (const el of document.querySelectorAll('h1,h2,h3,p,li,a,button,input,label,span,td,th')) {
              if (el.closest('.radial-sidebar') || el.closest('.radial-scrim')) continue;
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) continue;
              if (r.bottom < 0 || r.top > window.innerHeight) continue; // off-screen rows
              // closest point of the rect to the hub centre
              const nx = Math.max(r.left, Math.min(cx, r.right));
              const ny = Math.max(r.top, Math.min(cy, r.bottom));
              const d = Math.hypot(nx - cx, ny - cy);
              if (d <= R) {
                hits.push({
                  tag: el.tagName,
                  text: (el.textContent || '').trim().slice(0, 40),
                  rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) },
                  dist: Math.round(d),
                });
              }
            }
            return { hub: { x: Math.round(hub.x), y: Math.round(hub.y), w: Math.round(hub.width) }, hits: hits.slice(0, 8), hitCount: hits.length };
          })()`,
          returnByValue: true,
        },
        sid,
      );
      out[`${route} ${vp.name}`] = result.value;
      await cdp.send('Target.closeTarget', { targetId });
    }
  }

  console.log(JSON.stringify(out, null, 2));
  chrome.kill('SIGKILL');
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
