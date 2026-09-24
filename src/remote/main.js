// DADASHMODE V7 · Phone remote. Roles: DIRECTOR · PLAYER_E · PLAYER_M · JUDGE · MONITOR
import { Link, uid } from '../shared/sync.js';
import { deckHTML, bindActions, updateTimers, esc, B } from '../control/deck.js';
import { CFG, PHASES, GEMINI } from '../shared/data.js';
import { fmtClock, priceOf, r4Elapsed } from '../shared/engine.js';

const $ = s => document.querySelector(s);
const q = new URLSearchParams(location.search);
let room = q.get('room') || localStorage.getItem('dm7-room') || 'DM7', pin = q.get('pin') || localStorage.getItem('dm7-pin') || '';
let role = q.get('role') || localStorage.getItem('dm7-role') || '';
let V = null, priv = null, offset = 0, link = null, pending = new Map(), lastAt = 0, lastSeq = -1, wake = null;
const ROLES = [['DIRECTOR', 'کارگردان', 'کل مسابقه از گوشی: دکمه‌های هر بخش، زیرنویس، جمنای', 'G'], ['PLAYER_E', 'بازیکن قرمز', 'تمام · خرید مخفی · شرط', 'E'], ['PLAYER_M', 'بازیکن سبز', 'تمام · خرید مخفی · شرط', 'M'], ['JUDGE', 'داور', 'دهان خالی · غلط · نتیجهٔ چالش', 'A'], ['MONITOR', 'مانیتور', 'نمایش خروجی روی تلویزیون/تبلت', 'gold']];
const now = () => Date.now() + offset;
function toast(t, k = 'err') { const d = document.createElement('div'); d.className = 'toast ' + k; d.textContent = t; $('#toasts').append(d); setTimeout(() => d.classList.add('out'), 1800); setTimeout(() => d.remove(), 2300); }
function send(action) {
  if (!link) return; const id = uid(); const P = role.startsWith('PLAYER_') ? role.slice(7) : undefined;
  const a = { ...action }; if (P && a.p == null && /^(R4_FINISH|R4_CHALLENGE|SHOP_|RISK_STAKE)/.test(a.type)) a.p = P;
  pending.set(id, Date.now()); link.send({ type: 'cmd', id, role, action: a }); if (navigator.vibrate) navigator.vibrate(15);
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); toast('پاسخی از اتاق کنترل نیامد'); } }, 3500);
}
function onMsg(m) {
  if (m.type === 'state') { offset = m.snap.hostNow - Date.now(); lastAt = Date.now(); const ch = m.snap.seq !== lastSeq; V = m.snap; priv = m.priv; lastSeq = V.seq; if (ch) render(); }
  if (m.type === 'ack' && pending.has(m.id)) { const t0 = pending.get(m.id); pending.delete(m.id); if (m.error) { toast(m.error); if (navigator.vibrate) navigator.vibrate([60, 40, 60]); } else { const b = $('#sent'); b.textContent = `ثبت شد ● ${Date.now() - t0}ms`; b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 900); } }
}
function connect() {
  localStorage.setItem('dm7-room', room); localStorage.setItem('dm7-pin', pin); localStorage.setItem('dm7-role', role);
  if (role === 'MONITOR') { location.href = `stage.html?room=${encodeURIComponent(room)}&pin=${encodeURIComponent(pin)}`; return; }
  link = new Link({ role, room, pin, onMsg, onStatus: s => { const d = $('#net'); if (!d) return; d.className = 'net ' + (s.ws ? 'on' : ''); d.textContent = s.code === 4003 ? 'PIN غلط' : s.ws ? (s.latency != null ? s.latency + 'ms' : 'وصل') : 'قطع'; if (s.code === 4003) { toast('PIN اشتباه است'); localStorage.removeItem('dm7-pin'); } } });
  try { navigator.wakeLock && navigator.wakeLock.request('screen').then(w => (wake = w)); } catch (e) {}
  render();
}

