// DADASHMODE V7 · deterministic game engine. The computer is the single source of truth.
import { CFG, PHASES, TARGETS, RIDDLES, FATE, BITES } from './data.js';
import { sha256hex } from './sha256.js';

export const P = ['E', 'M'];
export const other = p => (p === 'E' ? 'M' : 'E');
const r1 = x => Math.round(x * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PH = PHASES.map(p => p.id);

export function fmtClock(sec, tenths = false) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60), s = sec - m * 60;
  const ss = tenths ? s.toFixed(1).padStart(4, '0') : String(Math.floor(s)).padStart(2, '0');
  return `${String(m).padStart(2, '0')}:${ss}`;
}

function rng(seed) { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }

export function makePattern(rand) {
  for (;;) {
    const b = Array.from({ length: 8 }, () => (rand() < 0.5 ? 1 : 0));
    const ones = b.reduce((a, c) => a + c, 0);
    if (ones < 3 || ones > 5) continue;
    let run = 1, ok = true;
    for (let i = 1; i < 8; i++) { run = b[i] === b[i - 1] ? run + 1 : 1; if (run > 3) { ok = false; break; } }
    if (ok) return b;
  }
}

export function initialState(names = { E: 'اِلیاس', M: 'عِماد' }) {
  return {
    v: 7, phase: 'READY', names, banks: { E: CFG.start, M: CFG.start }, showStart: null,
    seq: 0, log: [], fx: [], fxId: 0, cues: [], cueId: 0,
    timer: { running: false, startAt: 0, acc: 0, limit: 0, label: '' },
    r1: { result: null },
    r2: { line: { E: null, M: null }, throws: { E: [], M: [] }, scored: { E: 0, M: 0 } },
    r3: freshR3(), r4: freshR4(),
    reveal: { done: false, capped: false, before: null },
    shop: freshShop(),
    risk: { order: [], stake: { E: null, M: null }, result: { E: null, M: null } },
    vault: { code: null, salt: null, seal: null, target: null, pattern: null, riddle: null, order: [], results: {}, seed: 0 },
    run: null,
    kase: { layer: 0, winner: null, tiebreak: null, fate: null, bite: { picked: [], revealed: false } },
    badges: { E: 0, M: 0 },
    effects: { E: {}, M: {} },
    settings: {
      subs: { on: true, clean: false, speakers: { G: true, E: true, M: true, A: true }, cps: 15, mode: 'karaoke', offset: 0, size: 52, pos: 'bottom', y: 0.86, lines: 2, maxChars: 42, bg: 'shadow', bgOpacity: 0.55, fx: 'shine', preset: 'main' },
      look: 'cinema', theme: 'vault', sfxWhere: 'control', link: { room: 'DM7', pin: String(1000 + Math.floor(Math.random() * 9000)) }, chroma: 'off', chromaColor: 'auto', fxSpeed: 1, ghost: false, silenceRule: true, sfx: true, volume: 0.8,
    },
  };
}
function freshR3() { return { startAt: null, stopAt: null, T: { E: null, M: null }, mouthAt: { E: null, M: null }, done: { E: null, M: null }, pen: { E: 0, M: 0 }, result: null, needLeftLess: false }; }
function freshR4() { return { startAt: null, finish: { E: null, M: null }, lockUntil: { E: 0, M: 0 }, first: null, challenge: null, result: null, needNone: false }; }
function freshShop() { return { leader: null, picks: { E: [], M: [] }, submitted: { E: false, M: false }, revealed: false, outcome: [], paid: { E: 0, M: 0 } }; }

// ---------- helpers
export const leaderOf = b => (b.E > b.M ? 'E' : b.M > b.E ? 'M' : null);
export const trailerOf = b => (b.E < b.M ? 'E' : b.M < b.E ? 'M' : null);
export function priceOf(s, p, card) {
  const c = CFG.shop.cards[card]; let v = c.price;
  if (s.shop.leader === p && (c.color === 'red' || c.color === 'gold')) v += CFG.shop.tax;
  return v;
}
export function r3Elapsed(s, now) { const r = s.r3; if (!r.startAt) return 0; return Math.min(CFG.r3.limit, ((r.stopAt || now) - r.startAt) / 1000); }
export function r4Elapsed(s, now) { const r = s.r4; if (!r.startAt) return 0; return Math.min(CFG.r4.limit, (now - r.startAt) / 1000); }
export function timerValue(s, now) { const t = s.timer; const e = t.acc + (t.running ? (now - t.startAt) / 1000 : 0); return { elapsed: e, left: t.limit ? Math.max(0, t.limit - e) : null }; }
export function runLeft(run, now) {
  if (!run || !run.startAt) return run ? run.clock0 : 0;
  if (run.result) return run.result.left;
  const pausedMs = run.pausedMs + (run.pauseAt ? now - run.pauseAt : 0);
  return Math.max(0, run.clock0 - (now - run.startAt - pausedMs) / 1000 - run.pen);
}
function showClock(s, now) { if (!s.showStart) return '00:00.0'; return fmtClock((now - s.showStart) / 1000, true); }

