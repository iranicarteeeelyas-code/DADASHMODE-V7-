import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { icon, rr, font } from './draw.js';
import { CFG } from '../shared/data.js';

export const gold = () => new THREE.MeshStandardMaterial({ color: 0xe0ad3c, metalness: 1, roughness: 0.2, envMapIntensity: 1.4 });
export const steel = () => new THREE.MeshStandardMaterial({ color: 0x9aa3b5, metalness: 1, roughness: 0.32 });

function canvasTex(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

export function briefcase() {
  const g = new THREE.Group(); const m = gold();
  const bottom = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.9, 0.7, 6, 0.1), m); bottom.position.y = 0.45; g.add(bottom);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.9, -0.35); g.add(lidPivot);
  const lid = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.9, 0.7, 6, 0.1), m); lid.position.set(0, 0.45, 0.35); lidPivot.add(lid);
  const seam = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.04, 0.72), new THREE.MeshStandardMaterial({ color: 0x3a2a08, metalness: 0.6, roughness: 0.5 })); seam.position.y = 0.9; g.add(seam);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 14, 40, Math.PI), m); handle.position.set(0, 1.8, 0); lidPivot.add(handle); handle.position.set(0, 0.9, 0.35);
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.6), new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  inner.rotation.x = -Math.PI / 2; inner.position.set(0, 0.88, 0); g.add(inner);
  const digitTex = canvasTex(128, 1280, (c, w, h) => { c.fillStyle = '#16120a'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffe9a8'; c.font = '700 96px "JetBrains Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; for (let i = 0; i < 10; i++) c.fillText(String(i), w / 2, i * 128 + 64); });
  const wheels = [];
  for (let i = 0; i < 3; i++) { const tex = digitTex.clone(); tex.needsUpdate = true; tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 0.1);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 32, 1, true), new THREE.MeshStandardMaterial({ map: tex, metalness: 0.3, roughness: 0.5 })); w.rotation.z = Math.PI / 2; w.position.set(-0.22 + i * 0.22, 0.9, 0.39); g.add(w); wheels.push(w); }
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.34, 0.06, 4, 0.03), new THREE.MeshStandardMaterial({ color: 0x2a2012, metalness: 0.8, roughness: 0.4 })); plate.position.set(0, 0.9, 0.36); g.add(plate);
  g.userData = { lidPivot, inner, wheels };
  return g;
}

