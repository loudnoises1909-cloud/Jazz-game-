
import * as THREE from './three.module.min.js';
import { RoomEnvironment } from './addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from './addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from './addons/postprocessing/EffectComposer.js';
import { RenderPass } from './addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './addons/postprocessing/OutputPass.js';

const TEST = location.hash.includes('test');
const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const E = {
  io: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  out: t => 1 - Math.pow(1 - t, 3),
  back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  lin: t => t,
};
const sleep = ms => new Promise(r => setTimeout(r, TEST ? Math.min(ms, 120) : ms));

// ───────────────────────── renderer, scene, camera ─────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const stage = new THREE.Group(); scene.add(stage);
const BG = 0x090a14;
scene.background = new THREE.Color(BG);
scene.fog = new THREE.FogExp2(0x0d0f1d, .03);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), .04).texture;

const camera = new THREE.PerspectiveCamera(35, 1, .1, 120);
const camTarget = V3(0, 1.3, .8);
const camBase = V3();
// each game frames the camera on its own set: a target, how much must fit, and how steeply to look down
const VIEW = { x: 0, y: 1.3, z: .8, w: 7.4, h: 5.3, pitch: .197, lift: .3 };
function setView(v) { Object.assign(VIEW, v); resize(); }
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .5, .5, 1.55);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h;
  const need = Math.max(VIEW.h, VIEW.w / camera.aspect), d = need / (2 * Math.tan(THREE.MathUtils.degToRad(17.5)));
  camTarget.set(VIEW.x, VIEW.y + (need - VIEW.h) * VIEW.lift, VIEW.z); // tall screens: aim higher so the empty floor drops out of view
  camBase.set(VIEW.x, camTarget.y + Math.sin(VIEW.pitch) * d, camTarget.z + Math.cos(VIEW.pitch) * d);
  camera.position.copy(camBase); camera.lookAt(camTarget); camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ───────────────────────── textures drawn in code ─────────────────────────
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTex = canvasTex(128, 128, g => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.22, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});
const sparkTex = canvasTex(128, 128, g => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 40);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#fff'; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 9 : 60; g.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr); }
  g.fill();
});
function heartPath(g, cx, cy, s) {
  g.beginPath(); g.moveTo(cx, cy + s * .5);
  g.bezierCurveTo(cx - s * .15, cy + s * .32, cx - s * .55, cy + s * .1, cx - s * .55, cy - s * .18);
  g.bezierCurveTo(cx - s * .55, cy - s * .45, cx - s * .2, cy - s * .55, cx, cy - s * .3);
  g.bezierCurveTo(cx + s * .2, cy - s * .55, cx + s * .55, cy - s * .45, cx + s * .55, cy - s * .18);
  g.bezierCurveTo(cx + s * .55, cy + s * .1, cx + s * .15, cy + s * .32, cx, cy + s * .5);
}
const heartTex = canvasTex(128, 128, g => {
  heartPath(g, 64, 66, 110); const gr = g.createLinearGradient(0, 10, 0, 120);
  gr.addColorStop(0, '#ff8a76'); gr.addColorStop(1, '#cf2f3b'); g.fillStyle = gr; g.fill();
  g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(42, 44, 12, 8, -.6, 0, 7); g.fill();
});
const woodTex = canvasTex(1024, 256, (g, w, h) => {
  g.fillStyle = '#8f5631'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) {
    const y = Math.random() * h, a = Math.random() * .16 + .03, amp = rand(2, 7), fr = rand(.004, .012), ph = rand(0, 6);
    g.strokeStyle = Math.random() < .5 ? `rgba(95,50,22,${a})` : `rgba(230,170,120,${a * .7})`;
    g.lineWidth = rand(.6, 2.4); g.beginPath();
    for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * fr + ph) * amp);
    g.stroke();
  }
});
woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(1.4, 1);
const skyTex = canvasTex(1024, 1024, (g, w) => {
  const r = g.createRadialGradient(w * .55, w * .4, 30, w / 2, w / 2, w * .7);
  r.addColorStop(0, '#1d2d63'); r.addColorStop(.6, '#0f1840'); r.addColorStop(1, '#05081b'); g.fillStyle = r; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 700; i++) { const b = Math.pow(Math.random(), 3); g.fillStyle = `rgba(255,250,235,${.25 + b * .75})`; g.beginPath(); g.arc(rand(0, w), rand(0, w), .5 + b * 1.6, 0, 7); g.fill(); }
  for (let i = 0; i < 5; i++) { const c = g.createRadialGradient(rand(0, w), rand(0, w), 0, rand(0, w), rand(0, w), 260); c.addColorStop(0, 'rgba(120,140,220,.10)'); c.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = c; g.fillRect(0, 0, w, w); }
});
const moonTex = canvasTex(512, 512, (g, w) => {
  const m = g.createRadialGradient(220, 210, 20, 256, 256, 250);
  m.addColorStop(0, '#fffdf2'); m.addColorStop(.85, '#e9dcb8'); m.addColorStop(1, '#cdbb92');
  g.fillStyle = m; g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill();
  g.save(); g.beginPath(); g.arc(256, 256, 250, 0, 7); g.clip();
  for (let i = 0; i < 26; i++) { const x = rand(40, 470), y = rand(40, 470), r = rand(8, 46); g.fillStyle = `rgba(150,130,95,${rand(.12, .3)})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,250,230,.25)'; g.lineWidth = 2; g.beginPath(); g.arc(x - 2, y - 2, r, 2.5, 5); g.stroke(); }
  [[180, 200, 90], [320, 330, 70], [300, 160, 50]].forEach(([x, y, r]) => { g.fillStyle = 'rgba(140,120,90,.22)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
  g.restore();
});

// ───────────────────────── materials ─────────────────────────
const M = {
  fur: c => new THREE.MeshPhysicalMaterial({ color: c, roughness: .62, sheen: 1, sheenRoughness: .32, sheenColor: new THREE.Color(0xf3d2dc), envMapIntensity: .45 }),
  gloss: (c, r = .25) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r, clearcoat: .7, clearcoatRoughness: .15, envMapIntensity: .7 }),
  matte: (c, r = .9) => new THREE.MeshStandardMaterial({ color: c, roughness: r, envMapIntensity: .3 }),
  metal: c => new THREE.MeshStandardMaterial({ color: c, metalness: 1, roughness: .22, envMapIntensity: .75 }),
  cloth: c => new THREE.MeshPhysicalMaterial({ color: c, roughness: .85, sheen: .8, sheenRoughness: .5, sheenColor: new THREE.Color(0xffffff), envMapIntensity: .3 }),
};
function mesh(geo, mat, cast = true, recv = false) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m; }

// ───────────────────────── lights ─────────────────────────
// a warm lantern key on the patient, cool moonlight from the cave mouth, very little ambient
scene.add(new THREE.HemisphereLight(0x8a9ad6, 0x2a1d16, .5));
const key = new THREE.DirectionalLight(0xffd6a8, 2.1);
key.position.set(-4, 8, 7); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -4, near: 1, far: 30 });
key.shadow.bias = -.0004; key.shadow.normalBias = .03;
scene.add(key);
const fill = new THREE.DirectionalLight(0x8f9ccc, .55); fill.position.set(6, 2, 6); scene.add(fill);

// ───────────────────────── cave set ─────────────────────────
function hash(a, b, c) {
  let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1274126177)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, z, p = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const w = p ? (a => ((a % p) + p) % p) : (a => a);
  const H = (a, b, c) => hash(w(a), w(b), c);
  const s = t => t * t * (3 - 2 * t), u = s(fx), v = s(fy), q = s(fz), L = (a, b, t) => a + (b - a) * t;
  return L(L(L(H(ix, iy, iz), H(ix + 1, iy, iz), u), L(H(ix, iy + 1, iz), H(ix + 1, iy + 1, iz), u), v),
           L(L(H(ix, iy, iz + 1), H(ix + 1, iy, iz + 1), u), L(H(ix, iy + 1, iz + 1), H(ix + 1, iy + 1, iz + 1), u), v), q);
}
const fbm = (x, y, z) => vnoise(x, y, z) * .55 + vnoise(x * 2.1, y * 2.1, z * 2.1) * .3 + vnoise(x * 4.3, y * 4.3, z * 4.3) * .15;

// fine stone detail: a tiling normal map made from noise, with crack-like ridges
const rockNormal = (() => {
  const S = 512, P = 8, h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0, a = .5, f = 1;
    for (let o = 0; o < 5; o++) { v += vnoise(x / S * P * f, y / S * P * f, o, P * f) * a; a *= .5; f *= 2; }
    const r = 1 - Math.abs(vnoise(x / S * P * 2, y / S * P * 2, 9, P * 2) - .5) * 2;
    h[y * S + x] = v + Math.pow(r, 10) * -.12;
  }
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S), k = 6;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const H = (xx, yy) => h[((yy + S) % S) * S + ((xx + S) % S)];
    let nx = (H(x - 1, y) - H(x + 1, y)) * k, ny = (H(x, y - 1) - H(x, y + 1)) * k, nz = 1;
    const l = Math.hypot(nx, ny, nz), i = (y * S + x) * 4;
    img.data[i] = (nx / l * .5 + .5) * 255; img.data[i + 1] = (ny / l * .5 + .5) * 255; img.data[i + 2] = (nz / l * .5 + .5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
})();
function rockMat(rx, ry, extra = {}) {
  const n = rockNormal.clone(); n.repeat.set(rx, ry); n.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .84, normalMap: n, normalScale: new THREE.Vector2(.9, .9), envMapIntensity: .12, ...extra });
}
// stone colours: cool grey, warm brown-grey, near-black in the cracks
const STONE = { deep: new THREE.Color(0x121117), base: new THREE.Color(0x37343d), warm: new THREE.Color(0x5a4f47), lite: new THREE.Color(0x857b72), cool: new THREE.Color(0x3d3a52) };
function stoneColor(n, m) {
  return STONE.deep.clone().lerp(STONE.base, clamp(n * 2.2 - .35, 0, 1)).lerp(m > .5 ? STONE.warm : STONE.cool, clamp((m - .3) * 1.6, 0, 1) * .6).lerp(STONE.lite, clamp(n * 2.4 - 1.5, 0, 1) * .55);
}

// the cave dome, with a ragged opening to the night sky
const DOME_C = V3(0, 4, -3), DOME_R = 20, HOLE_DIR = V3(4.3, -1.1, -9).normalize(), HOLE_ANG = .21;
const HOLE_POS = DOME_C.clone().addScaledVector(HOLE_DIR, 17.2);
const MOUTH = DOME_C.clone().addScaledVector(HOLE_DIR, 15.4);
{
  const geo = new THREE.SphereGeometry(DOME_R, 180, 120), pos = geo.attributes.position, col = [], v = V3(), dirs = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); const u = v.clone().normalize(); dirs.push(u);
    const n = fbm(v.x * .17 + 9, v.y * .17, v.z * .17), d2 = fbm(v.x * .7, v.y * .7 + 3, v.z * .7), m = vnoise(v.x * .08, v.y * .08 + 5, v.z * .08);
    const lip = Math.max(0, 1 - Math.abs(u.angleTo(HOLE_DIR) - HOLE_ANG) / .08); // thicker rock round the opening
    v.multiplyScalar(1 - n * .26 - d2 * .05 - lip * .05); pos.setXYZ(i, v.x, v.y, v.z);
    const c = stoneColor(n * .85 + d2 * .3, m); col.push(c.r, c.g, c.b);
  }
  const idx = geo.index.array, keep = [], cd = V3();
  for (let i = 0; i < idx.length; i += 3) {
    cd.copy(dirs[idx[i]]).add(dirs[idx[i + 1]]).add(dirs[idx[i + 2]]).normalize();
    const edge = HOLE_ANG * (1 + (vnoise(cd.x * 9, cd.y * 9, cd.z * 9) - .5) * .55);
    if (cd.angleTo(HOLE_DIR) > edge) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  geo.setIndex(keep);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const cave = mesh(geo, rockMat(30, 16, { side: THREE.BackSide }), false, false);
  cave.position.copy(DOME_C); scene.add(cave);
}
{ // uneven stone floor
  const geo = new THREE.PlaneGeometry(64, 64, 180, 180).rotateX(-Math.PI / 2), pos = geo.attributes.position, col = [], v = V3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); const n = fbm(v.x * .25 + 3, 0, v.z * .25), m = vnoise(v.x * .1, 7, v.z * .1);
    pos.setY(i, (n - .45) * .9 + fbm(v.x * 1.3, 2, v.z * 1.3) * .12);
    const c = stoneColor(n * .9, m).multiplyScalar(.85); col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const floor = mesh(geo, rockMat(26, 26), false, true); floor.position.y = -1.35; scene.add(floor);
}
// stalactites: knobbly, dark at the root, wet and paler at the tip
function spikeGeo(r, h, seed) {
  const pts = []; for (let i = 0; i <= 18; i++) { const t = i / 18; pts.push(new THREE.Vector2(r * Math.pow(1 - t, 1.35) * (1 + .12 * Math.sin(t * 11 + seed)) + .012, h * t)); }
  const geo = new THREE.LatheGeometry(pts, 28), pos = geo.attributes.position, col = [], v = V3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); const t = v.y / h, n = fbm(v.x * 2.2 + seed, v.y * 1.4, v.z * 2.2);
    const k = 1 + (n - .5) * .5 * (1 - t * .6); pos.setXYZ(i, v.x * k, v.y, v.z * k);
    const c = stoneColor(.32 + n * .35, .7).lerp(new THREE.Color(0x9a9088), Math.pow(t, 3) * .7); col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals(); return geo;
}
const drips = [];
{
  const mat = rockMat(2, 5, { roughness: .55 });
  mat.metalness = 0; Object.assign(mat, { roughness: .5 });
  const wet = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .45, clearcoat: .8, clearcoatRoughness: .25, normalMap: mat.normalMap, normalScale: new THREE.Vector2(.8, .8), envMapIntensity: .2 });
  const hang = (x, y, z, h, r, seed) => { const m = mesh(spikeGeo(r, h, seed), wet, false, false); m.rotation.x = Math.PI; m.rotation.y = rand(0, 6); m.position.set(x, y, z); scene.add(m); return m; };
  for (let i = 0; i < 26; i++) hang(rand(-13, 13), 10.6 + rand(-1, .4), rand(-10, -2.5), rand(2.2, 5.2), rand(.35, .95), i);
  for (let i = 0; i < 9; i++) {
    const sd = i % 2 ? 1 : -1, x = sd * rand(3.2, 8), y = rand(7.4, 8.2), h = rand(1.6, 3.4), z = rand(-5, -2);
    hang(x, y, z, h, rand(.3, .6), i + 40);
    if (i < 4) drips.push({ tip: V3(x, y - h, z), t: rand(0, 3) });
  }
  for (let i = 0; i < 12; i++) {
    const x = (i % 2 ? 1 : -1) * rand(5.5, 13), z = rand(-10, -1.5), m = mesh(spikeGeo(rand(.4, .85), rand(1, 2.8), i * 3), wet, false, true);
    m.position.set(x, -1.45, z); scene.add(m);
  }
}
function rock(x, y, z, r, sy = .7, sx = 1) {
  const geo = new THREE.SphereGeometry(r, 64, 40), pos = geo.attributes.position, col = [], v = V3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); const n = fbm(v.x * .8 + x, v.y * .8, v.z * .8 + z), d = fbm(v.x * 2.6, v.y * 2.6 + x, v.z * 2.6);
    v.multiplyScalar(1 + (n - .5) * .55 + (d - .5) * .1); pos.setXYZ(i, v.x, v.y, v.z);
    const c = stoneColor(.25 + n * .55 + (v.y / r) * .15, vnoise(v.x * .5 + x, v.y * .5, z)); col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = mesh(geo, rockMat(3, 2), false, true); m.scale.set(sx, sy, 1); m.position.set(x, y, z); m.rotation.y = rand(0, 6); scene.add(m); return m;
}
rock(-6.4, -1.2, -2.2, 2.4, .62); rock(6.8, -1.3, -3, 2.6, .55); rock(-9.5, -1, -6.5, 2.8, .7); rock(9.5, -1, -7.5, 3, .6, 1.3);
const crystals = [];
function crystalCluster(x, z, color, n = 6, y = -1.3) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const mat = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 2.6, roughness: .1, clearcoat: 1, transparent: true, opacity: .92, envMapIntensity: 1 });
  for (let i = 0; i < n; i++) {
    const s = rand(.35, .75), m = mesh(new THREE.OctahedronGeometry(.5, 0), mat, false, false);
    m.scale.set(s * .5, s * 2, s * .5); m.position.set(rand(-.6, .6), s * .6, rand(-.5, .5));
    m.rotation.set(rand(-.4, .4), rand(0, 3), rand(-.45, .45)); g.add(m);
  }
  const l = new THREE.PointLight(color, 7, 6, 2); l.position.set(0, 1.4, .6); g.add(l);
  scene.add(g); crystals.push({ g, mat, l, ph: rand(0, 6) });
}
crystalCluster(-5.9, -2, 0x3fc9c0, 7, .15); crystalCluster(6.3, -2.8, 0x5d8cff, 6, -.05); crystalCluster(-9.2, -6.2, 0x3fc9c0, 5, .6);

// beyond the opening: the night sky, the moon, and moonlight falling into the cave
{
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ map: skyTex, fog: false, color: new THREE.Color(.75, .78, .9) }));
  sky.position.copy(DOME_C).addScaledVector(HOLE_DIR, 29); sky.lookAt(camBase); scene.add(sky);
  const up = V3(0, 1, 0), side = V3().crossVectors(HOLE_DIR, up).normalize(), upv = V3().crossVectors(side, HOLE_DIR).normalize();
  const moon = new THREE.Mesh(new THREE.CircleGeometry(1.9, 64), new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, fog: false, color: new THREE.Color(1.75, 1.7, 1.6) }));
  moon.position.copy(DOME_C).addScaledVector(HOLE_DIR, 27).addScaledVector(upv, .5).addScaledVector(side, -.9); moon.lookAt(camBase); scene.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x8ea6ff, transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.scale.setScalar(11); halo.material.opacity = .28; halo.position.copy(moon.position).addScaledVector(HOLE_DIR, .5); scene.add(halo);
  // boulders round the rim give the opening thickness
  const rimR = 17.2 * Math.tan(HOLE_ANG);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + rand(-.15, .15), rr = rimR * rand(.98, 1.15);
    const p = DOME_C.clone().addScaledVector(HOLE_DIR, 16.4 + rand(-.4, .4)).addScaledVector(side, Math.cos(a) * rr).addScaledVector(upv, Math.sin(a) * rr);
    rock(p.x, p.y, p.z, rand(1.3, 2.4), rand(.7, 1), 1);
  }
  const moonLight = new THREE.DirectionalLight(0x9cb6ff, 2.4); moonLight.position.copy(HOLE_POS); scene.add(moonLight);
  // a soft beam of moonlight, brightest where it enters and fading towards the floor
  const floorPt = V3(1.4, -1.3, -3.6), dir = V3().subVectors(HOLE_POS, floorPt), len = dir.length();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(rimR * .78, rimR * 1.35, len, 48, 1, true), new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(0x8fa9ff) }, uO: { value: .2 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uC; uniform float uO; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(abs(dot(vN, vV)), 3.); float a = f * smoothstep(0., 1., vY) * uO; gl_FragColor = vec4(uC * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  beam.position.copy(floorPt).addScaledVector(dir, .5); beam.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize()); scene.add(beam);
  // dust drifting in the beam
  const n = 160, g2 = new THREE.BufferGeometry(), p2 = new Float32Array(n * 3), base = [];
  for (let i = 0; i < n; i++) { const t = rand(.05, .85), q = floorPt.clone().addScaledVector(dir, t), r = rimR * (1.2 - t * .5) * Math.sqrt(Math.random()), a = rand(0, 6.28); q.addScaledVector(side, Math.cos(a) * r).addScaledVector(upv, Math.sin(a) * r * .8); base.push([q.x, q.y, q.z, rand(0, 6)]); }
  g2.setAttribute('position', new THREE.BufferAttribute(p2, 3));
  scene.add(new THREE.Points(g2, new THREE.PointsMaterial({ size: .07, map: glowTex, color: 0xc4d2ff, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending })));
  window.__dust = t => { base.forEach(([x, y, z, ph], i) => { p2[i * 3] = x + Math.sin(t * .13 + ph) * .35; p2[i * 3 + 1] = y + Math.sin(t * .09 + ph * 3) * .3; p2[i * 3 + 2] = z + Math.cos(t * .11 + ph) * .3; }); g2.attributes.position.needsUpdate = true; };
}
// water drips from a few stalactites
const dripMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe0ff, roughness: .05, clearcoat: 1, transparent: true, opacity: .8, envMapIntensity: 1.5 });
drips.forEach(d => { d.m = mesh(new THREE.SphereGeometry(.045, 12, 10), dripMat, false); d.m.scale.y = 1.6; d.m.visible = false; scene.add(d.m); });

// hanging lantern
const lantern = new THREE.Group();
{
  lantern.position.set(-4.1, 5.0, -.6);
  const rope = mesh(new THREE.CylinderGeometry(.025, .025, 2.4, 6), M.matte(0x6b4a2a), false); rope.position.y = 1.2; lantern.add(rope);
  const cap = mesh(new THREE.ConeGeometry(.42, .35, 6), M.metal(0x9a6a3a)); cap.position.y = -.05; lantern.add(cap);
  const glass = mesh(new THREE.SphereGeometry(.34, 32, 20), new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffa94a, emissiveIntensity: 3.2, roughness: .3 }), false); lantern.userData.glass = glass;
  glass.scale.y = 1.15; glass.position.y = -.45; lantern.add(glass);
  const base = mesh(new THREE.CylinderGeometry(.3, .24, .14, 6), M.metal(0x9a6a3a)); base.position.y = -.86; lantern.add(base);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb35c, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(3.2); halo.position.y = -.45; lantern.add(halo);
  const l = new THREE.PointLight(0xffa24f, 24, 12, 2); l.position.y = -.5; lantern.add(l); lantern.userData.light = l;
  scene.add(lantern);
}

// giant glowing mushrooms
const shrooms = [];
function shroom(x, z, h, r, col, bend = .2) {
  const g = new THREE.Group(); g.position.set(x, -1.3, z);
  const stemC = new THREE.CatmullRomCurve3([V3(0, 0, 0), V3(bend * .5, h * .5, 0), V3(bend, h, 0)]);
  g.add(mesh(new THREE.TubeGeometry(stemC, 20, r * .2, 14), M.matte(0xe6d8bf, .7), false, false));
  const capMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.1, roughness: .5 });
  const cap = mesh(new THREE.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), capMat, false, false);
  cap.scale.y = .62; cap.position.set(bend, h - .05, 0); cap.rotation.z = -bend * .4; g.add(cap);
  const under = new THREE.Mesh(new THREE.CircleGeometry(r * .98, 40), new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(.5), emissive: col, emissiveIntensity: .25, side: THREE.DoubleSide }));
  under.rotation.x = Math.PI / 2; under.position.y = .01; cap.add(under);
  for (let i = 0; i < 7; i++) {
    const th = rand(.25, 1.2), ph = rand(0, Math.PI * 2), sp = mesh(new THREE.SphereGeometry(r * rand(.07, .12), 12, 8), M.matte(0xfff3dc, .6), false, false);
    sp.position.set(Math.sin(th) * Math.cos(ph) * r, Math.cos(th) * r, Math.sin(th) * Math.sin(ph) * r); sp.scale.y = .5; cap.add(sp);
  }
  scene.add(g); shrooms.push({ mat: capMat, ph: rand(0, 6) }); return g;
}
shroom(3.7, -2.5, 1.9, .62, 0xc8461c, .25); shroom(4.55, -3.3, 2.5, .8, 0x138a86, -.2); shroom(3.05, -3.4, 1.45, .42, 0xc8461c, -.15);
shroom(-3.0, -3.8, 1.7, .5, 0x138a86, .2);
{ const l = new THREE.PointLight(0xff8a3a, 4, 5, 2); l.position.set(4.1, 1.1, -2.8); scene.add(l); }

// a crate of potions and books behind the table
{
  const crateMat = new THREE.MeshPhysicalMaterial({ map: woodTex, color: 0xb9a28a, roughness: .7, envMapIntensity: .3 });
  const crate = new THREE.Group(); crate.position.set(-4.2, -.35, -2.7); crate.rotation.y = .28; scene.add(crate);
  crate.add(mesh(new RoundedBoxGeometry(1.6, 1.9, 1.1, 3, .07), crateMat, true, true));
  for (const y of [-.45, .35]) { const slat = mesh(new RoundedBoxGeometry(1.66, .16, 1.16, 2, .04), M.matte(0x6e4426, .8), false); slat.position.y = y; crate.add(slat); }
  const glass = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: .08, clearcoat: 1, transparent: true, opacity: .78, emissive: c, emissiveIntensity: .25, envMapIntensity: 1.1 });
  [[-.45, .1, 0x3fc8c0, .55, .16], [-.02, -.2, 0xe8a13a, .4, .2], [.42, .15, 0xd24c3a, .5, .14]].forEach(([x, z, c, h, r]) => {
    const b = new THREE.Group(); b.position.set(x, .95, z); crate.add(b);
    const body = mesh(new THREE.CylinderGeometry(r, r, h, 24), glass(c), true); body.position.y = h / 2; b.add(body);
    const sh = mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass(c), false); sh.position.y = h; b.add(sh);
    const nk = mesh(new THREE.CylinderGeometry(r * .38, r * .38, .16, 16), glass(c), false); nk.position.y = h + r * .9; b.add(nk);
    const cork = mesh(new THREE.CylinderGeometry(r * .42, r * .36, .1, 16), M.matte(0xa8774a, .8), false); cork.position.y = h + r * .9 + .12; b.add(cork);
  });
  [[0x24407a, 0], [0xd24c3a, .13]].forEach(([c, y], i) => { const bk = mesh(new RoundedBoxGeometry(.7, .12, .5, 2, .03), M.matte(c, .7), true); bk.position.set(.5 - i * .05, 1.02 + y, -.32); bk.rotation.y = .3 + i * .25; crate.add(bk); });
}

// hanging vines
const vines = [];
function vine(x, z, top, bot, seed) {
  const piv = new THREE.Group(); piv.position.set(x, top, z); scene.add(piv);
  const pts = []; for (let i = 0; i <= 10; i++) pts.push(V3(Math.sin(i * 1.1 + seed) * .22, -(top - bot) * i / 10, Math.cos(i * .9 + seed) * .12));
  const c = new THREE.CatmullRomCurve3(pts);
  piv.add(mesh(new THREE.TubeGeometry(c, 60, .035, 6), M.matte(0x22402f, .8), false));
  const leafM = M.matte(0x2f6342, .7), leafG = new THREE.SphereGeometry(.1, 10, 6);
  for (let t = .05; t < 1; t += .045) { const lf = mesh(leafG, leafM, false); lf.position.copy(c.getPointAt(t)).add(V3(rand(-.05, .05), 0, .03)); lf.scale.set(1.6, .45, .9); lf.rotation.set(rand(-.5, .5), rand(0, 3), rand(-.8, .8)); piv.add(lf); }
  vines.push({ piv, ph: seed });
}
vine(-3.4, -4.4, 10, 4.2, 1); vine(-2.6, -5.2, 10, 4.9, 2.3); vine(2.9, -4.6, 10, 4.5, 3.7); vine(3.6, -5.6, 10, 5.3, 5.1);

// sleepy dark bats hanging upside down, with floating z's
const zTex = canvasTex(128, 128, g => { g.font = '700 96px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('z', 64, 70); });
const sleepers = [];
function sleepyBat(x, y, z, col, s = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); scene.add(g);
  const sp = mesh(spikeGeo(.3, 1.6, x), rockMat(1, 3), false); sp.rotation.x = Math.PI; sp.position.y = 1.55; g.add(sp);
  const fm = M.fur(col), wm = M.fur(new THREE.Color(col).multiplyScalar(.75));
  [-1, 1].forEach(sd => { const ft = mesh(new THREE.CylinderGeometry(.03, .03, .16, 8), M.matte(0x221c2e), false); ft.position.set(sd * .07, -.06, 0); g.add(ft); });
  const body = mesh(new THREE.SphereGeometry(.42, 32, 24), fm, false); body.scale.set(1, 1.15, .9); body.position.y = -.55; g.add(body);
  [-1, 1].forEach(sd => {
    const w = mesh(new THREE.SphereGeometry(.44, 28, 20), wm, false); w.scale.set(.5, 1.12, .95); w.position.set(sd * .3, -.5, .04); w.rotation.z = sd * .22; g.add(w);
    const ear = mesh(new THREE.ConeGeometry(.12, .3, 16), fm, false); ear.position.set(sd * .2, -1.02, 0); ear.rotation.z = Math.PI + sd * .35; g.add(ear);
    const eye = mesh(new THREE.TorusGeometry(.06, .016, 6, 16, Math.PI), M.matte(0x120c18, .6), false); eye.position.set(sd * .14, -.74, .37); g.add(eye);
  });
  const tooth = mesh(new RoundedBoxGeometry(.07, .08, .04, 2, .015), M.gloss(0xffffff, .2), false); tooth.position.set(0, -.9, .36); g.add(tooth);
  sleepers.push({ g, ph: rand(0, 6) });
}
sleepyBat(-1.9, 4.3, -7, 0x40384f); sleepyBat(-1.05, 4.55, -7.6, 0x4a3e5a, .85); sleepyBat(1.6, 4.4, -7.2, 0x40384f, .95);
let zT = 0;

// exam table, cushion and a first-aid kit
{
  const table = mesh(new RoundedBoxGeometry(9.4, .7, 4.4, 5, .22), new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: .5, clearcoat: .35, clearcoatRoughness: .3, envMapIntensity: .5 }), false, true);
  table.position.set(0, -.72, 1.2); scene.add(table);
  const kit = new THREE.Group(); kit.position.set(3.45, .07, -.35); kit.rotation.y = -.45;
  kit.add(mesh(new RoundedBoxGeometry(1.25, .85, .75, 4, .13), M.gloss(0xe6ddcf, .4), true, true));
  const crossM = M.gloss(0xe0383f, .3);
  const c1 = mesh(new RoundedBoxGeometry(.46, .14, .06, 2, .03), crossM); c1.position.z = .38; kit.add(c1);
  const c2 = mesh(new RoundedBoxGeometry(.14, .46, .06, 2, .03), crossM); c2.position.z = .38; kit.add(c2);
  const handle = mesh(new THREE.TorusGeometry(.22, .045, 10, 24, Math.PI), M.metal(0xb8bcc6)); handle.position.y = .42; kit.add(handle);
  scene.add(kit);
  const jar = new THREE.Group(); jar.position.set(-3.55, -.37, -.15); scene.add(jar);
  const jg = mesh(new THREE.CylinderGeometry(.34, .34, .72, 32, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xdff1ff, roughness: .05, clearcoat: 1, transparent: true, opacity: .28, side: THREE.DoubleSide, envMapIntensity: 1.4 }), false);
  jg.position.y = .36; jar.add(jg);
  for (let i = 0; i < 9; i++) { const c = mesh(new THREE.SphereGeometry(.13, 14, 10), M.cloth(0xffffff), false); c.position.set(rand(-.16, .16), .14 + (i / 9) * .45, rand(-.16, .16)); jar.add(c); }
  const lid = mesh(new THREE.CylinderGeometry(.37, .37, .1, 32), M.matte(0x8a5a33, .6)); lid.position.y = .77; jar.add(lid);
}

// fireflies
const flies = (() => {
  const n = 16, geo = new THREE.BufferGeometry(), p = new Float32Array(n * 3), base = [];
  for (let i = 0; i < n; i++) { const sd = i % 2 ? 1 : -1; base.push([sd * rand(2.6, 6), rand(.2, 3), rand(-4.5, -1.5), rand(0, 6)]); }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: .16, map: glowTex, color: new THREE.Color(4, 3.2, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(pts);
  return t => { base.forEach(([x, y, z, ph], i) => { p[i * 3] = x + Math.sin(t * .3 + ph) * .6; p[i * 3 + 1] = y + Math.sin(t * .5 + ph * 2) * .4; p[i * 3 + 2] = z + Math.cos(t * .4 + ph) * .4; }); geo.attributes.position.needsUpdate = true; };
})();

// ───────────────────────── shapes ─────────────────────────
const SHAPES = {
  heart: s => { const h = new THREE.Shape(); h.moveTo(0, -.5 * s);
    h.bezierCurveTo(-.15 * s, -.32 * s, -.55 * s, -.1 * s, -.55 * s, .18 * s);
    h.bezierCurveTo(-.55 * s, .45 * s, -.2 * s, .55 * s, 0, .3 * s);
    h.bezierCurveTo(.2 * s, .55 * s, .55 * s, .45 * s, .55 * s, .18 * s);
    h.bezierCurveTo(.55 * s, -.1 * s, .15 * s, -.32 * s, 0, -.5 * s); return h; },
  star: s => { const h = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? .25 : .58) * s; i ? h.lineTo(Math.cos(a) * r, Math.sin(a) * r) : h.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    h.closePath(); return h; },
  circle: s => { const h = new THREE.Shape(); h.absarc(0, 0, .46 * s, 0, Math.PI * 2, false); return h; },
};
const BANDAGE_COLOR = { heart: 0xd24c3a, star: 0xe6a92c, circle: 0x3d7fc4 };

// ───────────────────────── fur, eyes, wing skin ─────────────────────────
// fur is drawn as stacked "shells" (one instanced draw): each layer keeps only the strands tall enough to reach it
const strandTex = (() => {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { const v = Math.pow(Math.random(), .5) * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; return t;
})();
const whiteTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); whiteTex.needsUpdate = true;
function furShells(geo, color, { n = 20, len = .08, den = 3, droop = .015, face = 0, root = .5, tip = 1.12 } = {}) {
  if (!geo.attributes.furUv) geo.setAttribute('furUv', geo.attributes.uv);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: .88, envMapIntensity: .3 });
  const U = { uN: { value: n }, uLen: { value: len }, uDroop: { value: droop }, uStr: { value: strandTex }, uDen: { value: den }, uFace: { value: face }, uRoot: { value: root }, uTip: { value: tip }, uDirt: { value: whiteTex } };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'uniform float uN, uLen, uDroop, uFace;\nattribute vec2 furUv;\nvarying float vLayer; varying float vMask; varying vec2 vFurUv;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float fl = float(gl_InstanceID + 1) / uN; vLayer = fl; vFurUv = furUv;
      vec3 nn = normalize(objectNormal);
      float faceAmt = smoothstep(.62, .9, dot(nn, normalize(vec3(0., .1, 1.))));
      vMask = 1. - faceAmt * uFace * .82;
      transformed += objectNormal * uLen * fl; transformed.y -= uDroop * fl * fl;`);
    sh.fragmentShader = 'uniform sampler2D uStr; uniform sampler2D uDirt; uniform float uDen, uRoot, uTip;\nvarying float vLayer; varying float vMask; varying vec2 vFurUv;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float hs = texture2D(uStr, vFurUv * vec2(uDen * 2., uDen)).r;
      if (hs < vLayer || vLayer > vMask) discard;
      diffuseColor.rgb *= mix(uRoot, uTip, vLayer) * texture2D(uDirt, vFurUv).rgb;`);
  };
  const im = new THREE.InstancedMesh(geo, mat, n);
  im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false; im.raycast = () => {};
  im.userData.U = U; im.userData.len0 = len; im.count = n;
  return im;
}
// iris laid out in polar form: top of the canvas is the centre of the eye, bottom is its rim
const irisTex = canvasTex(512, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#050303'); gr.addColorStop(.46, '#070404'); gr.addColorStop(.5, '#2a1508'); gr.addColorStop(.62, '#7a4a1c');
  gr.addColorStop(.8, '#5a3414'); gr.addColorStop(.92, '#2a170a'); gr.addColorStop(1, '#120a05');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { const x = rand(0, w), y0 = rand(.48, .6) * h, y1 = rand(.75, .95) * h; g.strokeStyle = Math.random() < .5 ? `rgba(200,140,70,${rand(.08, .3)})` : `rgba(30,15,5,${rand(.1, .35)})`; g.lineWidth = rand(.5, 1.6); g.beginPath(); g.moveTo(x, y0); g.lineTo(x + rand(-3, 3), y1); g.stroke(); }
  g.fillStyle = 'rgba(230,170,90,.18)'; g.fillRect(0, .52 * h, w, .05 * h);
});
irisTex.wrapS = THREE.RepeatWrapping;
// wing skin: soft mottling, veins branching from the finger bones, fine wrinkles (drawn in wing units, x 0..2.4, y -.7..1.1)
const wingSkinTex = canvasTex(1024, 768, (g, w, h) => {
  const X = x => x / 2.4 * w, Y = y => (1 - (y + .7) / 1.8) * h;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { const c = g.createRadialGradient(rand(0, w), rand(0, h), 0, rand(0, w), rand(0, h), rand(20, 90)); c.addColorStop(0, `rgba(150,90,110,${rand(.04, .1)})`); c.addColorStop(1, 'rgba(150,90,110,0)'); g.fillStyle = c; g.fillRect(0, 0, w, h); }
  const vein = (x0, y0, a, len, wd, depth) => {
    let x = x0, y = y0; g.strokeStyle = `rgba(110,40,70,${.18 + wd * .12})`; g.lineWidth = wd; g.beginPath(); g.moveTo(X(x), Y(y));
    for (let i = 0; i < 10; i++) { a += rand(-.25, .25); x += Math.cos(a) * len / 10; y += Math.sin(a) * len / 10; g.lineTo(X(x), Y(y)); if (depth > 0 && Math.random() < .25) { g.stroke(); vein(x, y, a + rand(-1.1, 1.1), len * .5, wd * .6, depth - 1); g.strokeStyle = `rgba(110,40,70,${.18 + wd * .12})`; g.lineWidth = wd; g.beginPath(); g.moveTo(X(x), Y(y)); } }
    g.stroke();
  };
  const bones = [[[.1, .3], [1.22, 1.06]], [[1.22, 1.06], [2.32, .56]], [[1.22, 1.06], [1.97, -.16]], [[1.22, 1.06], [1.26, -.58]]];
  bones.forEach(([[ax, ay], [bx, by]]) => { for (let t = .15; t < .95; t += .12) { const x = ax + (bx - ax) * t, y = ay + (by - ay) * t, a = Math.atan2(by - ay, bx - ax); vein(x, y, a + (Math.random() < .5 ? 1.3 : -1.3) + rand(-.3, .3), rand(.25, .5), rand(1.4, 2.6), 2); } });
  g.strokeStyle = 'rgba(90,40,60,.09)'; g.lineWidth = 1;
  for (let i = 0; i < 260; i++) { const x = rand(0, w), y = rand(0, h), a = rand(0, 6.28), l = rand(10, 40); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + .4) * l * .5, y + Math.sin(a + .4) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
});
wingSkinTex.repeat.set(1 / 2.4, 1 / 1.8); wingSkinTex.offset.set(0, .7 / 1.8);
const wingBump = wingSkinTex.clone(); wingBump.colorSpace = THREE.NoColorSpace; wingBump.needsUpdate = true;

// ───────────────────────── the bat ─────────────────────────
const BATS = [
  { name: 'hoowy', fur: 0xd3849e, hat: [0xd63b2a, 0xf0b93a, 0x2c5fbf] },
  { name: 'doowy', fur: 0xcf8aa0, hat: [0x2f8a4e, 0xe8822a, 0xf0c63e] },
  { name: 'tooby', fur: 0xca7f98, hat: [0x24407a, 0xe8822a, 0xefe6d2] },
  { name: 'boopy', fur: 0xd28ea3, hat: [0x1d8a96, 0xf0b93a, 0xd63b2a] },
  { name: 'zoomy', fur: 0xcd8199, hat: [0x2a5cb8, 0x45a352, 0xf0b93a] },
];

function makeBat(cfg, { scrape: scrapeKind = null, furN = 1, blobY = -.085, scale = 1 } = {}) {
  const B = { root: new THREE.Group(), inner: new THREE.Group(), meshes: [], furs: [], cfg };
  B.root.add(B.inner);
  const fur = M.fur(cfg.fur), furLight = M.fur(new THREE.Color(cfg.fur).lerp(new THREE.Color(0xe8c4cc), .12)), furDark = M.fur(new THREE.Color(cfg.fur).multiplyScalar(.8));
  const SX = 1, SY = 1.08, SZ = .95;
  const add = (m, parent = B.inner) => { parent.add(m); m.traverse(o => o.isMesh && B.meshes.push(o)); return m; };
  const bodyGeo = new THREE.SphereGeometry(1, 72, 54);
  const body = mesh(bodyGeo, fur); body.scale.set(SX, SY, SZ); add(body);
  const bodyFur = furShells(bodyGeo, cfg.fur, { n: Math.max(6, Math.round(22 * furN)), len: .085, den: 3.2, droop: .018, face: 1 }); bodyFur.scale.copy(body.scale); B.inner.add(bodyFur); B.furs.push(bodyFur); B.body = body;
  const Z = V3(0, 0, 1);
  const surf = (x, y, off = 0) => {
    const zz = SZ * Math.sqrt(Math.max(0, 1 - x * x / (SX * SX) - y * y / (SY * SY)));
    const n = V3(x / (SX * SX), y / (SY * SY), zz / (SZ * SZ)).normalize();
    return { p: V3(x, y, zz).addScaledVector(n, off), n };
  };
  const stick = (m, x, y, off = 0) => { const s = surf(x, y, off); m.position.copy(s.p); m.quaternion.setFromUnitVectors(Z, s.n); return add(m); };

  // belly patch


  // ears
  const earPts = [[0, 0], [.36, .04], [.37, .36], [.25, .74], [.09, 1.02], [0, 1.08]].map(([x, y]) => new THREE.Vector2(x, y));
  const earGeo = new THREE.LatheGeometry(new THREE.SplineCurve(earPts).getPoints(24), 32);
  B.ears = [-1, 1].map(sd => {
    const piv = new THREE.Group(); piv.position.set(sd * .56, .62, -.12); piv.rotation.set(-.08, sd * .2, -sd * .55);
    const outer = mesh(earGeo, fur); outer.scale.set(1, 1, .5); piv.add(outer);
    const earFur = furShells(earGeo, cfg.fur, { n: Math.max(4, Math.round(12 * furN)), len: .05, den: 1.6, droop: .004 }); earFur.scale.copy(outer.scale); piv.add(earFur); B.furs.push(earFur);
    const inner = mesh(earGeo, new THREE.MeshPhysicalMaterial({ color: 0xc98a9c, roughness: .55, sheen: .4, sheenColor: new THREE.Color(0xf0c8d4), envMapIntensity: .3 })); inner.scale.set(.66, .78, .3); inner.position.set(0, .1, .16); piv.add(inner);
    add(piv); piv.userData.rz = -sd * .55; return piv;
  });

  // eyes: glossy whites, painted-on iris and pupil caps, fixed catch lights
  const irisGeo = new THREE.SphereGeometry(.303, 64, 24, 0, Math.PI * 2, 0, .64).rotateX(Math.PI / 2);
  const irisMat = new THREE.MeshPhysicalMaterial({ map: irisTex, roughness: .2, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: .8 });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf4efe8, roughness: .08, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1 });
  const lidGeo = new THREE.SphereGeometry(.322, 40, 20, 0, Math.PI * 2, 0, 1.05);
  const lidMat = M.fur(new THREE.Color(cfg.fur).multiplyScalar(.92));
  B.eyes = [-1, 1].map(sd => {
    const grp = new THREE.Group(), s = surf(sd * .33, .3, -.13);
    grp.position.copy(s.p); grp.rotation.y = sd * .12; grp.scale.set(1, 1, .82);
    grp.add(mesh(new THREE.SphereGeometry(.3, 48, 32), white, false));
    const look = new THREE.Group(); grp.add(look);
    look.add(mesh(irisGeo, irisMat, false));
    const hl = mesh(new THREE.SphereGeometry(.04, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }), false); hl.position.set(.08, .09, .282); grp.add(hl);
    const hl2 = mesh(new THREE.SphereGeometry(.018, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), false); hl2.position.set(-.065, -.075, .29); grp.add(hl2);
    const lid = mesh(lidGeo, lidMat, false); lid.rotation.x = -.42; grp.add(lid);
    const lash = mesh(new THREE.TorusGeometry(.322 * Math.sin(1.05), .008, 6, 48), M.gloss(0x2a1820, .5), false); lash.rotation.x = Math.PI / 2; lash.position.y = .322 * Math.cos(1.05); lid.add(lash);
    add(grp); return { grp, look, lid };
  });

  // brows
  B.brows = [-1, 1].map(sd => {
    const g = new THREE.Group(); stick(g, sd * .34, .67, .01);
    const cap = mesh(new THREE.CapsuleGeometry(.05, .22, 4, 10), M.gloss(0x3e2230, .45), false); cap.rotation.z = Math.PI / 2; g.add(cap);
    g.userData.sd = sd; g.userData.cap = cap; return g;
  });

  // nose, cheeks
  const snout = new THREE.Group(); stick(snout, 0, -.02, -.03);
  const muzzle = mesh(new THREE.SphereGeometry(.15, 32, 20), M.fur(cfg.fur), false); muzzle.scale.set(1.1, .7, .4); snout.add(muzzle);
  const nose = mesh(new THREE.SphereGeometry(.075, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0x5a2a38, roughness: .3, clearcoat: .8, clearcoatRoughness: .2 }), false); nose.scale.set(1.15, .7, .7); nose.position.set(0, .035, .055); snout.add(nose);
  [-1, 1].forEach(sd => { const ns = mesh(new THREE.SphereGeometry(.022, 12, 8), M.matte(0x140608, .6), false); ns.scale.set(1.1, .7, .5); ns.position.set(sd * .03, .028, .102); ns.scale.multiplyScalar(.8); snout.add(ns); });

  // mouths: smile, open laugh, worried
  const tubeAlong = pts => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => surf(x, y, .012).p)), 24, .03, 8, false);
  const lipMat = M.gloss(0x3a1422, .4);
  B.mouth = {
    smile: add(mesh(tubeAlong([[-.27, -.13], [-.14, -.23], [0, -.26], [.14, -.23], [.27, -.13]]), lipMat, false)),
    worried: add(mesh(tubeAlong([[-.16, -.28], [-.06, -.23], [.06, -.23], [.16, -.28]]), lipMat, false)),
    open: (() => {
      const g = new THREE.Group();
      const hole = mesh(new THREE.SphereGeometry(.18, 32, 20), M.gloss(0x4a0f26, .5), false); hole.scale.set(1.25, .8, .3); g.add(hole);
      const tongue = mesh(new THREE.SphereGeometry(.1, 24, 16), M.gloss(0xff6a8a, .4), false); tongue.scale.set(1.3, .6, .5); tongue.position.set(0, -.07, .03); g.add(tongue);
      stick(g, 0, -.27, -.02); return g;
    })(),
  };
  // buck teeth
  const toothGeo = new RoundedBoxGeometry(.15, .2, .08, 3, .035);
  [-1, 1].forEach(sd => { const t = mesh(toothGeo, new THREE.MeshPhysicalMaterial({ color: 0xf3ead8, roughness: .25, clearcoat: .9, clearcoatRoughness: .1, envMapIntensity: .6 }), false); stick(t, sd * .079, -.335, .012); t.rotation.z += sd * .04; });

  // feet
  [-1, 1].forEach(sd => { const f = mesh(new THREE.SphereGeometry(.15, 24, 16), furDark); f.scale.set(1.1, .6, 1.3); f.position.set(sd * .3, -1.01, .22); add(f); });

  // wings
  const ws = new THREE.Shape();
  ws.moveTo(0, .32); ws.quadraticCurveTo(.6, 1.02, 1.22, 1.06); ws.lineTo(2.32, .56);
  ws.quadraticCurveTo(1.86, .36, 1.97, -.16); ws.quadraticCurveTo(1.46, -.1, 1.26, -.58);
  ws.quadraticCurveTo(.82, -.26, .36, -.46); ws.quadraticCurveTo(.24, -.1, 0, -.22);
  const wingGeo = new THREE.ExtrudeGeometry(ws, { depth: .018, bevelEnabled: true, bevelThickness: .014, bevelSize: .02, bevelSegments: 2, curveSegments: 32 });
  { const wp = wingGeo.attributes.position, wc = [], v = V3(), near = new THREE.Color(cfg.fur).lerp(new THREE.Color(0xffffff), .12), far = new THREE.Color(0x7d3e5c);
    for (let i = 0; i < wp.count; i++) { v.fromBufferAttribute(wp, i); const k = clamp(v.x / 2.3, 0, 1);
      wp.setZ(i, v.z - .32 * k * k + .06 * Math.sin(v.y * 2.4) * k); const c = near.clone().lerp(far, Math.pow(k, 1.4) * .75); wc.push(c.r, c.g, c.b); }
    wingGeo.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3)); wingGeo.computeVertexNormals(); }
  const wingMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, color: 0xffffff, map: wingSkinTex, bumpMap: wingBump, bumpScale: 1.2, roughness: .48, sheen: .5, sheenColor: new THREE.Color(0xe8c2d0), sheenRoughness: .35, emissive: 0x4a1428, emissiveIntensity: .35, side: THREE.DoubleSide, envMapIntensity: .45 });
  const boneMat = new THREE.MeshPhysicalMaterial({ color: 0x8a4a62, roughness: .45, sheen: .5, sheenColor: new THREE.Color(0xe0b0c0), envMapIntensity: .35 });
  const bones = [[[.1, .3], [.62, .86], [1.22, 1.06]], [[1.22, 1.06], [1.8, .8], [2.32, .56]], [[1.22, 1.06], [1.6, .45], [1.97, -.16]], [[1.22, 1.06], [1.25, .2], [1.26, -.58]]];
  B.wings = [-1, 1].map(sd => {
    const piv = new THREE.Group(); piv.position.set(sd * .78, .04, -.22); if (sd < 0) piv.scale.x = -1;
    piv.add(mesh(wingGeo, wingMat));
    const wz = (x, y) => .075 - .32 * (x / 2.3) ** 2 + .06 * Math.sin(y * 2.4) * (x / 2.3);
    bones.forEach((b, bi) => {
      const crv = new THREE.CatmullRomCurve3(b.map(([x, y]) => V3(x, y, wz(x, y))));
      piv.add(mesh(new THREE.TubeGeometry(crv, 24, bi ? .02 : .032, 8), boneMat, false));
      [.5, 1].forEach(t => { if (bi === 0 && t === 1) return; const k = mesh(new THREE.SphereGeometry(bi ? .03 : .045, 12, 8), boneMat, false); k.position.copy(crv.getPointAt(t)); k.scale.z = .7; piv.add(k); });
    });
    const claw = mesh(new THREE.ConeGeometry(.04, .14, 10), M.gloss(0x3a2a2c, .3), false); claw.position.set(1.22, 1.14, wz(1.22, 1.1) - .02); claw.rotation.z = .5; piv.add(claw);
    add(piv); return piv;
  });

  // the scrape on the bat's left wing (screen right), in the same shape as the bandage it needs
  B.scrapeKind = scrapeKind;
  if (scrapeKind) {
  B.scrape = new THREE.Group(); B.scrape.position.set(1.0, .36, .085 - .32 * (1 / 2.3) ** 2 + .06 * Math.sin(.36 * 2.4) * (1 / 2.3) + .01);
  const sOut = new THREE.Mesh(new THREE.ShapeGeometry(SHAPES[scrapeKind](.62), 24), new THREE.MeshStandardMaterial({ color: 0x8e1d34, roughness: .9 }));
  const sIn = new THREE.Mesh(new THREE.ShapeGeometry(SHAPES[scrapeKind](.5), 24), new THREE.MeshStandardMaterial({ color: 0xe0465a, emissive: 0x6a0d1d, roughness: .7 }));
  sIn.position.z = .004; B.scrape.add(sOut, sIn);
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(.2, .025), new THREE.MeshBasicMaterial({ color: 0xffb3bf })); l.position.set(rand(-.08, .08), -.08 + i * .08, .008); l.rotation.z = .5; B.scrape.add(l); }
  B.wings[1].add(B.scrape);
  } else B.scrape = new THREE.Group();

  // propeller cap
  const hat = new THREE.Group(); hat.position.set(0, .75, -.03); hat.rotation.set(-.14, 0, .06);
  for (let i = 0; i < 6; i++) hat.add(mesh(new THREE.SphereGeometry(.68, 24, 14, i * Math.PI / 3, Math.PI / 3, 0, Math.PI / 2), M.gloss(cfg.hat[i % 3], .38)));
  hat.children.forEach(c => c.scale.y = .8);
  const band = mesh(new THREE.TorusGeometry(.675, .055, 12, 64), M.gloss(cfg.hat[1], .38)); band.rotation.x = Math.PI / 2; hat.add(band);
  const visor = mesh(new THREE.CylinderGeometry(.52, .52, .05, 40, 1, false, -Math.PI / 2, Math.PI), M.gloss(cfg.hat[0], .38)); visor.scale.z = .75; visor.position.set(0, .02, .5); visor.rotation.x = .18; hat.add(visor);
  const stem = mesh(new THREE.CylinderGeometry(.03, .03, .2, 10), M.metal(0xd8dde6)); stem.position.y = .62; hat.add(stem);
  B.prop = new THREE.Group(); B.prop.position.y = .73; hat.add(B.prop);
  B.prop.add(mesh(new THREE.SphereGeometry(.065, 16, 12), M.gloss(cfg.hat[1], .3)));
  [0, 2].forEach((ci, k) => { const bl = mesh(new RoundedBoxGeometry(.36, .03, .13, 2, .014), M.gloss(cfg.hat[ci], .3)); bl.position.x = k ? .2 : -.2; bl.rotation.x = k ? .3 : -.3; B.prop.add(bl); });
  add(hat);

  // glowing heart inside the chest (heartbeat)
  B.heart = new THREE.Mesh(new THREE.ShapeGeometry(SHAPES.heart(.42), 24), new THREE.MeshBasicMaterial({ color: 0xff4a3d, transparent: true, opacity: 0, depthWrite: false }));
  B.heart.position.set(0, -.5, 1.0); B.inner.add(B.heart);
  B.heartGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff4a3d, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  B.heartGlow.position.copy(B.heart.position); B.heartGlow.scale.setScalar(2.6); B.inner.add(B.heartGlow);
  B.chest = V3(.05, -.52, 1.0);

  // soft contact shadow on the cushion
  B.blob = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: .4, depthWrite: false }));
  B.blob.rotation.x = -Math.PI / 2; B.blob.position.set(0, blobY, .25); stage.add(B.blob); B.blobY = blobY;

  // live state
  Object.assign(B, { base: V3(0, 1.62, .25), offset: V3(), flapAmp: .42, flapSpeed: 7, bobAmt: 1, squash: 0, wobble: 0, mood: 'happy',
    lookTarget: null, blinkT: 2, blinking: 0, prop: B.prop, propSpeed: 3, bank: 0, vel: V3(), last: V3(), hurt: false });
  B.setMood = m => {
    B.mood = m;
    B.mouth.smile.visible = m === 'happy' || m === 'sleep'; B.mouth.open.visible = m === 'open'; B.mouth.worried.visible = m === 'worried';
    B.brows.forEach(b => { b.userData.cap.rotation.z = Math.PI / 2 + (m === 'worried' ? -b.userData.sd * .38 : m === 'open' ? b.userData.sd * .12 : 0); b.position.y = surf(b.userData.sd * .34, m === 'open' ? .7 : .67, .01).p.y; });
  };
  B.setMood('happy');
  B.worldOf = local => B.inner.localToWorld(local.clone());
  B.scrapeWorld = () => B.scrape.getWorldPosition(V3());
  // fur controls: length (wet = short, fluffy = long) and a dirt texture painted into fur and skin
  B.setFurLen = k => B.furs.forEach(f => f.userData.U.uLen.value = f.userData.len0 * k);
  B.setDirt = tex => { B.furs.forEach(f => f.userData.U.uDirt.value = tex || whiteTex); B.body.material.map = tex || null; B.body.material.needsUpdate = true; };
  B.root.scale.setScalar(scale); B.scale = scale;
  B.dispose = () => { B.root.removeFromParent(); B.blob.removeFromParent(); const i = BAT_LIST.indexOf(B); if (i >= 0) BAT_LIST.splice(i, 1); };
  stage.add(B.root); BAT_LIST.push(B);
  return B;
}

const BAT_LIST = [];
function updateBat(B, t, dt) {
  const fs = B.flapSpeed, a = B.flapAmp;
  B.root.position.copy(B.base).add(B.offset);
  B.root.position.y += Math.sin(t * 2.3) * .085 * B.bobAmt;
  const flap = Math.sin(t * fs);
  const lift = .08 + (B.wingLift || 0);
  B.wings[1].rotation.z = flap * a + lift; B.wings[0].rotation.z = -(flap * a + lift);
  B.wings[1].rotation.y = -Math.cos(t * fs) * a * .45 - .1; B.wings[0].rotation.y = -B.wings[1].rotation.y;
  const sq = Math.sin(t * fs + 1.2) * .022 * (a / .42) + B.squash;
  B.inner.scale.set(1 - sq * .6, 1 + sq, 1 - sq * .6);
  B.inner.rotation.z = Math.sin(t * 13) * B.wobble;
  B.ears.forEach((e, i) => { e.rotation.z = e.userData.rz + Math.sin(t * fs - 1.4) * .07 * (i ? 1 : -1) + Math.sin(t * 13 - .6) * B.wobble * 1.5; });
  B.prop.rotation.y += dt * B.propSpeed;
  // bank into horizontal movement
  B.vel.subVectors(B.root.position, B.last).divideScalar(Math.max(dt, 1e-3)); B.last.copy(B.root.position);
  B.bank += (clamp(-B.vel.x * .09, -.6, .6) - B.bank) * Math.min(1, dt * 5);
  B.root.rotation.z = B.bank; B.root.rotation.x = clamp(B.vel.y * -.03, -.3, .3);
  // blink
  B.blinkT -= dt;
  if (B.blinkT <= 0) { B.blinking = .16; B.blinkT = rand(2.2, 5); }
  if (B.blinking > 0) B.blinking -= dt;
  const close = B.blinking > 0 ? 1 - Math.abs(B.blinking - .08) / .08 : (B.mood === 'sleep' ? 1 : B.mood === 'worried' ? .1 : 0);
  // eyes follow what the child is holding, otherwise the camera
  const tgt = B.lookTarget || camera.position;
  B.eyes.forEach(e => {
    e.lid.rotation.x += ((-.42 + close * 2.0) - e.lid.rotation.x) * Math.min(1, dt * 30);
    const l = e.grp.worldToLocal(tgt.clone()).normalize();
    const ry = clamp(Math.atan2(l.x, l.z), -.42, .42), rx = clamp(-Math.atan2(l.y, l.z), -.36, .36);
    e.look.rotation.y += (ry - e.look.rotation.y) * Math.min(1, dt * 12); e.look.rotation.x += (rx - e.look.rotation.x) * Math.min(1, dt * 12);
  });
  // contact shadow
  const h = B.root.position.y;
  const hh = (h - B.blobY) / B.scale - .085;
  B.blob.position.x = B.root.position.x; B.blob.position.z = B.root.position.z; B.blob.visible = B.root.visible && !B.noBlob; B.blob.material.opacity = clamp(.55 - (hh - 1.1) * .18, 0, .5); B.blob.scale.setScalar((.9 + (hh - 1.4) * .25) * B.scale);
  // scrape throbs while it hurts
  if (B.scrape.visible) B.scrape.scale.setScalar(1 + Math.max(0, Math.sin(t * 5)) * .1 * (B.hurt ? 1 : .3));
}

// ───────────────────────── tools ─────────────────────────
function makeSteth() {
  const g = new THREE.Group();
  const head = new THREE.Group(); g.add(head); head.rotation.x = Math.PI / 2;
  head.add(mesh(new THREE.CylinderGeometry(.33, .35, .14, 48), M.metal(0xe2e6ee)));
  const dia = mesh(new THREE.CylinderGeometry(.27, .27, .15, 48), M.gloss(0x2a2a36, .3)); dia.position.y = .01; head.add(dia);
  const ring = mesh(new THREE.TorusGeometry(.33, .045, 12, 48), M.metal(0xcfd4de)); ring.rotation.x = Math.PI / 2; ring.position.y = .07; head.add(ring);
  // the tube runs off to the side (+x); it lies on the table, and hangs down once it is on a chest
  const tube = new THREE.CatmullRomCurve3([V3(.42, 0, -.03), V3(.85, -.22, -.06), V3(1.3, .08, -.08), V3(1.7, -.02, -.1)]);
  g.add(mesh(new THREE.TubeGeometry(tube, 48, .06, 12), M.gloss(0x2f4f86, .32)));
  const neck = mesh(new THREE.CylinderGeometry(.055, .055, .2, 12), M.metal(0xd9dde6)); neck.position.x = .38; neck.rotation.z = Math.PI / 2; g.add(neck);
  [-1, 1].forEach(sd => {
    const arm = new THREE.CatmullRomCurve3([V3(1.7, -.02, -.1), V3(1.9, sd * .16, -.1), V3(2.15, sd * .3, -.08)]);
    g.add(mesh(new THREE.TubeGeometry(arm, 20, .032, 8), M.metal(0xd9dde6)));
    const tip = mesh(new THREE.SphereGeometry(.075, 16, 12), M.gloss(0x1e1e26, .3)); tip.position.set(2.18, sd * .32, -.08); g.add(tip);
  });
  g.scale.setScalar(.8);
  return g;
}
function makeBandage(kind) {
  const g = new THREE.Group(), col = BANDAGE_COLOR[kind];
  const opts = { depth: .05, bevelEnabled: true, bevelThickness: .04, bevelSize: .05, bevelSegments: 4, curveSegments: 32 };
  const base = mesh(new THREE.ExtrudeGeometry(SHAPES[kind](1), opts), new THREE.MeshPhysicalMaterial({ color: col, roughness: .7, sheen: .6, sheenColor: new THREE.Color(0xffffff), envMapIntensity: .4 }));
  base.position.z = -.045; g.add(base);
  const pad = mesh(new THREE.ExtrudeGeometry(SHAPES[kind](.52), { ...opts, depth: .03, bevelThickness: .03, bevelSize: .03 }), M.cloth(0xf4e8cf), false);
  pad.position.z = .04; g.add(pad);
  const dotM = new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(.72), roughness: .8 });
  SHAPES[kind](.8).getSpacedPoints(kind === 'circle' ? 12 : 14).slice(0, -1).forEach(p => {
    const d = mesh(new THREE.SphereGeometry(.028, 8, 6), dotM, false); d.position.set(p.x, p.y, .05); d.scale.z = .4; g.add(d);
  });
  return g;
}
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
function makeTool(kind, obj, home) {
  const holder = new THREE.Group(); holder.add(obj); holder.position.copy(home); holder.scale.setScalar(.001); stage.add(holder);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(kind === 'steth' ? 1 : .8, 12, 8), hitMat); holder.add(hit);
  if (kind === 'steth') hit.position.x = .55;
  const T = { kind, holder, obj, hit, home: home.clone(), restTilt: kind === 'steth' ? -.95 : -.42, active: false, gone: false, wiggle: 0 };
  hit.userData.tool = T; obj.rotation.x = T.restTilt;
  return T;
}
const TABLE_Y = .12, TOOL_Z = 2.35;

// ───────────────────────── particles ─────────────────────────
const parts = [];
function burst(pos, { n = 26, tex = sparkTex, color = 0xfff1a6, speed = 3.2, life = 1.1, size = .42, up = 1.2, grav = -2.4, additive = true } = {}) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const s = new THREE.Sprite(m); s.position.copy(pos); s.scale.setScalar(size); scene.add(s);
    const v = V3(rand(-1, 1), rand(-.4, 1), rand(-.6, .8)).normalize().multiplyScalar(speed * rand(.4, 1)); v.y += up;
    parts.push({ s, v, life: life * rand(.7, 1.2), t: 0, size: size * rand(.6, 1.2), grav, spin: rand(-3, 3) });
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt; const e = p.t / p.life;
    p.s.position.addScaledVector(p.v, dt); p.v.y += p.grav * dt; p.v.multiplyScalar(Math.pow(.35, dt));
    p.s.material.opacity = e < .15 ? e / .15 : 1 - (e - .15) / .85; p.s.material.rotation += p.spin * dt;
    p.s.scale.setScalar(p.size * (1 - e * .4));
    if (e >= 1) { scene.remove(p.s); p.s.material.dispose(); parts.splice(i, 1); }
  }
}

// ───────────────────────── tweens ─────────────────────────
let clockT = 0;
const tweens = [];
function tween(dur, fn, ease = E.io) { return new Promise(res => tweens.push({ t0: clockT, dur: TEST ? Math.min(dur, .15) : dur, fn, ease, res })); }
function updateTweens() {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i], e = clamp((clockT - w.t0) / w.dur, 0, 1); w.fn(w.ease(e), e);
    if (e >= 1) { tweens.splice(i, 1); w.res(); }
  }
}
const bez = (a, b, c, t) => V3().addScaledVector(a, (1 - t) * (1 - t)).addScaledVector(b, 2 * (1 - t) * t).addScaledVector(c, t * t);

// ───────────────────────── sound ─────────────────────────
let AC = null, master, musicGain, voiceGain, lowpass;
function audioOn() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain(); master.gain.value = .9; master.connect(AC.destination);
  musicGain = AC.createGain(); musicGain.gain.value = 0; musicGain.connect(master);
  voiceGain = AC.createGain(); voiceGain.gain.value = 1.05; voiceGain.connect(master);
  lowpass = AC.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 160; lowpass.connect(master);
  startMusic();
}
function tone({ f = 440, f2 = 0, type = 'sine', at = 0, d = .2, v = .2, a = .006, dest = master }) {
  if (!AC) return;
  const s = (at || AC.currentTime), o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, s); if (f2) o.frequency.exponentialRampToValueAtTime(f2, s + d);
  g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(v, s + a); g.gain.exponentialRampToValueAtTime(.0001, s + d);
  o.connect(g).connect(dest); o.start(s); o.stop(s + d + .05);
}
function noise({ at = 0, d = .4, v = .2, f1 = 400, f2 = 2400 }) {
  if (!AC) return;
  const s = at || AC.currentTime, len = Math.floor(AC.sampleRate * d), buf = AC.createBuffer(1, len, AC.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = AC.createBufferSource(), bp = AC.createBiquadFilter(), g = AC.createGain();
  src.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(f1, s); bp.frequency.exponentialRampToValueAtTime(f2, s + d);
  g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(v, s + d * .4); g.gain.linearRampToValueAtTime(0, s + d);
  src.connect(bp).connect(g).connect(master); src.start(s);
}
const now = () => AC ? AC.currentTime : 0;
const SFX = {
  squeak: () => { tone({ f: 1650, f2: 2500, d: .11, v: .07 }); tone({ f: 2500, f2: 1800, at: now() + .1, d: .1, v: .055 }); },
  pick: () => tone({ f: 520, f2: 880, d: .12, v: .12, type: 'triangle' }),
  pop: () => { tone({ f: 380, f2: 1100, d: .1, v: .16, type: 'triangle' }); },
  chime: () => [1318.5, 1568, 2093, 2637].forEach((f, i) => { tone({ f, at: now() + i * .075, d: .7, v: .06 }); tone({ f: f * 2, at: now() + i * .075, d: .25, v: .015 }); }),
  boing: () => tone({ f: 330, f2: 130, d: .38, v: .14, type: 'triangle' }),
  whoosh: () => noise({ d: .55, v: .16, f1: 300, f2: 2600 }),
  beat: () => { tone({ f: 78, f2: 44, d: .17, v: .9, dest: lowpass }); tone({ f: 70, f2: 42, at: now() + .2, d: .22, v: .7, dest: lowpass }); },
  giggle: () => [0, .08, .16, .24, .32].forEach((t, i) => tone({ f: 1400 + i * 140, f2: 2300 + i * 120, at: now() + t, d: .07, v: .055 })),
  sparkle: () => [2093, 2637, 3136, 2637, 3520].forEach((f, i) => tone({ f, at: now() + i * .05, d: .3, v: .035 })),
};
// soft marimba loop (C major pentatonic), quiet under the voice
let musicOn = false;
function startMusic() {
  if (musicOn || !AC) return; musicOn = true;
  musicGain.gain.setTargetAtTime(musicBase, AC.currentTime, 1.5);
  const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5], bass = [130.81, 174.61, 196, 130.81];
  const mel = [0, 2, 4, 2, 3, 2, 1, -1, 0, 2, 4, 5, 4, 2, 1, -1], step = 60 / 92 / 2;
  let nextT = AC.currentTime + .1, i = 0;
  const mallet = (f, at, v) => { tone({ f, at, d: .55, v, dest: musicGain }); tone({ f: f * 3.98, at, d: .07, v: v * .22, dest: musicGain }); };
  setInterval(() => {
    while (nextT < AC.currentTime + .4) {
      const m = mel[i % 16]; if (m >= 0) mallet(notes[m], nextT, .045);
      if (i % 4 === 0) tone({ f: bass[(i / 4 | 0) % 4], at: nextT, d: .9, v: .06, dest: musicGain });
      nextT += step; i++;
    }
  }, 100);
}
let musicBase = .55;
function duck(on) { if (musicGain) musicGain.gain.setTargetAtTime(on ? Math.min(.18, musicBase) : musicBase, AC.currentTime, .15); }
// a game can turn the background loop down or off (the band makes its own music)
function musicLevel(v) { musicBase = v; if (musicGain) musicGain.gain.setTargetAtTime(v, AC.currentTime, .3); }
const getAudio = () => ({ AC, master });

// voice lines, shared with the 2D game
const LINE = {
  n_hoowy: 'Oh, look! Here comes Hoowy!', n_doowy: 'Oh, look! Here comes Doowy!', n_tooby: 'Oh, look! Here comes Tooby!',
  n_boopy: 'Oh, look! Here comes Boopy!', n_zoomy: 'Oh, look! Here comes Zoomy!',
  listen: "First... let's listen to the heart.", heartOk: 'Ba-dum, ba-dum! What a strong heart!',
  p_scrape: 'Oh no, a scrape! Can you find the bandage that matches?', wrong: "Hmm... not that one. Let's try another!",
  match: 'You did it! Great job!', tap: 'Now tap the bat, to help it feel better.', healed: 'Yay! All better!', home: 'Back home, with the family!',
};
const VB = /\/v2\/?/.test(location.pathname) ? '../voice/' : 'voice/';
let VMAP = null; const vbuf = {};
fetch(VB + 'voices.json').then(r => r.ok ? r.json() : null).then(j => VMAP = j).catch(() => {});
function loadVoice(k) {
  if (!AC || !VMAP || !VMAP[k]) return Promise.resolve(null);
  return vbuf[k] ||= fetch(VB + VMAP[k]).then(r => r.arrayBuffer()).then(b => AC.decodeAudioData(b)).catch(() => null);
}
let speaking = 0;
const isSpeaking = () => speaking > 0;
async function say(k) {
  if (TEST) { await sleep(60); return; }
  speaking++; duck(true);
  const buf = await loadVoice(k);
  await new Promise(res => {
    if (buf) { const s = AC.createBufferSource(); s.buffer = buf; s.connect(voiceGain); s.onended = res; s.start(); return; }
    if ('speechSynthesis' in window && LINE[k]) {
      const u = new SpeechSynthesisUtterance(LINE[k]); u.rate = .92; u.pitch = 1.15; u.onend = res; u.onerror = res;
      speechSynthesis.cancel(); speechSynthesis.speak(u); setTimeout(res, 7000); return;
    }
    setTimeout(res, 1500);
  });
  if (--speaking === 0) duck(false);
}

// ───────────────────────── frame hooks and input ─────────────────────────
const hooks = [];
function onFrame(fn) { hooks.push(fn); }
// the running game sets these; the engine routes pointer events to them after aiming the ray
const input = { down: null, move: null, up: null };
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function setNDC(e) { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); }
function pick(objs, recursive = false) { return ray.intersectObjects(objs, recursive)[0] || null; }
// a plane facing the camera through a point: drag objects across it
function dragPlane(point) {
  const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(V3()).negate(), point);
  return () => { const p = V3(); return ray.ray.intersectPlane(pl, p) ? p : null; };
}
// a horizontal plane at a height: for things moved around on the table
function floorPlane(y) { const pl = new THREE.Plane(V3(0, 1, 0), -y); return () => { const p = V3(); return ray.ray.intersectPlane(pl, p) ? p : null; }; }
const sp = w => { const v = w.clone().project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; };
const cv = renderer.domElement;
cv.addEventListener('pointerdown', e => { audioOn(); setNDC(e); if (input.down) input.down(e); });
cv.addEventListener('pointermove', e => { setNDC(e); if (input.move) input.move(e); });
const upH = e => { setNDC(e); if (input.up) input.up(e); };
cv.addEventListener('pointerup', upH); cv.addEventListener('pointercancel', upH);

// ───────────────────────── shared overlays ─────────────────────────
function showAgain(fn) {
  const a = $('#again'); a.classList.remove('hide');
  $('#againBtn').onclick = () => { audioOn(); a.classList.add('hide'); fn(); };
}
// progress pips along the top: filled for each finished round
function progress(n, done) {
  const p = $('#prog'); p.style.display = n ? 'flex' : 'none';
  p.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('');
}
function confetti(pos, n = 40) {
  const cols = [0xd63b2a, 0xf0b93a, 0x2c5fbf, 0x2f8a4e, 0xe8822a];
  for (let i = 0; i < 5; i++) burst(pos, { n: n / 5 | 0, tex: sparkTex, color: cols[i], size: .35, speed: 4.5, up: 3, grav: -4, life: 1.8 });
}

// ───────────────────────── main loop ─────────────────────────
const clock = new THREE.Clock();
let lowQ = false, qT = 0, qN = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .05); clockT += dt; const t = clockT;
  updateTweens();
  hooks.forEach(f => f(t, dt));
  BAT_LIST.forEach(b => updateBat(b, t, dt));
  lantern.rotation.z = Math.sin(t * .9) * .05; lantern.rotation.x = Math.sin(t * .7) * .03;
  { const fl = .9 + vnoise(t * 7, 0, 0) * .16 + Math.sin(t * 23) * .02; lantern.userData.light.intensity = 24 * fl; lantern.userData.glass.material.emissiveIntensity = 3.2 * fl; }
  window.__dust(t);
  drips.forEach(d => { d.t -= dt; if (d.t <= 0) { d.m.visible = true; d.m.position.copy(d.tip); d.v = 0; d.t = rand(2.5, 5); } if (d.m.visible) { d.v += 9.8 * dt; d.m.position.y -= d.v * dt; if (d.m.position.y < -1.2) d.m.visible = false; } });
  crystals.forEach(c => { c.mat.emissiveIntensity = 2.4 + Math.sin(t * 1.3 + c.ph) * .5; c.l.intensity = 6 + Math.sin(t * 1.3 + c.ph) * 2; });
  shrooms.forEach(m => m.mat.emissiveIntensity = 1 + Math.sin(t * 1.1 + m.ph) * .18);
  vines.forEach(v => { v.piv.rotation.z = Math.sin(t * .6 + v.ph) * .03; v.piv.rotation.x = Math.sin(t * .45 + v.ph) * .02; });
  sleepers.forEach(b => b.g.rotation.z = Math.sin(t * .8 + b.ph) * .07);
  if ((zT -= dt) <= 0) { zT = rand(1.6, 2.8); const b = sleepers[Math.random() * sleepers.length | 0]; burst(b.g.position.clone().add(V3(.25, -.7, .3)), { n: 1, tex: zTex, color: 0xd7cfff, size: .38, speed: .15, up: .55, grav: 0, life: 2.4, additive: false }); }
  flies(t); updateParts(dt);
  camera.position.set(camBase.x + Math.sin(t * .23) * .12, camBase.y + Math.sin(t * .31) * .06, camBase.z); camera.lookAt(camTarget);
  composer.render();
  // if this device struggles, drop the glow and render at a lower resolution
  if (!TEST && !lowQ) { qT += dt; qN++; if (qN === 150) { if (qT / qN > 1 / 38) { lowQ = true; bloom.enabled = false; renderer.setPixelRatio(1); composer.setPixelRatio(1); resize(); } } }
});

export {
  THREE, TEST, $, rand, clamp, V3, E, sleep, renderer, scene, stage, camera, setView, canvasTex, glowTex, sparkTex, heartTex, woodTex, zTex,
  M, mesh, RoundedBoxGeometry, SHAPES, BANDAGE_COLOR, BATS, makeBat, makeSteth, makeBandage, makeTool, TABLE_Y, TOOL_Z,
  burst, confetti, tween, bez, SFX, tone, noise, now, say, audioOn, duck, MOUTH, HOLE_POS, onFrame, input, ray, setNDC, sp, pick,
  dragPlane, floorPlane, furShells, isSpeaking, musicLevel, getAudio, rock, fbm, vnoise, showAgain, progress, BAT_LIST,
};
