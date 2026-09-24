// Phase deck: context controls for the current state (desktop control room + director phone)
import { CFG, PHASES, TARGETS, FATE, BITES, GEMINI } from '../shared/data.js';
import { fmtClock, r3Elapsed, r4Elapsed, runLeft, timerValue, trailerOf, leaderOf } from '../shared/engine.js';

const enc = o => encodeURIComponent(JSON.stringify(o));
const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function B(label, a, cls = '', o = {}) { return `<button class="btn ${cls}" ${a ? `data-a="${enc(a)}"` : ''} ${o.confirm ? `data-confirm="${esc(o.confirm)}"` : ''} ${o.dis ? 'disabled' : ''} ${o.key ? `title="کلید ${esc(o.key)}"` : ''}>${label}${o.key ? `<kbd>${esc(o.key)}</kbd>` : ''}</button>`; }
const card = (title, body, cls = '') => `<section class="card ${cls}">${title ? `<header class="card-h">${title}</header>` : ''}<div class="card-b">${body}</div></section>`;
const pl = (V, p) => `<span class="pn ${p}">${esc(V.names[p])}</span>`;
const nextPhase = V => { const i = PHASES.findIndex(p => p.id === V.phase); return PHASES[i + 1]; };
export function goNext(V, label) { const n = nextPhase(V); return n ? B(`${label || 'مرحلهٔ بعد'} · ${esc(n.fa)}`, { type: 'PHASE_GO', phase: n.id }, 'next') : ''; }

export function deckHTML(V, now, ctx = {}) {
  const f = DECK[V.phase]; const body = f ? f(V, now, ctx) : '';
  return `<div class="deck-inner" data-phase="${V.phase}">${body}</div>`;
}
const DECK = {};
DECK.READY = (V) => card('شروع', `<p class="lead">هوک، معرفی و قانون یک‌خطی. بانک هر نفر ${fa(45)} ثانیه.</p>
  ${!V.vault.seal ? `<div class="warn">رمز کیف هنوز مهر نشده. از «قسمت و داده‌ها» سه رقم را وارد کن (نفر سوم).</div>` : `<div class="ok">کد مهر رمز: <b class="mono">${esc(V.vault.seal)}</b> · جلوی تروث‌کم ثبت شود</div>`}
  <div class="row">${B('SYNC · فلش + بوق', { type: 'SYNC' }, 'ghost', { key: 'S' })}${goNext(V, 'شروع')}</div>`);
DECK.R1 = (V, now) => { const tv = timerValue(V, now); const done = !!V.r1.result;
  return card('راند ۱ · برج لیوان', `<div class="timer" data-timer="r1">${fmtClock(tv.left ?? 30)}</div>
  <div class="row">${B(V.timer.running ? 'توقف' : 'شروع تایمر ۳۰', { type: 'TIMER', op: V.timer.running ? 'stop' : 'start' }, 'gold', { key: 'Space' })}${B('ریست', { type: 'TIMER', op: 'reset' }, 'ghost')}</div>
  <div class="duo">${['E', 'M'].map((p, i) => `<div class="side ${p}">${pl(V, p)}${B('برج سالم · +۱۰', { type: 'R1_WIN', p }, 'xl ' + p, { dis: done, key: String(i + 1) })}</div>`).join('')}</div>
  <div class="row small">${B('هم‌زمان · هر دو +۵', { type: 'R1_TIE' }, 'ghost', { dis: done })}${B(`هیچ‌کس · +۵ ${esc(V.names.E)}`, { type: 'R1_NONE', p: 'E' }, 'ghost', { dis: done })}${B(`هیچ‌کس · +۵ ${esc(V.names.M)}`, { type: 'R1_NONE', p: 'M' }, 'ghost', { dis: done })}${B('برابر · هیچ', { type: 'R1_NONE', p: null }, 'ghost', { dis: done })}</div>
  ${done ? `<div class="ok">ثبت شد</div>` : ''}<div class="row">${goNext(V)}</div>`); };