function log(s, now, text, src) {
  if (!s.showStart) s.showStart = now;
  s.log.push({ t: showClock(s, now), ts: now, ph: s.phase, text, src: src || 'host' });
  if (s.log.length > 4000) s.log.shift();
}
function fx(s, type, payload = {}, now = Date.now()) {
  s.fxId += 1; s.fx.push({ id: s.fxId, type, at: now, ...payload });
  if (s.fx.length > 40) s.fx.shift();
}
function bank(s, p, delta, now, why) {
  const before = s.banks[p]; s.banks[p] = r1(Math.max(0, before + delta));
  fx(s, 'coins', { p, delta, from: before, to: s.banks[p] }, now);
  return s.banks[p];
}
export function cue(s, speaker, text, now) {
  s.cueId += 1; s.cues.push({ id: s.cueId, speaker, text, at: now });
  if (s.cues.length > 600) s.cues.shift();
}

// ---------- R3 logic
function r3Finalize(s, now) {
  const r = s.r3; if (r.result || !P.every(p => r.done[p])) return;
  r.stopAt = r.stopAt || now;
  const dq = p => r.done[p] === 'dq', fin = p => r.done[p] === 'empty';
  let res;
  if (dq('E') && dq('M')) res = { E: 0, M: 0, note: 'هر دو رد صلاحیت' };
  else if (dq('E') || dq('M')) { const w = dq('E') ? 'M' : 'E'; const pts = fin(w) ? CFG.r3.dqBonus : CFG.r3.dqNoFinish; res = { [w]: pts, [other(w)]: 0, note: 'رد صلاحیت' }; }
  else if (!fin('E') && !fin('M')) { r.needLeftLess = true; return; }
  else {
    const T = { E: r.T.E ?? 60, M: r.T.M ?? 60 };
    const w = T.E <= T.M ? 'E' : 'M', l = other(w); const raw = r1(T[l] - T[w]);
    if (raw < CFG.r3.tieBand) res = { E: CFG.r3.tieBonus, M: CFG.r3.tieBonus, note: `تساوی نفس‌گیر (Δ${raw})` };
    else res = { [w]: clamp(Math.round(raw), CFG.r3.floor, CFG.r3.cap), [l]: 0, note: `Δ${raw}` };
  }
  r.result = res;
  P.forEach(p => { if (res[p]) bank(s, p, res[p], now); });
  log(s, now, `R3 RESULT ${P.filter(p => res[p]).map(p => `${p} +${res[p]}`).join(' ') || 'NONE'} (${res.note}) BANK=${s.banks.E}|${s.banks.M}`);
  fx(s, 'verdict', { text: P.filter(p => res[p]).map(p => `${s.names[p]} +${res[p]}`).join(' · ') }, now);
}

// ---------- R4 logic
function r4Apply(s, now) {
  const r = s.r4; if (r.result) return;
  if (!r.first) { r.needNone = true; return; }
  const f = r.first, c = r.challenge; let res;
  if (c && c.result === c.by) res = { [c.by]: CFG.r4.chWin[0], [f]: CFG.r4.chWin[1], note: 'چالش چسب موفق' };
  else if (c && c.result === f) res = { [f]: CFG.r4.reward, [c.by]: CFG.r4.chLose, note: 'چالش چسب ناموفق' };
  else res = { [f]: CFG.r4.reward, note: c ? 'چالش نامشخص' : 'اولین تمام معتبر' };
  r.result = res;
  P.forEach(p => { if (res[p]) bank(s, p, res[p], now); });
  log(s, now, `R4 RESULT ${P.filter(p => res[p] !== undefined).map(p => `${p}${res[p] >= 0 ? '+' : ''}${res[p]}`).join(' ')} (${res.note}) BANK=${s.banks.E}|${s.banks.M}`);
}