// ---------- screens
function picker() {
  document.body.dataset.role = '';
  $('#app').innerHTML = `<div class="pick"><div class="brand"><b>DADASH</b><span>MODE</span><small>TIME BANK · V7</small></div>
  <label>اتاق<input id="r-room" class="inp mono" value="${esc(room)}" autocomplete="off"></label><label>PIN<input id="r-pin" class="inp mono" inputmode="numeric" value="${esc(pin)}" placeholder="۴ رقم از صفحهٔ «گوشی‌ها»"></label>
  <div class="roles">${ROLES.map(([k, fa, d, c]) => `<button class="role ${c}" data-role="${k}"><b>${fa}</b><small>${d}</small></button>`).join('')}</div></div>`;
  $('#app').onclick = e => { const b = e.target.closest('[data-role]'); if (!b) return; role = b.dataset.role; room = $('#r-room').value.trim() || 'DM7'; pin = $('#r-pin').value.trim(); history.replaceState(null, '', `?room=${room}&pin=${pin}&role=${role}`); connect(); };
}
const phaseFa = () => PHASES.find(p => p.id === V.phase)?.fa || '';
function topbar() { const nm = ROLES.find(r => r[0] === role); return `<header class="rtop"><button class="ghost sm btn" id="switch">${esc(nm ? nm[1] : role)}</button><b>${esc(V ? phaseFa() : 'در انتظار اتاق کنترل…')}</b><span id="net" class="net">…</span></header>
  ${V ? `<div class="mini-bank"><div class="E"><span>${esc(V.names.E)}</span><b class="mono">${fmtClock(V.banks.E)}</b></div><div class="M"><span>${esc(V.names.M)}</span><b class="mono">${fmtClock(V.banks.M)}</b></div></div>` : ''}`; }

