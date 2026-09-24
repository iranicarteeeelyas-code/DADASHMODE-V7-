// DADASHMODE V7 · Control Room (desktop + tablet + standalone phone)
import { Host } from './host.js';
import { deckHTML, bindActions, updateTimers, esc, B } from './deck.js';
import { directorView, studioView, subsView, voiceView, dataView, logView, phonesView, settingsView, PRESETS } from './views.js';
import { StageRenderer } from '../stage/renderer.js';
import { PHASES, GEMINI, CFG, TIMELINE, SHOTS } from '../shared/data.js';
import { fmtClock, initialState, priceOf } from '../shared/engine.js';
import { toSRT, toVTT, toSRTEnglishBlank } from '../shared/subs.js';
import { play, setVolume, setEnabled, setCustom, clearCustom, audioCtx } from '../shared/sfx.js';
import { qrSVG } from '../shared/qr.js';
import { kv, listVersions, voices, sfxStore, download } from './store.js';
import { speak, startRec, stopRec, vkey } from './voice.js';
import { uid } from '../shared/sync.js';

const $ = (s, r = document) => r.querySelector(s);
const host = new Host(); const ui = { view: 'control', checks: {}, lineIdx: {} };
const NAV = [
  ['control', 'اتاق کنترل', 'M4 5h16v10H4z M8 19h8'], ['director', 'کارگردانی', 'M4 6h16 M4 12h10 M4 18h13'], ['studio', 'استودیو', 'M3 7h13v10H3z M16 10l5-3v10l-5-3'],
  ['subs', 'زیرنویس', 'M3 6h18v12H3z M7 14h4 M13 14h4 M7 10h10'], ['voice', 'صدا و گوینده', 'M12 3v10 M8 9v2a4 4 0 0 0 8 0V9 M12 17v4'],
  ['data', 'قسمت و داده‌ها', 'M5 4h14v16H5z M9 8h6 M9 12h6'], ['log', 'لاگ و حافظه', 'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5'], ['phones', 'گوشی‌ها', 'M8 3h8v18H8z M11 18h2'], ['settings', 'تنظیمات', 'M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z M12 2v3 M12 19v3 M2 12h3 M19 12h3'],
];
const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

function toast(msg, kind = 'err') { const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; $('#toasts').append(t); setTimeout(() => t.classList.add('out'), 2200); setTimeout(() => t.remove(), 2700); }
const send = a => { audioCtx(); const r = host.dispatch({ ...a, src: 'host' }); return r; };