// ---------- phase entry
function enter(s, ph, now) {
  s.phase = ph; s.timer = { running: false, startAt: 0, acc: 0, limit: 0, label: '' };
  if (ph === 'R1') s.timer.limit = CFG.r1.limit;
  if (ph === 'R3_SANDWICH' && !s.r3.result) s.r3 = freshR3();
  if (ph === 'R4_GLUE' && !s.r4.result) s.r4 = freshR4();
  if (ph === 'TWIST_BANKOPEN') fx(s, 'bankopen', {}, now);
  if (ph === 'SHOP' && !s.shop.revealed) { s.shop = freshShop(); s.shop.leader = leaderOf(s.banks); }
  if (ph === 'RISK' && !s.risk.order.length) { const t = trailerOf(s.banks) || 'M'; s.risk.order = [t, other(t)]; }
  if (ph === 'VAULT_ARMED') fx(s, 'armed', {}, now);
  if (ph === 'RUN1' || ph === 'RUN2') {
    const idx = ph === 'RUN1' ? 0 : 1;
    if (!s.vault.order.length) { const t = trailerOf(s.banks) || 'M'; s.vault.order = [t, other(t)]; }
    const p = s.vault.order[idx];
    if (!s.vault.results[p]) s.run = { p, clock0: s.banks[p], startAt: null, pausedMs: 0, pauseAt: null, pen: 0, station: 1, stage: 'ready', stageAt: now, flash: null, s2: { input: [0, 0, 0, 0, 0, 0, 0, 0], checks: 0, lastN: null }, s3: { lockUntil: 0, hintShown: false, wrong: 0 }, code: { lockUntil: 0, entry: '' }, hintUsed: false, codes: 0, result: null };
  }
  if (ph === 'CASE') {
    const R = s.vault.results; const a = R.E, b = R.M;
    let w = null;
    if (a && b) {
      if (a.open && !b.open) w = 'E'; else if (b.open && !a.open) w = 'M';
      else if (a.open && b.open) w = Math.abs(a.left - b.left) < 0.05 ? null : a.left > b.left ? 'E' : 'M';
      else w = a.codes === b.codes ? null : a.codes > b.codes ? 'E' : 'M';
    }
    s.kase.winner = w || s.kase.tiebreak; s.kase.layer = 0;
  }
}

