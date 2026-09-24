// DADASHMODE V7 · Stage output (OBS / CapCut / TV). Receives state only, never decides.
import { StageRenderer } from './renderer.js';
import { Link } from '../shared/sync.js';
import { initialState, publicView } from '../shared/engine.js';
import { audioCtx } from '../shared/sfx.js';

const q = new URLSearchParams(location.search);
const room = q.get('room') || localStorage.getItem('dm7-room') || 'DM7', pin = q.get('pin') || localStorage.getItem('dm7-pin') || '';
const W = +(q.get('w') || 1920), H = +(q.get('h') || 1080);
const cv = document.getElementById('stage'); const tb = document.getElementById('tb'); const st = document.getElementById('st');
let R; try { R = new StageRenderer(cv, { width: W, height: H }); } catch (e) { document.body.innerHTML = '<p style="color:#ddd;font:20px Vazirmatn;padding:40px">WebGL فعال نیست. کروم یا اج را با شتاب سخت‌افزاری باز کنید.</p>'; throw e; }
R.mute = q.get('sfx') !== '1';
let snap = publicView(initialState(), Date.now(), 'stage'); snap._waiting = true; let offset = 0, lastAt = 0;
function take(m) { if (m.type !== 'state' || !m.snap) return; offset = m.snap.hostNow - Date.now(); snap = m.snap; lastAt = Date.now(); if (q.get('chroma') === '1') snap.settings.chroma = 'on'; if (q.get('chroma') === '0') snap.settings.chroma = 'off'; }
const link = new Link({ role: 'stage', room, pin, onMsg: take, onStatus: s => { st.textContent = s.ws ? 'شبکه ●' : 'محلی'; } });
window.addEventListener('message', e => e.data && take(e.data));
if (window.opener) try { window.opener.postMessage({ type: 'stage-hello' }, '*'); } catch (e) {}

// dual export: second renderer forced to chroma so one take gives clean + key plate
let R2 = null, cv2 = null;
function frame() {
  const now = Date.now() + offset; const S = snap;
  if (Date.now() - lastAt > 4000 && !S._waiting) st.textContent = 'اتصال قطع شد…';
  R.render(S, now);
  if (R2) R2.render({ ...S, settings: { ...S.settings, chroma: 'on', subs: { ...S.settings.subs, on: false } } }, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// recording
let recs = [];
function mime() { for (const m of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']) if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; return ''; }
function recorder(canvas, tag) {
  const stream = canvas.captureStream(60); const mt = mime(); const r = new MediaRecorder(stream, { mimeType: mt, videoBitsPerSecond: 24e6 }); const chunks = [];
  r.ondataavailable = e => e.data.size && chunks.push(e.data);
  r.onstop = () => { const b = new Blob(chunks, { type: mt }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `DADASHMODE-${tag}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${mt.includes('mp4') ? 'mp4' : 'webm'}`; a.click(); };
  r.start(1000); return r;
}
function toggleRec(dual) {
  if (recs.length) { recs.forEach(r => r.stop()); recs = []; document.body.classList.remove('rec'); if (R2) { R2.renderer.dispose(); R2 = null; cv2.remove(); cv2 = null; } return; }
  if (!mime()) { alert('ضبط در این مرورگر پشتیبانی نمی‌شود. از OBS استفاده کنید.'); return; }
  recs.push(recorder(cv, snap.settings.chroma !== 'off' ? 'KEY' : 'CLEAN'));
  if (dual) { cv2 = document.createElement('canvas'); cv2.style.display = 'none'; document.body.append(cv2); R2 = new StageRenderer(cv2, { width: W, height: H }); R2.mute = true; R2.lastFx = R.lastFx; recs.push(recorder(cv2, 'KEY')); }
  document.body.classList.add('rec');
}
const fs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}));
addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (k === 'f') fs(); if (k === 'r') toggleRec(false); if (k === 'd') toggleRec(true); if (k === 'm') { R.mute = !R.mute; audioCtx(); flash(R.mute ? 'صدا خاموش' : 'صدا روشن'); } if (k === 'h') document.body.classList.toggle('clean'); });
tb.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; audioCtx(); dispatchEvent(new KeyboardEvent('keydown', { key: b.dataset.k })); });
function flash(t) { st.textContent = t; }
let hideT; addEventListener('mousemove', () => { document.body.classList.add('hover'); clearTimeout(hideT); hideT = setTimeout(() => document.body.classList.remove('hover'), 1800); });