// ---------- shell
function shell() {
  $('#rail').innerHTML = `<div class="brand"><b>DADASH</b><span>MODE</span><small>TIME BANK · V7</small></div><nav>${NAV.map(([k, l, d]) => `<button data-nav="${k}" class="${ui.view === k ? 'on' : ''}">${svg(d)}<span>${l}</span></button>`).join('')}</nav><div class="rail-foot"><span id="link-dot" class="dot"></span><span id="link-txt">محلی</span></div>`;
  $('#rail').onclick = e => { const b = e.target.closest('[data-nav]'); if (b) { ui.view = b.dataset.nav; if (ui.view === 'log') listVersions().then(v => { ui.versions = v; render(true); }); if (ui.view === 'voice') refreshKeys(); if (ui.view === 'phones') fetchInfo(); shell(); render(true); } };
}
function header(V) {
  const ph = PHASES.find(p => p.id === V.phase);
  $('#top').innerHTML = `<div class="ph"><span class="live-dot"></span><b>${esc(ph.fa)}</b><small class="mono">${esc(TIMELINE[V.phase]?.time || '')}</small></div>
    <div class="tools">${B('UNDO', { type: 'UNDO' }, 'ghost sm', { key: 'U' })}${B('SYNC', { type: 'SYNC' }, 'ghost sm', { key: 'S' })}${B('CC', { type: 'SET', path: 'subs.on', value: !V.settings.subs.on }, (V.settings.subs.on ? 'gold' : 'ghost') + ' sm', { key: 'C' })}${B('کروما', { type: 'SET', path: 'chroma', value: V.settings.chroma === 'off' ? 'on' : 'off' }, (V.settings.chroma !== 'off' ? 'gold' : 'ghost') + ' sm', { key: 'G' })}${B('خروجی ↗', { local: 'openStage' }, 'ghost sm')}</div>`;
}
function flow(V) {
  const i0 = PHASES.findIndex(p => p.id === V.phase);
  return `<div class="flow">${PHASES.map((p, i) => `<button class="step ${i < i0 ? 'past' : ''} ${i === i0 ? 'now' : ''}" data-go="${p.id}"><span class="mono">${p.t}</span><b>${esc(p.fa)}</b></button>`).join('')}</div>`;
}
function tiles(V) {
  return ['E', 'M'].map(p => { const eff = V.effects[p] || {}; return `<div class="tile ${p}"><span class="nm">${esc(V.names[p])}</span><b class="mono" data-bank="${p}">${fmtClock(V.banks[p])}</b><div class="eff">${eff.gloves ? '<i class="E">دستکش</i>' : ''}${eff.spicy ? '<i class="E">معمای تند</i>' : ''}${eff.hint ? '<i class="A">ذره‌بین</i>' : ''}</div></div>`; }).join('');
}
function geminiCard(V) {
  const lines = [...(GEMINI[V.phase] || []), ...GEMINI.ANY]; const idx = (ui.lineIdx[V.phase] || 0) % lines.length;
  return `<section class="card gem"><header class="card-h">جملهٔ بعدی جمنای <kbd>T</kbd></header><div class="card-b"><p class="next-line">«${esc(lines[idx])}»</p>
    <div class="row">${B('بگو + زیرنویس', { local: 'sayNext' }, 'G')}${B('بعدی', { local: 'nextLine' }, 'ghost')}</div>
    <details><summary>همهٔ جمله‌های این بخش</summary><div class="lines-list">${lines.map((t, i) => `<div class="gl"><span>${esc(t)}</span>${B('بگو', { type: 'SAY', speaker: 'G', text: t }, 'sm G')}</div>`).join('')}</div></details>
    <div class="row"><select id="say-sp" class="inp sm"><option value="G">جمنای</option><option value="E">${esc(V.names.E)}</option><option value="M">${esc(V.names.M)}</option><option value="A">اپ</option></select><input id="say-tx" class="inp" placeholder="زیرنویس آزاد…">${B('ارسال', { local: 'sayFree' }, 'ghost sm')}</div></div></section>`;
}
function controlView(V) {
  return `<div class="bankbar">${tiles(V)}</div>${flow(V)}
  <div class="control-grid"><div id="deck" class="deck">${deckHTML(V, Date.now())}</div>
  <aside class="side-col"><div class="preview-slot" id="slot-control"></div>${geminiCard(V)}
  <section class="card"><header class="card-h">لاگ زنده</header><div class="card-b logmini mono">${V.log.slice(-8).reverse().map(l => `<div><span>${esc(l.t)}</span> ${esc(l.text)}</div>`).join('')}</div></section></aside></div>`;
}

// ---------- preview renderer (single WebGL context moved between slots)
let preview = null, pvCanvas = null;
function mountPreview() {
  const slot = document.querySelector('.preview-slot'); if (!slot) return;
  if (!pvCanvas) { pvCanvas = document.createElement('canvas'); pvCanvas.className = 'pv'; try { preview = new StageRenderer(pvCanvas, { width: 1280, height: 720, preview: true }); } catch (e) { slot.innerHTML = '<p class="dim">WebGL در دسترس نیست</p>'; return; } }
  if (pvCanvas.parentElement !== slot) slot.append(pvCanvas);
}
let lastSeq = -1, lastView = '';
function render(force) {
  const V = host.view('director'); header(V);
  if (force || V.seq !== lastSeq || ui.view !== lastView) {
    lastSeq = V.seq; lastView = ui.view;
    const main = $('#main'); const keepScroll = main.scrollTop;
    const html = { control: controlView, director: v => directorView(v, ui), studio: studioView, subs: subsView, voice: v => voiceView(v, ui), data: dataView, log: v => logView(v, ui), phones: v => phonesView(v, ui), settings: settingsView }[ui.view](V);
    const focused = document.activeElement && document.activeElement.id; const val = focused && document.activeElement.value;
    if (ui.view === 'control' && $('#deck') && !force) { $('#deck').innerHTML = deckHTML(V, Date.now()); $('.bankbar').innerHTML = tiles(V); $('.flow').outerHTML = flow(V); const lm = $('.logmini'); if (lm) lm.innerHTML = V.log.slice(-8).reverse().map(l => `<div><span>${esc(l.t)}</span> ${esc(l.text)}</div>`).join(''); const nl = $('.next-line'); if (nl) { const g = $('.gem'); g.outerHTML = geminiCard(V); } }
    else { main.innerHTML = `<div class="view v-${ui.view}">${html}</div>`; main.scrollTop = keepScroll; }
    if (focused && $('#' + focused)) { $('#' + focused).focus(); if (val != null) $('#' + focused).value = val; }
    mountPreview(); drawQRs();
  }
}
function drawQRs() { document.querySelectorAll('[data-qr]').forEach(el => { if (!el.innerHTML) try { el.innerHTML = qrSVG(el.dataset.qr, 5); } catch (e) { el.textContent = 'QR خطا'; } }); }
function frame() {
  const V = host.view('stage'); const now = Date.now();
  if (preview && pvCanvas && pvCanvas.isConnected) { V.settings = { ...V.settings }; preview.render(V, now); }
  const deck = $('#deck'); if (deck) updateTimers(deck, V, now);
  requestAnimationFrame(frame);
}