// ---------- reducer
export function apply(s0, a, now = Date.now()) {
  const s = structuredClone(s0); const src = a.src || 'host'; const p = a.p;
  const err = m => ({ state: s0, error: m });
  const R = s.r3, F = s.r4;
  s.seq += 1;
  switch (a.type) {
    case 'PHASE_GO': {
      if (!PH.includes(a.phase)) return err('حالت نامعتبر');
      if (a.phase === 'VAULT_ARMED' && !s.vault.seal) return err('اول رمز کیف را در «داده‌ها» مهر کن');
      if (a.phase === 'VAULT_ARMED') armVault(s, now);
      enter(s, a.phase, now); log(s, now, `PHASE ${a.phase}`, src); break;
    }
    case 'NAMES': s.names = { ...s.names, ...a.names }; break;
    case 'SET_CODE': {
      const d = String(a.code || '').replace(/[^0-9]/g, ''); if (d.length !== 3) return err('رمز باید سه رقم باشد');
      const salt = Math.random().toString(36).slice(2, 10);
      s.vault.code = d.split('').map(Number); s.vault.salt = salt; s.vault.seal = sha256hex(d + salt).slice(0, 6).toUpperCase();
      log(s, now, `LOCK SEAL=${s.vault.seal}`, src); break;
    }
    case 'TIMER': {
      const t = s.timer;
      if (a.op === 'start' && !t.running) { t.running = true; t.startAt = now; }
      else if (a.op === 'stop' && t.running) { t.acc += (now - t.startAt) / 1000; t.running = false; }
      else if (a.op === 'reset') { t.running = false; t.acc = 0; }
      log(s, now, `${s.phase} TIMER ${a.op.toUpperCase()}`, src); break;
    }
    // R1
    case 'R1_WIN': if (s.r1.result) return err('راند ۱ ثبت شده'); s.r1.result = { [p]: CFG.r1.win }; bank(s, p, CFG.r1.win, now); s.timer.running = false; log(s, now, `R1 ${p} WIN +10 BANK=${s.banks.E}|${s.banks.M}`, src); fx(s, 'verdict', { text: `${s.names[p]} +۱۰` }, now); break;
    case 'R1_TIE': if (s.r1.result) return err('راند ۱ ثبت شده'); s.r1.result = { E: 5, M: 5 }; P.forEach(q => bank(s, q, 5, now)); log(s, now, 'R1 TIE +5/+5', src); break;
    case 'R1_NONE': if (s.r1.result) return err('راند ۱ ثبت شده'); s.r1.result = p ? { [p]: CFG.r1.fallback } : {}; if (p) bank(s, p, CFG.r1.fallback, now); log(s, now, `R1 NONE ${p ? p + ' +5' : 'EVEN'}`, src); break;
    // R2
    case 'R2_LOCK': if (s.r2.line[p]) return err('خط قفل شده؛ عوض نمی‌شود'); if (!CFG.r2.lines[a.line]) return err('خط نامعتبر'); s.r2.line[p] = a.line; fx(s, 'lock', { p, line: a.line }, now); log(s, now, `R2 ${p} LINE=${a.line} (+${CFG.r2.lines[a.line].pts}) LOCK`, src); break;
    case 'R2_THROW': {
      const L = s.r2.line[p]; if (!L) return err('اول خط را قفل کن');
      if (s.r2.scored[p]) return err('گل ثبت شده؛ بقیهٔ پرتاب‌ها حذف'); if (s.r2.throws[p].length >= CFG.r2.throws) return err('۳ پرتاب تمام شد');
      s.r2.throws[p].push(a.hit ? 1 : a.void ? -1 : 0);
      fx(s, 'throw', { p, line: L, hit: !!a.hit, n: s.r2.throws[p].length }, now);
      if (a.hit) { const pts = CFG.r2.lines[L].pts; s.r2.scored[p] = pts; bank(s, p, pts, now); }
      log(s, now, `R2 ${p} ${a.hit ? 'HIT +' + CFG.r2.lines[L].pts : a.void ? 'VOID' : 'MISS'} ${s.r2.throws[p].length}/3`, src); break;
    }
    // R3
    case 'R3_START': if (R.startAt) return err('شروع شده'); R.startAt = now; fx(s, 'horn', {}, now); log(s, now, 'R3 START', src); break;
    case 'R3_MOUTH': {
      if (!R.startAt || R.result) return err('دوئل فعال نیست'); if (R.mouthAt[p] || R.done[p]) return err('قبلاً ثبت شده');
      R.mouthAt[p] = now; R.T[p] = r1(r3Elapsed(s, now) + R.pen[p]); fx(s, 'ding', { p }, now);
      log(s, now, `R3 ${p} MOUTHFULL T=${R.T[p]}`, src); break;
    }
    case 'R3_EMPTY': {
      if (!R.mouthAt[p] || R.done[p]) return err('اول «دهان‌پر»');
      if ((now - R.mouthAt[p]) / 1000 > CFG.r3.swallow) return err('پنجرهٔ ۳۰ ثانیه تمام شد');
      R.done[p] = 'empty'; fx(s, 'pop', { p }, now); log(s, now, `R3 ${p} EMPTY OK`, src); r3Finalize(s, now); break;
    }
    case 'R3_PEN': R.pen[p] += CFG.r3.pen; if (R.T[p] != null) R.T[p] = r1(R.T[p] + CFG.r3.pen); log(s, now, `R3 ${p} PENALTY +3`, src); break;
    case 'R3_DQ': if (R.done[p]) return err('قبلاً قطعی شده'); R.done[p] = 'dq'; log(s, now, `R3 ${p} DQ`, src); r3Finalize(s, now); break;
    case 'R3_SAFETY': if (R.result) return err('نتیجه ثبت شده'); R.stopAt = now; R.result = { E: CFG.r3.safety, M: CFG.r3.safety, note: 'توقف ایمنی «قرمز»' }; P.forEach(q => bank(s, q, CFG.r3.safety, now)); log(s, now, 'R3 SAFETY_STOP both +5', src); break;
    case 'R3_LEFTLESS': if (!R.needLeftLess || R.result) return err('لازم نیست'); R.needLeftLess = false; R.result = p ? { [p]: CFG.r3.leftLess, note: 'کمتر باقی گذاشت' } : { note: 'برابر' }; if (p) bank(s, p, CFG.r3.leftLess, now); log(s, now, `R3 LEFTLESS ${p || 'EVEN'}`, src); break;
    // R4
    case 'R4_START': if (F.startAt) return err('شروع شده'); F.startAt = now; log(s, now, 'R4 START', src); break;
    case 'R4_FINISH': {
      if (!F.startAt || F.result) return err('راند فعال نیست'); if (now < F.lockUntil[p]) return err('دکمه ۵ ثانیه قفل است'); if (F.finish[p] != null) return err('قبلاً تمام زده');
      F.finish[p] = r1(r4Elapsed(s, now)); if (!F.first) F.first = p; fx(s, 'ding', { p }, now);
      log(s, now, `R4 ${p} FINISH ${fmtClock(F.finish[p], true)}`, src); break;
    }
    case 'R4_WRONG': {
      if (F.finish[p] == null) return err('تمامی ثبت نشده'); F.finish[p] = null; F.lockUntil[p] = now + CFG.r4.wrongLock * 1000;
      if (F.first === p) F.first = F.finish[other(p)] != null ? other(p) : null;
      fx(s, 'buzz', { p }, now); log(s, now, `R4 ${p} WRONG (cancel + lock 5)`, src); break;
    }
    case 'R4_CHALLENGE': {
      if (F.challenge) return err('چالش فقط یک بار'); if (!F.first || F.first === p) return err('فقط نفر دوم'); if (F.finish[p] == null) return err('اول پازل خودت را تمام کن');
      F.challenge = { by: p, result: undefined }; log(s, now, `R4 ${p} CHALLENGE`, src); break;
    }
    case 'R4_CH_RESULT': if (!F.challenge) return err('چالشی نیست'); F.challenge.result = a.winner || null; log(s, now, `R4 CHALLENGE ${a.winner ? 'WIN ' + a.winner : 'UNCLEAR'}`, src); r4Apply(s, now); break;
    case 'R4_FINALIZE': if (F.challenge && F.challenge.result === undefined) return err('اول نتیجهٔ چالش'); r4Apply(s, now); break;
    case 'R4_NONE': if (F.result) return err('ثبت شده'); F.needNone = false; F.result = p ? { [p]: CFG.r4.fallback, note: 'پازل درست‌تر' } : { note: 'برابر' }; if (p) bank(s, p, CFG.r4.fallback, now); log(s, now, `R4 NONE ${p || 'EVEN'}`, src); break;
    // REVEAL
    case 'REVEAL_DO': {
      if (s.reveal.done) return err('رونمایی انجام شده');
      const b = { ...s.banks }; s.reveal.before = b; s.reveal.done = true;
      const L = leaderOf(b), gap = Math.abs(b.E - b.M);
      if (L && gap > CFG.gapCap) { const t = other(L); const to = r1(b[L] - CFG.gapCap); s.reveal.capped = true; bank(s, t, to - b[t], now); }
      fx(s, 'reveal', { capped: s.reveal.capped, gap }, now); log(s, now, `REVEAL GAP=${r1(gap)} CAP=${s.reveal.capped ? 'YES' : 'NO'}`, src); break;
    }
    // SHOP
    case 'SHOP_PICK': {
      const sh = s.shop; if (s.phase !== 'SHOP') return err('فروشگاه باز نیست'); if (sh.submitted[p]) return err('ثبت شده'); const c = CFG.shop.cards[a.card]; if (!c) return err('کارت نامعتبر');
      const list = sh.picks[p]; const i = list.indexOf(a.card);
      if (i >= 0) { list.splice(i, 1); sh.paid[p] -= priceOf(s, p, a.card); break; }
      if (list.length >= CFG.shop.max) return err('حداکثر ۲ کارت');
      if (c.color === 'red' && list.some(k => CFG.shop.cards[k].color === 'red')) return err('فقط ۱ قرمز');
      const pr = priceOf(s, p, a.card); if (s.banks[p] - sh.paid[p] - pr < CFG.floor) return err('کف ۲۰');
      list.push(a.card); sh.paid[p] += pr; break;
    }
    case 'SHOP_SUBMIT': s.shop.submitted[p] = true; fx(s, 'submitted', { p }, now); log(s, now, `SHOP ${p} SUBMIT (${s.shop.picks[p].length} cards)`, src); break;
    case 'SHOP_REVEAL': {
      const sh = s.shop; if (sh.revealed) return err('رونمایی شده'); if (!a.force && !P.every(q => sh.submitted[q])) return err('هر دو باید ثبت کنند');
      sh.revealed = true; P.forEach(q => { sh.picks[q].forEach(k => log(s, now, `SHOP ${q} PICK=${k} PRICE=${priceOf(s, q, k)}`, src)); if (sh.paid[q]) bank(s, q, -sh.paid[q], now); });
      const has = (q, k) => sh.picks[q].includes(k); const eff = { E: {}, M: {} }; const used = { MIRROR: { E: false, M: false }, SHIELD: { E: false, M: false } }; const out = [];
      P.forEach(q => { if (has(q, 'HINT')) eff[q].hint = 1; });
      P.forEach(from => sh.picks[from].filter(k => CFG.shop.cards[k].color === 'red').forEach(card => {
        let dest = other(from), bounced = false;
        if (has(dest, 'MIRROR') && !used.MIRROR[dest]) { used.MIRROR[dest] = true; dest = from; bounced = true; }
        if (has(dest, 'SHIELD') && !used.SHIELD[dest]) { used.SHIELD[dest] = true; out.push({ card, from, dest, status: 'BLOCKED', bounced }); }
        else { eff[dest][card.toLowerCase()] = true; out.push({ card, from, dest, status: bounced ? 'BOUNCED' : 'ACTIVE', bounced }); }
      }));
      P.forEach(q => ['SHIELD', 'MIRROR'].forEach(k => { if (has(q, k) && !used[k][q]) out.push({ card: k, from: q, dest: q, status: 'BURNED' }); }));
      sh.outcome = out; s.effects = eff; fx(s, 'shopreveal', { out }, now);
      out.forEach(o => log(s, now, `SHOP REVEAL ${o.card} ${o.from}->${o.dest} ${o.status}`, src));
      log(s, now, `SHOP BANK=${s.banks.E}|${s.banks.M}`, src); break;
    }
    // RISK
    case 'RISK_STAKE': {
      const rk = s.risk; if (rk.stake[p] != null) return err('قفل شده'); const first = rk.order[0];
      if (p !== first && rk.stake[first] == null) return err('اول نفر عقب اعلام می‌کند');
      let v = a.stake === 'ALLIN' ? CFG.risk.allIn : Number(a.stake);
      if (a.stake === 'ALLIN') { if (trailerOf(s.banks) !== p || Math.abs(s.banks.E - s.banks.M) < CFG.risk.allInGap) return err('همه‌چی ۳۰ فقط برای نفر عقب با فاصلهٔ ≥ ۱۵'); }
      else if (!CFG.risk.stakes.includes(v)) return err('شرط نامعتبر');
      if (s.banks[p] - v < CFG.floor) return err('کف بانک ۲۰');
      rk.stake[p] = { v, allIn: a.stake === 'ALLIN' }; fx(s, 'lock', { p, stake: v }, now); log(s, now, `RISK ${p} STAKE=${a.stake === 'ALLIN' ? 'ALLIN30' : v} LOCK`, src); break;
    }
    case 'RISK_RESULT': {
      const rk = s.risk; if (!rk.stake[p]) return err('شرط قفل نشده'); if (rk.result[p] != null) return err('ثبت شده');
      rk.result[p] = a.hit ? 'HIT' : 'MISS'; const v = rk.stake[p].v; if (v) bank(s, p, a.hit ? v : -v, now);
      fx(s, a.hit ? 'hit' : 'miss', { p }, now); log(s, now, `RISK ${p} ${a.hit ? 'HIT +' : 'MISS -'}${v} BANK=${s.banks[p]}`, src); break;
    }
    // RUN
    case 'RUN_START': { const r = s.run; if (!r) return err('دونده‌ای نیست'); if (r.startAt) return err('شروع شده'); r.startAt = now; r.stage = 'target'; r.stageAt = now; log(s, now, `${s.phase} ${r.p} START CLOCK=${r.clock0.toFixed(1)}`, src); fx(s, 'runstart', { p: r.p }, now); break; }
    case 'RUN_PAUSE': { const r = s.run; if (!r || !r.startAt || r.result) return err('در حال اجرا نیست'); if (r.pauseAt) { r.pausedMs += now - r.pauseAt; r.pauseAt = null; log(s, now, 'PAUSE OFF', src); } else { r.pauseAt = now; log(s, now, 'PAUSE ON', src); } break; }
    case 'RUN_PEN': { const r = s.run; if (!r) return err('—'); r.pen += a.sec; log(s, now, `${s.phase} ${r.p} PEN -${a.sec} (${a.reason || ''})`, src); break; }
    case 'S1_WRONG': { const r = s.run; if (!r || r.station !== 1) return err('ایستگاه ۱ نیست'); fx(s, 'scratch', {}, now); log(s, now, `${s.phase} ${r.p} S1 GUESS=WRONG`, src); break; }
    case 'S1_PASS': { const r = s.run; if (!r || r.station !== 1 || !r.startAt) return err('ایستگاه ۱ نیست'); r.station = 2; r.stage = 'show'; r.stageAt = now; r.codes = 1; r.flash = { digits: [0], until: now + CFG.vault.codeShow * 1000 }; fx(s, 'unlock', { station: 1 }, now); log(s, now, `${s.phase} ${r.p} S1 PASS C1 SHOWN`, src); break; }
    case 'S2_TOGGLE': { const r = s.run; if (!r || r.station !== 2 || r.stage !== 'input') return err('ورودی فعال نیست'); r.s2.input[a.i] = r.s2.input[a.i] ? 0 : 1; break; }
    case 'S2_CHECK': {
      const r = s.run; if (!r || r.station !== 2 || r.stage !== 'input') return err('ورودی فعال نیست');
      const n = r.s2.input.reduce((acc, v, i) => acc + (v === s.vault.pattern[i] ? 1 : 0), 0); r.s2.checks++; r.s2.lastN = n;
      if (n === 8) { r.station = 3; r.stage = 'riddle'; r.stageAt = now; r.codes = 2; r.flash = { digits: [1], until: now + CFG.vault.codeShow * 1000 }; fx(s, 'goldwave', {}, now); log(s, now, `${s.phase} ${r.p} S2 PASS C2 SHOWN`, src); }
      else { r.pen += CFG.vault.memWrong; fx(s, 'wrong', { n }, now); log(s, now, `${s.phase} ${r.p} S2 CHECK ${n}/8 -3`, src); }
      break;
    }
    case 'S2_HINT': { const r = s.run; if (!r || r.station !== 2 || r.stage !== 'input') return err('—'); if (!s.effects[r.p]?.hint || r.hintUsed) return err('ذره‌بین نداری'); r.hintUsed = true; r.stage = 'hint'; r.stageAt = now; log(s, now, `${s.phase} ${r.p} S2 HINT`, src); break; }
    case 'S3_HINT': { const r = s.run; if (!r || r.station !== 3) return err('—'); if (!s.effects[r.p]?.hint || r.hintUsed) return err('ذره‌بین نداری'); r.hintUsed = true; r.s3.hintShown = true; log(s, now, `${s.phase} ${r.p} S3 HINT`, src); break; }
    case 'S3_ANSWER': {
      const r = s.run; if (!r || r.station !== 3) return err('ایستگاه ۳ نیست'); if (now < r.s3.lockUntil) return err('قفل ۵ ثانیه');
      if (Number(a.d) === s.vault.code[2]) { r.station = 4; r.stage = 'code'; r.stageAt = now; r.codes = 3; r.flash = { digits: [2], until: now + CFG.vault.codeShow * 1000 }; fx(s, 'unlock', { station: 3 }, now); log(s, now, `${s.phase} ${r.p} S3 RIDDLE OK`, src); }
      else { r.s3.lockUntil = now + CFG.vault.riddleLock * 1000; r.s3.wrong++; fx(s, 'buzz', {}, now); log(s, now, `${s.phase} ${r.p} S3 WRONG (${a.d}) lock 5`, src); }
      break;
    }
    case 'CODE_KEY': { const r = s.run; if (!r || r.station !== 4) return err('گاوصندوق فعال نیست'); if (a.d === 'C') { r.code.entry = ''; break; } if ((r.code.entry || '').length >= 3) return err('سه رقم وارد شده'); r.code.entry = (r.code.entry || '') + a.d; fx(s, 'tick', {}, now); break; }
    case 'CODE_ENTER': {
      const r = s.run; if (!r || r.station !== 4) return err('گاوصندوق فعال نیست'); if (now < r.code.lockUntil) return err('قفل ۵ ثانیه');
      const d = String(a.code ?? r.code.entry ?? '').replace(/\D/g, ''); r.code.entry = '';
      if (d === s.vault.code.join('')) { const left = r1(runLeft(r, now)); r.result = { open: true, left, codes: 3 }; s.vault.results[r.p] = r.result; fx(s, 'vaultopen', { p: r.p, left }, now); log(s, now, `${s.phase} ${r.p} VAULT OPEN LEFT=${left}`, src); }
      else { r.code.lockUntil = now + CFG.vault.codeLock * 1000; r.flash = { digits: [0, 1, 2], until: now + CFG.vault.codeShow * 1000 }; fx(s, 'buzz', {}, now); log(s, now, `${s.phase} ${r.p} CODE WRONG lock 5`, src); }
      break;
    }
    // CASE
    case 'CASE_TIEBREAK': s.kase.tiebreak = p; s.kase.winner = p; log(s, now, `CASE TIEBREAK ${p}`, src); break;
    case 'CASE_NEXT': {
      const k = s.kase; if (!k.winner) return err('برنده مشخص نیست (مرگ ناگهانی توکن)'); if (k.layer >= 4) return err('پایان');
      k.layer++; if (k.layer === 1) { log(s, now, `CASE WINNER=${k.winner} SEAL=${s.vault.seal} OK`, src); fx(s, 'caseopen', { p: k.winner }, now); }
      if (k.layer === 2) { s.badges[k.winner]++; fx(s, 'crown', { p: k.winner }, now); log(s, now, `CASE L1 CROWN+BADGE ${k.winner} (${s.badges[k.winner]})`, src); }
      if (k.layer === 3) log(s, now, 'CASE L2 FATE', src);
      if (k.layer === 4) log(s, now, 'CASE L3 PUNISH', src);
      break;
    }
    case 'CASE_FATE': s.kase.fate = a.i; fx(s, 'fate', { i: a.i }, now); log(s, now, `CASE FATE #${a.i + 1} ${FATE[a.i]?.t || ''}`, src); break;
    case 'CASE_BITE': { const b = s.kase.bite; if (b.revealed) return err('—'); if (b.picked.includes(a.i)) return err('انتخاب شده'); b.picked.push(a.i); fx(s, 'bite', { i: a.i }, now); log(s, now, `CASE BITE #${a.i + 1} ${BITES[a.i].t}`, src); if (b.picked.length >= 2) { b.revealed = true; log(s, now, 'CASE BITE REVEAL ALL', src); } break; }
    // voices / subs
    case 'SAY': {
      if (s.settings.silenceRule && a.speaker === 'G' && s.phase === 'R3_SANDWICH' && R.startAt && !R.result && P.some(q => !R.done[q]) && !a.force) return err('قانون سکوت: دهان پر است');
      cue(s, a.speaker || 'G', a.text, now); fx(s, 'say', { speaker: a.speaker || 'G', text: a.text, tts: a.tts !== false }, now); log(s, now, `SAY ${a.speaker || 'G'}: ${a.text.slice(0, 40)}`, src); break;
    }
    case 'SET': { const path = a.path.split('.'); let o = s.settings; for (let i = 0; i < path.length - 1; i++) o = o[path[i]]; o[path.at(-1)] = a.value; break; }
    case 'SET_MANY': Object.assign(s.settings.subs, a.subs || {}); break;
    case 'EDIT': { if (!a.reason) return err('دلیل لازم است'); bank(s, p, Number(a.delta), now); log(s, now, `EDIT ${p} ${a.delta > 0 ? '+' : ''}${a.delta} (${a.reason}) BANK=${s.banks[p]}`, src); break; }
    case 'FX': fx(s, a.fx, a.payload || {}, now); break;
    case 'SYNC': fx(s, 'sync', {}, now); log(s, now, `SYNC ${a.label || ''}`, src); break;
    case 'NOTE': log(s, now, `NOTE ${a.text}`, src); break;
    default: return err('فرمان ناشناخته: ' + a.type);
  }
  return { state: s };
}

