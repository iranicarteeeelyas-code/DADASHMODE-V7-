// DADASHMODE V7 local server: static files + WebSocket relay (LAN phones). Zero dependencies. Run: node serve.mjs [port]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)); const PORT = +(process.argv[2] || process.env.PORT || 3000);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.webm': 'video/webm', '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.pdf': 'application/pdf' };
const ips = () => Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
const rooms = new Map(); // room -> { pin, clients:Set }
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/info') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify({ ips: ips(), port: PORT, rooms: [...rooms].map(([k, r]) => ({ room: k, peers: [...r.clients].map(c => c.role) })) })); }
  let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(f, (e, st) => { if (e || !st.isFile()) { res.writeHead(404); return res.end('404'); } res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' }); fs.createReadStream(f).pipe(res); });
});
function frame(str) { const d = Buffer.from(str); const n = d.length; const h = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : (() => { const b = Buffer.alloc(10); b[0] = 0x81; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b; })(); return Buffer.concat([h, d]); }
function closeFrame(code) { return Buffer.from([0x88, 2, code >> 8, code & 255]); }
srv.on('upgrade', (req, sock) => {
  const u = new URL(req.url, 'http://x'); if (u.pathname !== '/ws') return sock.destroy();
  const key = req.headers['sec-websocket-key']; const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acc}\r\n\r\n`); sock.setNoDelay(true);
  const role = u.searchParams.get('role') || 'x', room = u.searchParams.get('room') || 'DM7', pin = u.searchParams.get('pin') || '';
  let R = rooms.get(room); if (!R) { R = { pin: null, clients: new Set() }; rooms.set(room, R); }
  if (role === 'host') R.pin = pin; // host defines the PIN
  else if (R.pin && pin !== R.pin && role !== 'stage') { sock.write(closeFrame(4003)); return sock.end(); }
  const c = { sock, role, id: u.searchParams.get('id') }; R.clients.add(c);
  const peers = () => { const list = [...R.clients].map(x => ({ id: x.id, role: x.role })); for (const x of R.clients) if (x.role === 'host') x.sock.write(frame(JSON.stringify({ type: 'peers', list }))); };
  peers(); console.log(`+ ${role} @${room} (${R.clients.size})`);
  let buf = Buffer.alloc(0), frag = [];
  sock.on('data', d => { buf = Buffer.concat([buf, d]);
    while (buf.length >= 2) { const op = buf[0] & 15, fin = buf[0] & 128, masked = buf[1] & 128; let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const mk = masked ? buf.slice(off, off + 4) : null; if (masked) off += 4; if (buf.length < off + len) return;
      let pl = buf.slice(off, off + len); if (mk) { pl = Buffer.from(pl); for (let i = 0; i < pl.length; i++) pl[i] ^= mk[i & 3]; } buf = buf.slice(off + len);
      if (op === 8) { sock.end(); return; } if (op === 9) { sock.write(Buffer.concat([Buffer.from([0x8a, pl.length]), pl])); continue; }
      if (op === 1 || op === 0) { frag.push(pl); if (!fin) continue; const txt = Buffer.concat(frag).toString(); frag = []; route(txt); } }
  });
  function route(txt) { let m; try { m = JSON.parse(txt); } catch (e) { return; } const out = frame(txt);
    for (const x of R.clients) { if (x === c) continue; if (role === 'host' || x.role === 'host' || (m.type === 'pong')) try { x.sock.write(out); } catch (e) {} } }
  const bye = () => { if (R.clients.delete(c)) { console.log(`- ${role} @${room}`); peers(); } }; sock.on('close', bye); sock.on('error', bye);
});
srv.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  DADASHMODE V7 · Time Bank\n  ─────────────────────────────\n  اتاق کنترل:   http://localhost:${PORT}\n  خروجی صحنه:   http://localhost:${PORT}/stage.html`);
  for (const ip of ips()) console.log(`  گوشی‌ها:       http://${ip}:${PORT}/remote.html`); console.log('');
});
