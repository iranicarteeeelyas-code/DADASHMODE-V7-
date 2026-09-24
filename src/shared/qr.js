// Minimal QR encoder (byte mode, EC level M, versions 1-10). Offline, no deps.
const ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26], BLK = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const ALIGN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 255; };
function rsDiv(deg) { const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = mul(root, 2); } return r; }
function rsRem(data, div) { const r = div.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => (r[i] ^= mul(c, f))); } return r; }
const rawModules = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
const dataCap = v => Math.floor(rawModules(v) / 8) - ECC[v] * BLK[v];

export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let v = 1; while (v <= 10 && dataCap(v) < bytes.length + 2 + (v >= 10 ? 1 : 0)) v++;
  if (v > 10) throw new Error('QR too long');
  const bits = []; const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, v >= 10 ? 16 : 8); bytes.forEach(b => put(b, 8));
  const cap = dataCap(v) * 8; put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let p = 0xec; data.length < dataCap(v); p ^= 0xec ^ 0x11) data.push(p);
  // blocks
  const nb = BLK[v], el = ECC[v], raw = Math.floor(rawModules(v) / 8), ns = nb - (raw % nb), sl = Math.floor(raw / nb), div = rsDiv(el);
  const blocks = []; let k = 0;
  for (let i = 0; i < nb; i++) { const d = data.slice(k, k + sl - el + (i < ns ? 0 : 1)); k += d.length; const e = rsRem(d, div); if (i < ns) d.push(0); blocks.push(d.concat(e)); }
  const cw = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== sl - el || j >= ns) cw.push(b[i]); });
  // matrix
  const N = v * 4 + 17, M = Array.from({ length: N }, () => new Array(N).fill(false)), F = Array.from({ length: N }, () => new Array(N).fill(false));
  const set = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
  for (let i = 0; i < N; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && x < N && y >= 0 && y < N) set(x, y, d !== 2 && d !== 4); } };
  finder(3, 3); finder(N - 4, 3); finder(3, N - 4);
  const al = ALIGN[v];
  al.forEach((a, i) => al.forEach((b, j) => { if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
  const fmt = mask => { const d = (0 << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); const b = ((d << 10) | r) ^ 0x5412;
    const g = i => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, g(i)); set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8)); for (let i = 9; i < 15; i++) set(14 - i, 8, g(i));
    for (let i = 0; i < 8; i++) set(N - 1 - i, 8, g(i)); for (let i = 8; i < 15; i++) set(8, N - 15 + i, g(i)); set(8, N - 8, true); };
  fmt(0);
  if (v >= 7) { let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25); const b = (v << 12) | r; for (let i = 0; i < 18; i++) { const bt = ((b >>> i) & 1) === 1, a = N - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, bt); set(c, a, bt); } }
  let i = 0;
  for (let right = N - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let vert = 0; vert < N; vert++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? N - 1 - vert : vert; if (!F[y][x] && i < cw.length * 8) { M[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; } } }
  const maskFn = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  const applyMask = m => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!F[y][x] && maskFn[m](x, y)) M[y][x] = !M[y][x]; };
  const penalty = () => { let p = 0; const lines = []; for (let y = 0; y < N; y++) { lines.push(M[y].map(b => (b ? 1 : 0)).join('')); lines.push(M.map(r => (r[y] ? 1 : 0)).join('')); }
    lines.forEach(s => { (s.match(/0{5,}|1{5,}/g) || []).forEach(r => (p += r.length - 2)); p += ((s.match(/(?=10111010000|00001011101)/g) || []).length) * 40; });
    for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
    let dark = 0; M.forEach(r => r.forEach(b => (dark += b ? 1 : 0))); p += Math.floor(Math.abs(dark * 20 - N * N * 10) / (N * N)) * 10; return p; };
  let best = 0, bp = Infinity;
  for (let m = 0; m < 8; m++) { applyMask(m); fmt(m); const pp = penalty(); if (pp < bp) { bp = pp; best = m; } applyMask(m); }
  applyMask(best); fmt(best);
  return M;
}
export function qrSVG(text, px = 6, fg = '#0b0f1c', bg = '#ffffff') {
  const M = qrMatrix(text), N = M.length, q = 4, S = (N + q * 2) * px; let d = '';
  M.forEach((r, y) => r.forEach((b, x) => { if (b) d += `M${(x + q) * px} ${(y + q) * px}h${px}v${px}h-${px}z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><rect width="100%" height="100%" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`;
}