DECK.R2 = (V) => card('راند ۲ · فاصله را خودت انتخاب کن', `<p class="hint">هرچه دورتر، امتیاز بیشتر. خط یک بار قفل می‌شود؛ فقط اولین گل ارزش دارد.</p>
  <div class="duo">${['E', 'M'].map((p, i) => { const L = V.r2.line[p], th = V.r2.throws[p], sc = V.r2.scored[p]; const over = sc || th.length >= 3;
    return `<div class="side ${p}">${pl(V, p)}<div class="lines">${Object.entries(CFG.r2.lines).map(([k, v]) => B(`<b>${fa(v.m)} متر</b><span>+${fa(v.pts)}</span>`, { type: 'R2_LOCK', p, line: k }, 'line ' + (L === k ? 'on' : ''), { dis: !!L })).join('')}</div>
      <div class="dots">${[0, 1, 2].map(k => `<i class="${th[k] === 1 ? 'hit' : th[k] === 0 ? 'miss' : th[k] === -1 ? 'void' : ''}"></i>`).join('')}</div>
      <div class="row">${B('گُل', { type: 'R2_THROW', p, hit: true }, 'gold', { dis: !L || over, key: String(i + 1) })}${B('نخورد', { type: 'R2_THROW', p, hit: false }, 'ghost', { dis: !L || over })}${B('باطل', { type: 'R2_THROW', p, void: true }, 'ghost', { dis: !L || over })}</div>${sc ? `<div class="ok">+${fa(sc)}</div>` : ''}</div>`; }).join('')}</div><div class="row">${goNext(V)}</div>`);
DECK.R3_SANDWICH = (V, now) => { const R = V.r3; const el = r3Elapsed(V, now);
  return card('راند ۳ · دوئل ساندویچ', `<div class="safety"><b>ایمنی:</b> ناظر هایملیچ کنار میز · جمنای ساکت · کلمهٔ توقف «قرمز»</div>
  <div class="row">${B(R.startAt ? 'در حال اجرا' : 'بوق شروع', { type: 'R3_START' }, 'gold xl', { dis: !!R.startAt, key: 'Space' })}${B('قرمز · توقف ایمنی', { type: 'R3_SAFETY' }, 'danger xl', { dis: !!R.result, confirm: 'توقف ایمنی؟ راند لغو و اگر حال همه خوب است هر دو +۵' })}</div>
  <div class="duo">${['E', 'M'].map((p, i) => { const d = R.done[p], m = R.mouthAt[p]; const T = R.T[p];
    return `<div class="side ${p}">${pl(V, p)}<div class="timer big ${d === 'empty' ? 'final' : m ? 'temp' : ''}" data-timer="r3-${p}">${(T ?? (R.startAt ? el + R.pen[p] : 0)).toFixed(1)}</div>
    <div class="status">${d === 'empty' ? 'قطعی' : d === 'dq' ? 'رد صلاحیت' : d === 'nofinish' ? 'تمام نکرد (۶۰)' : m ? 'موقت · ۳۰ ثانیه برای قورت' : '—'}</div>
    <div class="row">${B('دهان‌پر', { type: 'R3_MOUTH', p }, 'xl ' + p, { dis: !R.startAt || !!m || !!d, key: i ? '9' : '7' })}${B('دهان خالی ✔', { type: 'R3_EMPTY', p }, 'xl gold', { dis: !m || !!d, key: i ? '3' : '1' })}</div>
    <div class="row small">${B('جریمه +۳', { type: 'R3_PEN', p }, 'ghost', { dis: !R.startAt || !!d, key: i ? '6' : '4' })}${B('رد صلاحیت', { type: 'R3_DQ', p }, 'ghost', { dis: !!d, confirm: 'رد صلاحیت (برگشت غذا)؟' })}</div></div>`; }).join('')}</div>
  ${R.needLeftLess ? `<div class="warn">هیچ‌کس تمام نکرد: کی کمتر باقی گذاشت؟ (نمای بالا S5)</div><div class="row">${B(V.names.E, { type: 'R3_LEFTLESS', p: 'E' }, 'E')}${B(V.names.M, { type: 'R3_LEFTLESS', p: 'M' }, 'M')}${B('برابر', { type: 'R3_LEFTLESS', p: null }, 'ghost')}</div>` : ''}
  ${R.result ? `<div class="ok">${esc(R.result.note || '')}</div>` : ''}<div class="row">${goNext(V)}</div>`); };
DECK.TWIST_BANKOPEN = (V) => card('پیچش میانی · بانک باز شد', `<p class="lead">گلیچ طلایی، صدای قفل، ۵ کارت قفل با قیمت. هیچ عددی عوض نمی‌شود.</p>
  <div class="row">${B('پخش دوبارهٔ انیمیشن', { type: 'FX', fx: 'bankopen' }, 'gold')}${goNext(V)}</div>`);