function armVault(s, now) {
  const seed = (now ^ 0x5bd1e995) >>> 0; const rand = rng(seed); s.vault.seed = seed;
  s.vault.target = Math.floor(rand() * TARGETS.length);
  s.vault.pattern = makePattern(rand);
  s.vault.riddle = s.vault.code[2];
  log(s, now, `VAULT_ARMED TARGET=#${s.vault.target + 1} PATTERN=${s.vault.pattern.join('')} RIDDLE=bucket`, 'host');
}

// automatic transitions (host calls ~10Hz)
export function tick(s0, now = Date.now()) {
  let s = null; const W = () => (s = s || structuredClone(s0));
  const R = s0.r3;
  if (s0.phase === 'R3_SANDWICH' && R.startAt && !R.result && !R.needLeftLess) {
    const el = r3Elapsed(s0, now);
    for (const p of P) {
      if (s0.r3.done[p]) continue;
      if (R.mouthAt[p] && (now - R.mouthAt[p]) / 1000 > CFG.r3.swallow) { W(); s.r3.done[p] = 'nofinish'; s.r3.T[p] = 60; log(s, now, `R3 ${p} NO_SWALLOW T=60`); }
      else if (!R.mouthAt[p] && el >= CFG.r3.limit) { W(); s.r3.done[p] = 'nofinish'; s.r3.T[p] = 60; log(s, now, `R3 ${p} TIMEOUT T=60`); }
    }
    if (s) r3Finalize(s, now);
  }
  if (s0.timer.running && s0.timer.limit && timerValue(s0, now).left <= 0) { W(); s.timer.running = false; s.timer.acc = s.timer.limit; fx(s, 'timeup', {}, now); }
  const r = s0.run;
  if (r && r.startAt && !r.result) {
    if (!r.pauseAt) {
      const since = (now - r.stageAt) / 1000;
      if (r.stage === 'target' && since >= CFG.vault.targetShow) { W(); s.run.stage = 'draw'; s.run.stageAt = now; }
      if (r.stage === 'show' && since >= CFG.vault.memShow + (r.flash ? 0 : 0)) { W(); s.run.stage = 'lock'; s.run.stageAt = now; }
      if (r.stage === 'lock' && since >= CFG.vault.memLock) { W(); s.run.stage = 'input'; s.run.stageAt = now; }
      if (r.stage === 'hint' && since >= CFG.vault.hintShow) { W(); s.run.stage = 'input'; s.run.stageAt = now; }
    }
    if (runLeft(r, now) <= 0) { W(); s.run.result = { open: false, left: 0, codes: r.codes }; s.vault.results[r.p] = s.run.result; fx(s, 'vaultclosed', { p: r.p }, now); log(s, now, `${s.phase} ${r.p} TIME UP CODES=${r.codes}`); }
  }
  return s;
}

