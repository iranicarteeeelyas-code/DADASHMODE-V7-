// IndexedDB persistence: current state, 25 versions, daily snapshots, voices, custom SFX
const DB = 'dadashmode-v7'; let dbp = null;
function db() { if (!dbp) dbp = new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => { const d = r.result; ['kv', 'versions', 'voices', 'sfx'].forEach(s => d.objectStoreNames.contains(s) || d.createObjectStore(s)); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); return dbp; }
async function tx(store, mode, fn) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode); const s = t.objectStore(store); const out = fn(s); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); }
export const kv = {
  get: k => tx('kv', 'readonly', s => s.get(k)).catch(() => null),
  set: (k, v) => tx('kv', 'readwrite', s => s.put(v, k)).catch(() => null),
};
export async function saveVersion(state, label) {
  const key = Date.now(); await tx('versions', 'readwrite', s => s.put({ label, at: key, state }, key));
  const keys = await tx('versions', 'readonly', s => s.getAllKeys()); if (keys.length > 25) await tx('versions', 'readwrite', s => keys.slice(0, keys.length - 25).forEach(k => s.delete(k)));
  const day = new Date().toISOString().slice(0, 10); await kv.set('daily-' + day, state);
}
export const listVersions = () => tx('versions', 'readonly', s => s.getAll()).catch(() => []);
export const voices = { get: k => tx('voices', 'readonly', s => s.get(k)), set: (k, v) => tx('voices', 'readwrite', s => s.put(v, k)), del: k => tx('voices', 'readwrite', s => s.delete(k)), keys: () => tx('voices', 'readonly', s => s.getAllKeys()) };
export const sfxStore = { get: k => tx('sfx', 'readonly', s => s.get(k)), set: (k, v) => tx('sfx', 'readwrite', s => s.put(v, k)), del: k => tx('sfx', 'readwrite', s => s.delete(k)), all: async () => { const keys = await tx('sfx', 'readonly', s => s.getAllKeys()); const out = {}; for (const k of keys) out[k] = await tx('sfx', 'readonly', s => s.get(k)); return out; } };
export function download(name, content, type = 'text/plain;charset=utf-8') { const b = content instanceof Blob ? content : new Blob([content], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