DECK.R4_GLUE = (V, now) => { const F = V.r4; const el = r4Elapsed(V, now); const second = F.first ? (F.first === 'E' ? 'M' : 'E') : null;
  return card('راند ۴ · دستکش، پازل و چسب', `<div class="timer" data-timer="r4">${fmtClock(F.startAt ? 180 - el : 180)}</div>
  <div class="row">${B(F.startAt ? 'در حال اجرا' : 'شروع ۱۸۰', { type: 'R4_START' }, 'gold', { dis: !!F.startAt, key: 'Space' })}</div>
  <div class="duo">${['E', 'M'].map((p, i) => `<div class="side ${p}">${pl(V, p)}<div class="status">${F.finish[p] != null ? 'تمام · ' + fmtClock(F.finish[p], true) : now < F.lockUntil[p] ? 'قفل ۵ ثانیه' : 'در حال چیدن'} ${F.first === p ? '· اول' : ''}</div>
    <div class="row">${B('تمام', { type: 'R4_FINISH', p }, 'xl ' + p, { dis: !F.startAt || F.finish[p] != null || !!F.result, key: String(i + 1) })}${B('غلط', { type: 'R4_WRONG', p }, 'ghost', { dis: F.finish[p] == null || !!F.result, key: '0' })}</div></div>`).join('')}</div>
  ${F.first && !F.challenge && !F.result ? `<div class="row">${B(`چالش چسب · ${esc(V.names[second])}`, { type: 'R4_CHALLENGE', p: second }, 'gold', { dis: F.finish[second] == null, key: '*' })}${B('نهایی کن (+۱۵ اولی)', { type: 'R4_FINALIZE' }, '')}</div>` : ''}
  ${F.challenge && F.challenge.result === undefined ? `<div class="warn">تست تکان، بعد «جمنای، کدوم چسب دقیق‌تره؟ معیار: قاب، بعد تمیزی.»</div><div class="row">${B('برنده ' + esc(V.names.E), { type: 'R4_CH_RESULT', winner: 'E' }, 'E')}${B('برنده ' + esc(V.names.M), { type: 'R4_CH_RESULT', winner: 'M' }, 'M')}${B('نامشخص', { type: 'R4_CH_RESULT', winner: null }, 'ghost')}</div>` : ''}
  ${F.needNone ? `<div class="warn">هیچ‌کس معتبر تمام نکرد: +۵ به پازل درست‌تر</div><div class="row">${B(V.names.E, { type: 'R4_NONE', p: 'E' }, 'E')}${B(V.names.M, { type: 'R4_NONE', p: 'M' }, 'M')}${B('برابر', { type: 'R4_NONE', p: null }, 'ghost')}</div>` : ''}
  ${F.result ? `<div class="ok">${esc(F.result.note)}</div>` : ''}<div class="row">${goNext(V)}</div>`); };
DECK.REVEAL = (V) => card('رونمایی بانک', `<p class="lead">اگر فاصله بیشتر از ۳۰ باشد، نفر عقب به «جلو منهای ۳۰» می‌رسد (یک بار).</p>
  <div class="row">${B('اجرای رونمایی', { type: 'REVEAL_DO' }, 'gold xl', { dis: V.reveal.done, key: 'Enter' })}</div>${V.reveal.done ? `<div class="ok">${V.reveal.capped ? 'سقف اعمال شد' : 'بدون سقف'}</div>` : ''}<div class="row">${goNext(V)}</div>`);
DECK.SHOP = (V, now, ctx) => card('فروشگاه کارت و دردسر', `<p class="hint">انتخاب‌ها مخفی‌اند؛ هر بازیکن روی گوشی خودش (یا صفحهٔ پنهان روی همین لپ‌تاپ). نفر عقب اول.</p>
  <div class="duo">${['E', 'M'].map(p => `<div class="side ${p}">${pl(V, p)}<div class="status">${V.shop.submitted[p] ? 'ثبت شد ●' : 'در حال انتخاب...'}</div>${ctx.private !== false ? B('صفحهٔ انتخاب پنهان', { local: 'privateShop', p }, 'ghost', { dis: V.shop.submitted[p] }) : ''}</div>`).join('')}</div>
  <div class="row">${B('رونمایی همزمان', { type: 'PHASE_GO', phase: 'SHOP_REVEAL' }, 'gold xl', { dis: !(V.shop.submitted.E && V.shop.submitted.M) })}</div>`);
