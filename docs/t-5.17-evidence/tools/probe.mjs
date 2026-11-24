// Scroll Craft probe: acts, cues, geometry and any element left at opacity 0.
//
// Usage: node probe.mjs <route> [width] [height] [reduced]
// Prints a JSON record: the page's own act/cue counts, the scroll height, and
// every element that is still at opacity 0 after a full pass down and back up.
import { spawn } from 'node:child_process';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`;
const route = process.argv[2] ?? '/';
const width = Number(process.argv[3] ?? 1440);
const height = Number(process.argv[4] ?? 900);
const reduced = process.argv[5] === 'reduced';
const PORT = 9300 + Math.floor(Math.random() * 200);
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
    close: () => ws.close(),
  };
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    `--user-data-dir=/tmp/probe-${PORT}`,
    'about:blank',
  ]);
  chrome.stderr.on('data', () => {});
  for (let i = 0; i < 120; i++) {
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
  });
  await S('Page.navigate', { url: `http://localhost:3000${route}` });
  await sleep(6000);

  const evalJs = async (expression) => {
    const { result } = await S('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return result.value;
  };

  const before = await evalJs(`(() => {
    const g = window.ScrollCraft;
    return {
      hasGlobal: !!g,
      instances: g ? g.instances.length : 0,
      scReady: document.documentElement.classList.contains('sc-ready'),
      acts: document.querySelectorAll('[data-sc-act]').length,
      cues: document.querySelectorAll('[data-sc-cue]').length,
      reveals: document.querySelectorAll('[data-sc-reveal]').length,
      parallax: document.querySelectorAll('[data-sc-parallax]').length,
      docHeight: document.documentElement.scrollHeight,
      innerHeight: innerHeight,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      scrollWidth: document.documentElement.scrollWidth,
    };
  })()`);

  // Walk the page down in viewport steps, then back up, sampling nothing but
  // letting the engine run its read() at every position.
  const total = Math.max(0, before.docHeight - before.innerHeight);
  const step = Math.round(before.innerHeight * 0.6);
  const positions = [];
  for (let y = 0; y <= total; y += step) positions.push(y);
  if (positions[positions.length - 1] !== total) positions.push(total);
  for (const y of positions) {
    await evalJs(`window.scrollTo(0, ${y}); null`);
    await sleep(140);
  }
  for (const y of [...positions].reverse()) {
    await evalJs(`window.scrollTo(0, ${y}); null`);
    await sleep(120);
  }
  // Settle at the top and at two-thirds through, the two places a cue is most
  // likely to be mid-window, then measure.
  const samples = [];
  for (const y of [0, Math.round(total * 0.5), Math.round(total * 0.78), total]) {
    await evalJs(`window.scrollTo(0, ${y}); null`);
    await sleep(320);
    const rec = await evalJs(`(() => {
      const hidden = [];
      const sel = '[data-sc-cue], [data-in], [data-sc-stagger] > *';
      document.querySelectorAll(sel).forEach((el) => {
        const cs = getComputedStyle(el);
        const op = parseFloat(cs.opacity);
        const r = el.getBoundingClientRect();
        const onScreen = r.bottom > 0 && r.top < innerHeight && r.width > 0 && r.height > 0;
        if (op < 0.05 && onScreen) {
          hidden.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || '').toString().slice(0, 80),
            text: (el.textContent || '').trim().slice(0, 60),
            cue: el.getAttribute('data-sc-cue'),
            top: Math.round(r.top),
          });
        }
      });
      const actStates = [];
      document.querySelectorAll('[data-sc-act]').forEach((a) => {
        actStates.push({
          id: a.id || null,
          p: a.style.getPropertyValue('--sc-p') || null,
          span: a.getAttribute('data-sc-span'),
        });
      });
      return { y: Math.round(scrollY), hidden, actStates };
    })()`);
    samples.push(rec);
  }

  const errors = cdp.events
    .filter(
      (e) =>
        (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') ||
        (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'),
    )
    .map((e) =>
      e.method === 'Log.entryAdded'
        ? `${e.params.entry.text} ${e.params.entry.url ?? ''}`.slice(0, 240)
        : e.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 240),
    );

  console.log(JSON.stringify({ route, width, height, reduced, before, samples, errors }, null, 2));
  chrome.kill('SIGKILL');
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
