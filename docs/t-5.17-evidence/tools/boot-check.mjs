// Verify the Scroll Craft engine actually loads, mounts, and tears down.
//
// This is the bootstrap check, run before any page markup exists: if the engine
// does not reach `window.ScrollCraft` and mount an instance, every `data-sc-*`
// attribute in the app is decoration and the whole task is unverifiable.
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
  const events = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.method) events.push(m);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    }
  });
  return {
    events,
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
    '--user-data-dir=/tmp/t-5.17-boot',
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

  for (const route of ['/', '/how-it-works', '/p/c7c3b1c0b05291c3c931a7d1/tasks']) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: sid } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sid);
    await cdp.send('Runtime.enable', {}, sid);
    await cdp.send('Log.enable', {}, sid);
    await cdp.send(
      'Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
      sid,
    );
    await cdp.send('Page.navigate', { url: `${BASE}${route}` }, sid);
    await sleep(5000);

    const { result } = await cdp.send(
      'Runtime.evaluate',
      {
        expression: `(() => {
          const g = window.ScrollCraft;
          return {
            hasGlobal: !!g,
            hasMount: !!(g && typeof g.mount === 'function'),
            instances: g ? g.instances.length : null,
            scReady: document.documentElement.classList.contains('sc-ready'),
            engineScript: !!document.querySelector('script[data-sc-engine]'),
            acts: document.querySelectorAll('[data-sc-act]').length,
            cues: document.querySelectorAll('[data-sc-cue]').length,
            actsParsed: g && g.instances[0] ? g.instances[0].acts.length : null,
          };
        })()`,
        returnByValue: true,
      },
      sid,
    );
    out[route] = result.value;

    // Console errors and failed requests on this route.
    const errs = cdp.events.filter(
      (e) =>
        e.sessionId === sid &&
        ((e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') ||
          (e.method === 'Log.entryAdded' && e.params.entry.level === 'error')),
    );
    out[route].consoleErrors = errs.map((e) =>
      e.method === 'Log.entryAdded'
        ? `${e.params.entry.text} ${e.params.entry.url ?? ''}`
        : e.params.args.map((a) => a.value ?? a.description).join(' '),
    );
    cdp.events.length = 0;

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
