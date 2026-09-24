// 2D drawing primitives for the broadcast HUD (canvas → WebGL texture)
export const THEMES = {
  vault: { name: 'vault', bg: '#070b18', panel: 'rgba(10,15,32,0.86)', panel2: 'rgba(22,30,58,0.9)', line: 'rgba(245,197,66,0.35)', gold: '#f5c542', gold2: '#ffdf7e', goldDeep: '#a8740f', E: '#e5484d', M: '#2fb36c', G: '#9b5de5', A: '#3e8bff', text: '#f6f1e6', dim: '#98a1b8', dark: '#05070f', display: 'Lalezar', body: 'Vazirmatn', num: 'JetBrains Mono', numW: 800, sticker: false, skew: 0 },
  beast: { name: 'beast', bg: '#0a1bd9', panel: '#0d0d12', panel2: '#17171f', line: '#ffe600', gold: '#ffe600', gold2: '#fff47a', goldDeep: '#d4a600', E: '#ff3344', M: '#16e46a', G: '#ff2e88', A: '#00d4ff', text: '#ffffff', dim: '#c9cfff', dark: '#050505', display: 'Lalezar', body: 'Vazirmatn', num: 'Anton', numW: 400, sticker: true, skew: -0.08 },
};
export const ease = { expo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)), quint: t => 1 - Math.pow(1 - Math.min(1, t), 5), inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), cl: t => Math.max(0, Math.min(1, t)) };
export function rr(c, x, y, w, h, r) { r = Math.min(r, h / 2, w / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
export function font(th, kind, size, w) { const f = kind === 'num' ? th.num : kind === 'display' ? th.display : th.body; const wt = w || (kind === 'num' ? th.numW : kind === 'display' ? 400 : 700); return `${wt} ${size}px "${f}", "Vazirmatn", sans-serif`; }
export function text(c, th, s, x, y, o = {}) {
  const { kind = 'body', size = 40, w, color = th.text, align = 'center', base = 'middle', stroke = th.sticker ? 12 : 0, strokeColor = th.dark, shadow = th.sticker ? 8 : 0, glow = 0, alpha = 1, dir, maxW } = o;
  c.save(); c.globalAlpha *= alpha; c.font = font(th, kind, size, w); c.textAlign = align; c.textBaseline = base;
  c.direction = dir || (/[\u0600-\u06FF]/.test(s) ? 'rtl' : 'ltr');
  if (shadow) { c.fillStyle = strokeColor; c.fillText(s, x + shadow * 0.6, y + shadow, maxW); if (stroke) { c.lineWidth = stroke; c.strokeStyle = strokeColor; c.lineJoin = 'round'; c.strokeText(s, x + shadow * 0.6, y + shadow, maxW); } }
  if (stroke) { c.lineWidth = stroke; c.strokeStyle = strokeColor; c.lineJoin = 'round'; c.strokeText(s, x, y, maxW); }
  if (glow) { c.shadowColor = color; c.shadowBlur = glow; }
  c.fillStyle = color; c.fillText(s, x, y, maxW); c.restore();
}
export function measure(c, th, s, kind, size, w) { c.save(); c.font = font(th, kind, size, w); c.direction = /[\u0600-\u06FF]/.test(s) ? 'rtl' : 'ltr'; const m = c.measureText(s).width; c.restore(); return m; }
export function panel(c, th, x, y, w, h, o = {}) {
  const { fill = th.panel, border = th.line, r = th.sticker ? 18 : 22, lw = th.sticker ? 6 : 2, shadow = true } = o;
  c.save();
  if (th.sticker) { c.fillStyle = th.dark; rr(c, x + 10, y + 12, w, h, r); c.fill(); }
  else if (shadow) { c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 40; c.shadowOffsetY = 16; }
  c.fillStyle = fill; rr(c, x, y, w, h, r); c.fill(); c.shadowColor = 'transparent';
  if (lw) { c.lineWidth = lw; c.strokeStyle = th.sticker ? th.dark : border; rr(c, x, y, w, h, r); c.stroke(); }
  c.restore();
}
export function ring(c, x, y, r, frac, col, lw = 10, back = 'rgba(255,255,255,0.12)') { c.save(); c.lineCap = 'round'; c.lineWidth = lw; c.strokeStyle = back; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); c.strokeStyle = col; c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, frac))); c.stroke(); c.restore(); }
export function bar(c, th, x, y, w, h, frac, col, back = 'rgba(255,255,255,0.1)') { c.save(); c.fillStyle = back; rr(c, x, y, w, h, h / 2); c.fill(); c.fillStyle = col; rr(c, x, y, Math.max(h, w * Math.max(0, Math.min(1, frac))), h, h / 2); c.fill(); c.restore(); }
export function fa(n) { return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); }
export function goldGrad(c, th, y0, y1) { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, th.gold2); g.addColorStop(0.55, th.gold); g.addColorStop(1, th.goldDeep); return g; }

