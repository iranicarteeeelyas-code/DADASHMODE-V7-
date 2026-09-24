// Procedural cinematic SFX (WebAudio). Custom files can override any event (stored in IndexedDB by the control app).
let ctx = null, master = null, verb = null; const custom = new Map(); let vol = 0.8, enabled = true;
export function audioCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createDynamicsCompressor(); master.threshold.value = -10; master.ratio.value = 4;
    const g = ctx.createGain(); g.gain.value = vol; master.connect(g); g.connect(ctx.destination); master._g = g;
    verb = ctx.createConvolver(); const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = 0.28; verb.connect(vg); vg.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function setVolume(v) { vol = v; if (master) master._g.gain.value = v; }
export function setEnabled(b) { enabled = b; }
export async function setCustom(name, arrayBuffer) { const c = audioCtx(); custom.set(name, await c.decodeAudioData(arrayBuffer.slice(0))); }
export function clearCustom(name) { custom.delete(name); }

const T = () => ctx.currentTime;
function env(g, t, a, peak, d, end = 0.0001) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
function osc(type, f, t, dur, peak = 0.5, a = 0.005, dest = master, send = 0) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); env(g, t, a, peak, dur); o.connect(g); g.connect(dest); if (send) { const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(verb); } o.start(t); o.stop(t + a + dur + 0.05); return o; }
function noise(t, dur, peak = 0.4, filt = null, a = 0.005, send = 0) { const len = Math.ceil(ctx.sampleRate * (dur + a + 0.05)), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(); s.buffer = b; const g = ctx.createGain(); env(g, t, a, peak, dur); let n = s; if (filt) { const f = ctx.createBiquadFilter(); Object.assign(f, { type: filt.type }); f.frequency.setValueAtTime(filt.f, t); if (filt.f2) f.frequency.exponentialRampToValueAtTime(filt.f2, t + a + dur); f.Q.value = filt.q || 1; n.connect(f); n = f; } n.connect(g); g.connect(master); if (send) { const sg = ctx.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(verb); } s.start(t); return s; }

