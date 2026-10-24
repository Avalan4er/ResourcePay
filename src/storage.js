// OPFS persistence glue — browser API layer, NOT unit-covered (SPEC Testing strategy names loadState/saveState as integration-only; proven by tests/e2e/persistence-reload.feature). One file bills.json, whole-state rewrite per save. shortcut: fine for one person's bills (<1MB); move to delta writes if history ever grows past that.
const WORKER_SRC = `
let acc = null; // one sync access handle per file per context: open lazily, CLOSE after every load/save so a reloading/reopened document sees the written bytes (MDN's visibility rule)
self.onmessage = async (ev) => {
  const { cmd, payload } = ev.data;
  try {
    if (!acc) {
      const fh = await (await navigator.storage.getDirectory()).getFileHandle('bills.json', { create: true });
      // factory names differ per engine/context (secure OPFS vs older docs vs sandboxed); they are receiver-bound zero-arg methods, so call as fh[n]() — an unbound alias throws "Illegal invocation".
      let err; for (const n of ['createFileSystemSyncAccessHandle', 'createSyncAccessHandle', 'createSandboxedFileSystemUnionHandle']) { if (!fh?.[n]) continue; try { acc = await fh[n](); break; } catch (e) { err = e; } } // probe-verified on Edge 155: inside a dedicated worker only createSyncAccessHandle exists; call it as fh[n]() so the receiver stays bound
      if (!acc) throw err ?? Error('no sync access handle factory on this file handle');
    }
    if (cmd === 'load') { const n = acc.getSize(), b = new Uint8Array(n); if (n) { try { acc.read(b, { at: 0 }); } catch (e2) { if (!/options|not of type/i.test(String(e2))) throw e2; acc.read(b, 0); } } const out = new TextDecoder().decode(b); acc.close(); acc = null; self.postMessage({ ok: true, data: out }); return; } // close after every op: MDN says writes are only guaranteed visible to another context once the writing handle is closed (an iPhone reload/relaunch is exactly that)
    const enc = new TextEncoder().encode(payload); acc.truncate(0); try { acc.write(enc, { at: 0 }); } catch (e2) { if (!/options|not of type/i.test(String(e2))) throw e2; acc.write(enc, 0); } acc.flush(); acc.close(); acc = null; self.postMessage({ ok: true }); // same rule applies after writes
  } catch (e) { self.postMessage({ ok: false, err: String(e) }); }
};`;

const queue = []; let worker = null;
try { worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC]))); const wire = (e) => { const cb = queue.shift(); if (cb) cb(e.data ?? { ok: false, err: 'worker failed' }); }; worker.addEventListener('message', wire); worker.addEventListener('error', wire); } catch (_) {} // CSP-blocked blob worker fires 'error': resolve the pending call so saveState rejects and the UI shows STR.noStorage instead of hanging
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(cmd, payload = null) { const p = new Promise((res) => queue.push(res)); worker.postMessage({ cmd, payload }); const r = await p; if (!r?.ok) throw Error(r?.err ?? 'storage unavailable'); return r; } // FIFO is safe: a dedicated Worker has one ordered message lane

// navigation tears the previous page's worker down asynchronously, so a fresh handle can briefly collide with the old one. shortcut: backoff-retry only on handle-in-use errors, then bubble (upgrade: explicit close() per document if a browser ever requires it).
async function xfer(cmd, payload = null) { for (let i = 0; ; i++) { try { return await ask(cmd, payload); } catch (e) { const m = String(e?.message ?? e); if (i > 2 || !/being accessed|in use|another context|another frame/i.test(m)) throw e; await sleep(150 * (i + 1)); } } }

export async function loadState() { if (!worker) throw Error('no opfs worker'); const r = await xfer('load'); return r.data ? JSON.parse(r.data) : null; }
export async function saveState(s) { if (!worker) throw Error('no opfs worker'); await xfer('save', JSON.stringify(s)); return s; }
