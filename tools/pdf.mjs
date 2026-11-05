// Steps through the deck in headless Chrome, one page per beat, and writes release/PhD-Defense-slides.pdf.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const OUTPUT = resolve('release', 'PhD-Defense-slides.pdf');
const DEBUG_PORT = 9333;
const SCENE_WAIT_MS = Number(process.env.SCENE_WAIT_MS ?? 11000);
const BEAT_WAIT_MS = Number(process.env.BEAT_WAIT_MS ?? 5000);

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function findBrowser() {
  const candidates = [
    [process.env.ProgramFiles, 'Google\\Chrome\\Application\\chrome.exe'],
    [process.env['ProgramFiles(x86)'], 'Google\\Chrome\\Application\\chrome.exe'],
    [process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'],
    [process.env['ProgramFiles(x86)'], 'Microsoft\\Edge\\Application\\msedge.exe'],
    [process.env.ProgramFiles, 'Microsoft\\Edge\\Application\\msedge.exe'],
  ];
  for (const [folder, path] of candidates) {
    if (folder && existsSync(join(folder, path))) return join(folder, path);
  }
  throw new Error('Chrome or Edge is required.');
}

async function connect() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      const page = targets.find((target) => target.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('The browser did not start.');
}

// The dev server exposes window.__engine, which is how beats are counted.
const server = await createServer({ server: { port: 5190 }, logLevel: 'error' });
await server.listen();
const deckUrl = `${server.resolvedUrls.local[0]}?quality=high#/opening`;

const work = mkdtempSync(join(tmpdir(), 'phd-defense-pdf-'));
const shots = join(work, 'shots');
mkdirSync(shots);

const browser = spawn(findBrowser(), [
  '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${join(work, 'profile')}`,
  '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--force_high_performance_gpu',
  '--window-size=1920,1080', '--hide-scrollbars', '--no-first-run', 'about:blank',
], { stdio: 'ignore' });

const socket = new WebSocket(await connect());
await new Promise((done) => socket.addEventListener('open', done, { once: true }));

let lastId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(JSON.stringify(message.error)));
  else request.resolve(message.result);
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++lastId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

const position = () =>
  evaluate(`(() => { const s = window.__engine.scenes;
    return { index: s.currentIndex, beat: s.beat, id: s.scenes[s.currentIndex].id }; })()`);

const pressNext = async () => {
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', {
      type, key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39,
    });
  }
};

try {
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: deckUrl });

  for (let attempt = 0; attempt < 240; attempt++) {
    const ready = await evaluate('Boolean(window.__engine) && window.__engine.preparing === false').catch(() => false);
    if (ready) break;
    await sleep(500);
  }
  await sleep(SCENE_WAIT_MS);

  const gpu = await evaluate(`(() => { const gl = document.querySelector('canvas').getContext('webgl2');
    const info = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(info.UNMASKED_RENDERER_WEBGL); })()`);
  console.log(`Rendering on ${gpu}`);

  let page = 0;
  let current = await position();
  for (;;) {
    page += 1;
    const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
    const name = `${String(page).padStart(3, '0')}-${current.id}-b${current.beat}.jpg`;
    writeFileSync(join(shots, name), Buffer.from(data, 'base64'));
    console.log(name);

    await pressNext();
    await sleep(300);
    const next = await position();
    if (next.index === current.index && next.beat === current.beat) break;
    await sleep(next.index !== current.index ? SCENE_WAIT_MS : BEAT_WAIT_MS);
    current = next;
  }

  const images = readdirSync(shots).sort();
  const sheet = join(work, 'deck.html');
  writeFileSync(sheet, `<!doctype html><html><head><style>
@page { size: 1920px 1080px; margin: 0; }
html, body { margin: 0; background: #000; }
img { display: block; width: 1920px; height: 1080px; break-after: page; }
img:last-child { break-after: auto; }
</style></head><body>${images.map((file) => `<img src="shots/${file}">`).join('')}</body></html>`);

  await send('Page.navigate', { url: pathToFileURL(sheet).href });
  await sleep(4000);
  const { data: pdf } = await send('Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
  });

  mkdirSync('release', { recursive: true });
  writeFileSync(OUTPUT, Buffer.from(pdf, 'base64'));
  console.log(`\n${images.length} pages written to ${OUTPUT}`);
} finally {
  socket.close();
  browser.kill();
  await server.close();
  await sleep(500);
  rmSync(work, { recursive: true, force: true });
}
