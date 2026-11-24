// Reveal-motion measurement (T-5.15).
//
// Question: does each `[data-motion-reveal]` element actually pass through
// intermediate transform values, or is it painted at its final state from the
// first frame?
//     1 distinct value  = never animated
//     dozens            = it really moved
//
// Notes that matter, each learned the hard way while building this probe:
//
//  * The sampler must ride `requestAnimationFrame`. Polling with a timer
//    instead reported every element as static.
//  * Read the element's FIRST CHILD. `Reveal`/`RevealGroup` animate the wrapper,
//    but `MaskLine`/`DrawRule` animate the child, and reading
//    `getComputedStyle(wrapper)` in the same tick as the child suppressed the
//    child's intermediate values.
//  * Key records by the element's own text, not by DOM index and not by node
//    identity. This page swaps its hero during hydration, so the reveal-node
//    count really does change (19 -> 15 -> 14) and either of the other keys
//    silently mixes elements or records a dead node.
//  * Take the measurement before any scrolling. A scroll pass unmounts the
//    mobile workflow stack, which replaced live records with static ones.
//
// Usage: node reveal-frames.mjs [route] [width] [height] [reduced]

import { spawn } from 'node:child_process';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`;
const BASE = 'http://localhost:3000';
const route = process.argv[2] ?? '/';
const W = Number(process.argv[3] ?? 1440);
const H = Number(process.argv[4] ?? 900);
const reduced = process.argv[5] === 'reduced';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9471;

const p = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--no-sandbox',
  '--disable-gpu',
  '--hide-scrollbars',
  // NOTE: `--force-prefers-reduced-motion` only recognises the value `reduce`.
  // Passing `=no-preference` does NOT mean "motion allowed": Chromium treats the
  // flag as set and reports the reduce preference, which correctly disables every
  // animation. That single flag produced a string of false "0 animated" results
  // while the page was animating perfectly. Omit the flag entirely for the
  // default (motion on) case.
  ...(reduced ? ['--force-prefers-reduced-motion=reduce'] : []),
  `--user-data-dir=/tmp/rf-${Date.now()}`,
  'about:blank',
]);
p.stderr.on('data', () => {});
for (let i = 0; i < 80; i++) {
  try {
    await fetch(`http://127.0.0.1:${PORT}/json/version`);
    break;
  } catch {
    await sleep(250);
  }
}

const page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
};
const send = (method, params = {}, sid) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params, sessionId: sid }));
  });

await send('Page.enable');
await send('Runtime.enable');
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false},sessionId);

await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  window.__t = new Map();
  const sample = () => {
    document.querySelectorAll('[data-motion-reveal]').forEach((w) => {
      const inner = w.firstElementChild;
      if (!inner) return;
      const key = (w.textContent || '').trim().slice(0, 24) || '(empty)';
      let cur = window.__t.get(key);
      if (!cur) { cur = new Set(); window.__t.set(key, cur); }
      cur.add(getComputedStyle(inner).transform);
    });
    if (performance.now() < 9000) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
`},sessionId);

await send('Page.navigate', { url: `${BASE}${route}` }, sessionId);
await sleep(5000);

const r = await send('Runtime.evaluate', { expression: `
  [...window.__t.entries()].map(([k, v]) => ({ text: k, states: v.size }))
`, returnByValue: true }, sessionId);

const rows = r.result.result.value || [];
const moved = (x) => x.states > 1;
console.log(JSON.stringify({
  route,
  reduced,
  viewport: [W, H],
  tracked: rows.length,
  animated: rows.filter(moved).length,
  static: rows.filter((x) => !moved(x)).length,
  animatedDetail: rows.filter(moved).sort((a, b) => b.states - a.states),
  staticDetail: rows.filter((x) => !moved(x)).map((x) => x.text),
}, null, 2));

ws.close();
p.kill();
