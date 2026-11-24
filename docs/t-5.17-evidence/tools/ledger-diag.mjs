// Diagnostic: does the ledger track --sc-p, accumulate its total, and pin?
//
// Kept as a dedicated probe because the ledger is the page's signature move and
// three separate contracts have to hold at once: the act geometry (the stage
// must actually stick), the CSS custom-property inheritance (each row's `--at`
// must reach its rule), and the derived arithmetic (the printed totals must be
// 0,40 / 0,70 / 0,90 / 1,00, not invented).
import { spawn } from 'node:child_process';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`;
const PORT = 9700 + Math.floor(Math.random() * 200);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect(port) {
  const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
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
    send: (method, params = {}, sessionId) =>
      new Promise((res, rej) => {
        const i = ++id;
        pending.set(i, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id: i, method, params, sessionId }));
      }),
  };
}

const FRACTIONS = [0.3, 0.4, 0.46, 0.52, 0.58, 0.64, 0.7, 0.78, 0.88];

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    `--user-data-dir=/tmp/led-${PORT}`,
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
  await S('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await S('Page.navigate', { url: 'http://localhost:3000/' });
  await sleep(5000);

  const ev = async (expr) =>
    (await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result
      .value;

  await ev(`(() => {
    const s = document.createElement('style');
    s.textContent = 'html,body,*{scroll-behavior:auto!important}';
    document.head.appendChild(s);
    if (window.__lenis) window.__lenis.stop();
    return true;
  })()`);

  const media = await ev(`({
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    narrow: matchMedia('(max-width: 1023px)').matches,
    innerWidth: innerWidth,
  })`);
  const geom = await ev(`({ h: document.documentElement.scrollHeight, vh: innerHeight })`);
  const total = geom.h - geom.vh;

  const out = [];
  for (const f of FRACTIONS) {
    const y = Math.round(total * f);
    await ev(`window.scrollTo({ top: ${y}, behavior: 'instant' }); null`);
    await sleep(340);
    const rec = await ev(`(() => {
      const act = document.getElementById('scoring');
      if (!act) return { error: 'no #scoring' };
      const stage = act.querySelector('[data-sc-stage]');
      const stageCs = stage ? getComputedStyle(stage) : null;
      const rows = [...act.querySelectorAll('.home-ledger-toggle')].map((r) => {
        const bar = r.querySelector('.home-ledger-bar');
        return {
          at: r.style.getPropertyValue('--at'),
          opacity: Number(getComputedStyle(r).opacity).toFixed(3),
          bar: bar ? getComputedStyle(bar).transform : null,
        };
      });
      // Which total is currently the most opaque one? That is what the reader
      // sees, and it has to be the running sum for the rows that have passed.
      const totals = [...act.querySelectorAll('.home-ledger-total')].map((t) => ({
        text: t.textContent,
        at: t.style.getPropertyValue('--at'),
        opacity: Number(getComputedStyle(t).opacity).toFixed(3),
      }));
      const visibleTotal = totals.reduce((best, t) => (Number(t.opacity) > Number(best.opacity) ? t : best), totals[0]);
      return {
        y: Math.round(scrollY),
        p: act.style.getPropertyValue('--sc-p'),
        stagePosition: stageCs ? stageCs.position : null,
        stageTop: stage ? Math.round(stage.getBoundingClientRect().top) : null,
        rows,
        totals,
        visibleTotal: visibleTotal ? visibleTotal.text : null,
      };
    })()`);
    out.push(rec);
  }

  console.log(JSON.stringify({ media, geom, out }, null, 2));
  chrome.kill('SIGKILL');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
