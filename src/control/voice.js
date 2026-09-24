// Gemini voice: recorded lines (IndexedDB) → fallback browser TTS (fa-IR)
import { voices } from './store.js';
export const vkey = t => 'v:' + t.replace(/[\u064B-\u0652\u0670]/g, '').replace(/\s+/g, ' ').trim();
let current = null;
export async function speak(text, rate = 1) {
  try { const rec = await voices.get(vkey(text)); if (rec) { if (current) current.pause(); current = new Audio(URL.createObjectURL(rec)); current.playbackRate = rate; await current.play(); return 'rec'; } } catch (e) {}
  if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(text.replace(/[\u064B-\u0652]/g, '')); const vs = speechSynthesis.getVoices(); const v = vs.find(x => /fa|Persian|Farsi/i.test(x.lang + x.name)); if (v) u.voice = v; u.lang = 'fa-IR'; u.rate = 0.95 * rate; u.pitch = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); return v ? 'tts' : 'tts-nofa'; }
  return 'none';
}
let rec = null, chunks = [];
export async function startRec() { const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } }); rec = new MediaRecorder(st); chunks = []; rec.ondataavailable = e => chunks.push(e.data); rec.start(); return true; }
export function stopRec() { return new Promise(res => { if (!rec) return res(null); rec.onstop = () => { rec.stream.getTracks().forEach(t => t.stop()); res(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); rec = null; }; rec.stop(); }); }