// ---------- local actions
async function local(a, btn) {
  const V = host.s;
  switch (a.local) {
    case 'openStage': { const u = 'stage.html?room=' + V.settings.link.room + (a.chroma ? '&chroma=1' : '') + '&sfx=' + (V.settings.sfxWhere !== 'control' ? 1 : 0); host.stageWin = window.open(u, 'dm7stage', 'width=1280,height=720'); setTimeout(() => host.broadcast(true), 800); break; }
    case 'privateShop': privateShop(a.p); break;
    case 'sayNext': { const lines = [...(GEMINI[V.phase] || []), ...GEMINI.ANY]; const t = lines[(ui.lineIdx[V.phase] || 0) % lines.length]; const r = send({ type: 'SAY', speaker: 'G', text: t }); if (!r.error) { speak(t); ui.lineIdx[V.phase] = (ui.lineIdx[V.phase] || 0) + 1; render(true); } break; }
    case 'nextLine': ui.lineIdx[V.phase] = (ui.lineIdx[V.phase] || 0) + 1; render(true); break;
    case 'sayFree': { const t = $('#say-tx').value.trim(); if (!t) return; const sp = $('#say-sp').value; const r = send({ type: 'SAY', speaker: sp, text: t, tts: sp === 'G' }); if (!r.error) { if (sp === 'G') speak(t); $('#say-tx').value = ''; } break; }
    case 'subTest': send({ type: 'SAY', speaker: 'G', text: $('#sub-test').value, force: true }); break;
    case 'csv': download('dadashmode-v7-log.csv', '\ufefftime,phase,event,source\n' + V.log.map(l => [l.t, l.ph, '"' + l.text.replace(/"/g, '""') + '"', l.src].join(',')).join('\n'), 'text/csv;charset=utf-8'); break;
    case 'srt': download('dadashmode-v7-fa.srt', toSRT(V.cues, V.settings.subs, V.showStart || V.cues[0]?.at || 0)); break;
    case 'vtt': download('dadashmode-v7-fa.vtt', toVTT(V.cues, V.settings.subs, V.showStart || V.cues[0]?.at || 0), 'text/vtt'); break;
    case 'srt-en': download('dadashmode-v7-en.srt', toSRTEnglishBlank(V.cues, V.settings.subs, V.showStart || 0)); break;
    case 'backup': download(`dadashmode-v7-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`, JSON.stringify(V), 'application/json'); break;
    case 'restore': { const f = await pickFile('.json'); if (!f) return; try { const s = JSON.parse(await f.text()); if (s.v !== 7) throw 0; host.replace(s); toast('بازیابی شد', 'ok'); } catch (e) { toast('فایل پشتیبان نامعتبر'); } break; }
    case 'restoreVer': { const v = (ui.versions || []).find(x => x.at === a.at); if (v) { host.replace(v.state); toast('نسخه بازگردانی شد', 'ok'); } break; }
    case 'reset': { const keep = V.settings; const s = initialState(V.names); s.settings = keep; s.badges = V.badges; host.replace(s); break; }
    case 'seal': { const c = $('#code-in').value; const r = send({ type: 'SET_CODE', code: c }); if (!r.error) { $('#code-in').value = ''; toast('رمز مهر شد · کد: ' + host.s.vault.seal, 'ok'); } break; }
    case 'edit': { const r = send({ type: 'EDIT', p: $('#ed-p').value, delta: Number($('#ed-d').value), reason: $('#ed-r').value.trim() }); if (!r.error) toast('اصلاح ثبت شد', 'ok'); break; }
    case 'print': printSheet(); break;
    case 'play': speak(a.text); break;
    case 'rec': if (ui.recording === a.text) { const b = await stopRec(); if (b) await voices.set(vkey(a.text), b); ui.recording = null; await refreshKeys(); toast('ضبط شد', 'ok'); } else { try { await startRec(); ui.recording = a.text; render(true); } catch (e) { toast('دسترسی میکروفون لازم است'); } } break;
    case 'importVoice': { const f = await pickFile('audio/*'); if (f) { await voices.set(vkey(a.text), f); await refreshKeys(); } break; }
    case 'sfx': audioCtx(); play(a.name); break;
    case 'importSfx': { const f = await pickFile('audio/*'); if (f) { const buf = await f.arrayBuffer(); await sfxStore.set(a.name, buf); await setCustom(a.name, buf); await refreshKeys(); } break; }
    case 'delSfx': await sfxStore.del(a.name); clearCustom(a.name); await refreshKeys(); break;
    case 'newPin': send({ type: 'SET', path: 'link.pin', value: String(1000 + Math.floor(Math.random() * 9000)) }); toast('PIN تازه؛ صفحه را دوباره بارگذاری کن', 'ok'); break;
  }
}
function pickFile(accept) { return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0]); i.click(); }); }
async function refreshKeys() { try { ui.voiceKeys = new Set(await voices.keys()); ui.sfxKeys = Object.keys(await sfxStore.all()); } catch (e) {} render(true); }
async function fetchInfo() { try { const r = await fetch('/api/info'); ui.info = await r.json(); } catch (e) { ui.info = null; } render(true); }

