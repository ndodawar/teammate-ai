// Does :focus-visible actually match after a real keyboard traversal, and does the
// focused item's tooltip become visible from that rule (not from the active rule)?
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
    `--user-data-dir=/tmp/t-5.16-fv`,
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
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: sid } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sid);
  await cdp.send('Runtime.enable', {}, sid);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sid);
  await cdp.send('Page.navigate', { url: `${BASE}/p/c7c3b1c0b05291c3c931a7d1/members` }, sid);
  await sleep(4200);

  await cdp.send('Runtime.evaluate', { expression: `document.querySelector('.radial-trigger').click()` }, sid);
  await sleep(450);

  // ArrowDown to a non-active item, using a real key event so focus-visible applies.
  const press = async (key, vk) => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code: key, windowsVirtualKeyCode: vk }, sid);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: vk }, sid);
    await sleep(250);
  };
  await press('ArrowDown', 40); // Anggota -> Tugas (on members, Tugas is not active)

  const { result } = await cdp.send(
    'Runtime.evaluate',
    {
      expression: `(() => {
        const el = document.activeElement;
        const link = el && el.closest('.radial-link');
        const tip = link && link.querySelector('.radial-tooltip');
        return {
          label: link && link.getAttribute('aria-label'),
          active: link && link.dataset.active,
          matchesFocusVisible: link ? link.matches(':focus-visible') : null,
          matchesFocus: link ? link.matches(':focus') : null,
          tipOpacity: tip ? getComputedStyle(tip).opacity : null,
        };
      })()`,
      returnByValue: true,
    },
    sid,
  );
  console.log(JSON.stringify(result.value, null, 2));
  chrome.kill('SIGKILL');
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