DECK.SHOP_REVEAL = (V) => card('رونمایی کارت‌ها', `<div class="row">${B('رونمایی و حل برخورد', { type: 'SHOP_REVEAL' }, 'gold xl', { dis: V.shop.revealed, key: 'Enter' })}${!V.shop.revealed ? B('رونمایی اجباری', { type: 'SHOP_REVEAL', force: true }, 'ghost', { confirm: 'بدون ثبت هر دو نفر رونمایی شود؟' }) : ''}</div>
  ${V.shop.revealed ? `<ul class="list">${V.shop.outcome.map(o => `<li><b>${esc(CFG.shop.cards[o.card].fa)}</b> ${esc(V.names[o.from])} → ${esc(V.names[o.dest])} · ${({ ACTIVE: 'فعال', BLOCKED: 'خنثی', BOUNCED: 'برگشت', BURNED: 'سوخت' })[o.status]}</li>`).join('') || '<li>هیچ‌کس کارت نخرید</li>'}</ul>` : ''}<div class="row">${goNext(V)}</div>`);
DECK.RISK = (V) => { const t = V.risk.order[0]; const gap = Math.abs(V.banks.E - V.banks.M);
  return card('شوت ریسک', `<p class="hint">اول ${esc(V.names[t] || '')} اعلام می‌کند. کف بانک ۲۰. «همه‌چی ۳۰» فقط برای نفر عقب با فاصلهٔ ≥ ۱۵.</p>
  <div class="duo">${['E', 'M'].map(p => { const st = V.risk.stake[p], res = V.risk.result[p]; const canAll = trailerOf(V.banks) === p && gap >= 15;
    return `<div class="side ${p}">${pl(V, p)}<div class="row">${[0, 10, 20].map(v => B(fa(v), { type: 'RISK_STAKE', p, stake: v }, 'stake ' + (st && !st.allIn && st.v === v ? 'on' : ''), { dis: !!st || V.banks[p] - v < 20 })).join('')}${B('همه‌چی ۳۰', { type: 'RISK_STAKE', p, stake: 'ALLIN' }, 'stake ' + (st && st.allIn ? 'on' : ''), { dis: !!st || !canAll || V.banks[p] - 30 < 20 })}</div>
    <div class="row">${B('خورد ✔', { type: 'RISK_RESULT', p, hit: true }, 'gold', { dis: !st || !!res })}${B('نخورد ✘', { type: 'RISK_RESULT', p, hit: false }, 'danger', { dis: !st || !!res })}</div>${res ? `<div class="ok">${res === 'HIT' ? 'خورد' : 'نخورد'}</div>` : ''}</div>`; }).join('')}</div><div class="row">${goNext(V)}</div>`); };
DECK.VAULT_ARMED = (V) => card('آماده‌سازی فینال', `<ul class="check">${['AI-CAM به سکوی داور S7 + «چک کادر»', 'برگه، ماژیک، چشم‌بند، ۸ لیوان وارونه', 'دستکش کنار ایستگاه ۲ (اگر فعال)', 'نفر دوم ۱۵ متر دور، پشت به میز، هدفون', 'تروث‌کم هنوز ضبط می‌کند'].map(x => `<li>${x}</li>`).join('')}</ul>
  <div class="ok">دویدن اول: ${pl(V, V.vault.order[0] || trailerOf(V.banks) || 'M')} · هدف نقاشی: <b>${V.vault.target != null ? esc(TARGETS[V.vault.target].fa) : '—'}</b></div><div class="row">${goNext(V, 'شروع')}</div>`);
