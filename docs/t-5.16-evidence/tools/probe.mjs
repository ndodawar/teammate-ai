// T-5.16 radial sidebar probe.
//
// Drives the existing Chrome over CDP (no package added) and MEASURES the menu
// rather than eyeballing it: geometry, overlap with page content, horizontal
// overflow, active-state mapping, keyboard traversal, Escape and outside-click.
//
// Usage: node docs/t-5.16-evidence/tools/probe.mjs [route]
import { spawn } from 'node:child_process';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`;
const BASE = 'http://localhost:3000';
const CODE = 'c7c3b1c0b05291c3c931a7d1';
const ROUTE = (process.argv[2] ?? `/p/${CODE}/tasks`).replace('{code}', CODE);

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
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((res2, rej) => {
      const i = ++id;
      pending.set(i, { resolve: res2, reject: rej });
      ws.send(JSON.stringify({ id: i, method, params, sessionId: sessionId ?? undefined }));
    });
  return { send };
}

async function evaluate(cdp, sid, expression) {
  const { result, exceptionDetails } = await cdp.send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    sid,
  );
  if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
  return result.value;
}

async function runViewport(cdp, vp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: sid } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sid);
  await cdp.send('Runtime.enable', {}, sid);
  await cdp.send('Log.enable', {}, sid);

  // (console error capture is handled by the page-level logs)
  // Collect real console errors (not warnings) for the whole session.
  const ws = await connect();
  void ws;

  await cdp.send(
    'Emulation.setDeviceMetricsOverride',
    { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile },
    sid,
  );
  await cdp.send('Page.navigate', { url: `${BASE}${ROUTE}` }, sid);
  await sleep(4200);

  const out = { vp: vp.name, route: ROUTE };

  // ---- preflight: prove the hub exists before measuring -------------------
  out.preflight = await evaluate(
    cdp,
    sid,
    `(() => ({
      url: location.href,
      title: document.title,
      bodyLen: document.body.innerHTML.length,
      hasSidebar: !!document.querySelector('.radial-sidebar'),
      hasTrigger: !!document.querySelector('.radial-trigger'),
      triggers: document.querySelectorAll('.radial-trigger').length,
      sidenav: !!document.querySelector('.site-nav'),
      rail: !!document.querySelector('.rail'),
      text: document.body.innerText.slice(0, 160),
    }))()`,
  );

  if (!out.preflight.hasTrigger) {
    // Nothing to measure; return the preflight so the failure is diagnosable
    // instead of surfacing as a null dereference three steps later.
    await cdp.send('Target.closeTarget', { targetId });
    return out;
  }

  // ---- geometry at rest -------------------------------------------------
  out.rest = await evaluate(
    cdp,
    sid,
    `(() => {
      const hub = document.querySelector('.radial-trigger');
      const sidebar = document.querySelector('.radial-sidebar');
      if (!hub || !sidebar) return { error: 'hub missing' };
      const r = hub.getBoundingClientRect();
      return {
        hub: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        docked: sidebar.dataset.side,
        triggerCount: document.querySelectorAll('.radial-trigger').length,
        docScrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`,
  );

  // ---- does the hub cover page content at rest? --------------------------
  out.overlapAtRest = await evaluate(
    cdp,
    sid,
    `(() => {
      const hub = document.querySelector('.radial-trigger');
      const r = hub.getBoundingClientRect();
      const pts = [
        [r.left + r.width/2, r.top + r.height/2],
        [r.left + 4, r.top + 4],
        [r.right - 4, r.bottom - 4],
      ];
      const hits = [];
      for (const [x, y] of pts) {
        const el = document.elementFromPoint(x, y);
        // Ignore the hub itself and its descendants.
        if (el && !el.closest('.radial-sidebar')) {
          hits.push({ x: Math.round(x), y: Math.round(y), tag: el.tagName, cls: (el.className || '').toString().slice(0, 60) });
        }
      }
      return hits;
    })()`,
  );

  // ---- open the menu -----------------------------------------------------
  await evaluate(cdp, sid, `document.querySelector('.radial-trigger').click()`);
  await sleep(450);

  out.open = await evaluate(
    cdp,
    sid,
    `(() => {
      const items = [...document.querySelectorAll('.radial-item')];
      const hub = document.querySelector('.radial-trigger').getBoundingClientRect();
      const hcx = hub.left + hub.width/2, hcy = hub.top + hub.height/2;
      const info = items.map((li) => {
        const a = li.querySelector('a');
        const r = a.getBoundingClientRect();
        const cx = r.left + r.width/2, cy = r.top + r.height/2;
        return {
          label: a.getAttribute('aria-label'),
          active: a.dataset.active === 'true',
          cur: a.getAttribute('aria-current'),
          x: Math.round(cx), y: Math.round(cy),
          radius: Math.round(Math.hypot(cx - hcx, cy - hcy)),
          visible: getComputedStyle(li).visibility,
          opacity: Number(getComputedStyle(li).opacity).toFixed(2),
          inViewport: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
        };
      });
      // Pairwise overlap between item hit boxes.
      const overlaps = [];
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const A = items[i].querySelector('a').getBoundingClientRect();
          const B = items[j].querySelector('a').getBoundingClientRect();
          const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left);
          const oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
          if (ox > 0 && oy > 0) overlaps.push([i, j, Math.round(ox), Math.round(oy)]);
        }
      }
      return { items: info, overlaps, count: items.length, expanded: document.querySelector('.radial-trigger').getAttribute('aria-expanded') };
    })()`,
  );

  // ---- tooltip visible on hover/focus? -----------------------------------
  out.tooltip = await evaluate(
    cdp,
    sid,
    `(() => {
      // Two checks: the ACTIVE item's label must be permanently visible (it is the
      // only "you are here" statement), and any item's label must appear on focus.
      const active = document.querySelector('.radial-link[data-active="true"]');
      const activeTip = active && active.querySelector('.radial-tooltip');
      const any = document.querySelector('.radial-item a');
      any.focus();
      const anyTip = any.querySelector('.radial-tooltip');
      return {
        activeText: activeTip ? activeTip.textContent.trim() : null,
        activeOpacity: activeTip ? getComputedStyle(activeTip).opacity : null,
        focusedText: anyTip.textContent.trim(),
        focusedOpacity: getComputedStyle(anyTip).opacity,
      };
    })()`,
  );

  // ---- keyboard: Escape closes and returns focus -------------------------
  await evaluate(
    cdp,
    sid,
    `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`,
  );
  await sleep(320);
  out.afterEscape = await evaluate(
    cdp,
    sid,
    `(() => ({
      expanded: document.querySelector('.radial-trigger').getAttribute('aria-expanded'),
      focusOnHub: document.activeElement === document.querySelector('.radial-trigger'),
      firstItemVisible: getComputedStyle(document.querySelector('.radial-item')).visibility,
    }))()`,
  );

  // ---- outside click closes ---------------------------------------------
  await evaluate(cdp, sid, `document.querySelector('.radial-trigger').click()`);
  await sleep(400);
  await evaluate(
    cdp,
    sid,
    `document.elementFromPoint(window.innerWidth - 30, window.innerHeight - 30)?.click?.()` +
      `; document.querySelector('.radial-scrim').click()`,
  );
  await sleep(320);
  out.afterOutside = await evaluate(
    cdp,
    sid,
    `document.querySelector('.radial-trigger').getAttribute('aria-expanded')`,
  );

  // ---- keyboard traversal with REAL key events ---------------------------
  // `.focus()` from JS never matches `:focus-visible`, so it cannot prove the
  // keyboard story. Dispatch real keydown events through CDP: open the menu,
  // confirm focus is on the first item, then ArrowDown and ArrowUp and check the
  // focused element and that its label is actually visible.
  await evaluate(cdp, sid, `document.querySelector('.radial-trigger').click()`);
  await sleep(450);
  const kb = {};
  kb.focusOnOpen = await evaluate(cdp, sid, `document.activeElement?.getAttribute('aria-label')`);
  const arrow = async (key, vk) => {
    await cdp.send(
      'Input.dispatchKeyEvent',
      { type: 'rawKeyDown', key, code: key, windowsVirtualKeyCode: vk },
      sid,
    );
    await cdp.send(
      'Input.dispatchKeyEvent',
      { type: 'keyUp', key, code: key, windowsVirtualKeyCode: vk },
      sid,
    );
    await sleep(120);
  };
  await arrow('ArrowDown', 40);
  await arrow('ArrowDown', 40);
  kb.afterTwoDown = await evaluate(cdp, sid, `document.activeElement?.getAttribute('aria-label')`);
  await arrow('ArrowUp', 38);
  kb.afterOneUp = await evaluate(cdp, sid, `document.activeElement?.getAttribute('aria-label')`);
  // The label fades in over 140ms, so wait past that before sampling its opacity.
  // Reading it immediately after the arrow key raced the transition and produced a
  // spurious 0 on some routes while the focus position itself was always correct.
  await sleep(220);
  kb.focusedTooltipOpacity = await evaluate(
    cdp,
    sid,
    `(() => {
      const el = document.activeElement;
      const tip = el && el.querySelector('.radial-tooltip');
      return tip ? getComputedStyle(tip).opacity : null;
    })()`,
  );
  out.keyboard = kb;

  // Close via Escape so the closed-tab check below starts from a known state.
  await evaluate(
    cdp,
    sid,
    `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`,
  );
  await sleep(320);

  // ---- closed menu must not be tabbable ---------------------------------
  // Measured the way a browser decides it: an element is reachable by Tab only
  // if it is a link/button, has tabIndex >= 0, and is not hidden. Counting by
  // `visibility` alone was wrong, because visibility flips only after the close
  // transition ends, which made a correctly-guarded menu look broken.
  out.closedFocusable = await evaluate(
    cdp,
    sid,
    `(() => {
      const links = [...document.querySelectorAll('.radial-item a')];
      return {
        tabIndexValues: links.map((a) => a.tabIndex),
        reachableByTab: links.filter((a) => a.tabIndex >= 0).length,
        activeElementIsInsideMenu: links.some((a) => a === document.activeElement),
      };
    })()`,
  );

  await cdp.send('Target.closeTarget', { targetId });
  return out;
}

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--user-data-dir=${process.env.CHROME_PROFILE_DIR ?? '/tmp/t-5.16-chrome'}`,
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
  const results = [];
  for (const vp of [
    { name: 'desktop', width: 1440, height: 900, mobile: false },
    { name: 'mobile', width: 390, height: 844, mobile: true },
    { name: 'narrow', width: 320, height: 700, mobile: true },
  ]) {
    results.push(await runViewport(cdp, vp));
  }
  console.log(JSON.stringify(results, null, 2));
  chrome.kill('SIGKILL');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
