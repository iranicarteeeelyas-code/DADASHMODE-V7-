// Link: WebSocket (LAN, via serve.mjs) + BroadcastChannel (same device). The host is the only source of truth.
export class Link {
  constructor({ role, room = 'DM7', pin = '', onMsg = () => {}, onStatus = () => {} }) {
    Object.assign(this, { role, room, pin, onMsg, onStatus }); this.ws = null; this.ok = false; this.id = role + '-' + Math.random().toString(36).slice(2, 7);
    try { this.bc = new BroadcastChannel('dadashmode-v7-' + room); this.bc.onmessage = e => this._in(e.data, 'bc'); } catch (e) { this.bc = null; }
    this.connect(); this.pingT = setInterval(() => this.ping(), 2000);
  }
  connect() {
    if (!/^https?:/.test(location.protocol)) { this.onStatus({ ws: false, reason: 'file' }); return; }
    try {
      const u = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=${encodeURIComponent(this.role)}&room=${encodeURIComponent(this.room)}&pin=${encodeURIComponent(this.pin)}&id=${this.id}`;
      const ws = new WebSocket(u); this.ws = ws;
      ws.onopen = () => { this.ok = true; this.onStatus({ ws: true }); this.send({ type: 'hello', role: this.role, id: this.id }); };
      ws.onmessage = e => { try { this._in(JSON.parse(e.data), 'ws'); } catch (x) {} };
      ws.onclose = ev => { this.ok = false; this.onStatus({ ws: false, code: ev.code }); if (ev.code !== 4003) setTimeout(() => this.connect(), 1500); };
      ws.onerror = () => {};
    } catch (e) { setTimeout(() => this.connect(), 3000); }
  }
  _in(m, via) { if (!m || m.from === this.id) return; if (m.type === 'pong' && m.to === this.id) { this.latency = Date.now() - m.t; this.onStatus({ ws: this.ok, latency: this.latency }); return; } if (m.type === 'ping') { if (this.role === 'host') this.send({ type: 'pong', to: m.from, t: m.t }); return; } this.onMsg(m, via); }
  send(m) { m.from = this.id; const s = JSON.stringify(m); if (this.ws && this.ws.readyState === 1) this.ws.send(s); if (this.bc) try { this.bc.postMessage(m); } catch (e) {} }
  ping() { if (this.role !== 'host') this.send({ type: 'ping', t: Date.now() }); }
}
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
