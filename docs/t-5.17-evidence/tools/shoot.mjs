// Contact-sheet shooter for T-5.17.
//
// The Scroll Craft skill's own `scripts/shoot.mjs` needs `playwright-core`,
// which this project does not have and which the task forbids adding without a
// verified need. This is the project's established CDP path instead (raw
// WebSocket to the DevTools protocol), so it needs no dependency at all.
//
// Usage:
//   node shoot.mjs --url / --out docs/t-5.17-evidence/desktop --width 1440 --height 900
//   node shoot.mjs --url / --out ... --reduced-motion
//   node shoot.mjs --url / --out ... --stops 0,0.25,0.5,0.75,1
//
// Each shot is a full-viewport PNG at a scroll position expressed as a fraction
// of the document's scrollable height. Names sort in scroll order.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`;
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);

const url = opt('url', '/');
const out = opt('out', 'docs/t-5.17-evidence/shots');
const width = Number(opt('width', 1440));
const height = Number(opt('height', 900));
const reduced = flag('reduced-motion');
const stops = opt('stops', '0,0.16,0.33,0.5,0.66,0.83,1')
  .split(',')
  .map(Number);
const prefix = opt('prefix', '');
// How long to let the route settle after navigation. See the note at the
// navigate call: a route that fetches its data needs far more than the default.
const wait = Number(opt('wait', 5500));
const PORT = 9400 + Math.floor(Math.random() * 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/version`);
  const { webSocketDebuggerUrl } = await res.json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener('open', r);
    ws.addEventListener('error', j);
  });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.method) events.push(m);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) {
        p.reject(new Error(JSON.stringify(m.error)));
      } else {
        p.resolve(m.result);
      }
    }
  });
  return {
    events,
    send: (method, params = {}, sessionId) =>
      new Promise((res2, rej) => {
        const i = ++id;
        pending.set(i, { resolve: res2, reject: rej });
        ws.send(JSON.stringify({ id: i, method, params, sessionId }));
      }),
  };
}

async function main() {
  mkdirSync(out, { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--user-data-dir=/tmp/shoot-${PORT}`,
    'about:blank',
  ]);
  chrome.stderr.on('data', () => {});
  for (let i = 0; i < 150; i++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/json/version`);
      break;
    } catch {
      await sleep(200);
    }
  }
  const cdp = await connect(PORT);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: sid } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => cdp.send(m, p, sid);

  await S('Page.enable');
  await S('Runtime.enable');
  await S('Log.enable');
  if (reduced) {
    await S('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
  }
  await S('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
    screenWidth: width,
    screenHeight: height,
  });

  const evalJs = async (expression) => {
    const { result } = await S('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return result.value;
  };

  // Theme is a storage preference the app reads on load; set it before the
  // page's own scripts run so there is no flash and no re-layout mid-shoot.
  await S('Page.navigate', { url: 'http://localhost:3000/' });
  await sleep(2500);
  const theme = opt('theme', 'light');
  await evalJs(`localStorage.setItem('theme_preference', ${JSON.stringify(theme)}); null`);

  await S('Page.navigate', { url: `http://localhost:3000${url}` });
  // Most routes are server-rendered and settle in a few seconds. A data-driven
  // route is not: the result page POSTs to `/api/recommend`, which runs a real
  // Gemini embedding pass and takes ~10s on this project. Photographing it at
  // 5.5s captures the loading skeleton and would misreport the page as empty,
  // so the wait is an option (`--wait <ms>`) rather than a constant.
  await sleep(wait);
  await evalJs(`document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true`);

  // The app mounts Lenis (a 900ms glide) and the engine's stylesheet sets
  // `scroll-behavior: smooth`. Both are right for a reader and both make a
  // scripted `scrollTo` land somewhere other than the requested pixel, which
  // would silently mislabel every frame in the sheet. Disabling animation for
  // the capture only is the difference between a contact sheet that records
  // what was asked for and one that records where the page happened to stop.
  await evalJs(`(() => {
    const style = document.createElement('style');
    style.id = 'shoot-no-smooth';
    style.textContent = 'html, body, * { scroll-behavior: auto !important; } html { scroll-snap-type: none !important; }';
    document.head.appendChild(style);
    // Lenis re-writes scrollTop every tick, so it has to be stopped rather than
    // out-run. The app exposes the live instance for exactly this; a missing
    // handle means the route opted out of smoothing, which needs no stop.
    const lenis = window.__lenis;
    if (lenis && typeof lenis.stop === 'function') lenis.stop();
    return { stoppedLenis: !!lenis };
  })()`);

  // Walk the whole document once so every entry-triggered reveal has fired and
  // the engine has measured every act, then return to the top.
  const geom = await evalJs(`(() => ({
    docHeight: document.documentElement.scrollHeight,
    innerHeight: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }))()`);
  const total = Math.max(0, geom.docHeight - geom.innerHeight);
  const step = Math.round(height * 0.5);
  for (let y = 0; y <= total; y += step) {
    await evalJs(`window.scrollTo(0, ${y}); null`);
    await sleep(90);
  }
  await sleep(400);

  const shots = [];
  for (let i = 0; i < stops.length; i++) {
    const frac = stops[i];
    const y = Math.round(total * frac);
    await evalJs(`window.scrollTo({ top: ${y}, behavior: 'instant' }); null`);
    // The engine coalesces scroll into one rAF, so a single frame is enough once
    // smoothing is off. The longer wait is for entry reveals whose
    // IntersectionObserver fires after the jump.
    await sleep(700);
    await evalJs(`window.scrollTo({ top: ${y}, behavior: 'instant' }); null`);
    await sleep(260);
    const actual = await evalJs('Math.round(scrollY)');
    const { data } = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const name = `${prefix}${String(i).padStart(2, '0')}-y${actual}.png`;
    writeFileSync(join(out, name), Buffer.from(data, 'base64'));
    shots.push({ name, requested: y, actual });
  }

  const errors = cdp.events
    .filter(
      (e) =>
        (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') ||
        (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'),
    )
    .map((e) =>
      e.method === 'Log.entryAdded'
        ? `${e.params.entry.text} ${e.params.entry.url ?? ''}`.slice(0, 300)
        : e.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300),
    );

  const meta = {
    url,
    width,
    height,
    reduced,
    theme,
    stops,
    geom,
    shots,
    errors,
  };
  writeFileSync(join(out, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log(JSON.stringify(meta, null, 2));
  chrome.kill('SIGKILL');
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
