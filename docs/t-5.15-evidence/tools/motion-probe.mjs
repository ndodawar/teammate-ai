// Measures whether scroll-reveal motion actually runs in the live browser.
// For each `[data-motion-reveal]` element we scroll it into view, sample its
// computed opacity/transform over time, and report whether it changed. Sampling
// computed style is the only way to tell "an animation exists in the bundle"
// apart from "the animation is visible to the user".
import { spawn } from 'node:child_process';
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`;
const BASE = 'http://localhost:3000';
const route = process.argv[2] ?? '/';
const theme = process.argv[3] ?? 'light';
const reduced = process.argv[4] === 'reduced';
const W = Number(process.argv[5] ?? 1440), H = Number(process.argv[6] ?? 900);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const p = spawn(CHROME, ['--headless=new','--remote-debugging-port=9431','--no-sandbox','--disable-gpu','--hide-scrollbars','--force-prefers-reduced-motion=' + (reduced?'reduce':'no-preference'),`--user-data-dir=/tmp/mp-${Date.now()}`,'about:blank']);
p.stderr.on('data',()=>{});
for (let i=0;i<80;i++){ try{ await fetch('http://127.0.0.1:9431/json/version'); break;}catch{ await sleep(250);} }
const page = (await (await fetch('http://127.0.0.1:9431/json/list')).json()).find(t=>t.type==='page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let id=0; const pending=new Map();
ws.onmessage=(e)=>{const m=JSON.parse(e.data); if(pending.has(m.id)){pending.get(m.id)(m); pending.delete(m.id);}};
const send=(method,params={},sid)=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method,params,sessionId:sid}));});

const {result:{targetId}} = await send('Target.createTarget',{url:'about:blank'});
const {result:{sessionId}} = await send('Target.attachToTarget',{targetId,flatten:true});
await send('Page.enable',{},sessionId);
await send('Runtime.enable',{},sessionId);
await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:W<800},sessionId);
await send('Page.navigate',{url:`${BASE}/`},sessionId); await sleep(2000);
await send('Runtime.evaluate',{expression:`localStorage.setItem('theme_preference','${theme}')`},sessionId);
await send('Page.navigate',{url:`${BASE}${route}`},sessionId); await sleep(3500);

const total = await send('Runtime.evaluate',{expression:`document.querySelectorAll('[data-motion-reveal]').length`,returnByValue:true},sessionId);

// Scroll through the page in steps and collect how many reveal elements ever
// reported an opacity < 1, i.e. were mid-animation at some sample.
const result = await send('Runtime.evaluate',{expression:`(async()=>{
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const els=[...document.querySelectorAll('[data-motion-reveal]')];
  const seen=new Map(); // index -> min opacity observed
  const h=document.documentElement.scrollHeight;
  const step=Math.max(120, innerHeight*0.4);
  for(let y=0;y<=h;y+=step){
    window.scrollTo(0,y);
    for(let s=0;s<4;s++){
      await sleep(60);
      els.forEach((el,i)=>{
        const cs=getComputedStyle(el);
        const o=parseFloat(cs.opacity);
        const m=cs.transform;
        const prev=seen.get(i);
        if(!prev) seen.set(i,{minO:o,moving:m!=='none'});
        else { prev.minO=Math.min(prev.minO,o); if(m!=='none') prev.moving=true; }
      });
    }
  }
  let animated=0, everHidden=0;
  for(const v of seen.values()){ if(v.moving) animated++; if(v.minO<0.99) everHidden++; }
  return {total:els.length, sampled:seen.size, animatedByTransform:animated, everBelowFullOpacity:everHidden,
    scrollHeight:h};
})()`,awaitPromise:true,returnByValue:true},sessionId);
console.log(JSON.stringify({route,theme,reduced,viewport:[W,H],domRevealCount:total.result.result.value,...result.result.result.value},null,2));
ws.close(); p.kill();