const LIB = {
  impact(t) { const o = osc('sine', 120, t, 0.9, 0.9, 0.003, master, 0.4); o.frequency.exponentialRampToValueAtTime(38, t + 0.6); noise(t, 0.25, 0.5, { type: 'lowpass', f: 2500, f2: 200 }, 0.002, 0.5); },
  boom(t) { const o = osc('sine', 90, t, 1.6, 1, 0.002, master, 0.3); o.frequency.exponentialRampToValueAtTime(30, t + 1.2); const o2 = osc('triangle', 180, t, 0.3, 0.4); o2.frequency.exponentialRampToValueAtTime(40, t + 0.3); },
  riser(t, d = 1.6) { noise(t, d, 0.35, { type: 'bandpass', f: 300, f2: 6000, q: 3 }, d * 0.9, 0.4); const o = osc('sawtooth', 110, t, d, 0.08, d * 0.9); o.frequency.exponentialRampToValueAtTime(880, t + d); },
  whoosh(t) { noise(t, 0.45, 0.35, { type: 'bandpass', f: 400, f2: 3500, q: 1.2 }, 0.12, 0.2); },
  tick(t) { osc('square', 1800, t, 0.03, 0.15); noise(t, 0.02, 0.15, { type: 'highpass', f: 3000 }); },
  ding(t) { [1318, 2637].forEach((f, i) => osc('sine', f, t, 1.1, i ? 0.12 : 0.35, 0.003, master, 0.35)); },
  pop(t) { const o = osc('sine', 500, t, 0.12, 0.6); o.frequency.exponentialRampToValueAtTime(1400, t + 0.06); },
  buzz(t) { osc('sawtooth', 110, t, 0.45, 0.35); osc('square', 116, t, 0.45, 0.2); },
  cash(t) { [2093, 2637, 3136].forEach((f, i) => osc('sine', f, t + i * 0.05, 0.9, 0.22, 0.002, master, 0.4)); noise(t, 0.12, 0.3, { type: 'highpass', f: 4000 }); LIB.coins(t + 0.08); },
  coins(t) { for (let i = 0; i < 9; i++) osc('triangle', 2500 + Math.random() * 2500, t + i * 0.035 + Math.random() * 0.02, 0.18, 0.08, 0.001, master, 0.2); },
  lock(t) { noise(t, 0.08, 0.6, { type: 'bandpass', f: 1800, q: 4 }); osc('square', 220, t + 0.06, 0.12, 0.25); noise(t + 0.1, 0.14, 0.4, { type: 'bandpass', f: 900, q: 6 }, 0.002, 0.3); },
  unlock(t) { [0, 0.07, 0.14].forEach((d, i) => noise(t + d, 0.05, 0.4, { type: 'bandpass', f: 2500 + i * 600, q: 8 })); LIB.ding(t + 0.2); },
  glitch(t) { for (let i = 0; i < 10; i++) { const d = Math.random() * 0.8; noise(t + d, 0.03 + Math.random() * 0.05, 0.35, { type: 'bandpass', f: 400 + Math.random() * 5000, q: 10 }); osc('square', 60 + Math.random() * 900, t + d, 0.04, 0.12); } },
  vault(t) { const o = osc('sawtooth', 55, t, 2.4, 0.35, 0.3, master, 0.5); o.frequency.linearRampToValueAtTime(40, t + 2.4); noise(t, 2.2, 0.2, { type: 'lowpass', f: 300 }, 0.4, 0.3); LIB.lock(t + 0.1); LIB.choir(t + 1.2); },
  choir(t) { [220, 277, 330, 440, 554].forEach(f => { const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'bandpass'; fl.frequency.value = 800; fl.Q.value = 2; env(g, t, 0.08, 0.09, 1.8); o.connect(fl); fl.connect(g); g.connect(master); const s = ctx.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(verb); o.start(t); o.stop(t + 2); }); },
  heartbeat(t) { [0, 0.22].forEach(d => { const o = osc('sine', 60, t + d, 0.18, 0.8); o.frequency.exponentialRampToValueAtTime(40, t + d + 0.15); }); },
  trombone(t) { const o = osc('sawtooth', 294, t, 1.6, 0.18, 0.05); o.frequency.setValueAtTime(294, t); o.frequency.setValueAtTime(277, t + 0.35); o.frequency.setValueAtTime(262, t + 0.7); o.frequency.linearRampToValueAtTime(220, t + 1.5); },
  scratch(t) { noise(t, 0.25, 0.5, { type: 'bandpass', f: 1200, f2: 300, q: 4 }); noise(t + 0.2, 0.2, 0.4, { type: 'bandpass', f: 300, f2: 1500, q: 4 }); },
  bass(t) { const o = osc('sine', 70, t, 1.8, 1, 0.002); o.frequency.exponentialRampToValueAtTime(28, t + 1.5); },
  glass(t) { for (let i = 0; i < 14; i++) osc('triangle', 3000 + Math.random() * 5000, t + Math.random() * 0.25, 0.3, 0.07, 0.001, master, 0.4); noise(t, 0.35, 0.4, { type: 'highpass', f: 2500 }, 0.001, 0.4); },
  shield(t) { osc('triangle', 660, t, 0.9, 0.3, 0.002, master, 0.5); osc('triangle', 990, t, 0.7, 0.2, 0.002, master, 0.5); noise(t, 0.1, 0.4, { type: 'bandpass', f: 3000, q: 2 }); },
  mirror(t) { const o = osc('sine', 600, t, 0.8, 0.25, 0.01, master, 0.6); o.frequency.exponentialRampToValueAtTime(2400, t + 0.5); },
  horn(t) { osc('square', 440, t, 0.5, 0.25, 0.01); osc('square', 442, t, 0.5, 0.2, 0.01); },
  beep1k(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 1000; g.gain.setValueAtTime(0.5, t); g.gain.setValueAtTime(0, t + 0.2); o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.21); },
  win(t) { [523, 659, 784, 1047].forEach((f, i) => osc('triangle', f, t + i * 0.12, 0.7, 0.2, 0.005, master, 0.4)); LIB.choir(t + 0.4); },
  thud(t) { const o = osc('sine', 80, t, 0.35, 0.8); o.frequency.exponentialRampToValueAtTime(45, t + 0.3); },
  howl(t) { const o = osc('sawtooth', 300, t, 1.6, 0.12, 0.3, master, 0.7); o.frequency.linearRampToValueAtTime(700, t + 0.6); o.frequency.linearRampToValueAtTime(420, t + 1.6); },
  moo(t) { const o = osc('sawtooth', 150, t, 0.8, 0.2, 0.1); o.frequency.linearRampToValueAtTime(110, t + 0.8); },
};
export const SFX_NAMES = Object.keys(LIB);
export function play(name, delay = 0) {
  if (!enabled) return; const c = audioCtx(); const t = c.currentTime + delay + 0.01;
  if (custom.has(name)) { const s = c.createBufferSource(); s.buffer = custom.get(name); s.connect(master); s.start(t); return; }
  const fn = LIB[name]; if (fn) try { fn(t); } catch (e) { /* ignore */ }
}
