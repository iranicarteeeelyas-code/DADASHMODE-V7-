// Host: owns the one true state; applies commands from keyboard, UI, phones; persists; broadcasts
import { apply, tick, initialState, publicView } from '../shared/engine.js';
import { Link } from '../shared/sync.js';
import { kv, saveVersion } from './store.js';

export class Host {
  constructor() { this.s = initialState(); this.hist = []; this.subs = new Set(); this.errs = new Set(); this.peers = new Map(); this.seen = new Set(); this.stageWin = null; }
  async init() {
    const saved = await kv.get('state'); if (saved && saved.v === 7) { const base = initialState(); this.s = { ...base, ...saved, settings: { ...base.settings, ...saved.settings, subs: { ...base.settings.subs, ...(saved.settings?.subs || {}) }, link: saved.settings?.link || base.settings.link } }; }
    const L = this.s.settings.link;
    this.link = new Link({ role: 'host', room: L.room, pin: L.pin, onMsg: m => this.onMsg(m), onStatus: st => { this.wsStatus = st; this.emit(); } });
    setInterval(() => this.loop(), 100); setInterval(() => this.broadcast(true), 1000);
    window.addEventListener('message', e => { if (e.data && e.data.type === 'cmd') this.onMsg(e.data); if (e.data && e.data.type === 'stage-hello') this.broadcast(true); });
  }
  onMsg(m) {
    if (m.type === 'cmd') { if (this.seen.has(m.id)) return; this.seen.add(m.id); if (this.seen.size > 500) this.seen = new Set([...this.seen].slice(-250));
      const r = this.dispatch({ ...m.action, src: m.role ? 'phone-' + m.role.replace('PLAYER_', '') : 'phone' }); this.link.send({ type: 'ack', id: m.id, to: m.from, error: r.error || null }); }
    if (m.type === 'hello') { this.peers.set(m.from, { role: m.role, at: Date.now() }); this.broadcast(true); this.emit(); }
    if (m.type === 'peers') { this.serverPeers = m.list; this.emit(); }
    if (m.type === 'ping') this.peers.set(m.from, { ...(this.peers.get(m.from) || {}), at: Date.now() });
  }
  dispatch(a) {
    if (a.type === 'UNDO') return this.undo();
    const r = apply(this.s, a, Date.now()); if (r.error) { this.errs.forEach(f => f(r.error, a)); return r; }
    if (!['SET', 'SET_MANY', 'NAMES', 'S2_TOGGLE', 'CODE_KEY'].includes(a.type)) { this.hist.push(this.s); if (this.hist.length > 80) this.hist.shift(); }
    this.s = r.state; this.changed(a.type === 'PHASE_GO' ? 'phase ' + a.phase : null); return r;
  }
  undo() { const prev = this.hist.pop(); if (!prev) return { error: 'چیزی برای برگرداندن نیست' }; const log = this.s.log; this.s = { ...prev, log: [...log, { t: log.at(-1)?.t || '', ts: Date.now(), ph: this.s.phase, text: 'UNDO (last event reverted)', src: 'host' }] }; this.changed(); return { state: this.s }; }
  changed(versionLabel) { this.dirty = true; this.broadcast(true); this.emit(); clearTimeout(this._sv); this._sv = setTimeout(() => kv.set('state', this.s), 250); if (versionLabel) saveVersion(this.s, versionLabel); }
  loop() { const n = tick(this.s, Date.now()); if (n) { this.s = n; this.changed(); } this.emit('tick'); }
  view(role = 'director') { return publicView(this.s, Date.now(), role); }
  broadcast(force) { const v = publicView(this.s, Date.now(), 'stage'); const priv = { E: this.s.shop.picks.E, M: this.s.shop.picks.M, paidE: this.s.shop.paid.E, paidM: this.s.shop.paid.M };
    const msg = { type: 'state', snap: v, priv }; this.link && this.link.send(msg); if (this.stageWin && !this.stageWin.closed) try { this.stageWin.postMessage(msg, '*'); } catch (e) {} }
  on(f) { this.subs.add(f); } onError(f) { this.errs.add(f); }
  emit(kind) { this.subs.forEach(f => f(kind)); }
  replace(state) { this.hist.push(this.s); this.s = state; this.changed('restore'); }
}
