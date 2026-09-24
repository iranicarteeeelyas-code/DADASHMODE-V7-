// Broadcast HUD: every screen of the show, drawn at 1920×1080 then composited in WebGL
import { THEMES, ease, rr, text, measure, panel, ring, bar, fa, goldGrad, icon, font } from './draw.js';
import { CFG, TARGETS, FATE, BITES, PHASES } from '../shared/data.js';
import { fmtClock, r3Elapsed, r4Elapsed, runLeft, timerValue, leaderOf, priceOf } from '../shared/engine.js';
import { activeCue, wrap } from '../shared/subs.js';

const W = 1920, H = 1080;
const STATUS_FA = { ACTIVE: 'فعال', BLOCKED: 'خنثی', BOUNCED: 'برگشت', BURNED: 'سوخت' };
const CARD_ORDER = ['HINT', 'SHIELD', 'GLOVES', 'SPICY', 'MIRROR'];

export class HUD {
  constructor() {
    this.c = document.createElement('canvas'); this.c.width = W; this.c.height = H; this.x = this.c.getContext('2d');
    this.sc = document.createElement('canvas'); this.sc.width = W; this.sc.height = 360; this.sx = this.sc.getContext('2d');
    this.th = THEMES.vault; this.disp = null; this.tw = {}; this.parts = []; this.pops = []; this.banner = null; this.flash = 0; this.lastCue = null; this.subStart = 0; this.cardAnim = {};
  }
  setTheme(n) { this.th = THEMES[n] || THEMES.vault; }
  fx(f, S, now) {
    const th = this.th;
    if (f.type === 'coins') {
      const p = f.p, tx = p === 'E' ? 336 : W - 336, ty = 130;
      this.tw[p] = { from: f.from, to: f.to, at: now, dur: 1300 };
      const n = Math.min(26, 6 + Math.abs(f.delta));
      if (f.delta > 0) for (let i = 0; i < n; i++) this.parts.push({ kind: 'coin', x0: W / 2 + (Math.random() - 0.5) * 300, y0: 620 + (Math.random() - 0.5) * 140, x1: tx + (Math.random() - 0.5) * 120, y1: ty, cx: (W / 2 + tx) / 2 + (Math.random() - 0.5) * 500, cy: 180 + Math.random() * 200, at: now + i * 38, dur: 900 + Math.random() * 300, spin: Math.random() * 10 });
      else for (let i = 0; i < 16; i++) this.parts.push({ kind: 'shard', x: tx + (Math.random() - 0.5) * 300, y: ty + 40, vx: (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 4, at: now, dur: 1400, col: th.E, r: Math.random() * 6 });
      this.pops.push({ p, text: (f.delta > 0 ? '+' : '−') + Math.abs(f.delta), col: f.delta > 0 ? th.gold : th.E, x: tx, y: 230, at: now + (f.delta > 0 ? 700 : 0) });
    }
    if (f.type === 'verdict') this.banner = { text: f.text, at: now };
    if (f.type === 'sync') this.flash = now;
    if (f.type === 'caseopen' || f.type === 'crown' || f.type === 'vaultopen') for (let i = 0; i < 180; i++) this.parts.push({ kind: 'conf', x: W / 2 + (Math.random() - 0.5) * 400, y: 420, vx: (Math.random() - 0.5) * 26, vy: -10 - Math.random() * 16, at: now + Math.random() * 300, dur: 3600, col: [th.gold, th.gold2, th.E, th.M, '#ffffff'][i % 5], r: Math.random() * 6, w: 10 + Math.random() * 12 });
    if (f.type === 'hit' || f.type === 'goldwave') for (let i = 0; i < 90; i++) this.parts.push({ kind: 'spark', x: W / 2, y: 600, vx: (Math.random() - 0.5) * 30, vy: -Math.random() * 22, at: now, dur: 1800, col: th.gold2 });
  }
  pruneTw(S, now) {
    if (!this.disp) this.disp = { E: S.banks.E, M: S.banks.M };
    for (const p of ['E', 'M']) { const t = this.tw[p]; if (t) { const k = ease.expo(Math.min(1, (now - t.at) / t.dur)); this.disp[p] = t.from + (t.to - t.from) * k; if (k >= 1) { delete this.tw[p]; this.disp[p] = S.banks[p]; } } else this.disp[p] = S.banks[p]; }
  }
  draw(S, now) {
    const c = this.x, th = this.th; c.clearRect(0, 0, W, H); this.pruneTw(S, now);
    const V = VIEWS[S.phase]; if (V) V(c, th, S, now, this);
    if (!(S.phase === 'RUN1' || S.phase === 'RUN2') || !S.run || S.run.stage === 'ready' || S.run.result) this.tiles(c, th, S, now);
    else this.tiles(c, th, S, now, true);
    this.drawBanner(c, th, now); this.drawParts(c, th, now); this.drawPops(c, th, now);
    if (this.flash && now - this.flash < 400) { c.fillStyle = `rgba(255,255,255,${1 - (now - this.flash) / 400})`; c.fillRect(0, 0, W, H); text(c, th, 'SYNC', W / 2, H / 2, { kind: 'num', size: 220, color: '#111', stroke: 0, shadow: 0 }); }
    this.subs(S, now);
  }
  tiles(c, th, S, now, compact = false) {
    const y = 48, w = compact ? 360 : 480, h = compact ? 108 : 150;
    [['E', 96], ['M', W - 96 - w]].forEach(([p, x]) => {
      c.save(); if (th.skew) { c.translate(x + w / 2, y + h / 2); c.transform(1, 0, th.skew, 1, 0, 0); c.translate(-(x + w / 2), -(y + h / 2)); }
      const col = th[p]; const pulse = this.tw[p] ? 1 + 0.04 * Math.sin((now - this.tw[p].at) / 40) * (1 - (now - this.tw[p].at) / 1300) : 1;
      c.translate(x + w / 2, y + h / 2); c.scale(pulse, pulse); c.translate(-(x + w / 2), -(y + h / 2));
      panel(c, th, x, y, w, h, { fill: th.sticker ? col : th.panel, border: col, lw: th.sticker ? 6 : 3 });
      if (!th.sticker) { const g = c.createLinearGradient(x, y, x, y + h); g.addColorStop(0, col + 'cc'); g.addColorStop(1, col + '33'); c.fillStyle = g; rr(c, x + 3, y + 3, w - 6, 40, 18); c.fill(); }
      text(c, th, S.names[p], x + w / 2, y + 24, { size: compact ? 26 : 30, w: 800, stroke: th.sticker ? 8 : 0, shadow: 0 });
      text(c, th, fmtClock(this.disp[p]), x + w / 2, y + (compact ? 70 : 96), { kind: 'num', size: compact ? 58 : 84, color: th.sticker ? '#fff' : th.text, glow: this.tw[p] ? 30 : 0 });
      c.restore();
      const eff = S.effects && S.effects[p]; if (eff && S.shop && S.shop.revealed) {
        let ix = x + 30; ['gloves', 'spicy', 'hint'].forEach(k => { if (!eff[k]) return; const card = k.toUpperCase(); const cc = CFG.shop.cards[card]; const used = k === 'hint' && S.run && S.run.p === p && S.run.hintUsed;
          c.save(); c.globalAlpha = used ? 0.35 : 1; panel(c, th, ix, y + h + 14, 64, 52, { fill: th[cc.color === 'red' ? 'E' : cc.color === 'blue' ? 'A' : 'gold'], lw: 0, r: 14, shadow: false }); icon(c, card, ix + 32, y + h + 40, 34, '#fff'); c.restore(); ix += 74; });
      }
    });
  }
  drawBanner(c, th, now) {
    const b = this.banner; if (!b) return; const age = now - b.at; if (age > 3200) { this.banner = null; return; }
    const k = ease.expo(Math.min(1, age / 500)), out = age > 2700 ? ease.expo((age - 2700) / 500) : 0; const w = Math.max(640, measure(c, th, b.text, 'display', 88) + 160), x = W / 2 - w / 2, y = 700 + (1 - k) * 60 + out * 40;
    c.save(); c.globalAlpha = k * (1 - out); panel(c, th, x, y, w, 150, { fill: th.sticker ? th.gold : th.panel2, border: th.gold, lw: 4 });
    text(c, th, b.text, W / 2, y + 80, { kind: 'display', size: 88, color: th.sticker ? th.dark : th.gold, stroke: th.sticker ? 0 : 0, shadow: 0, glow: th.sticker ? 0 : 20 }); c.restore();
  }
  drawPops(c, th, now) { this.pops = this.pops.filter(p => now - p.at < 1800); this.pops.forEach(p => { const age = now - p.at; if (age < 0) return; const k = ease.expo(age / 600); text(c, th, p.text, p.x, p.y + 60 - k * 60, { kind: 'num', size: 110 * (0.6 + 0.4 * k), color: p.col, alpha: 1 - Math.max(0, (age - 1200) / 600), glow: 30 }); }); }
  drawParts(c, th, now) {
    this.parts = this.parts.filter(p => now - p.at < p.dur);
    for (const p of this.parts) {
      const age = now - p.at; if (age < 0) continue; const t = age / p.dur;
      if (p.kind === 'coin') { const k = ease.inOut(Math.min(1, age / p.dur)); const x = (1 - k) * (1 - k) * p.x0 + 2 * (1 - k) * k * p.cx + k * k * p.x1, y = (1 - k) * (1 - k) * p.y0 + 2 * (1 - k) * k * p.cy + k * k * p.y1; const sx = Math.abs(Math.cos(age / 90 + p.spin)); c.save(); c.translate(x, y); c.scale(Math.max(0.15, sx), 1); const g = c.createRadialGradient(-6, -6, 2, 0, 0, 22); g.addColorStop(0, '#fff6c8'); g.addColorStop(0.5, th.gold); g.addColorStop(1, th.goldDeep); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 20, 0, Math.PI * 2); c.fill(); c.strokeStyle = th.goldDeep; c.lineWidth = 3; c.stroke(); c.restore(); }
      else { const f = age / 16; const x = p.x + p.vx * f, y = p.y + p.vy * f + 0.25 * f * f * (p.kind === 'conf' ? 0.35 : 1); c.save(); c.globalAlpha = 1 - t; c.translate(x, y); c.rotate(f * 0.1 + p.r); c.fillStyle = p.col;
        if (p.kind === 'conf') c.fillRect(-p.w / 2, -4, p.w * Math.abs(Math.cos(f * 0.2)), 8); else if (p.kind === 'shard') { c.beginPath(); c.moveTo(0, -10); c.lineTo(8, 8); c.lineTo(-6, 6); c.fill(); } else { c.shadowColor = p.col; c.shadowBlur = 12; c.beginPath(); c.arc(0, 0, 4, 0, Math.PI * 2); c.fill(); } c.restore(); }
    }
  }
  subs(S, now) {
    const c = this.sx, th = this.th, cfg = S.settings.subs; c.clearRect(0, 0, W, 360); this.subY = cfg.pos === 'top' ? 0.2 : cfg.y;
    if (!cfg.on || cfg.clean) { this.subAlpha = 0; return; }
    const cue = activeCue(S.cues || [], cfg, now); if (!cue) { this.subAlpha = 0; return; }
    if (this.lastCue !== cue.id) { this.lastCue = cue.id; this.subStart = now; }
    const age = (now - cue.start) / 1000, dur = (cue.end - cue.start) / 1000, cps = cfg.cps;
    const lines = wrap(cue.text, cfg.maxChars, cfg.lines); const size = cfg.size, lh = size * 1.45; const col = { G: th.G, E: th.E, M: th.M, A: th.A }[cue.speaker];
    const totalWords = lines.flat().length; const typed = Math.floor(age * cps); let charCount = 0, wordIdx = 0;
    const H2 = lines.length * lh + 30; const y0 = 180 - H2 / 2 + 15;
    c.font = font(th, 'body', size, 800); c.direction = 'rtl';
    const widths = lines.map(l => c.measureText(l.join(' ')).width); const maxW = Math.max(...widths) + 80;
    if (cfg.bg === 'box') { c.save(); c.globalAlpha = cfg.bgOpacity; c.fillStyle = th.dark; rr(c, W / 2 - maxW / 2, y0 - 16, maxW, H2 + 8, 22); c.fill(); c.restore(); }
    // speaker tag
    const tag = { G: 'جمنای', E: S.names.E, M: S.names.M, A: 'اپ' }[cue.speaker];
    c.save(); c.font = font(th, 'body', Math.round(size * 0.5), 900); const tw = c.measureText(tag).width + 36; c.fillStyle = col; rr(c, W / 2 + maxW / 2 - tw - 10, y0 - 46, tw, size * 0.72, 12); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = 'rtl'; c.fillText(tag, W / 2 + maxW / 2 - 10 - tw / 2, y0 - 46 + size * 0.37); c.restore();
    lines.forEach((ws, li) => {
      const y = y0 + li * lh + lh / 2; c.font = font(th, 'body', size, 800); const space = c.measureText(' ').width; let x = W / 2 + widths[li] / 2;
      ws.forEach(w => {
        const ww = c.measureText(w).width; const wStart = (wordIdx / totalWords) * dur * 0.92, local = age - wStart; let alpha = 1, scale = 1, color = th.text;
        if (cfg.mode === 'word') { alpha = ease.cl(local / 0.12); scale = 0.85 + 0.15 * ease.expo(ease.cl(local / 0.25)); if (local < 0) alpha = 0; }
        if (cfg.mode === 'type') { const vis = typed - charCount; alpha = vis <= 0 ? 0 : 1; }
        if (cfg.mode === 'karaoke') { color = local >= 0 && local < dur / totalWords * 1.1 ? th.gold : local >= 0 ? th.text : 'rgba(255,255,255,0.55)'; scale = local >= 0 && local < 0.25 ? 1 + 0.08 * (1 - local / 0.25) : 1; }
        if (/^[«»"]?(ثانیه|همه‌چی|سی|بانک|کد|خالیه|گُل|قفل)/.test(w) && cfg.mode !== 'karaoke') color = th.gold;
        c.save(); c.translate(x - ww / 2, y); c.scale(scale, scale); c.globalAlpha = alpha; c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = 'rtl'; c.font = font(th, 'body', size, 800);
        if (cfg.bg === 'shadow' || th.sticker) { c.lineJoin = 'round'; c.lineWidth = th.sticker ? size * 0.22 : size * 0.12; c.strokeStyle = 'rgba(0,0,0,' + (th.sticker ? 1 : 0.75) + ')'; c.strokeText(w, 0, 0); }
        c.fillStyle = color; c.fillText(w, 0, 0); c.restore();
        x -= ww + space; charCount += w.length + 1; wordIdx++;
      });
    });
    this.subAlpha = 1; this.subAge = age;
  }
}

// ---------------- views
const cx = W / 2;
function phaseTag(c, th, S, label, sub) {
  const w = Math.max(520, measure(c, th, label, 'display', 54) + 120);
  panel(c, th, cx - w / 2, 56, w, 96, { fill: th.sticker ? th.gold : th.panel, border: th.gold, lw: 2 });
  text(c, th, label, cx, 96, { kind: 'display', size: 54, color: th.sticker ? th.dark : th.gold, stroke: 0, shadow: 0 });
  if (sub) text(c, th, sub, cx, 178, { size: 26, color: th.dim, w: 600, stroke: th.sticker ? 6 : 0, shadow: 0 });
}
function bigTimer(c, th, sec, x, y, size = 150, col = th.text, tenths = false, warn = false, now = 0) {
  const shake = warn ? Math.sin(now / 30) * 6 : 0;
  text(c, th, fmtClock(sec, tenths), x + shake, y, { kind: 'num', size, color: warn ? th.E : col, glow: warn ? 40 : 18 });
}
const V = {};
V.READY = (c, th, S, now) => {
  const t = (now / 1000) % 1000;
  text(c, th, 'بانکِ زمان', cx, 700, { kind: 'display', size: 190, color: th.sticker ? th.gold : th.gold, glow: th.sticker ? 0 : 36, stroke: th.sticker ? 20 : 0, shadow: th.sticker ? 14 : 0 });
  text(c, th, 'DADASHMODE  |  TIME BANK', cx, 820, { kind: 'num', size: 44, color: th.text, w: 700, stroke: th.sticker ? 8 : 0 });
  text(c, th, '«هر بازی رو ببریم، برای آخر ویدیو زمان می‌گیریم.»', cx, 896, { size: 36, color: th.dim, w: 600, alpha: 0.6 + 0.4 * Math.sin(t * 2) ** 2 });
};
V.R1 = (c, th, S, now) => {
  phaseTag(c, th, S, 'راند ۱ · برج لیوان', 'ده لیوان · فقط یک دست · برج ۲ ثانیه سالم');
  const tv = timerValue(S, now); const left = tv.left ?? CFG.r1.limit;
  ring(c, cx, 420, 130, left / CFG.r1.limit, left <= 5 ? th.E : th.gold, 18); bigTimer(c, th, left, cx, 420, 96, th.text, false, left <= 5 && S.timer.running, now);
  if (S.r1.result) { const w = Object.keys(S.r1.result).filter(k => S.r1.result[k]); text(c, th, w.length ? w.map(p => `${S.names[p]} +${fa(S.r1.result[p])}`).join('  ·  ') : 'بدون برنده', cx, 640, { kind: 'display', size: 72, color: th.gold }); }
};
V.R2 = (c, th, S, now) => {
  phaseTag(c, th, S, 'راند ۲ · فاصله رو خودت انتخاب کن', 'هرچه دورتر، امتیاز بیشتر · ۲م +۵ · ۳م +۱۰ · ۴م +۲۰');
  ['E', 'M'].forEach((p, i) => {
    const x = i ? W - 96 - 520 : 96, y = 700; const L = S.r2.line[p];
    panel(c, th, x, y, 520, 200, { border: th[p] });
    text(c, th, S.names[p], x + 260, y + 40, { size: 32, color: th[p], w: 900 });
    if (L) { const ln = CFG.r2.lines[L]; text(c, th, `${fa(ln.m)} متر`, x + 360, y + 110, { kind: 'display', size: 64 }); text(c, th, `+${ln.pts}`, x + 150, y + 110, { kind: 'num', size: 72, color: th.gold, glow: 20 }); icon(c, 'LOCK', x + 470, y + 40, 34, th.gold); }
    else text(c, th, 'در حال انتخاب...', x + 260, y + 110, { size: 34, color: th.dim });
    for (let k = 0; k < 3; k++) { const v = S.r2.throws[p][k]; const bx = x + 150 + k * 110, by = y + 170; c.beginPath(); c.arc(bx, by, 16, 0, Math.PI * 2); c.fillStyle = v === 1 ? th.gold : v === 0 ? 'rgba(255,255,255,0.18)' : v === -1 ? th.E : 'rgba(255,255,255,0.06)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 2; c.stroke(); }
  });
};
V.R3_SANDWICH = (c, th, S, now) => {
  phaseTag(c, th, S, 'راند ۳ · دوئل ساندویچ', 'دهان‌پر = توقف ساعت · ۳۰ ثانیه برای قورت · دهان خالی = قطعی');
  const R = S.r3, el = r3Elapsed(S, now);
  ['E', 'M'].forEach((p, i) => {
    const x = i ? W - 96 - 700 : 96, y = 300; const done = R.done[p], T = R.T[p]; const mouth = R.mouthAt[p] && !done;
    const col = done === 'empty' ? th.M : mouth ? th.gold : done === 'dq' || done === 'nofinish' ? th.E : th.text;
    panel(c, th, x, y, 700, 400, { border: th[p], lw: 3 });
    icon(c, 'SANDWICH', x + 620, y + 60, 70, th[p]); text(c, th, S.names[p], x + 350, y + 56, { size: 40, color: th[p], w: 900 });
    const val = T != null ? T : R.startAt ? el + R.pen[p] : 0; text(c, th, val.toFixed(1), x + 350, y + 190, { kind: 'num', size: 170, color: col, glow: 24 });
    const chip = done === 'empty' ? 'قطعی' : mouth ? 'موقت · قورت بده' : done === 'dq' ? 'رد صلاحیت' : done === 'nofinish' ? 'تمام نکرد · ۶۰' : R.startAt ? 'در حال خوردن' : 'دست‌ها پشت کمر';
    text(c, th, chip, x + 350, y + 300, { size: 36, color: col, w: 800 });
    if (mouth) { const f = 1 - (now - R.mouthAt[p]) / 30000; bar(c, th, x + 60, y + 350, 580, 18, f, f < 0.25 ? th.E : th.gold); }
    if (R.pen[p]) text(c, th, `جریمه +${fa(R.pen[p])}`, x + 100, y + 56, { size: 26, color: th.E });
  });
  if (R.startAt && !R.result && ['E', 'M'].some(p => !R.done[p])) text(c, th, 'قانون سکوت · اول قورت، بعد خنده', cx, 760, { size: 30, color: th.dim, w: 700 });
  if (R.result) text(c, th, R.result.note || '', cx, 780, { size: 34, color: th.gold });
};
V.TWIST_BANKOPEN = (c, th, S, now, hud) => {
  const f = S.fx.filter(x => x.type === 'bankopen').at(-1); const age = f ? now - f.at : 99999;
  const k = ease.expo(Math.min(1, age / 700)); const g = age < 1000 ? Math.random() : 0;
  c.save(); c.globalAlpha = k;
  if (g > 0.5) { text(c, th, 'BANK OPEN', cx + 14, 250, { kind: 'num', size: 150, color: '#ff3b6b', alpha: 0.6 }); text(c, th, 'BANK OPEN', cx - 14, 250, { kind: 'num', size: 150, color: '#28e0ff', alpha: 0.6 }); }
  text(c, th, 'BANK OPEN', cx, 250, { kind: 'num', size: 150, color: th.gold, glow: 40 });
  text(c, th, 'بانک باز شد', cx, 370, { kind: 'display', size: 96, color: th.text });
  c.restore();
  if (age > 2400) { const k2 = ease.expo(Math.min(1, (age - 2400) / 600)); text(c, th, 'آبی برای خودت  ·  قرمز برای حریف  ·  طلایی برای شجاع‌ها', cx, 930, { size: 44, w: 800, alpha: k2, color: th.text }); }
  CARD_ORDER.forEach((k3, i) => { const cc = CFG.shop.cards[k3]; const x = cx + (2 - i) * 270; text(c, th, cc.fa, x, 780, { size: 30, w: 800, alpha: ease.cl((age - 1200 - i * 120) / 400) }); text(c, th, fa(cc.price), x, 830, { kind: 'num', size: 44, color: th.gold, alpha: ease.cl((age - 1200 - i * 120) / 400) }); });
};
V.R4_GLUE = (c, th, S, now) => {
  const F = S.r4; phaseTag(c, th, S, 'راند ۴ · دستکش، پازل و چسب', 'چیدن با دستکش · چسب بی‌دستکش · اولین «تمام» +۱۵');
  const el = r4Elapsed(S, now), left = CFG.r4.limit - el; bigTimer(c, th, F.startAt ? left : CFG.r4.limit, cx, 330, 120, th.text, false, F.startAt && left < 10 && !F.result, now);
  if (F.challenge) {
    text(c, th, 'چالش چسب', cx, 450, { kind: 'display', size: 72, color: th.gold });
    ['E', 'M'].forEach((p, i) => { const x = i ? cx + 60 : cx - 460; panel(c, th, x, 510, 400, 300, { border: th[p], lw: 4 }); grid(c, th, x + 70, 560, 260, 180, 1, th[p]); text(c, th, p, x + 200, 790, { kind: 'num', size: 40, color: th[p] }); });
    ['۱ تست تکان', '۲ قاب و تراز', '۳ تمیزی'].forEach((s, i) => text(c, th, s, cx, 870 + i * 44, { size: 30, color: th.dim }));
    if (F.challenge.result !== undefined) text(c, th, F.challenge.result ? `برندهٔ چسب: ${S.names[F.challenge.result]}` : 'تشخیص نمی‌دم', cx, 640, { kind: 'display', size: 58, color: th.gold, glow: 20 });
    return;
  }
  ['E', 'M'].forEach((p, i) => {
    const x = i ? W - 96 - 560 : 96, y = 420; const fin = F.finish[p]; const locked = now < F.lockUntil[p];
    panel(c, th, x, y, 560, 380, { border: th[p], lw: 3 }); text(c, th, S.names[p], x + 280, y + 46, { size: 36, color: th[p], w: 900 });
    grid(c, th, x + 140, y + 90, 280, 190, fin != null ? 1 : Math.min(0.83, el / 150), th[p]);
    text(c, th, fin != null ? `تمام · ${fmtClock(fin, true)}` : locked ? `قفل ${fa(Math.ceil((F.lockUntil[p] - now) / 1000))}` : 'در حال چیدن', x + 280, y + 330, { size: 36, w: 800, color: fin != null ? th.gold : locked ? th.E : th.dim });
    if (F.first === p) icon(c, 'CROWN', x + 500, y + 46, 40, th.gold);
  });
};
function grid(c, th, x, y, w, h, prog, col) { const cw = w / 3, ch = h / 2; for (let r = 0; r < 2; r++) for (let q = 0; q < 3; q++) { const i = r * 3 + q, on = i < Math.round(prog * 6); c.save(); c.fillStyle = on ? col : 'rgba(255,255,255,0.06)'; c.globalAlpha = on ? 0.9 : 1; rr(c, x + q * cw + 4, y + r * ch + 4, cw - 8, ch - 8, 8); c.fill(); c.restore(); } }
V.REVEAL = (c, th, S, now) => {
  phaseTag(c, th, S, 'رونمایی بانک', 'سقف فاصله ۳۰ ثانیه');
  const f = S.fx.filter(x => x.type === 'reveal').at(-1); const age = f ? now - f.at : 0; const k = ease.quint(Math.min(1, age / 2600));
  ['E', 'M'].forEach((p, i) => { const x = i ? cx + 330 : cx - 330; const val = (S.reveal.done ? S.banks[p] : S.banks[p]) * (f ? k : 0); text(c, th, fmtClock(val), x, 900, { kind: 'num', size: 90, color: th[p], glow: 20 }); text(c, th, S.names[p], x, 980, { size: 34, w: 800 }); });
  if (S.reveal.done && age > 2600) { const gap = Math.abs(S.banks.E - S.banks.M); text(c, th, S.reveal.capped ? 'سقف اعمال شد · فاصله = ۳۰' : gap === 30 ? 'دقیقاً روی مرز' : `فاصله ${fa(Math.round(gap))} ثانیه`, cx, 560, { kind: 'display', size: 70, color: S.reveal.capped ? th.E : th.gold, glow: 20 }); }
};
V.SHOP = (c, th, S, now, hud) => {
  phaseTag(c, th, S, 'فروشگاه کارت', 'حداکثر ۲ کارت · فقط ۱ قرمز · مخفی و همزمان');
  CARD_ORDER.forEach((k, i) => { const cc = CFG.shop.cards[k]; const x = cx + (2 - i) * 330; text(c, th, cc.line, x, 790, { size: 28, color: th.dim, w: 600 });
    if (S.shop.leader && (cc.color !== 'blue')) text(c, th, `جلو: ${fa(cc.price + CFG.shop.tax)}`, x, 836, { size: 26, color: th.E, w: 800 }); });
  ['E', 'M'].forEach((p, i) => { const sub = S.shop.submitted[p]; text(c, th, `${S.names[p]}: ${sub ? 'ثبت شد ●' : 'در حال انتخاب...'}`, i ? W - 300 : 300, 930, { size: 36, w: 800, color: sub ? th.gold : th.dim }); });
  const f = S.fx.find(x => x.type === 'bankopen'); const age = now - (S._shopAt || now);
};
V.SHOP_REVEAL = (c, th, S, now) => {
  phaseTag(c, th, S, 'رونمایی کارت‌ها', 'آینه ← سپر ← اثر');
  const f = S.fx.filter(x => x.type === 'shopreveal').at(-1); const age = f ? now - f.at : -1;
  ['E', 'M'].forEach((p, i) => {
    const x = i ? W - 96 - 700 : 96, y = 360; panel(c, th, x, y, 700, 440, { border: th[p], lw: 3 }); text(c, th, S.names[p], x + 350, y + 48, { size: 38, color: th[p], w: 900 });
    const picks = S.shop.revealed ? S.shop.picks[p] : S.shop.picks[p].map(() => '?');
    if (!picks.length) text(c, th, 'هیچی', x + 350, y + 220, { kind: 'display', size: 70, color: th.dim });
    picks.forEach((k, j) => { const flip = S.shop.revealed ? ease.expo(ease.cl((age - j * 250) / 500)) : 0; const cc = CFG.shop.cards[k]; const bx = x + 350 + (j - (picks.length - 1) / 2) * 260, by = y + 220;
      c.save(); c.translate(bx, by); c.scale(Math.max(0.02, Math.abs(Math.cos((1 - flip) * Math.PI / 2 + (flip < 0.5 ? 0 : 0)))), 1);
      const colr = cc ? (cc.color === 'red' ? th.E : cc.color === 'blue' ? th.A : th.gold) : th.panel2;
      panel(c, th, -100, -130, 200, 260, { fill: flip > 0.02 ? colr : th.panel2, border: th.gold, lw: 3, shadow: false });
      if (flip > 0.02 && cc) { icon(c, k, 0, -40, 90, '#fff'); text(c, th, cc.fa, 0, 70, { size: 30, w: 900, stroke: 6, strokeColor: 'rgba(0,0,0,0.5)', shadow: 0 }); } else icon(c, 'LOCK', 0, 0, 70, th.gold);
      c.restore(); });
  });
  if (f && age > 1200) (S.shop.outcome || []).forEach((o, i) => { const k = ease.expo(ease.cl((age - 1200 - i * 700) / 500)); if (k <= 0) return; const cc = CFG.shop.cards[o.card]; const col = o.status === 'ACTIVE' ? th.E : o.status === 'BOUNCED' ? th.gold : o.status === 'BLOCKED' ? th.A : th.dim;
    text(c, th, `${cc.fa} ${o.status === 'BURNED' ? 'ِ' + S.names[o.from] : '← ' + S.names[o.dest]} · ${STATUS_FA[o.status]}`, cx, 860 + i * 58, { size: 42, w: 900, color: col, alpha: k }); });
};
V.RISK = (c, th, S, now) => {
  phaseTag(c, th, S, 'شوت ریسک', 'اول نفر عقب اعلام می‌کند · کف بانک ۲۰');
  ['E', 'M'].forEach((p, i) => { const x = i ? W - 96 - 700 : 96, y = 380; const st = S.risk.stake[p], res = S.risk.result[p]; panel(c, th, x, y, 700, 380, { border: th[p], lw: 3 }); text(c, th, S.names[p], x + 350, y + 50, { size: 38, color: th[p], w: 900 });
    const opts = [0, 10, 20, 'ALLIN']; opts.forEach((o, j) => { const bx = x + 80 + j * 150, by = y + 130; const sel = st && ((o === 'ALLIN' && st.allIn) || (o !== 'ALLIN' && !st.allIn && st.v === o)); panel(c, th, bx, by, 130, 90, { fill: sel ? th.gold : th.panel2, border: sel ? th.gold : th.line, lw: 2, shadow: false }); text(c, th, o === 'ALLIN' ? 'همه‌چی ۳۰' : fa(o), bx + 65, by + 46, { size: o === 'ALLIN' ? 26 : 44, w: 900, color: sel ? th.dark : th.text, stroke: 0, shadow: 0 }); });
    if (st) icon(c, 'LOCK', x + 640, y + 50, 36, th.gold);
    if (res) text(c, th, res === 'HIT' ? 'خورد ✔' : 'نخورد ✘', x + 350, y + 310, { kind: 'display', size: 76, color: res === 'HIT' ? th.gold : th.E, glow: 24 }); });
  const last = S.fx.filter(x => x.type === 'miss').at(-1); if (last && now - last.at < 1500) { c.save(); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 3; const ox = last.p === 'E' ? 446 : W - 446, oy = 570; for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(ox, oy); let px = ox, py = oy; const a = (i / 12) * Math.PI * 2; for (let s = 0; s < 5; s++) { px += Math.cos(a + (Math.random() - 0.5) * 0.6) * 50; py += Math.sin(a + (Math.random() - 0.5) * 0.6) * 50; c.lineTo(px, py); } c.stroke(); } c.restore(); }
};
V.VAULT_ARMED = (c, th, S, now) => {
  const p = 0.5 + 0.5 * Math.sin(now / 180);
  text(c, th, 'VAULT ARMED', cx, 480, { kind: 'num', size: 170, color: th.E, glow: 30 + 30 * p });
  text(c, th, 'داور نزدیک‌تر میاد', cx, 640, { kind: 'display', size: 80, color: th.text });
  if (S.vault.order.length) text(c, th, `دویدن اول: ${S.names[S.vault.order[0]]}`, cx, 760, { size: 40, color: th.dim, w: 800 });
};
function runView(c, th, S, now, hud) {
  const r = S.run; if (!r) { text(c, th, 'دویدن ثبت شده', cx, 540, { kind: 'display', size: 80 }); return; }
  const p = r.p, left = runLeft(r, now), warn = left <= 10 && !r.result && r.startAt;
  // giant clock
  text(c, th, S.names[p], cx, 70, { size: 36, color: th[p], w: 900 });
  text(c, th, fmtClock(left, true), cx + (warn ? Math.sin(now / 25) * 8 : 0), 185, { kind: 'num', size: 170, color: warn ? th.E : th.gold, glow: 36 });
  if (r.pauseAt) text(c, th, 'مکث داور', cx, 290, { size: 34, color: th.E, w: 900 });
  if (S.settings.ghost && S.phase === 'RUN2' && S.vault.results[S.vault.order[0]]) { const g = S.vault.results[S.vault.order[0]]; text(c, th, `شبح: ${fmtClock(g.left, true)}`, cx + 480, 185, { kind: 'num', size: 50, color: 'rgba(200,200,210,0.6)' }); }
  // stations
  const st = [['PENCIL', 'نقاشی کور'], ['BRAIN', 'اتاق حافظه'], ['QUESTION', 'معما'], ['VAULT', 'گاوصندوق']];
  st.forEach(([ic, lb], i) => { const x = cx + (1.5 - i) * 250 - 110, y = 320; const done = r.station > i + 1 || (r.result && r.result.open), cur = r.station === i + 1 && !r.result;
    panel(c, th, x, y, 220, 110, { fill: done ? th.M + (th.sticker ? '' : '44') : cur ? th.panel2 : th.panel, border: cur ? th.gold : done ? th.M : th.line, lw: cur ? 4 : 2, shadow: false });
    icon(c, done ? 'CHECK' : cur ? ic : 'LOCK', x + 170, y + 55, 50, done ? th.M : cur ? th.gold : th.dim); text(c, th, lb, x + 80, y + 55, { size: 28, w: 800, color: cur ? th.text : th.dim, stroke: 0, shadow: 0 });
    if (i === 1 && S.effects[p]?.gloves) text(c, th, 'با دستکش', x + 110, y + 132, { size: 24, color: th.E, w: 900 }); });
  const cy = 700;
  if (r.flashDigits && r.flashDigits.length) { r.flashDigits.forEach((fd, j) => { const x = cx + (r.flashDigits.length - 1) * 130 - j * 260; panel(c, th, x - 110, cy - 160, 220, 300, { fill: th.panel2, border: th.gold, lw: 5 }); text(c, th, `C${fd.i + 1}`, x, cy - 110, { kind: 'num', size: 40, color: th.dim }); text(c, th, String(fd.d), x, cy + 20, { kind: 'num', size: 200, color: th.gold, glow: 50 }); }); return; }
  if (r.result) { text(c, th, r.result.open ? 'VAULT OPEN' : 'گاوصندوق بسته ماند', cx, cy - 60, { kind: r.result.open ? 'num' : 'display', size: 130, color: r.result.open ? th.gold : th.E, glow: 30 }); text(c, th, r.result.open ? fmtClock(r.result.left, true) : `کدها: ${fa(r.result.codes)} از ۳`, cx, cy + 90, { kind: 'num', size: 90, color: th.text }); return; }
  if (!r.startAt) { text(c, th, 'آماده', cx, cy - 40, { kind: 'display', size: 120, color: th.text }); text(c, th, `ساعت = بانک · ${fmtClock(r.clock0)}`, cx, cy + 80, { size: 44, color: th.dim, w: 800 }); return; }
  if (r.station === 1) {
    if (r.stage === 'target' && S.vault.target != null) { const f = 1 - (now - r.stageAt) / (CFG.vault.targetShow * 1000); ring(c, cx, cy, 220, f, th.gold, 14); text(c, th, TARGETS[S.vault.target].fa, cx, cy, { kind: 'display', size: 150, color: th.text, glow: 20 }); }
    else { text(c, th, 'نقاشی کور', cx, cy - 60, { kind: 'display', size: 110, color: th.text }); text(c, th, 'جمنای، این چیه؟ فقط یه کلمه.', cx, cy + 70, { size: 44, color: th.G, w: 800 }); }
  }
  if (r.station === 2) memoryHUD(c, th, S, now, r);
  if (r.station === 3) { const rt = S.vault.riddleText; panel(c, th, 200, cy - 200, W - 400, 380, { border: rt && rt.spicy ? th.E : th.gold, lw: 4 }); if (rt) { const lines = wrap(rt.text, 48, 3); lines.forEach((l, i) => text(c, th, l.join(' '), cx, cy - 90 + i * 76 - (lines.length - 1) * 10, { size: 52, w: 800 })); if (rt.spicy) text(c, th, 'معمای تند', 360, cy - 160, { size: 30, color: th.E, w: 900 }); if (rt.hint) text(c, th, 'ذره‌بین: ' + rt.hint, cx, cy + 140, { size: 38, color: th.A, w: 800 }); }
    if (now < r.s3.lockUntil) text(c, th, `قفل ${fa(Math.ceil((r.s3.lockUntil - now) / 1000))}`, cx, cy + 230, { size: 44, color: th.E, w: 900 }); }
  if (r.station === 4) { for (let i = 0; i < 3; i++) { const x = cx + (1 - i) * 200; panel(c, th, x - 80, cy - 110, 160, 220, { fill: th.panel2, border: th.gold, lw: 4 }); text(c, th, r.code.entry?.[i] || '_', x, cy, { kind: 'num', size: 130, color: th.gold }); } text(c, th, 'رمز سه‌رقمی رو وارد کن', cx, cy + 190, { size: 40, color: th.dim, w: 800 }); if (now < r.code.lockUntil) text(c, th, `قفل ${fa(Math.ceil((r.code.lockUntil - now) / 1000))}`, cx, cy + 250, { size: 40, color: th.E, w: 900 }); }
}
function memoryHUD(c, th, S, now, r) {
  const since = (now - r.stageAt) / 1000; const y = 930;
  if (r.stage === 'show' || r.stage === 'hint') { const dur = r.stage === 'show' ? CFG.vault.memShow : CFG.vault.hintShow; ring(c, 180, 640, 70, 1 - since / dur, th.gold, 12); text(c, th, fa(Math.max(0, Math.ceil(dur - since))), 180, 640, { kind: 'num', size: 64 }); text(c, th, r.stage === 'show' ? 'نگاه کن' : 'ذره‌بین', cx, y, { kind: 'display', size: 60, color: th.gold }); }
  if (r.stage === 'lock') { bar(c, th, 360, y - 20, W - 720, 26, 1 - since / CFG.vault.memLock, th.E); text(c, th, 'فقط روی میز بچین', cx, y + 40, { size: 40, w: 800 }); }
  if (r.stage === 'input') { text(c, th, 'وارد کن + CHECK', cx, y, { kind: 'display', size: 56, color: th.text }); if (r.s2.lastN != null && r.s2.lastN < 8) text(c, th, `${fa(r.s2.lastN)} از ۸`, cx, y - 380, { kind: 'display', size: 80, color: th.E, glow: 20 }); }
}
V.RUN1 = runView; V.RUN2 = runView;
V.CASE = (c, th, S, now) => {
  const k = S.kase, w = k.winner;
  if (!w) { text(c, th, 'مرگ ناگهانی · سُر توکن', cx, 540, { kind: 'display', size: 100, color: th.gold }); return; }
  if (k.layer === 0) { text(c, th, 'برندهٔ کیف...', cx, 540, { kind: 'display', size: 120, color: th.gold, glow: 30 }); return; }
  text(c, th, `برنده: ${S.names[w]}`, cx, 250, { kind: 'display', size: 96, color: th[w], glow: 20 });
  if (S.vault.code) { const f = S.fx.find(x => x.type === 'caseopen'); const age = f ? now - f.at : 9999; S.vault.code.forEach((d, i) => { const x = cx + (1 - i) * 170; const roll = age < 600 + i * 500; panel(c, th, x - 70, 320, 140, 180, { fill: th.panel2, border: th.gold, lw: 4 }); text(c, th, roll ? String(Math.floor(now / 50 + i * 3) % 10) : String(d), x, 410, { kind: 'num', size: 120, color: th.gold, glow: roll ? 0 : 40 }); }); }
  const L = [['CROWN', 'تاج + نشان ساندویچ طلایی'], ['ENVELOPE', 'پاکت سرنوشت'], ['BOX', 'پاکت بازنده']];
  L.forEach(([ic, lb], i) => { const on = k.layer >= i + 2; const x = cx + (1 - i) * 440 - 200; panel(c, th, x, 560, 400, 150, { fill: on ? th.panel2 : th.panel, border: on ? th.gold : th.line, lw: on ? 4 : 2 }); icon(c, ic, x + 330, 635, 70, on ? th.gold : th.dim); text(c, th, lb, x + 150, 635, { size: 30, w: 800, color: on ? th.text : th.dim, maxW: 260 }); });
  if (k.layer === 2) text(c, th, `نشان‌ها: ${S.names[w]} ${fa(S.badges[w])}`, cx, 800, { kind: 'display', size: 64, color: th.gold });
  if (k.layer === 3 && k.fate != null) { text(c, th, `«${FATE[k.fate].t}»`, cx, 790, { kind: 'display', size: 76, color: th.gold }); text(c, th, FATE[k.fate].d, cx, 880, { size: 38, w: 700 }); }
  if (k.layer >= 4) BITES.forEach((b, i) => { const x = 330 + i * 252, y = 760; const picked = k.bite.picked.includes(i), show = picked || k.bite.revealed; panel(c, th, x - 110, y, 220, 200, { fill: picked ? th.E : th.panel2, border: picked ? th.E : th.line, lw: 3 }); text(c, th, fa(i + 1), x, y + 50, { kind: 'num', size: 50, color: th.gold }); if (show) text(c, th, b.t, x, y + 130, { size: 26, w: 800, maxW: 200 }); });
};
V.END = (c, th, S, now) => {
  text(c, th, 'دفاع از تاج', cx, 380, { kind: 'display', size: 170, color: th.gold, glow: 30 });
  text(c, th, 'مجازات قسمت بعد رو شما انتخاب کنید', cx, 540, { size: 48, w: 800 });
  [cx - 440, cx + 40].forEach(x => { panel(c, th, x, 640, 400, 225, { fill: 'rgba(0,0,0,0.35)', border: th.line }); });
};
const VIEWS = V;