function runDeck(V, now) {
  const r = V.run; if (!r) return card('فینال', `<p>این دویدن ثبت شده.</p><div class="row">${goNext(V)}</div>`);
  const left = runLeft(r, now); const eff = V.effects[r.p] || {}; const T = V.vault.target != null ? TARGETS[V.vault.target] : null;
  let st = '';
  if (!r.startAt) st = `<div class="row">${B('شروع دویدن', { type: 'RUN_START' }, 'gold xl', { key: 'Space' })}</div>`;
  else if (r.result) st = `<div class="ok big">${r.result.open ? 'گاوصندوق باز شد · ' + fmtClock(r.result.left, true) : 'وقت تمام · کدها ' + fa(r.result.codes)}</div><div class="row">${goNext(V)}</div>`;
  else if (r.station === 1) st = `<div class="station"><h4>۱ · نقاشی کور</h4><p>هدف: <b>${T ? esc(T.fa) : ''}</b> · قبول: ${T ? T.ok.map(esc).join('، ') : ''}</p><p class="hint">«جمنای، این چیه؟ فقط یه کلمه.» فقط کلمهٔ اول حساب است.</p>
    <div class="row">${B('PASS ← C1', { type: 'S1_PASS' }, 'gold xl', { dis: r.stage === 'target' })}${B('حدس غلط · برگهٔ نو', { type: 'S1_WRONG' }, 'ghost')}</div></div>`;
  else if (r.station === 2) st = `<div class="station"><h4>۲ · اتاق حافظه ${eff.gloves ? '<span class="tag E">با دستکش</span>' : ''}</h4><p class="hint">${({ show: 'نگاه کن (۵ ثانیه)', lock: 'قفل ورودی: فقط روی میز بچین (۸ ثانیه)', input: 'ردیف میز را از چپ به راست (از دید دونده) وارد کن', hint: 'ذره‌بین: ۳ ثانیه' })[r.stage] || ''}</p>
    <div class="cups">${r.s2.input.map((v, i) => B(`<i>${fa(i + 1)}</i>${v ? '▲ بالا' : '▼ پایین'}`, { type: 'S2_TOGGLE', i }, 'cup ' + (v ? 'up' : 'down'), { dis: r.stage !== 'input' })).join('')}</div>
    <div class="row">${B('CHECK', { type: 'S2_CHECK' }, 'gold xl', { dis: r.stage !== 'input' })}${eff.hint && !r.hintUsed ? B('ذره‌بین · ۳ ثانیه', { type: 'S2_HINT' }, 'A', { dis: r.stage !== 'input' }) : ''}${eff.gloves ? B('یک دست بی‌دستکش (−۵)', { type: 'RUN_PEN', sec: 5, reason: 'یک دست بی‌دستکش بعد از ۶۰ ثانیه' }, 'ghost', { confirm: 'بعد از ۶۰ ثانیه در ایستگاه ۲؟ −۵ ثانیه' }) : ''}</div>${r.s2.lastN != null && r.s2.lastN < 8 ? `<div class="warn">${fa(r.s2.lastN)} از ۸ · −۳</div>` : ''}</div>`;
  else if (r.station === 3) st = `<div class="station"><h4>۳ · معمای خنده‌دار ${eff.spicy ? '<span class="tag E">تند</span>' : ''}</h4><p class="riddle">${esc(V.vault.riddleText?.text || '')}</p>${V.vault.riddleText?.hint ? `<p class="hint">ذره‌بین: ${esc(V.vault.riddleText.hint)}</p>` : ''}
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => B(fa(d), { type: 'S3_ANSWER', d }, 'key', { dis: now < r.s3.lockUntil })).join('')}</div><div class="row">${eff.hint && !r.hintUsed ? B('ذره‌بین · جملهٔ کمکی', { type: 'S3_HINT' }, 'A') : ''}</div>${now < r.s3.lockUntil ? '<div class="warn">قفل ۵ ثانیه</div>' : ''}</div>`;
  else if (r.station === 4) st = `<div class="station"><h4>۴ · گاوصندوق</h4><div class="codebox mono">${(r.code.entry || '').padEnd(3, '_').split('').join(' ')}</div>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => B(fa(d), { type: 'CODE_KEY', d: String(d) }, 'key', { dis: now < r.code.lockUntil })).join('')}${B('پاک', { type: 'CODE_KEY', d: 'C' }, 'key ghost')}</div>
    <div class="row">${B('باز کن', { type: 'CODE_ENTER' }, 'gold xl', { dis: (r.code.entry || '').length !== 3 || now < r.code.lockUntil, key: 'Enter' })}</div>${now < r.code.lockUntil ? '<div class="warn">کد غلط · قفل ۵ ثانیه · نمایش دوبارهٔ کدها</div>' : ''}</div>`;
  return card(`${V.phase === 'RUN1' ? 'دویدن اول' : 'دویدن دوم'} · ${pl(V, r.p)}`, `<div class="timer big ${left <= 10 && r.startAt && !r.result ? 'warn' : ''}" data-timer="run">${fmtClock(left, true)}</div>
    <div class="stations">${['نقاشی', 'حافظه', 'معما', 'گاوصندوق'].map((s, i) => `<span class="${r.station > i + 1 || (r.result && r.result.open) ? 'done' : r.station === i + 1 ? 'cur' : ''}">${s}</span>`).join('')}</div>
    ${r.startAt && !r.result ? `<div class="row small">${B(r.pauseAt ? 'ادامه' : 'مکث داور', { type: 'RUN_PAUSE' }, 'ghost', { key: 'P' })}${B('چشم‌بند جابه‌جا (−۱۰)', { type: 'RUN_PEN', sec: 10, reason: 'چشم‌بند بار دوم' }, 'ghost', { confirm: 'بار دوم است؟ −۱۰ ثانیه' })}</div>` : ''}${st}`);
}
DECK.RUN1 = runDeck; DECK.RUN2 = runDeck;
DECK.CASE = (V) => { const k = V.kase; const labels = ['باز کردن کیف · رمز', 'لایهٔ ۱ · تاج + نشان', 'لایهٔ ۲ · پاکت سرنوشت', 'لایهٔ ۳ · پاکت بازنده'];
  return card('کیف طلایی سه‌لایه', `${!k.winner ? `<div class="warn">زمان برابر: مرگ ناگهانی با یک سُر توکن</div><div class="row">${B(V.names.E, { type: 'CASE_TIEBREAK', p: 'E' }, 'E')}${B(V.names.M, { type: 'CASE_TIEBREAK', p: 'M' }, 'M')}</div>` : `<div class="ok big">برنده: ${pl(V, k.winner)}</div>`}
  <div class="row">${k.layer < 4 ? B(labels[k.layer], { type: 'CASE_NEXT' }, 'gold xl', { dis: !k.winner, key: 'Enter' }) : ''}</div>
  ${k.layer >= 3 ? `<h4>پاکت سرنوشت (متن داخل پاکت)</h4><div class="grid3">${FATE.map((x, i) => B(`${fa(i + 1)}. ${esc(x.t)}`, { type: 'CASE_FATE', i }, k.fate === i ? 'gold' : 'ghost')).join('')}</div>` : ''}
  ${k.layer >= 4 ? `<h4>لقمهٔ مرموز · بازنده ۲ جعبه</h4><div class="grid3">${BITES.map((b, i) => B(`${fa(i + 1)}${k.bite.picked.includes(i) || k.bite.revealed ? ' · ' + esc(b.t) : ''}`, { type: 'CASE_BITE', i }, k.bite.picked.includes(i) ? 'E' : 'ghost', { dis: k.bite.revealed || k.bite.picked.includes(i) })).join('')}</div>` : ''}
  <div class="row">${k.layer >= 4 ? goNext(V) : ''}</div>`); };