function privateShop(p) {
  const ov = document.createElement('div'); ov.className = 'private';
  const draw = () => { const S = host.s, sh = S.shop, picks = sh.picks[p]; const left = S.banks[p] - sh.paid[p];
    ov.innerHTML = `<div class="private-in"><h2>نوبت <span class="pn ${p}">${esc(S.names[p])}</span> · بقیه نگاه نکنند</h2><p class="dim">حداکثر ۲ کارت · فقط ۱ قرمز · بانک بعد از خرید: <b class="mono">${fmtClock(left)}</b></p>
      <div class="shopgrid">${Object.entries(CFG.shop.cards).map(([k, c]) => `<button class="shopcard ${c.color} ${picks.includes(k) ? 'on' : ''}" data-k="${k}"><b>${c.fa}</b><span class="mono">${priceOf(S, p, k)}</span><small>${c.line}</small></button>`).join('')}</div>
      <div class="row">${B(picks.length ? 'ثبت انتخاب' : 'هیچی · ثبت', null, 'gold xl submit')}${B('بستن بدون ثبت', null, 'ghost close')}</div></div>`; };
  ov.addEventListener('click', e => { const c = e.target.closest('[data-k]'); if (c) { const r = send({ type: 'SHOP_PICK', p, card: c.dataset.k }); if (!r.error) draw(); return; } if (e.target.closest('.submit')) { send({ type: 'SHOP_SUBMIT', p }); ov.remove(); } if (e.target.closest('.close')) ov.remove(); });
  draw(); document.body.append(ov);
}
function printSheet() {
  const V = host.s; const w = window.open('', '_blank');
  w.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>برگهٔ مادر V7</title><style>@font-face{font-family:V;src:url(fonts/Vazirmatn.ttf)}body{font-family:V,sans-serif;margin:24px;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:6px 8px;font-size:13px;text-align:right}th{background:#111;color:#fff}h1{margin:0 0 8px}.b{border:2px solid #111;padding:8px;margin:10px 0}</style></head><body><h1>برگهٔ مادر V7 · ${esc(V.names.E)} / ${esc(V.names.M)}</h1>
  <table><tr><th>زمان</th><th>بخش</th><th>قانون</th><th>شات‌ها</th></tr>${PHASES.map(p => `<tr><td>${TIMELINE[p.id]?.time || ''}</td><td>${p.fa}</td><td>${TIMELINE[p.id]?.rule || ''}</td><td>${(SHOTS[p.id] || []).map(s => s[0]).join(' ')}</td></tr>`).join('')}</table>
  <div class="b"><b>اعداد مقدس:</b> ۴۵ شروع · R3 کف ۳ سقف ۲۰ · R4 ۱۵ (۱۰/۵، −۵) · سقف فاصله ۳۰ · کارت ۱۰/۵/۱۵/۱۰/۲۰ · مالیات ۵ · کف ۲۰ · حافظه ۵/۸/−۳ · معما قفل ۵ · کد ۳ ثانیه</div>
  <div class="b"><b>ایمنی:</b> ناظر هایملیچ کنار میز · کلمهٔ توقف «قرمز» · جمنای ساکت با دهان پر · اورژانس ۱۱۵</div>
  <div class="b"><b>قبل از REC:</b> رمز کیف مهر شد؟ (${V.vault.seal || '—'}) · گوشی‌ها جفت شدند؟ · زیرنویس زنده برای نسخهٔ تمیز خاموش؟ · چسب‌ها تست شد؟ · ساندویچ‌ها وزن شد؟</div><script>print()<\/script></body></html>`);
}

// ---------- inputs (segments, toggles, ranges)
function bindInputs(root) {
  root.addEventListener('click', e => {
    const s = e.target.closest('[data-set]'); if (s) { const path = s.dataset.set, v = JSON.parse(s.dataset.v); if (path === 'subs.preset') { send({ type: 'SET_MANY', subs: { ...PRESETS[v], preset: v } }); } else send({ type: 'SET', path, value: v }); return; }
    const g = e.target.closest('[data-go]'); if (g) { if (g.dataset.go !== host.s.phase && confirm('رفتن به «' + PHASES.find(p => p.id === g.dataset.go).fa + '»؟')) send({ type: 'PHASE_GO', phase: g.dataset.go }); return; }
    const d = e.target.closest('[data-dir]'); if (d) { ui.dirPhase = d.dataset.dir; render(true); return; }
    const c = e.target.closest('[data-copy]'); if (c) { navigator.clipboard?.writeText(c.textContent); toast('کپی شد', 'ok'); }
  });
  root.addEventListener('change', e => {
    const t = e.target; if (t.dataset.toggle) send({ type: 'SET', path: t.dataset.toggle, value: t.checked });
    if (t.dataset.check) { ui.checks[t.dataset.check] = t.checked; kv.set('checks', ui.checks); }
    if (t.dataset.name) send({ type: 'NAMES', names: { [t.dataset.name]: t.value.trim() || (t.dataset.name === 'E' ? 'اِلیاس' : 'عِماد') } });
  });
  root.addEventListener('input', e => { const t = e.target; if (t.dataset.range) { const v = Number(t.value); send({ type: 'SET', path: t.dataset.range, value: v }); if (t.dataset.range === 'volume') setVolume(v); } });
}

// ---------- hotkeys (9.5)
function hotkeys() {
  addEventListener('keydown', e => {
    if (e.target.matches('input, textarea, select')) return; const S = host.s, ph = S.phase, k = e.key; let a = null;
    const R3 = ph === 'R3_SANDWICH';
    if (R3 && '79'.includes(k)) a = { type: 'R3_MOUTH', p: k === '7' ? 'E' : 'M' };
    else if (R3 && '13'.includes(k)) a = { type: 'R3_EMPTY', p: k === '1' ? 'E' : 'M' };
    else if (R3 && '46'.includes(k)) a = { type: 'R3_PEN', p: k === '4' ? 'E' : 'M' };
    else if ('12'.includes(k) && k.length === 1) { const p = k === '1' ? 'E' : 'M'; a = ph === 'R1' ? { type: 'R1_WIN', p } : ph === 'R2' ? { type: 'R2_THROW', p, hit: true } : ph === 'R4_GLUE' ? { type: 'R4_FINISH', p } : null; }
    else if (k === '0' && ph === 'R4_GLUE') { const F = S.r4; const last = ['E', 'M'].filter(p => F.finish[p] != null).sort((x, y) => F.finish[y] - F.finish[x])[0]; if (last) a = { type: 'R4_WRONG', p: last }; }
    else if (k === '*' && ph === 'R4_GLUE' && S.r4.first) a = { type: 'R4_CHALLENGE', p: S.r4.first === 'E' ? 'M' : 'E' };
    else if (k === ' ') { e.preventDefault(); a = ph === 'R1' ? { type: 'TIMER', op: S.timer.running ? 'stop' : 'start' } : R3 && !S.r3.startAt ? { type: 'R3_START' } : ph === 'R4_GLUE' && !S.r4.startAt ? { type: 'R4_START' } : (ph === 'RUN1' || ph === 'RUN2') && S.run && !S.run.startAt ? { type: 'RUN_START' } : null; }
    else if (k === 'Enter') a = ph === 'REVEAL' ? { type: 'REVEAL_DO' } : ph === 'SHOP_REVEAL' ? { type: 'SHOP_REVEAL' } : ph === 'CASE' ? { type: 'CASE_NEXT' } : (ph === 'RUN1' || ph === 'RUN2') && S.run?.station === 4 ? { type: 'CODE_ENTER' } : null;
    else if (/^[0-9]$/.test(k) && (ph === 'RUN1' || ph === 'RUN2') && S.run?.station === 4) a = { type: 'CODE_KEY', d: k };
    else if (k === 'u' || k === 'U') a = { type: 'UNDO' };
    else if (k === 's' || k === 'S') a = { type: 'SYNC' };
    else if (k === 'p' || k === 'P') a = { type: 'RUN_PAUSE' };
    else if (k === 'g' || k === 'G') a = { type: 'SET', path: 'chroma', value: S.settings.chroma === 'off' ? 'on' : 'off' };
    else if (k === 'c' || k === 'C') a = { type: 'SET', path: 'subs.on', value: !S.settings.subs.on };
    else if (k === '[' || k === ']') a = { type: 'SET', path: 'subs.cps', value: Math.max(8, Math.min(25, S.settings.subs.cps + (k === ']' ? 1 : -1))) };
    else if (k === '-' || k === '=') a = { type: 'SET', path: 'subs.size', value: Math.max(24, Math.min(96, S.settings.subs.size + (k === '=' ? 4 : -4))) };
    else if (k === 't' || k === 'T') { local({ local: 'sayNext' }); return; }
    else if (k === 'F2') { e.preventDefault(); ui.view = 'phones'; fetchInfo(); shell(); render(true); return; }
    if (a) { e.preventDefault(); const r = send(a); if (r && r.error) toast(r.error); }
  });
}

// ---------- boot
(async function boot() {
  await host.init(); ui.checks = (await kv.get('checks')) || {};
  const s = host.s.settings; setVolume(s.volume); setEnabled(s.sfx);
  try { const all = await sfxStore.all(); for (const [k, v] of Object.entries(all)) await setCustom(k, v); } catch (e) {}
  shell(); render(true); hotkeys(); bindActions(document.body, a => { const r = send(a); if (r.error) toast(r.error); if (a.type === 'SAY' && !r.error && a.speaker === 'G') speak(a.text); }, local); bindInputs(document.body);
  host.onError(m => toast(m)); host.on(kind => { if (kind !== 'tick') { render(); const st = host.wsStatus || {}; const dot = $('#link-dot'); if (dot) { dot.className = 'dot ' + (st.ws ? 'on' : ''); $('#link-txt').textContent = st.ws ? `شبکه · ${host.peers.size} دستگاه` : 'فقط همین دستگاه'; } ui.ws = st.ws; ui.peers = [...host.peers].map(([id, p]) => ({ id, role: p.role })); setEnabled(host.s.settings.sfx); } });
  document.fonts && document.fonts.ready.then(() => render(true));
  addEventListener('pointerdown', () => audioCtx(), { once: true });
  window.__dm = { host, send, ui, render };
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
