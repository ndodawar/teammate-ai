import { spawn } from 'node:child_process';
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const [route, theme, w] = [process.argv[2]||'', process.argv[3]||'light', Number(process.argv[4]||1440)];
const p = spawn(CHROME, ['--headless=new','--remote-debugging-port=9391','--no-sandbox','--disable-gpu','--user-data-dir=/tmp/th-'+Date.now(),'about:blank']);
p.stderr.on('data',()=>{});
for (let i=0;i<80;i++){ try{ await fetch('http://127.0.0.1:9391/json/version'); break;}catch{await sleep(250);} }
// Seed origin first, THEN navigate.
const tabs = await (await fetch('http://127.0.0.1:9391/json/new?'+encodeURIComponent('http://localhost:3000/'),{method:'PUT'})).json();
const ws = new WebSocket(tabs.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const pending=new Map();
ws.onmessage=(e)=>{const m=JSON.parse(e.data); if(pending.has(m.id)){pending.get(m.id)(m); pending.delete(m.id);}};
const send=(m,params={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params}));});
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:w,height:900,deviceScaleFactor:1,mobile:w<800});
await sleep(2500);
await send('Runtime.evaluate',{expression:`localStorage.setItem('theme_preference','${theme}')`});
await send('Page.navigate',{url:'http://localhost:3000/'+route});
await sleep(4500);
const r = await send('Runtime.evaluate',{expression:`(()=>{
  const cs=(s)=>{const e=document.querySelector(s); if(!e) return 'MISSING'; const c=getComputedStyle(e); return c.backgroundColor+' | '+c.backdropFilter;};
  return {theme:document.documentElement.dataset.theme, w:innerWidth,
    rail:cs('.rail-surface'), nav:cs('.site-nav-shell'), capsule:cs('.nav-capsule'),
    panel:cs('.glass-panel'), topbar:cs('.app-topbar'),
    blurredCount:[...document.querySelectorAll('*')].filter(e=>getComputedStyle(e).backdropFilter!=='none').length,
    overflow:document.documentElement.scrollWidth-innerWidth};
})()`,returnByValue:true});
console.log(JSON.stringify(r.result.result.value,null,2));
ws.close(); p.kill();