DECK.END = (V) => card('اند اسکرین', `<p class="lead">«دفاع از تاج» + رأی کامنت برای مجازات قسمت بعد.</p><div class="row">${B('خروجی لاگ CSV', { local: 'csv' }, 'ghost')}${B('خروجی زیرنویس SRT', { local: 'srt' }, 'ghost')}</div>`);

export function updateTimers(root, V, now) {
  root.querySelectorAll('[data-timer]').forEach(el => { const k = el.dataset.timer; let v = null;
    if (k === 'r1') v = fmtClock(timerValue(V, now).left ?? 30);
    else if (k === 'r4') v = fmtClock(V.r4.startAt ? Math.max(0, 180 - r4Elapsed(V, now)) : 180);
    else if (k.startsWith('r3-')) { const p = k.slice(3); const R = V.r3; v = (R.T[p] ?? (R.startAt ? r3Elapsed(V, now) + R.pen[p] : 0)).toFixed(1); }
    else if (k === 'run' && V.run) v = fmtClock(runLeft(V.run, now), true);
    if (v != null && el.textContent !== v) el.textContent = v; });
}
export function bindActions(root, send, local = () => {}) {
  root.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = JSON.parse(decodeURIComponent(b.dataset.a));
    if (b.dataset.confirm && !confirm(b.dataset.confirm)) return; if (a.local) return local(a, b); send(a); if (navigator.vibrate) navigator.vibrate(12); });
}