// what phones & the stage may see (no hidden code/picks)
export function publicView(s, now = Date.now(), role = 'stage') {
  const v = structuredClone(s); v.hostNow = now;
  v.log = s.log.slice(-60);
  const code = s.vault.code; delete v.vault.salt;
  const reveal = s.phase === 'CASE' && s.kase.layer >= 1;
  v.vault.code = reveal ? code : null;
  if (v.run && code) {
    const fl = s.run.flash; v.run.flashDigits = fl && now < fl.until ? fl.digits.map(i => ({ i, d: code[i] })) : [];
    v.run.flash = null;
  }
  if (!s.shop.revealed && role !== 'host') {
    for (const p of P) { if (role !== 'PLAYER_' + p) { v.shop.picks[p] = s.shop.picks[p].map(() => '?'); v.shop.paid[p] = null; } }
  }
  if (role !== 'host') v.vault.pattern = s.run && ['show', 'hint'].includes(s.run.stage) ? s.vault.pattern : null;
  v.vault.riddle = null;
  if (code && s.run && s.run.station >= 3) {
    const rd = RIDDLES.find(x => x.a === code[2]);
    const spicy = !!s.effects[s.run.p]?.spicy;
    v.vault.riddleText = { text: spicy ? rd.s : rd.n, spicy, hint: s.run.s3.hintShown ? rd.h : null };
  }
  return v;
}
export { CFG, PHASES, TARGETS, RIDDLES, FATE, BITES };
