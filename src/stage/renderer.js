// Cinematic WebGL stage: three.js scene + HUD composite + bloom + film post + chroma-safe output
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HUD } from './hud.js';
import { THEMES, ease } from './draw.js';
import { briefcase, vaultDoor, card, cup, arrowSprite, labelSprite, dotTexture, crown, gold } from './objects.js';
import { CFG } from '../shared/data.js';
import { play } from '../shared/sfx.js';

export const LOOKS = {
  cinema: { grain: 0.055, vig: 0.42, ca: 0.0016, sat: 1.06, con: 1.08, tint: [1.03, 1.0, 0.95], bloom: 0.42, drift: 0.25, cones: 0.5 },
  arena: { grain: 0.03, vig: 0.3, ca: 0.0022, sat: 1.28, con: 1.14, tint: [1.0, 1.0, 1.04], bloom: 0.6, drift: 0.4, cones: 1.4 },
  broadcast: { grain: 0.0, vig: 0.12, ca: 0.0, sat: 1.04, con: 1.02, tint: [1, 1, 1], bloom: 0.25, drift: 0.1, cones: 0.3 },
  noir: { grain: 0.09, vig: 0.62, ca: 0.001, sat: 0.12, con: 1.25, tint: [1.02, 1.0, 0.98], bloom: 0.35, drift: 0.2, cones: 0.6, keepGold: 1 },
  studio3d: { grain: 0.02, vig: 0.35, ca: 0.0012, sat: 1.1, con: 1.06, tint: [1, 1, 1.02], bloom: 0.5, drift: 0.8, cones: 0.9 },
};
export const KEYS = { green: '#00b140', blue: '#0047bb', magenta: '#ff00ff' };

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.05 }, uVig: { value: 0.4 }, uCA: { value: 0.0015 }, uGlitch: { value: 0 }, uGold: { value: 0 }, uFlash: { value: 0 }, uShock: { value: new THREE.Vector3(0.5, 0.5, 9) }, uSat: { value: 1 }, uCon: { value: 1 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uChroma: { value: 0 }, uKeepGold: { value: 0 }, uAspect: { value: 16 / 9 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uGrain,uVig,uCA,uGlitch,uGold,uFlash,uSat,uCon,uChroma,uKeepGold,uAspect; uniform vec3 uShock,uTint; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  void main(){ vec2 uv=vUv;
    // shockwave ripple
    float st=uShock.z; if(st<1.6){ vec2 d=uv-uShock.xy; d.x*=uAspect; float r=length(d); float w=st*0.9; float ring=exp(-pow((r-w)*18.0,2.0))*(1.0-st/1.6); uv-= normalize(d+1e-5)*ring*0.025*vec2(1.0/uAspect,1.0); }
    // glitch slices
    if(uGlitch>0.001){ float band=floor(uv.y*28.0+floor(uTime*24.0)); float n=h(vec2(band,floor(uTime*30.0))); if(n<uGlitch*0.6) uv.x+= (h(vec2(band,2.0))-0.5)*0.12*uGlitch; }
    float ca=uCA+uGlitch*0.012; vec2 dir=(uv-0.5);
    vec4 c=texture2D(tDiffuse,uv); float r=texture2D(tDiffuse,uv+dir*ca).r; float b=texture2D(tDiffuse,uv-dir*ca).b; c.rgb=vec3(r,c.g,b);
    if(uChroma<0.5){
      float l=dot(c.rgb,vec3(0.299,0.587,0.114)); float goldness=smoothstep(0.25,0.0,abs(atan(c.g-c.b, c.r-c.g)-0.55))*step(0.15,c.r-c.b);
      float sat=mix(uSat,1.0,uKeepGold*goldness); c.rgb=mix(vec3(l),c.rgb,sat); c.rgb=(c.rgb-0.18)*uCon+0.18; c.rgb*=uTint;
      c.rgb=mix(c.rgb, c.rgb*vec3(1.25,1.0,0.45)+vec3(0.08,0.05,0.0), uGold);
      float v=smoothstep(0.95,0.25,length((vUv-0.5)*vec2(1.0,0.82))); c.rgb*=mix(1.0,v,uVig);
      c.rgb+=(h(vUv*vec2(1920.0,1080.0)+fract(uTime)*91.0)-0.5)*uGrain;
    }
    c.rgb=mix(c.rgb,vec3(1.0,0.98,0.92),uFlash);
    gl_FragColor=vec4(max(c.rgb,0.0),1.0); }`,
};
const KeySnap = { uniforms: { tDiffuse: { value: null }, uKey: { value: new THREE.Vector3(0, 1, 0) }, uOn: { value: 0 } }, vertexShader: FinalShader.vertexShader,
  fragmentShader: 'uniform sampler2D tDiffuse; uniform vec3 uKey; uniform float uOn; varying vec2 vUv; void main(){ vec4 c=texture2D(tDiffuse,vUv); if(uOn>0.5 && distance(c.rgb,uKey)<0.16) c.rgb=uKey; gl_FragColor=c; }' };
const SubShader = { uniforms: { map: { value: null }, uTime: { value: 0 }, uMode: { value: 1 }, uAge: { value: 0 }, uAlpha: { value: 1 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D map; uniform float uTime,uMode,uAge,uAlpha; varying vec2 vUv;
  void main(){ vec2 uv=vUv; float intro=clamp(uAge/0.35,0.0,1.0);
    if(uMode>2.5 && uMode<3.5){ uv.y+=sin(uv.x*18.0+uTime*4.0)*0.004; }
    vec4 c=texture2D(map,uv);
    if(uMode>1.5 && uMode<2.5){ float g=(1.0-intro); float off=g*0.02*sin(uTime*80.0); vec4 rr=texture2D(map,uv+vec2(off,0.0)); vec4 bb=texture2D(map,uv-vec2(off,0.0)); c=vec4(rr.r,c.g,bb.b,max(c.a,max(rr.a,bb.a))); }
    if(uMode>0.5 && uMode<1.5){ float band=smoothstep(0.06,0.0,abs(uv.x-fract(uTime*0.35)*1.6+0.3)); c.rgb+=band*c.a*vec3(0.9,0.75,0.35)*0.6; }
    gl_FragColor=vec4(c.rgb,c.a*uAlpha*mix(1.0,intro,step(0.5,uMode))); }` };

const LedShader = { uniforms: { uTime: { value: 0 }, uA: { value: new THREE.Color('#15204a') }, uB: { value: new THREE.Color('#f5c542') }, uPulse: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform float uTime,uPulse; uniform vec3 uA,uB; varying vec2 vUv;
  void main(){ vec2 p=vUv*vec2(160.0,56.0); vec2 g=fract(p)-0.5; float led=smoothstep(0.5,0.18,length(g));
    float wave=0.5+0.5*sin(vUv.x*6.0-uTime*0.6+sin(vUv.y*3.0+uTime*0.3)*2.0);
    float ring=exp(-pow(length((vUv-vec2(0.5,0.55))*vec2(2.8,1.0))-0.28,2.0)*60.0);
    vec3 col=mix(uA*0.35,uA,wave)+uB*ring*(0.55+uPulse); col*=led*0.9+0.1; col*=smoothstep(0.0,0.35,vUv.y);
    gl_FragColor=vec4(col*0.55,1.0); }` };
const ConeShader = { uniforms: { uColor: { value: new THREE.Color('#ffd98a') }, uI: { value: 0.5 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 uColor; uniform float uI; varying vec2 vUv; void main(){ float a=pow(vUv.y,2.2)*smoothstep(0.0,0.5,min(vUv.x,1.0-vUv.x)*2.0); gl_FragColor=vec4(uColor*a*uI*0.35,1.0); }' };
const RaysShader = { uniforms: { uTime: { value: 0 }, uI: { value: 0 }, uColor: { value: new THREE.Color('#ffcf5a') } }, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform float uTime,uI; uniform vec3 uColor; varying vec2 vUv; void main(){ vec2 d=vUv-0.5; float a=atan(d.y,d.x); float r=length(d); float rays=pow(0.5+0.5*sin(a*18.0+uTime*0.8),6.0)+pow(0.5+0.5*sin(a*7.0-uTime*0.5),8.0)*0.6; float f=smoothstep(0.5,0.0,r); gl_FragColor=vec4(uColor*(rays*f+f*f*0.8)*uI,1.0); }' };

export class StageRenderer {
  constructor(canvas, { width = 1920, height = 1080, preview = false } = {}) {
    this.canvas = canvas; this.W = width; this.H = height; this.preview = preview;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(1); r.setSize(width, height, false); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 200); this.camera.position.set(0, 2.2, 10); this.camTarget = new THREE.Vector3(0, 1.2, 0);
    this.cam = { pos: new THREE.Vector3(0, 2.2, 10), look: new THREE.Vector3(0, 1.2, 0), from: null, at: 0 };
    const pm = new THREE.PMREMGenerator(r); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.55;
    this.hud = new HUD(); this.th = THEMES.vault; this.look = LOOKS.cinema; this.chroma = 'off';
    this.build();
    // HUD overlay
    this.hudScene = new THREE.Scene(); this.ortho = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 10); this.ortho.position.z = 5;
    this.hudTex = new THREE.CanvasTexture(this.hud.c); this.hudTex.colorSpace = THREE.SRGBColorSpace; this.hudTex.minFilter = THREE.LinearFilter; this.hudTex.generateMipmaps = false;
    const hq = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.hudTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); this.hudScene.add(hq);
    this.subTex = new THREE.CanvasTexture(this.hud.sc); this.subTex.colorSpace = THREE.SRGBColorSpace; this.subTex.minFilter = THREE.LinearFilter; this.subTex.generateMipmaps = false;
    this.subMat = new THREE.ShaderMaterial({ ...SubShader, uniforms: THREE.UniformsUtils.clone(SubShader.uniforms), transparent: true, depthTest: false, depthWrite: false }); this.subMat.uniforms.map.value = this.subTex;
    this.subQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 360 / 1080), this.subMat); this.subQuad.position.z = 1; this.hudScene.add(this.subQuad);
    // composer
    const c = this.composer = new EffectComposer(r); c.setPixelRatio(1); c.setSize(width, height);
    c.addPass(new RenderPass(this.scene, this.camera)); const hp = new RenderPass(this.hudScene, this.ortho); hp.clear = false; hp.clearDepth = true; c.addPass(hp);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width / 2, height / 2), 0.4, 0.4, 0.9); c.addPass(this.bloom);
    this.final = new ShaderPass(FinalShader); c.addPass(this.final); c.addPass(new OutputPass()); this.snap = new ShaderPass(KeySnap); c.addPass(this.snap);
    this.t0 = performance.now(); this.lastFx = 0; this.fxState = { glitch: 0, gold: 0, flash: 0, shock: 9, shake: 0 }; this.throwAnim = null;
    this.setTheme('vault');
  }
  build() {
    const S = this.scene; this.env = new THREE.Group(); S.add(this.env);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x0a0e1c, metalness: 0.75, roughness: 0.26 })); floor.rotation.x = -Math.PI / 2; this.env.add(floor); this.floor = floor;
    this.led = new THREE.Mesh(new THREE.PlaneGeometry(46, 16), new THREE.ShaderMaterial({ ...LedShader, uniforms: THREE.UniformsUtils.clone(LedShader.uniforms) })); this.led.position.set(0, 8, -12); this.env.add(this.led);
    this.cones = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(2.2, 12, 48, 1, true), new THREE.ShaderMaterial({ ...ConeShader, uniforms: THREE.UniformsUtils.clone(ConeShader.uniforms), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.position.set(-7.5 + i * 5, 9, -4); this.env.add(m); this.cones.push(m); }
    const n = 900, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = (Math.random() - 0.5) * 16; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.06, map: dotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe2a0, opacity: 0.55 })); this.env.add(this.dust);
    S.add(new THREE.HemisphereLight(0x8090ff, 0x100808, 0.35));
    this.key = new THREE.SpotLight(0xffe0a0, 90, 30, 0.5, 0.6, 1.4); this.key.position.set(0, 9, 5); this.key.target.position.set(0, 0.8, 0); S.add(this.key, this.key.target);
    this.rimE = new THREE.PointLight(0xe5484d, 30, 16, 1.6); this.rimE.position.set(-5, 3, 2); this.rimM = new THREE.PointLight(0x2fb36c, 30, 16, 1.6); this.rimM.position.set(5, 3, 2); S.add(this.rimE, this.rimM);
    this.rays = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShaderMaterial({ ...RaysShader, uniforms: THREE.UniformsUtils.clone(RaysShader.uniforms), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); this.rays.position.set(0, 1.6, -3); S.add(this.rays);
    // hero groups
    this.G = {};
    const add = (k, o) => { o.userData.vis = 0; o.userData.k = 0; o.visible = false; S.add(o); this.G[k] = o; return o; };
    this.case = add('case', briefcase()); this.case.position.set(0, 0, 0);
    this.crown = add('crown', crown()); this.crown.position.set(0, 2.6, 0);
    this.vault = add('vault', vaultDoor()); this.vault.position.set(0, 2.4, -1.5);
    const cards = add('cards', new THREE.Group()); this.cardMeshes = ['HINT', 'SHIELD', 'GLOVES', 'SPICY', 'MIRROR'].map((k, i) => { const m = card(k, this.th); m.position.set((2 - i) * 1.45, 1.6, 0); cards.add(m); return m; });
    const cups = add('cups', new THREE.Group()); this.cups = []; for (let i = 0; i < 8; i++) { const cg = new THREE.Group(); const cm = cup(); cg.add(cm); const up = arrowSprite(true, '#ffe08a'), dn = arrowSprite(false, '#8aa0c8'); up.position.y = 1.1; dn.position.y = 1.1; cg.add(up, dn); cg.position.set((3.5 - i) * 0.85, 0.6, 0); cups.add(cg); this.cups.push({ g: cg, m: cm, up, dn, flip: 0 }); }
    const pyr = add('pyramids', new THREE.Group()); ['E', 'M'].forEach((p, s) => { let k = 0; for (let row = 0; row < 4; row++) for (let j = 0; j < 4 - row; j++) { const m = cup(p === 'E' ? 0xe5484d : 0x2fb36c); m.rotation.x = Math.PI; m.position.set((s ? 2.6 : -2.6) + (j - (3 - row) / 2) * 0.62, 0.72 + row * 0.72, 0); pyr.add(m); k++; } });
    // R2 lane (bucket right, lines farther = bigger reward)
    const lane = add('lane', new THREE.Group()); const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.7, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x3e8bff, metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide })); bucket.position.set(3.6, 0.35, 0); lane.add(bucket);
    const lineCols = { L1: 0x2fb36c, L2: 0xf5c542, L3: 0xe5484d }; this.laneX = {};
    Object.entries(CFG.r2.lines).forEach(([k, v]) => { const x = 3.6 - v.m * 1.55; this.laneX[k] = x; const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 2.2), new THREE.MeshBasicMaterial({ color: lineCols[k] })); b.position.set(x, 0.02, 0); lane.add(b); const l = labelSprite('+' + v.pts, '#' + lineCols[k].toString(16).padStart(6, '0'), 0.55 + v.pts / 30); l.position.set(x, 0.9 + v.pts / 40, 0.6); lane.add(l); const d = labelSprite(v.m + 'm', '#dfe6ff', 0.4); d.position.set(x, 0.3, 1.4); lane.add(d); });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 24), new THREE.MeshStandardMaterial({ color: 0xd8ff3a, roughness: 0.6, emissive: 0x223300 })); this.ball.visible = false; lane.add(this.ball);
    // columns
    const cols = add('columns', new THREE.Group()); this.colFill = {}; ['E', 'M'].forEach((p, i) => { const x = i ? 1.6 : -1.6; const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 4.2, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0.16, metalness: 0.1, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false })); glass.position.set(x, 2.1, 0); cols.add(glass);
      const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 1, 48), new THREE.MeshStandardMaterial({ color: p === 'E' ? 0xe5484d : 0x2fb36c, emissive: p === 'E' ? 0x5a0d10 : 0x0b4a26, metalness: 0.2, roughness: 0.25 })); fill.position.set(x, 0, 0); fill.scale.y = 0.001; cols.add(fill); this.colFill[p] = fill; });
    this.capBar = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xff3b3b })); cols.add(this.capBar);
    // 3D coin burst
    this.coinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.025, 24); this.coins = new THREE.InstancedMesh(this.coinGeo, gold(), 160); this.coins.count = 0; this.coins.frustumCulled = false; S.add(this.coins); this.coinData = [];
  }
  setTheme(n) { this.th = THEMES[n] || THEMES.vault; this.hud.setTheme(n); const bg = new THREE.Color(this.th.bg); this.bgColor = bg; if (this.chroma === 'off') { this.scene.background = bg; this.scene.fog = new THREE.Fog(bg, 14, 40); }
    this.led.material.uniforms.uA.value.set(n === 'beast' ? '#1a36ff' : '#15204a'); this.led.material.uniforms.uB.value.set(this.th.gold); this.floor.material.color.set(n === 'beast' ? 0x0a1070 : 0x0a0e1c); }
  setLook(n) { this.look = LOOKS[n] || LOOKS.cinema; this.lookName = n; }
  setChroma(mode, color = 'auto') {
    this.chroma = mode; const on = mode !== 'off'; let key = mode === 'on' ? (color === 'auto' ? 'blue' : color) : mode; if (!KEYS[key]) key = 'blue'; this.keyName = key;
    const col = new THREE.Color(KEYS[key]); this.env.visible = !on; this.rays.visible = true;
    this.scene.background = on ? col : this.bgColor; this.scene.fog = on ? null : new THREE.Fog(this.bgColor, 14, 40);
    const srgb = new THREE.Color(KEYS[key]); const hex = srgb.getHexString(); this.snap.uniforms.uKey.value.set(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255); this.snap.uniforms.uOn.value = on ? 1 : 0; this.final.uniforms.uChroma.value = on ? 1 : 0;
  }
  resize(w, h) { this.W = w; this.H = h; this.renderer.setSize(w, h, false); this.composer.setSize(w, h); }
  vis(k, on) { this.G[k].userData.vis = on ? 1 : 0; }
  onFx(f, S, now) {
    this.hud.fx(f, S, now); const F = this.fxState; const where = S.settings.sfxWhere || 'control'; const snd = S.settings.sfx && (this.preview ? where !== 'stage' : where !== 'control') && !this.mute;
    const s = n => snd && play(n);
    switch (f.type) {
      case 'coins': if (f.delta > 0) { this.burst(new THREE.Vector3(0, 1.4, 0), Math.min(120, 20 + f.delta * 4)); s('cash'); } else s('bass'); break;
      case 'bankopen': F.glitch = 1; F.gold = 1; F.shock = 0; s('glitch'); setTimeout(() => snd && play('vault'), 400); break;
      case 'lock': s('lock'); break;
      case 'throw': this.throwAnim = { line: f.line, hit: f.hit, at: now }; s('whoosh'); if (f.hit) setTimeout(() => snd && play('impact'), 700); else setTimeout(() => snd && play('thud'), 700); break;
      case 'horn': s('horn'); break; case 'ding': s('ding'); break; case 'pop': s('pop'); break; case 'buzz': s('buzz'); F.shake = 0.6; break;
      case 'verdict': s('impact'); F.shock = 0; F.shake = 0.8; break;
      case 'reveal': s('riser'); setTimeout(() => snd && play('impact'), 2400); break;
      case 'shopreveal': s('whoosh'); (f.out || []).forEach((o, i) => setTimeout(() => { if (!snd) return; play(o.status === 'BLOCKED' ? 'shield' : o.status === 'BOUNCED' ? 'mirror' : o.status === 'BURNED' ? 'trombone' : 'impact'); }, 1200 + i * 700)); break;
      case 'submitted': s('heartbeat'); break;
      case 'hit': s('cash'); F.shock = 0; this.burst(new THREE.Vector3(0, 1, 0), 90); break;
      case 'miss': s('glass'); setTimeout(() => snd && play('bass'), 150); F.shake = 1; break;
      case 'armed': s('riser'); break;
      case 'runstart': s('impact'); break;
      case 'unlock': s('unlock'); break; case 'goldwave': s('unlock'); F.gold = 0.6; break;
      case 'wrong': s('buzz'); F.shake = 0.7; F.glitch = 0.3; break; case 'scratch': s('scratch'); break;
      case 'vaultopen': s('vault'); F.shock = 0; F.flash = 0.5; this.burst(new THREE.Vector3(0, 2, 0), 140); break;
      case 'vaultclosed': s('trombone'); break;
      case 'caseopen': s('win'); F.flash = 0.6; F.shock = 0; this.burst(new THREE.Vector3(0, 1.2, 0), 160); break;
      case 'crown': s('choir'); break; case 'fate': s('whoosh'); break; case 'bite': s('pop'); break;
      case 'timeup': s('buzz'); break;
      case 'sync': if (!this.preview) play('beep1k'); break;
      case 'say': break;
    }
  }
  burst(at, n) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, u = Math.random(); this.coinData.push({ p: at.clone(), v: new THREE.Vector3(Math.cos(a) * (2 + u * 5), 4 + Math.random() * 6, Math.sin(a) * (1 + u * 3)), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), w: new THREE.Vector3(Math.random() * 12, Math.random() * 12, 0), life: 2.4 + Math.random() }); } if (this.coinData.length > 160) this.coinData.splice(0, this.coinData.length - 160); }
  shot(S, now) {
    // which 3D elements & camera per screen
    const ph = S.phase, r = S.run; const V = { case: 0, crown: 0, vault: 0, cards: 0, cups: 0, pyramids: 0, lane: 0, columns: 0 }; let cam = [0, 2.2, 10.5, 0, 1.3, 0]; let rays = 0;
    if (ph === 'READY') { V.case = 1; cam = [0, 1.9, 7.2, 0, 0.9, 0]; rays = 0.35; }
    if (ph === 'R1') { V.pyramids = 1; cam = [0, 2.6, 9.5, 0, 1.4, 0]; }
    if (ph === 'R2') { V.lane = 1; cam = [0.2, 2.4, 7.6, 0.2, 0.6, 0]; }
    if (ph === 'R3_SANDWICH') { cam = [0, 2.6, 12, 0, 1.4, 0]; }
    if (ph === 'TWIST_BANKOPEN') { V.vault = 1; V.cards = 1; cam = [0, 2.1, 9.8, 0, 1.8, 0]; rays = 0.8; }
    if (ph === 'R4_GLUE') { cam = [0, 2.6, 12, 0, 1.4, 0]; }
    if (ph === 'REVEAL') { V.columns = 1; cam = [0, 2.3, 9, 0, 2.0, 0]; }
    if (ph === 'SHOP') { V.cards = 1; cam = [0, 1.9, 8.2, 0, 1.55, 0]; rays = 0.25; }
    if (ph === 'VAULT_ARMED') { V.vault = 1; cam = [0, 2.4, 9.6, 0, 2.2, 0]; }
    if ((ph === 'RUN1' || ph === 'RUN2') && r) { if (r.station === 2 && !r.result && !(r.flashDigits && r.flashDigits.length)) { V.cups = 1; cam = [0, 2.2, 8.6, 0, 0.9, 0]; } else if (r.station === 4 || (r.result && r.result.open)) { V.vault = 1; cam = [0, 2.4, 9.8, 0, 2.2, 0]; rays = r.result && r.result.open ? 1 : 0.2; } }
    if (ph === 'CASE') { V.case = 1; cam = [0, 2.3, 7.4, 0, 1.0, 0]; rays = S.kase.layer >= 1 ? 1 : 0.4; if (S.kase.layer >= 2) V.crown = 1; }
    if (ph === 'END') { V.case = 1; V.crown = 1; cam = [2.2, 2.6, 8, 0, 1.2, 0]; rays = 0.5; }
    return { V, cam, rays };
  }
  render(S, now) {
    const t = (performance.now() - this.t0) / 1000, dt = Math.min(0.05, (this._lt ? t - this._lt : 0.016)); this._lt = t; const spd = S.settings.fxSpeed || 1; const k = dt * spd;
    if (S.settings.theme !== this.th.name) this.setTheme(S.settings.theme);
    if (S.settings.look !== this.lookName) this.setLook(S.settings.look);
    const ch = S.settings.chroma === 'off' ? 'off' : S.settings.chroma; if (ch !== this._ch || S.settings.chromaColor !== this._cc) { this._ch = ch; this._cc = S.settings.chromaColor; this.setChroma(ch === 'off' ? 'off' : ch === 'on' ? 'on' : ch, S.settings.chromaColor); }
    // fx
    for (const f of S.fx) if (f.id > this.lastFx) { this.lastFx = f.id; if (now - f.at < 5000) this.onFx(f, S, now); }
    const F = this.fxState; F.glitch = Math.max(0, F.glitch - k * 1.1); F.gold = Math.max(0, F.gold - k * 0.5); F.flash = Math.max(0, F.flash - k * 1.8); F.shock += k; F.shake = Math.max(0, F.shake - k * 2);
    const { V, cam, rays } = this.shot(S, now);
    Object.entries(this.G).forEach(([key, g]) => { g.userData.vis = V[key] || 0; g.userData.k += (g.userData.vis - g.userData.k) * (1 - Math.exp(-k * 5)); const s = ease.expo(g.userData.k); g.visible = g.userData.k > 0.01; g.scale.setScalar(0.001 + s); });
    // camera (critically damped towards shot + drift + shake)
    const L = this.look; const tp = new THREE.Vector3(cam[0], cam[1], cam[2]), tl = new THREE.Vector3(cam[3], cam[4], cam[5]); const a = 1 - Math.exp(-k * 2.2);
    this.cam.pos.lerp(tp, a); this.cam.look.lerp(tl, a);
    const dr = L.drift; this.camera.position.set(this.cam.pos.x + Math.sin(t * 0.21) * dr * 0.6, this.cam.pos.y + Math.sin(t * 0.33) * dr * 0.15, this.cam.pos.z + Math.cos(t * 0.17) * dr * 0.3);
    if (F.shake > 0) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * F.shake * 0.12, (Math.random() - 0.5) * F.shake * 0.12, 0));
    this.camera.lookAt(this.cam.look);
    // env animation
    this.led.material.uniforms.uTime.value = t; this.led.material.uniforms.uPulse.value = F.gold;
    this.cones.forEach((m, i) => { m.rotation.z = Math.sin(t * 0.4 * L.cones + i * 1.7) * 0.35; m.rotation.x = 0.25 + Math.cos(t * 0.3 + i) * 0.1; m.material.uniforms.uI.value = 0.35 + 0.25 * L.cones; m.material.uniforms.uColor.value.set(i % 2 ? this.th.gold : '#bcd0ff'); });
    const dp = this.dust.geometry.attributes.position; for (let i = 0; i < dp.count; i++) { let y = dp.getY(i) + dt * 0.12; if (y > 9) y = 0; dp.setY(i, y); } dp.needsUpdate = true;
    this.rays.material.uniforms.uTime.value = t; this.rays.material.uniforms.uI.value += ((rays * 0.6 * (this.chroma !== 'off' ? 0.6 : 1)) - this.rays.material.uniforms.uI.value) * (1 - Math.exp(-k * 3));
    this.rimE.color.set(this.th.E); this.rimM.color.set(this.th.M);
    const armed = S.phase === 'VAULT_ARMED'; this.key.color.set(armed ? 0xff4040 : 0xffe0a0); this.key.intensity = armed ? 60 + 40 * Math.sin(t * 6) : 90;
    // hero animations
    const cs = this.case.userData; this.case.rotation.y = S.phase === 'READY' || S.phase === 'END' ? Math.sin(t * 0.35) * 0.5 : 0;
    const open = S.phase === 'CASE' && S.kase.layer >= 1; cs.lidPivot.rotation.x += ((open ? -1.9 : 0) - cs.lidPivot.rotation.x) * (1 - Math.exp(-k * 2.5)); cs.inner.material.opacity += ((open ? 0.9 : 0) - cs.inner.material.opacity) * (1 - Math.exp(-k * 2));
    const code = S.vault.code; cs.wheels.forEach((w, i) => { const target = code ? code[i] : (t * (1 + i * 0.3)) % 10; const off = (target / 10); w.material.map.offset.y += ((1 - off - 0.05) - w.material.map.offset.y) * (1 - Math.exp(-k * 3)); });
    this.crown.rotation.y = t * 0.8; this.crown.position.y = 2.6 + Math.sin(t * 1.5) * 0.08;
    const vd = this.vault.userData; const vOpen = (S.phase === 'TWIST_BANKOPEN') || (S.run && S.run.result && S.run.result.open);
    vd.wheel.rotation.z += ((vOpen ? -Math.PI * 3 : 0) - vd.wheel.rotation.z) * (1 - Math.exp(-k * 1.6)); const doorT = vOpen ? -1.7 : 0; vd.hinge.rotation.y += (doorT - vd.hinge.rotation.y) * (1 - Math.exp(-k * (vOpen && Math.abs(vd.wheel.rotation.z) > 7 ? 1.4 : 0.2)));
    vd.glow.material.opacity += ((vOpen ? 1 : 0) - vd.glow.material.opacity) * (1 - Math.exp(-k * 1.5));
    // cards
    const shopAge = S.phase === 'TWIST_BANKOPEN' ? (now - (S.fx.filter(f => f.type === 'bankopen').at(-1)?.at || now)) / 1000 : 9;
    this.cardMeshes.forEach((m, i) => { const base = (2 - i) * 1.45; const tw = S.phase === 'TWIST_BANKOPEN'; const appear = tw ? ease.expo(Math.max(0, Math.min(1, (shopAge - 1.1 - i * 0.12) / 0.8))) : 1;
      const zoom = tw && shopAge > 3.6 && m.userData.key === 'GLOVES' ? ease.expo(Math.min(1, (shopAge - 3.6) / 0.8)) : 0;
      m.position.set(base * appear, 1.55 + Math.sin(t * 1.3 + i) * 0.06 + zoom * 0.4, (tw ? -1.2 + appear * 1.9 : 0) + zoom * 2.2); m.rotation.y = tw ? Math.PI * (1 - appear) + Math.sin(t + i) * 0.08 : Math.sin(t * 0.8 + i) * 0.12; m.scale.setScalar(Math.max(0.001, appear) * (1 + zoom * 0.25)); });
    // cups (memory room)
    if (S.run && S.run.station === 2) { const r = S.run; const pat = S.vault.pattern; this.cups.forEach((cp, i) => { let state = 0.5; if ((r.stage === 'show' || r.stage === 'hint') && pat) state = pat[i]; else if (r.stage === 'input') state = r.s2.input[i]; else state = 0.5; const upright = state === 1, dark = state === 0;
      cp.flip += ((dark ? Math.PI : 0) - cp.flip) * (1 - Math.exp(-k * 6)); cp.m.rotation.x = cp.flip; cp.m.position.y = dark ? 0.7 : 0; cp.m.material.color.set(state === 0.5 ? 0x555b6e : upright ? 0xf5c542 : 0x3a4a6b); cp.up.visible = upright; cp.dn.visible = dark; cp.g.position.y = 0.2 + (r.stage === 'show' ? Math.sin(t * 2 + i * 0.5) * 0.04 : 0); }); }
    // columns
    if (S.phase === 'REVEAL') { const f = S.fx.filter(x => x.type === 'reveal').at(-1); const kk = f ? ease.quint(Math.min(1, (now - f.at) / 2600)) : 0; ['E', 'M'].forEach(p => { const h = Math.max(0.001, (S.banks[p] / 130) * 4 * kk); const m = this.colFill[p]; m.scale.y = h; m.position.y = h / 2; }); const lead = Math.max(S.banks.E, S.banks.M); this.capBar.position.y = Math.max(0.02, ((lead - 30) / 130) * 4 * kk); this.capBar.visible = kk > 0.6; }
    // R2 throw
    if (this.throwAnim) { const ta = this.throwAnim, u = (now - ta.at) / 1000; const x0 = this.laneX[ta.line], x1 = 3.6 + (ta.hit ? 0 : 0.45); const dur = 0.55 + (3.6 - x0) * 0.05; const p = Math.min(1, u / dur);
      if (u < dur + 0.8) { this.ball.visible = true; const hgt = 0.9 + (3.6 - x0) * 0.35; if (p < 1) this.ball.position.set(x0 + (x1 - x0) * p, 1.2 + Math.sin(p * Math.PI) * hgt - p * 0.6, 0); else if (!ta.hit) { const q = u - dur; this.ball.position.set(x1 + q * 1.5, Math.max(0.12, 0.6 + q * 2 - q * q * 9), 0.3 * q); } else { this.ball.position.set(3.6, 0.3, 0); if (!ta.burst) { ta.burst = 1; this.burst(new THREE.Vector3(3.6, 0.8, 0), 60); } } }
      else { this.ball.visible = false; this.throwAnim = null; } }
    // coins
    const dummy = new THREE.Object3D(); let n = 0; this.coinData = this.coinData.filter(c => (c.life -= dt) > 0);
    for (const c of this.coinData) { c.v.y -= 12 * dt; c.p.addScaledVector(c.v, dt); if (c.p.y < 0.03) { c.p.y = 0.03; c.v.y *= -0.35; c.v.x *= 0.7; c.v.z *= 0.7; } c.r.x += c.w.x * dt; c.r.y += c.w.y * dt; dummy.position.copy(c.p); dummy.rotation.copy(c.r); dummy.scale.setScalar(Math.min(1, c.life)); dummy.updateMatrix(); this.coins.setMatrixAt(n++, dummy.matrix); }
    this.coins.count = n; this.coins.instanceMatrix.needsUpdate = true;
    // HUD & subtitles
    this.hud.draw(S, now); this.hudTex.needsUpdate = true; this.subTex.needsUpdate = true;
    const sc = S.settings.subs; this.subQuad.position.y = 0.5 - (this.hud.subY || 0.86) ; this.subQuad.visible = this.hud.subAlpha > 0;
    this.subMat.uniforms.uTime.value = t; this.subMat.uniforms.uAge.value = this.hud.subAge || 0; this.subMat.uniforms.uMode.value = { none: 0, shine: 1, glitch: 2, wave: 3 }[sc.fx] ?? 1;
    // post
    const U = this.final.uniforms; U.uTime.value = t; U.uGrain.value = L.grain; U.uVig.value = L.vig; U.uCA.value = L.ca; U.uSat.value = L.sat; U.uCon.value = L.con; U.uTint.value.set(...L.tint); U.uKeepGold.value = L.keepGold || 0;
    U.uGlitch.value = F.glitch; U.uGold.value = F.gold * 0.5; U.uFlash.value = F.flash; U.uShock.value.set(0.5, 0.45, F.shock);
    this.bloom.strength = (this.chroma !== 'off' ? 0.25 : L.bloom) * (this.th.sticker ? 0.7 : 1);
    this.composer.render(dt);
  }
}