// vector icons (no emoji dependence)
export function icon(c, name, x, y, s, col = '#fff', lw = 0) {
  c.save(); c.translate(x, y); c.scale(s / 100, s / 100); c.fillStyle = col; c.strokeStyle = col; c.lineWidth = lw || 9; c.lineCap = 'round'; c.lineJoin = 'round';
  const P = () => c.beginPath();
  switch (name) {
    case 'HINT': P(); c.arc(-8, -8, 28, 0, Math.PI * 2); c.stroke(); P(); c.moveTo(12, 12); c.lineTo(38, 38); c.lineWidth = 16; c.stroke(); break;
    case 'SHIELD': P(); c.moveTo(0, -42); c.lineTo(36, -28); c.quadraticCurveTo(36, 22, 0, 44); c.quadraticCurveTo(-36, 22, -36, -28); c.closePath(); c.fill(); c.globalCompositeOperation = 'destination-out'; P(); c.moveTo(0, -26); c.lineTo(0, 30); c.lineWidth = 8; c.stroke(); break;
    case 'GLOVES': P(); rr(c, -30, -34, 58, 58, 26); c.fill(); P(); c.ellipse(-30, -2, 13, 20, -0.4, 0, Math.PI * 2); c.fill(); P(); rr(c, -24, 20, 46, 22, 6); c.fill(); break;
    case 'SPICY': P(); c.moveTo(-34, 30); c.bezierCurveTo(-10, 34, 30, 10, 26, -22); c.bezierCurveTo(20, -30, 8, -26, 8, -18); c.bezierCurveTo(8, 6, -14, 16, -34, 30); c.fill(); P(); c.moveTo(18, -26); c.quadraticCurveTo(22, -42, 36, -40); c.lineWidth = 7; c.stroke(); break;
    case 'MIRROR': P(); c.ellipse(0, -10, 26, 34, 0, 0, Math.PI * 2); c.stroke(); P(); c.moveTo(0, 24); c.lineTo(0, 44); c.lineWidth = 12; c.stroke(); P(); c.moveTo(-8, -24); c.lineTo(6, -34); c.lineWidth = 6; c.stroke(); break;
    case 'LOCK': P(); c.arc(0, -12, 20, Math.PI, 0); c.lineWidth = 10; c.stroke(); P(); rr(c, -30, -12, 60, 46, 8); c.fill(); break;
    case 'UNLOCK': P(); c.arc(16, -18, 20, Math.PI, -0.1); c.lineWidth = 10; c.stroke(); P(); rr(c, -30, -8, 60, 44, 8); c.fill(); break;
    case 'CROWN': P(); c.moveTo(-40, 24); c.lineTo(-44, -24); c.lineTo(-20, 0); c.lineTo(0, -34); c.lineTo(20, 0); c.lineTo(44, -24); c.lineTo(40, 24); c.closePath(); c.fill(); break;
    case 'SANDWICH': P(); c.ellipse(0, -14, 42, 16, 0, Math.PI, 0); c.fill(); P(); rr(c, -44, -8, 88, 8, 4); c.fill(); P(); rr(c, -42, 4, 84, 8, 4); c.fill(); P(); rr(c, -42, 16, 84, 12, 6); c.fill(); break;
    case 'CUP': P(); c.moveTo(-26, -34); c.lineTo(26, -34); c.lineTo(18, 36); c.lineTo(-18, 36); c.closePath(); c.fill(); break;
    case 'CHECK': P(); c.moveTo(-30, 2); c.lineTo(-8, 24); c.lineTo(32, -22); c.lineWidth = 14; c.stroke(); break;
    case 'CROSS': P(); c.moveTo(-26, -26); c.lineTo(26, 26); c.moveTo(26, -26); c.lineTo(-26, 26); c.lineWidth = 14; c.stroke(); break;
    case 'PENCIL': P(); c.moveTo(-34, 34); c.lineTo(-26, 12); c.lineTo(22, -36); c.lineTo(36, -22); c.lineTo(-12, 26); c.closePath(); c.fill(); break;
    case 'BRAIN': P(); c.arc(-14, -6, 22, 0, Math.PI * 2); c.arc(14, -6, 22, 0, Math.PI * 2); c.fill(); P(); rr(c, -24, 8, 48, 26, 10); c.fill(); break;
    case 'QUESTION': c.font = '900 90px Vazirmatn'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 4); break;
    case 'VAULT': P(); c.arc(0, 0, 38, 0, Math.PI * 2); c.lineWidth = 8; c.stroke(); for (let i = 0; i < 6; i++) { P(); const a = (i / 6) * Math.PI * 2; c.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); c.lineTo(Math.cos(a) * 26, Math.sin(a) * 26); c.stroke(); } P(); c.arc(0, 0, 8, 0, Math.PI * 2); c.fill(); break;
    case 'ENVELOPE': P(); rr(c, -42, -28, 84, 56, 6); c.fill(); c.globalCompositeOperation = 'destination-out'; P(); c.moveTo(-40, -26); c.lineTo(0, 6); c.lineTo(40, -26); c.lineWidth = 6; c.stroke(); break;
    case 'BOX': P(); rr(c, -36, -30, 72, 60, 8); c.fill(); c.globalCompositeOperation = 'destination-out'; P(); c.moveTo(-36, -8); c.lineTo(36, -8); c.lineWidth = 5; c.stroke(); break;
  }
  c.restore();
}