function playerScreen(p) {
  const o = p === 'E' ? 'M' : 'E'; const ph = V.phase; let body = '';
  if (ph === 'R4_GLUE') { const F = V.r4; const lock = now() < (F.lockUntil?.[p] || 0); const mine = F.finish?.[p];
    body = `<div class="bigwrap"><div class="timer big mono" data-timer="r4">${fmtClock(F.startAt ? Math.max(0, 180 - r4Elapsed(V, now())) : 180)}</div>
    ${B(mine != null ? `ثبت شد · ${fmtClock(mine, true)}` : lock ? 'قفل ۵ ثانیه' : 'تمام!', { type: 'R4_FINISH' }, `mega ${p}`, { dis: !F.startAt || mine != null || lock || !!F.result })}
    ${F.first && F.first !== p && mine != null && !F.challenge ? B('چالش! (فقط یک بار)', { type: 'R4_CHALLENGE' }, 'gold xl') : ''}
    <p class="dim">${!F.startAt ? 'منتظر شروع راند باش' : F.result ? 'نتیجه ثبت شد' : 'فقط وقتی پازل کامل شد بزن. اشتباه = لغو + ۵ ثانیه قفل.'}</p></div>`; }
  else if (ph === 'SHOP') { const sh = V.shop; const picks = (priv && priv[p]) || []; const paid = (priv && priv['paid' + p]) || 0; const done = sh.submitted[p];
    body = `<div class="private-in"><h3>خرید مخفی · ${esc(V.names[p])}</h3><p class="dim">بانک ${fmtClock(V.banks[p])} · پرداخت ${paid} · بعد از خرید ${fmtClock(V.banks[p] - paid)} · کف ${CFG.floor}</p>
    <div class="shopgrid">${Object.entries(CFG.shop.cards).map(([k, c]) => { const on = picks.includes(k); const pr = priceOf(V, p, k); return `<button class="shopcard ${c.color} ${on ? 'on' : ''}" data-a="${encodeURIComponent(JSON.stringify({ type: 'SHOP_PICK', card: k }))}" ${done ? 'disabled' : ''}><b>${esc(c.fa)}</b><span class="mono">${pr}s</span><small>${esc(c.line)}</small></button>`; }).join('')}</div>
    <p class="small">حداکثر ۲ کارت · فقط ۱ قرمز · مالیات لیدر روی قرمز/طلایی +۵</p>
    ${done ? '<div class="ok">ثبت شد. صبر کن تا افشای همزمان.</div>' : B(`ثبت نهایی (${picks.length} کارت)`, { type: 'SHOP_SUBMIT' }, 'gold xl', { confirm: 'ثبت نهایی؟ دیگر قابل تغییر نیست.' })}</div>`; }
  else if (ph === 'RISK') { const rk = V.risk; const mine = rk.stake?.[p]; const first = rk.order?.[0]; const wait = p !== first && !rk.stake?.[first];
    body = `<div class="private-in"><h3>شرط آخر</h3>${mine ? `<div class="ok big">قفل شد: ${mine.allIn ? 'همه‌چی ۳۰' : mine.v}</div>` : wait ? `<p class="dim">اول ${esc(V.names[first])} اعلام می‌کند…</p>` : `<div class="stakes">${CFG.risk.stakes.map(v => B(String(v), { type: 'RISK_STAKE', stake: v }, 'stake xl')).join('')}${B('همه‌چی ۳۰', { type: 'RISK_STAKE', stake: 'ALLIN' }, 'stake xl danger', { confirm: 'همه‌چی ۳۰؟ فقط نفر عقب با فاصلهٔ ۱۵+' })}</div>`}</div>`; }
  else body = `<div class="bigwrap"><p class="lead">${esc(phaseFa())}</p><p class="dim">دکمه‌های تو در راند ۴، فروشگاه و شرط آخر فعال می‌شوند.</p><div class="vs"><span class="${p}">${esc(V.names[p])}</span><i>vs</i><span class="${o}">${esc(V.names[o])}</span></div></div>`;
  return body;
}
function judgeScreen() {
  const ph = V.phase; let b = '';
  if (ph === 'R3_SANDWICH') { const R = V.r3; b = `<div class="duo">${['E', 'M'].map(p => `<div class="side ${p}"><h4>${esc(V.names[p])}</h4><div class="timer mono" data-timer="r3-${p}">0.0</div>
    ${B('دهان‌پر', { type: 'R3_MOUTH', p }, 'line', { dis: !R.startAt || !!R.mouthAt?.[p] })}${B('دهان خالی ✔', { type: 'R3_EMPTY', p }, `xl ${p}`, { dis: !R.mouthAt?.[p] || !!R.done?.[p] })}${B('+۳ جریمه', { type: 'R3_PEN', p }, 'ghost')}</div>`).join('')}</div>
    ${B('توقف ایمنی «قرمز»', { type: 'R3_SAFETY' }, 'danger xl', { confirm: 'توقف ایمنی؟ هر دو +۵' })}`; }
  else if (ph === 'R4_GLUE') { const F = V.r4; b = `<div class="timer big mono" data-timer="r4">3:00</div><div class="duo">${['E', 'M'].map(p => `<div class="side ${p}"><h4>${esc(V.names[p])}</h4><p class="mono">${F.finish?.[p] != null ? fmtClock(F.finish[p], true) : '—'}</p>${B('غلط (لغو + قفل)', { type: 'R4_WRONG', p }, 'danger', { dis: F.finish?.[p] == null })}</div>`).join('')}</div>
    ${F.challenge && F.challenge.result === undefined ? `<div class="card"><div class="card-b"><h4>نتیجهٔ چالش</h4><div class="row">${B(esc(V.names.E), { type: 'R4_CH_RESULT', winner: 'E' }, 'E xl')}${B(esc(V.names.M), { type: 'R4_CH_RESULT', winner: 'M' }, 'M xl')}${B('نامشخص', { type: 'R4_CH_RESULT', winner: null }, 'ghost xl')}</div></div></div>` : ''}`; }
  else if (ph === 'R1') b = `<div class="duo">${['E', 'M'].map(p => B(`برد ${esc(V.names[p])}`, { type: 'R1_WIN', p }, `mega ${p}`)).join('')}</div>${B('تساوی', { type: 'R1_TIE' }, 'ghost xl')}`;
  else b = `<div class="bigwrap"><p class="lead">${esc(phaseFa())}</p><p class="dim">دکمه‌های داور در راند ۱، ۳ و ۴ فعال می‌شوند.</p></div>`;
  return b;
}
function directorScreen() {
  const lines = [...(GEMINI[V.phase] || []), ...GEMINI.ANY]; const S = V.settings.subs;
  return `<div class="deck">${deckHTML(V, now())}</div>
  <details class="card"><summary class="card-h">جمنای و زیرنویس</summary><div class="card-b">
  <div class="row">${B(S.on ? 'زیرنویس روشن' : 'زیرنویس خاموش', { type: 'SET', path: 'subs.on', value: !S.on }, S.on ? 'gold' : 'ghost')}${B('کندتر', { type: 'SET', path: 'subs.cps', value: Math.max(8, S.cps - 2) }, 'ghost sm')}<span class="mono">${S.cps} cps</span>${B('تندتر', { type: 'SET', path: 'subs.cps', value: Math.min(25, S.cps + 2) }, 'ghost sm')}</div>
  <div class="seg">${['all', 'word', 'type', 'karaoke'].map(m => B({ all: 'یکجا', word: 'کلمه‌ای', type: 'تایپی', karaoke: 'کارائوکه' }[m], { type: 'SET', path: 'subs.mode', value: m }, S.mode === m ? 'gold sm' : 'ghost sm')).join('')}</div>
  <div class="lines-list">${lines.map(t => `<div class="gl"><span>${esc(t)}</span>${B('بگو', { type: 'SAY', speaker: 'G', text: t }, 'sm G')}</div>`).join('')}</div></div></details>
  <div class="row sticky">${B('UNDO', { type: 'UNDO' }, 'ghost')}${B('SYNC', { type: 'SYNC' }, 'ghost')}</div>`;
}
function render() {
  if (!role || !link) return picker();
  document.body.dataset.role = role;
  const open = [...document.querySelectorAll('details[open]')].map(d => d.querySelector('summary')?.textContent);
  const y = scrollY;
  let body = !V ? `<div class="bigwrap"><p class="lead">در انتظار اتاق کنترل…</p><p class="dim">اتاق ${esc(room)} · صفحهٔ اصلی را روی کامپیوتر باز نگه دار.</p></div>`
    : role === 'DIRECTOR' ? directorScreen() : role === 'JUDGE' ? judgeScreen() : playerScreen(role.slice(7));
  $('#app').innerHTML = topbar() + `<main class="rbody">${body}</main><div id="sent" class="sent"></div>`;
  document.querySelectorAll('details').forEach(d => { if (open.includes(d.querySelector('summary')?.textContent)) d.open = true; });
  scrollTo(0, y);
  $('#switch').onclick = () => { if (confirm('تغییر نقش؟')) { localStorage.removeItem('dm7-role'); location.href = 'remote.html'; } };
}
bindActions(document.getElementById('app'), send, () => {});
setInterval(() => { if (V) updateTimers(document, V, now()); if (V && V.phase === 'R4_GLUE' && role.startsWith('PLAYER_')) { const F = V.r4; const p = role.slice(7); if (F.lockUntil?.[p] && Math.abs(now() - F.lockUntil[p]) < 150) render(); } if (link && lastAt && Date.now() - lastAt > 4000) { const d = $('#net'); if (d) { d.className = 'net'; d.textContent = 'قطع'; } } }, 100);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && link && navigator.wakeLock) navigator.wakeLock.request('screen').then(w => (wake = w)).catch(() => {}); });
if (role && (q.get('role') || localStorage.getItem('dm7-role'))) connect(); else picker();
