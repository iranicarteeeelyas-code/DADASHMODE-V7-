// Subtitle timing & export (shared by stage renderer, control preview and SRT/VTT export)
export const PRESETS = {
  main: { on: true, clean: false, size: 52, pos: 'bottom', y: 0.86, lines: 2, bg: 'shadow', mode: 'karaoke', cps: 15 },
  shorts: { on: true, clean: false, size: 74, pos: 'custom', y: 0.64, lines: 2, bg: 'box', mode: 'word', cps: 13 },
  rehearsal: { on: true, clean: false, size: 84, pos: 'bottom', y: 0.84, lines: 2, bg: 'box', mode: 'all', cps: 12 },
  off: { on: false },
};
export const SPEAKER = { G: { fa: 'جمنای', color: 'G' }, E: { fa: 'الیاس', color: 'E' }, M: { fa: 'عماد', color: 'M' }, A: { fa: 'اپ', color: 'A' } };
export function duration(text, cps) { return Math.min(7, Math.max(1.5, text.length / Math.max(4, cps))); }
// timeline: each cue gets start/end; a new cue cuts the previous (never below 0.8s)
export function timeline(cues, cfg) {
  const out = []; const off = (cfg.offset || 0) * 1000;
  cues.forEach((c, i) => {
    if (cfg.speakers && cfg.speakers[c.speaker] === false) return;
    const start = c.at + off; let end = start + duration(c.text, cfg.cps) * 1000;
    const next = cues[i + 1]; if (next) end = Math.min(end, Math.max(start + 800, next.at + off));
    out.push({ ...c, start, end });
  });
  return out;
}
export function activeCue(cues, cfg, now) { const tl = timeline(cues.slice(-8), cfg); for (let i = tl.length - 1; i >= 0; i--) if (now >= tl[i].start && now < tl[i].end) return tl[i]; return null; }
// wrap to max chars per line
export function wrap(text, maxChars = 42, lines = 2) {
  const words = text.split(/\s+/).filter(Boolean); const out = [[]]; let len = 0;
  words.forEach(w => { if (len + w.length > maxChars && out.at(-1).length) { out.push([]); len = 0; } out.at(-1).push(w); len += w.length + 1; });
  if (out.length > lines) { const keep = out.slice(0, lines - 1); keep.push(out.slice(lines - 1).flat()); return keep; }
  return out;
}
const ts = (ms, sep) => { ms = Math.max(0, Math.round(ms)); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, x = ms % 1000; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(x).padStart(3, '0')}`; };
export function toSRT(cues, cfg, t0, withNames = true) { return timeline(cues, cfg).map((c, i) => `${i + 1}\n${ts(c.start - t0, ',')} --> ${ts(c.end - t0, ',')}\n${withNames ? SPEAKER[c.speaker].fa + ': ' : ''}${c.text}\n`).join('\n'); }
export function toVTT(cues, cfg, t0) { return 'WEBVTT\n\n' + timeline(cues, cfg).map(c => `${ts(c.start - t0, '.')} --> ${ts(c.end - t0, '.')}\n<v ${SPEAKER[c.speaker].fa}>${c.text}\n`).join('\n'); }
export function toSRTEnglishBlank(cues, cfg, t0) { return timeline(cues, cfg).map((c, i) => `${i + 1}\n${ts(c.start - t0, ',')} --> ${ts(c.end - t0, ',')}\n[EN] \n`).join('\n'); }