export function vaultDoor() {
  const g = new THREE.Group(); const hinge = new THREE.Group(); hinge.position.x = -2.3; g.add(hinge);
  const door = new THREE.Group(); door.position.x = 2.3; hinge.add(door);
  const s = steel(); const dark = new THREE.MeshStandardMaterial({ color: 0x2b3140, metalness: 0.9, roughness: 0.4 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.45, 96), s); disc.rotation.x = Math.PI / 2; door.add(disc);
  [2.0, 1.55, 0.9].forEach((r, i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06 + i * 0.02, 12, 96), i === 1 ? gold() : dark); t.position.z = 0.24; door.add(t); });
  const wheel = new THREE.Group(); wheel.position.z = 0.34; door.add(wheel);
  for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), gold()); sp.rotation.z = (i / 6) * Math.PI; wheel.add(sp); const k = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), gold()); k.position.set(Math.cos(i / 6 * Math.PI * 2) * 0.75, Math.sin(i / 6 * Math.PI * 2) * 0.75, 0); wheel.add(k); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 32), gold()); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), dark); const a = (i / 16) * Math.PI * 2; b.position.set(Math.cos(a) * 1.8, Math.sin(a) * 1.8, 0.24); door.add(b); }
  const frame = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.2, 16, 96), dark); g.add(frame);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(2.2, 64), new THREE.MeshBasicMaterial({ color: 0xffcf5a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.z = -0.3; g.add(glow);
  g.userData = { hinge, wheel, glow };
  return g;
}

export function cardFront(key, theme) {
  const cc = CFG.shop.cards[key]; const col = cc.color === 'red' ? theme.E : cc.color === 'blue' ? theme.A : theme.gold;
  return canvasTex(512, 700, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, col); g.addColorStop(1, '#0b0f1c'); c.fillStyle = g; rr(c, 0, 0, w, h, 40); c.fill();
    c.strokeStyle = theme.gold; c.lineWidth = 14; rr(c, 10, 10, w - 20, h - 20, 34); c.stroke();
    icon(c, key, w / 2, 210, 220, '#ffffff');
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.direction = 'rtl'; c.font = font(theme, 'display', 76); c.fillText(cc.fa, w / 2, 430);
    c.font = font(theme, 'num', 130); c.fillStyle = theme.gold; c.direction = 'ltr'; c.fillText(String(cc.price), w / 2, 590);
  });
}
export function cardBack(theme) { return canvasTex(512, 700, (c, w, h) => { c.fillStyle = '#10141f'; rr(c, 0, 0, w, h, 40); c.fill(); c.strokeStyle = theme.gold; c.lineWidth = 14; rr(c, 10, 10, w - 20, h - 20, 34); c.stroke(); for (let i = 0; i < 12; i++) { c.strokeStyle = 'rgba(245,197,66,0.12)'; c.lineWidth = 3; c.beginPath(); c.arc(w / 2, h / 2, 30 + i * 22, 0, Math.PI * 2); c.stroke(); } icon(c, 'LOCK', w / 2, h / 2, 190, theme.gold); }); }
export function card(key, theme) {
  const edge = new THREE.MeshStandardMaterial({ color: 0xd9a53a, metalness: 1, roughness: 0.3 });
  const mats = [edge, edge, edge, edge, new THREE.MeshStandardMaterial({ map: cardFront(key, theme), roughness: 0.35, metalness: 0.1 }), new THREE.MeshStandardMaterial({ map: cardBack(theme), roughness: 0.4, metalness: 0.2 })];
  const m = new THREE.Mesh(new RoundedBoxGeometry(1.1, 1.5, 0.05, 4, 0.02), mats); m.userData.key = key; return m;
}

export function cup(colorHex = 0xf5c542) {
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(0.22, 0), new THREE.Vector2(0.3, 0.7), new THREE.Vector2(0.28, 0.7), new THREE.Vector2(0.2, 0.03), new THREE.Vector2(0, 0.03)];
  return new THREE.Mesh(new THREE.LatheGeometry(pts, 40), new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide }));
}
export function arrowSprite(up, col) { const t = canvasTex(128, 128, (c) => { c.fillStyle = col; c.beginPath(); if (up) { c.moveTo(64, 10); c.lineTo(118, 70); c.lineTo(84, 70); c.lineTo(84, 118); c.lineTo(44, 118); c.lineTo(44, 70); c.lineTo(10, 70); } else { c.moveTo(64, 118); c.lineTo(118, 58); c.lineTo(84, 58); c.lineTo(84, 10); c.lineTo(44, 10); c.lineTo(44, 58); c.lineTo(10, 58); } c.closePath(); c.fill(); }); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(0.35, 0.35, 1); return s; }
export function labelSprite(txt, col, size = 1) { const t = canvasTex(512, 256, (c, w, h) => { c.fillStyle = col; c.font = '400 170px Anton, "JetBrains Mono", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = col; c.shadowBlur = 30; c.fillText(txt, w / 2, h / 2); }); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(2 * size, 1 * size, 1); return s; }
export function dotTexture() { return canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,230,170,0.6)'); g.addColorStop(1, 'rgba(255,200,100,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }); }

export function crown() { const g = new THREE.Group(); const m = gold(); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.35, 48, 1, true), m); g.add(band); for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 12), m); const a = (i / 8) * Math.PI * 2; sp.position.set(Math.cos(a) * 0.72, 0.38, Math.sin(a) * 0.72); g.add(sp); const gem = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xe5484d : 0x2fb36c, emissive: i % 2 ? 0x550000 : 0x003311, metalness: 0.2, roughness: 0.1 })); gem.position.set(Math.cos(a) * 0.74, 0, Math.sin(a) * 0.74); g.add(gem); } return g; }
