// Bat Bath: a messy bat in a clawfoot tub. Scrub with the sponge, rinse with the shower, dry with the towel,
// fluff with the hair dryer. The dirt is painted into the bat's fur, so the sponge cleans exactly where it rubs.
import {
  THREE, TEST, rand, clamp, V3, E, sleep, stage, setView, glowTex, sparkTex, M, mesh, RoundedBoxGeometry, BATS, makeBat,
  TABLE_Y, TOOL_Z, TOOL_S, toolRow, burst, confetti, tween, bez, SFX, tone, noise, say, MOUTH, onFrame, input, pick, dragPlane, sp, progress, showAgain, BAT_LIST,
} from '../engine.js';

const ROUNDS = 3, MESS = ['mud', 'berry', 'paint'];
const TOOLS = { scrub: 'sponge', rinse: 'shower', dry: 'towel', fluff: 'dryer' };
const LINES = { scrub: 'w_scrub', rinse: 'w_rinse', dry: 'w_dry', fluff: 'w_fluff' };
const SEAT = V3(0, 1.08, .05);
let bat = null, phase = 'idle', round = 0, tool = null, duck = null, drag = null, dirt = null;
let bubbles = [], drops = [], wet = 1, fluff = 0, lastSnd = 0, hintT = null, dirtyAt = 0;
const G = { get phase() { return phase; }, get round() { return round; } };

// ───────────────────────── set: tub, foam, duck ─────────────────────────
const enamel = new THREE.MeshPhysicalMaterial({ color: 0xf4f1ea, roughness: .18, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: .8 });
const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: .28, envMapIntensity: 1 });
const chrome = M.metal(0xdfe3ea);
const bubbleMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .05, clearcoat: 1, transparent: true, opacity: .5, iridescence: 1, iridescenceIOR: 1.3, envMapIntensity: 1.4 });
const foam = [];
function buildTub() {
  const g = new THREE.Group(); g.position.set(0, -.2, .05); stage.add(g);
  // a lathe profile (outer wall, rolled rim, inner wall) squashed into an oval
  const prof = [[0, 0], [.7, .02], [.92, .14], [1, .5], [1.02, .88], [1.08, .93], [1.07, 1.0], [.99, 1.0], [.95, .9], [.9, .46], [.7, .14], [0, .12]].map(([x, y]) => new THREE.Vector2(x, y));
  const tub = mesh(new THREE.LatheGeometry(prof, 96), enamel, true, true); tub.scale.set(1.85, .95, .98); g.add(tub);
  // claw feet
  [[-1.3, -.55], [1.3, -.55], [-1.3, .55], [1.3, .55]].forEach(([x, z]) => {
    const f = new THREE.Group(); f.position.set(x, -.02, z); g.add(f);
    const ball = mesh(new THREE.SphereGeometry(.13, 20, 14), gold); ball.position.y = -.02; f.add(ball);
    const leg = mesh(new THREE.ConeGeometry(.12, .28, 16), gold); leg.position.y = .12; leg.rotation.x = Math.PI; f.add(leg);
  });
  // water and foam
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshPhysicalMaterial({ color: 0x9fd0e8, roughness: .05, transparent: true, opacity: .75, clearcoat: 1, envMapIntensity: 1.2 }));
  water.rotation.x = -Math.PI / 2; water.scale.set(1.72, .9, 1); water.position.y = .78; g.add(water);
  const foamMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .35, sheen: 1, sheenColor: new THREE.Color(0xdff2ff), envMapIntensity: .6 });
  const fg = new THREE.SphereGeometry(1, 16, 12);
  for (let i = 0; i < 70; i++) {
    const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * .95, s = rand(.12, .3);
    const m = mesh(fg, foamMat, false); m.scale.set(s, s * .7, s); m.position.set(Math.cos(a) * r * 1.7, .8 + rand(0, .08), Math.sin(a) * r * .85); g.add(m);
    foam.push({ m, y: m.position.y, ph: rand(0, 6) });
  }
  // faucet at the back left
  const pipe = new THREE.CatmullRomCurve3([V3(-1.75, .4, -.55), V3(-1.75, 1.25, -.55), V3(-1.62, 1.42, -.45), V3(-1.42, 1.32, -.35)]);
  g.add(mesh(new THREE.TubeGeometry(pipe, 30, .06, 12), chrome));
  [-1, 1].forEach(sd => { const k = mesh(new THREE.CylinderGeometry(.09, .09, .06, 6), chrome); k.position.set(-1.75 + sd * .2, 1.0, -.55); g.add(k); const h = mesh(new THREE.SphereGeometry(.05, 12, 8), new THREE.MeshPhysicalMaterial({ color: sd < 0 ? 0xd63b2a : 0x2c5fbf, roughness: .2, clearcoat: 1 })); h.position.set(-1.75 + sd * .2, 1.06, -.55); g.add(h); });
  // bath mat
  const mat = mesh(new RoundedBoxGeometry(4.6, .04, 2.6, 2, .02), M.cloth(0x2f6e8a), false, true); mat.position.set(0, -.35, .1); stage.add(mat);
  // a rubber duck floating in the tub
  duck = makeDuck(); duck.position.set(1.15, .86, .35); duck.scale.setScalar(.55); duck.rotation.y = -.6; g.add(duck);
  return g;
}
function makeDuck() {
  const d = new THREE.Group(), yel = new THREE.MeshPhysicalMaterial({ color: 0xf2c230, roughness: .3, clearcoat: .8, clearcoatRoughness: .2 });
  const body = mesh(new THREE.SphereGeometry(.5, 32, 24), yel); body.scale.set(1.25, .85, 1); d.add(body);
  const tail = mesh(new THREE.ConeGeometry(.2, .35, 16), yel); tail.position.set(-.6, .2, 0); tail.rotation.z = .9; d.add(tail);
  const head = mesh(new THREE.SphereGeometry(.32, 32, 24), yel); head.position.set(.35, .55, 0); d.add(head);
  const beak = mesh(new THREE.SphereGeometry(.14, 20, 12), new THREE.MeshPhysicalMaterial({ color: 0xe8732a, roughness: .35, clearcoat: .6 })); beak.scale.set(1.5, .6, 1); beak.position.set(.66, .5, 0); d.add(beak);
  [-1, 1].forEach(sd => { const e = mesh(new THREE.SphereGeometry(.05, 12, 8), M.gloss(0x111111, .1), false); e.position.set(.52, .64, sd * .17); d.add(e); });
  return d;
}

// ───────────────────────── tools ─────────────────────────
function makeToolObj(k) {
  const g = new THREE.Group();
  if (k === 'sponge') {
    g.add(mesh(new RoundedBoxGeometry(.95, .55, .38, 4, .12), new THREE.MeshPhysicalMaterial({ color: 0xe8bf3a, roughness: .85, sheen: .6, sheenColor: new THREE.Color(0xfff0b0) })));
    const hole = M.matte(0xb8901e, .9);
    for (let i = 0; i < 14; i++) { const h = mesh(new THREE.SphereGeometry(rand(.03, .06), 10, 8), hole, false); h.position.set(rand(-.4, .4), rand(-.22, .22), .19); h.scale.z = .3; g.add(h); }
    const top = mesh(new RoundedBoxGeometry(.95, .14, .38, 3, .05), M.cloth(0x2f8a4e)); top.position.y = .3; g.add(top);
  } else if (k === 'shower') {
    const head = mesh(new THREE.CylinderGeometry(.34, .26, .16, 40), chrome); g.add(head);
    const face = mesh(new THREE.CircleGeometry(.3, 40), M.matte(0x9aa3ad, .5), false); face.rotation.x = Math.PI / 2; face.position.y = -.081; g.add(face);
    for (let i = 0; i < 19; i++) { const a = i * 2.4, r = Math.sqrt(i / 19) * .24, h = mesh(new THREE.CircleGeometry(.022, 8), M.matte(0x2a2f36, .6), false); h.rotation.x = Math.PI / 2; h.position.set(Math.cos(a) * r, -.083, Math.sin(a) * r); g.add(h); }
    const handle = mesh(new THREE.CylinderGeometry(.07, .08, .9, 16), chrome); handle.position.set(.5, .3, 0); handle.rotation.z = -1.0; g.add(handle);
    const hose = new THREE.CatmullRomCurve3([V3(.88, .55, 0), V3(1.2, .4, -.1), V3(1.35, -.2, -.2), V3(1.2, -.6, -.3)]);
    g.add(mesh(new THREE.TubeGeometry(hose, 24, .045, 8), M.metal(0xb8bcc6)));
  } else if (k === 'towel') {
    g.add(mesh(new RoundedBoxGeometry(1.15, .55, .3, 4, .12), M.cloth(0x2f8f8a)));
    [-.14, .14].forEach(y => { const st = mesh(new RoundedBoxGeometry(1.17, .07, .32, 2, .03), M.cloth(0xf4e8cf), false); st.position.y = y; g.add(st); });
    for (let i = 0; i < 9; i++) { const fr = mesh(new THREE.CylinderGeometry(.015, .015, .14, 6), M.cloth(0xf4e8cf), false); fr.position.set(-.5 + i * .125, -.33, 0); g.add(fr); }
  } else if (k === 'dryer') {
    const navy = new THREE.MeshPhysicalMaterial({ color: 0x24407a, roughness: .3, clearcoat: .8 });
    const b = mesh(new THREE.SphereGeometry(.34, 32, 20), navy); b.scale.set(1.25, 1, 1); g.add(b);
    const noz = mesh(new THREE.CylinderGeometry(.18, .24, .5, 24), navy); noz.rotation.z = Math.PI / 2; noz.position.x = -.55; g.add(noz);
    const rim = mesh(new THREE.TorusGeometry(.18, .03, 8, 24), chrome); rim.rotation.y = Math.PI / 2; rim.position.x = -.8; g.add(rim);
    const handle = mesh(new THREE.CylinderGeometry(.1, .12, .62, 16), navy); handle.position.set(.12, -.48, 0); handle.rotation.z = -.2; g.add(handle);
    const btn = mesh(new THREE.SphereGeometry(.07, 12, 8), M.gloss(0xe8822a, .3)); btn.position.set(.2, -.3, .1); g.add(btn);
    const back = mesh(new THREE.CircleGeometry(.26, 24), M.matte(0x1a1a22, .6), false); back.position.x = .43; back.rotation.y = Math.PI / 2; g.add(back);
  }
  return g;
}
const HOME = V3(0, TABLE_Y + .15, TOOL_Z);
function placeHome() { HOME.z = toolRow().z; }
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
async function showTool(k) {
  if (tool) { const old = tool; tool = null; tween(.3, e => old.g.scale.setScalar(Math.max(.001, 1 - e))).then(() => old.g.removeFromParent()); }
  if (!k) return;
  placeHome(); const g = new THREE.Group(), obj = makeToolObj(k); obj.scale.setScalar(TOOL_S); g.add(obj); g.position.copy(HOME); g.scale.setScalar(.001); stage.add(g);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(.85 * TOOL_S, 12, 8), hitMat); g.add(hit);
  obj.rotation.x = k === 'shower' ? .95 : -.35; if (k === 'dryer') obj.rotation.y = -.3;
  tool = { k, g, obj, hit, wig: 0 };
  SFX.pop(); await tween(.5, e => g.scale.setScalar(Math.max(.001, e)), E.back);
}

// ───────────────────────── dirt painted into the fur ─────────────────────────
// the body's texture is 512×256 over the sphere: u runs round the body (front = .25), v from bottom (0) to top (1)
function makeDirt(kind) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 256);
  const cols = kind === 'mud' ? ['#6b4426', '#7a5030', '#5c3a1e'] : kind === 'berry' ? ['#6a2a6e', '#7d3478', '#55205a'] : ['#d63b2a', '#2c5fbf', '#f0b93a', '#2f8a4e', '#e8822a'];
  const blob = (x, y, r, col) => {
    const n = 11, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, k = kind === 'paint' ? (i % 2 ? rand(.5, .75) : rand(1, 1.45)) : rand(.7, 1.3); pts.push([x + Math.cos(a) * r * k, y + Math.sin(a) * r * k * rand(.75, 1)]); }
    g.fillStyle = col; g.beginPath();
    pts.forEach((p, i) => { const q = pts[(i + 1) % n], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; i ? g.quadraticCurveTo(p[0], p[1], m[0], m[1]) : g.moveTo(m[0], m[1]); });
    g.closePath(); g.fill();
    g.globalAlpha = .35; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x + rand(-3, 3), y + rand(-3, 3), r * .45, r * .35, rand(0, 3), 0, 7); g.fill(); g.globalAlpha = 1;
    for (let i = 0; i < rand(2, 6); i++) { const a = rand(0, 6.28), d = r * rand(1.3, 2.1); g.fillStyle = col; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rand(2, 5), 0, 7); g.fill(); }
    if (kind === 'berry') for (let i = 0; i < rand(1, 3); i++) { const dx = rand(-r * .5, r * .5), len = rand(14, 30); g.fillStyle = col; g.fillRect(x + dx - 2.5, y, 5, len); g.beginPath(); g.arc(x + dx, y + len, 4, 0, 7); g.fill(); }
  };
  let placed = 0, tries = 0;
  while (placed < 8 && tries++ < 200) {
    const u = rand(.07, .43), v = rand(.42, .72);
    if (Math.abs(u - .25) < .12 && v > .46 && v < .68) continue; // keep the eyes clear
    const x = u * 512, y = (1 - v) * 256, r = rand(14, 24), col = cols[placed % cols.length];
    blob(x, y, r, col); placed++;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const D = { c, g, t, kind };
  D.start = countDirty(D); return D;
}
function countDirty(D) {
  const d = D.g.getImageData(0, 0, 512, 256).data; let n = 0;
  for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] < 690) n++;
  return n;
}
function scrubAt(uv) {
  const x = uv.x * 512, y = (1 - uv.y) * 256, g = dirt.g;
  for (const ox of [0, -512, 512]) {
    const r = g.createRadialGradient(x + ox, y, 0, x + ox, y, 30);
    r.addColorStop(0, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(x + ox - 30, y - 30, 60, 60);
  }
  dirt.t.needsUpdate = true;
}

// ───────────────────────── bubbles and drops on the bat ─────────────────────────
const bubbleGeo = new THREE.SphereGeometry(1, 20, 14);
function addBubble(localPos, s = rand(.06, .13)) {
  const m = new THREE.Mesh(bubbleGeo, bubbleMat); m.position.copy(localPos); m.scale.setScalar(.001); bat.inner.add(m);
  const b = { m, s }; bubbles.push(b); tween(.25, e => m.scale.setScalar(Math.max(.001, s * e)), E.back); return b;
}
function popBubble(b) {
  bubbles.splice(bubbles.indexOf(b), 1);
  const w = b.m.getWorldPosition(V3());
  tween(.12, e => b.m.scale.setScalar(Math.max(.001, b.s * (1 + e * .6)))).then(() => b.m.removeFromParent());
  burst(w, { n: 3, size: .16, speed: 1.2, up: .4, color: 0xcfefff, life: .4 });
  sound('pop');
}
const dropMat = new THREE.MeshPhysicalMaterial({ color: 0x8ccbf0, roughness: .05, clearcoat: 1, transparent: true, opacity: .85, envMapIntensity: 1.5 });
const onBody = (x, y) => { const z = Math.sqrt(Math.max(0, 1 - x * x - y * y)); return V3(x, y * 1.08, z * .95).multiplyScalar(1.06); };
function addDrops(n) {
  for (let i = 0; i < n; i++) {
    const x = rand(-.7, .7), y = rand(-.2, .55); if (Math.abs(x) < .45 && y > .05 && y < .45) { i--; continue; }
    const m = mesh(new THREE.SphereGeometry(.07, 14, 10), dropMat, false); m.scale.set(1, 1.5, .8); m.position.copy(onBody(x, y)); bat.inner.add(m); drops.push(m);
  }
}
function sound(kind) {
  const n = performance.now(); if (n - lastSnd < 130) return; lastSnd = n;
  if (kind === 'squish') noise({ d: .1, v: .08, f1: 1800, f2: 2600 });
  else if (kind === 'pop') tone({ f: 1500 + Math.random() * 700, f2: 900, d: .05, v: .07 });
  else if (kind === 'rub') noise({ d: .12, v: .09, f1: 700, f2: 1100 });
  else if (kind === 'wind') noise({ d: .18, v: .08, f1: 1200, f2: 1800 });
  else if (kind === 'water') noise({ d: .16, v: .06, f1: 3000, f2: 2200 });
}

// ───────────────────────── rounds ─────────────────────────
async function startRound() {
  phase = 'intro'; bubbles = []; drops = []; wet = 1; fluff = 0;
  const cfg = BATS[(round * 2 + 1) % BATS.length];
  if (bat) bat.dispose();
  bat = makeBat(cfg); bat.noBlob = true; bat.wingLift = .38; bat.flapAmp = .12; bat.flapSpeed = 4; bat.bobAmt = .35;
  dirt = makeDirt(MESS[round % MESS.length]); bat.setDirt(dirt.t); bat.setMood('worried');
  const p0 = V3(9, 5, -3), p1 = V3(3.5, 4.5, 1), p2 = SEAT.clone();
  bat.base.copy(p0); bat.last.copy(p0); bat.flapSpeed = 13; bat.flapAmp = .42; bat.wingLift = 0; bat.propSpeed = 22;
  SFX.whoosh();
  await tween(1.9, e => bat.base.copy(bez(p0, p1, p2, e)), E.out);
  bat.flapSpeed = 4; bat.flapAmp = .12; bat.wingLift = .38; bat.propSpeed = 3;
  noise({ d: .6, v: .22, f1: 1600, f2: 300 });
  burst(SEAT.clone().add(V3(0, -.3, .5)), { n: 22, tex: glowTex, color: 0x9fd4ff, size: .18, speed: 2.6, up: 2.4, grav: -7, life: .9, additive: false });
  await say('w_intro');
  setPhase('scrub');
}
async function setPhase(p) {
  phase = p; await showTool(TOOLS[p]);
  armHint();
  if (LINES[p]) say(LINES[p]);
}
function armHint() {
  clearTimeout(hintT);
  hintT = setTimeout(() => { if (tool && !drag) { tool.wig = 1.4; armHint(); } }, 9000);
}
async function cleanDone() {
  dirt.g.fillStyle = '#fff'; dirt.g.fillRect(0, 0, 512, 256); dirt.t.needsUpdate = true;
  while (bubbles.length < 12) addBubble(onBody(rand(-.7, .7), rand(-.2, .6)));
  SFX.chime(); bat.setMood('happy'); endDrag();
  await setPhase('rinse');
}
async function rinseDone() {
  addDrops(7); bat.setFurLen(.4); wet = 1;
  SFX.chime(); endDrag();
  await setPhase('dry');
}
async function dryDone() {
  bat.setFurLen(1); SFX.chime(); endDrag();
  await setPhase('fluff');
}
async function fluffDone() {
  phase = 'done'; endDrag(); await showTool(null);
  bat.setMood('open'); SFX.chime(); SFX.giggle();
  burst(bat.root.position.clone().add(V3(0, .4, .6)), { n: 30 });
  // a happy shake, then the fur settles a little
  await tween(.6, e => bat.wobble = .12 * Math.sin(e * Math.PI));
  bat.wobble = 0;
  tween(1.2, e => bat.setFurLen(1.85 - .45 * e));
  await say('w_done');
  round++; progress(ROUNDS, round);
  // off it flies, clean and fluffy
  bat.wingLift = 0; bat.flapAmp = .42; bat.flapSpeed = 14; bat.propSpeed = 30; SFX.whoosh();
  const p0 = bat.base.clone(), p1 = V3(3, 4.5, -2), p2 = MOUTH.clone();
  await tween(2.2, e => { bat.base.copy(bez(p0, p1, p2, e)); bat.root.scale.setScalar(1 - e * .5); }, E.io);
  bat.root.visible = false;
  if (round >= ROUNDS) {
    phase = 'party'; confetti(V3(0, 2, .5), 60); SFX.chime();
    await say('w_party');
    showAgain(() => { round = 0; progress(ROUNDS, 0); startRound(); });
  } else startRound();
}

// ───────────────────────── input ─────────────────────────
function down(e) {
  if (duck && pick([duck], true)) { tone({ f: 900, f2: 1400, d: .14, v: .12, type: 'triangle' }); tone({ f: 1300, f2: 800, at: 0, d: .12, v: .06 }); tween(.4, k => duck.rotation.z = Math.sin(k * Math.PI * 3) * .3 * (1 - k)); return; }
  if (tool && TOOLS[phase] === tool.k && pick([tool.hit])) {
    const at = dragPlane(tool.g.position); drag = { at, id: e.pointerId, last: null, goal: tool.g.position.clone() };
    SFX.pick(); clearTimeout(hintT); tool.wig = 0; move(e);
    return;
  }
  if (bat && pick(bat.meshes)) { SFX.squeak(); bat.wobble = .05; setTimeout(() => bat && (bat.wobble = 0), 300); }
}
function move(e) {
  if (!drag || e.pointerId !== drag.id || !tool) return;
  const p = drag.at(); if (!p) return;
  const scr = { x: e.clientX, y: e.clientY }, moved = drag.last ? Math.hypot(scr.x - drag.last.x, scr.y - drag.last.y) : 0; drag.last = scr;
  const hit = pick([bat.body]);
  const k = tool.k;
  if (k === 'sponge' || k === 'towel') {
    // the sponge or towel sits on the bat where the finger is
    if (hit) { const n = hit.face.normal.clone().transformDirection(bat.body.matrixWorld); drag.goal.copy(hit.point).addScaledVector(n, .3); }
    else drag.goal.copy(p).add(V3(0, .25, 0));
  } else if (k === 'shower') drag.goal.copy(p).add(V3(0, .75, .2));
  else drag.goal.copy(p).add(V3(.95, .1, .3));
  if (!moved) return;
  if (k === 'sponge' && phase === 'scrub' && hit) {
    scrubAt(hit.uv); sound('squish');
    if (bubbles.length < 46 && Math.random() < .5) addBubble(bat.inner.worldToLocal(hit.point.clone()).multiplyScalar(1.04));
  } else if (k === 'shower' && phase === 'rinse') {
    const R = Math.min(innerWidth, innerHeight) * .12;
    bubbles.slice().forEach(b => { const s = sp(b.m.getWorldPosition(V3())); if (Math.hypot(s.x - scr.x, s.y - scr.y) < R) popBubble(b); });
    if (!bubbles.length) rinseDone();
  } else if (k === 'towel' && phase === 'dry') {
    const R = Math.min(innerWidth, innerHeight) * .1;
    if (hit) sound('rub');
    drops.slice().forEach(m => {
      const s = sp(m.getWorldPosition(V3()));
      if (Math.hypot(s.x - scr.x, s.y - scr.y) < R) { drops.splice(drops.indexOf(m), 1); tween(.2, e => m.scale.setScalar(Math.max(.001, 1 - e))).then(() => m.removeFromParent()); }
    });
    bat.setFurLen(.4 + .6 * (1 - drops.length / 7));
    if (!drops.length) dryDone();
  } else if (k === 'dryer' && phase === 'fluff') {
    const c = sp(bat.root.position), R = Math.min(innerWidth, innerHeight) * .32;
    if (Math.hypot(c.x - scr.x, c.y - scr.y) < R) {
      fluff = Math.min(1, fluff + moved * .0022); sound('wind'); bat.setFurLen(1 + fluff * .85);
      if (fluff >= 1) fluffDone();
    }
  }
}
function endDrag() { drag = null; if (tool) { const g = tool.g; const from = g.position.clone(); tween(.45, e => g.position.lerpVectors(from, HOME, e), E.back); } }
function up(e) { if (!drag || e.pointerId !== drag.id) return; endDrag(); armHint(); }

// ───────────────────────── per frame ─────────────────────────
function update(t, dt) {
  foam.forEach(f => f.m.position.y = f.y + Math.sin(t * 1.3 + f.ph) * .02);
  if (duck) { duck.position.y = .86 + Math.sin(t * 1.6) * .03; duck.rotation.x = Math.sin(t * 1.2) * .06; }
  if (tool) {
    if (drag) tool.g.position.lerp(drag.goal, 1 - Math.exp(-dt * 20));
    const s = drag ? 1.15 : 1; tool.g.scale.setScalar(tool.g.scale.x + (s - tool.g.scale.x) * Math.min(1, dt * 10));
    tool.obj.rotation.z = tool.wig > 0 ? Math.sin(t * 22) * .2 * Math.min(1, tool.wig) : tool.obj.rotation.z * .85;
    if (tool.wig > 0) tool.wig -= dt;
    if (tool.k === 'shower') tool.obj.rotation.x += ((drag ? .3 : .95) - tool.obj.rotation.x) * Math.min(1, dt * 8);
    // shower water and dryer wind
    if (drag && tool.k === 'shower' && Math.random() < .8) { burst(tool.g.position.clone().add(V3(rand(-.2, .2), -.12, rand(-.2, .2))), { n: 1, tex: glowTex, color: 0x9fd4ff, size: .1, speed: .3, up: -3, grav: -6, life: .5, additive: false }); sound('water'); }
    if (drag && tool.k === 'dryer' && Math.random() < .4) burst(tool.g.position.clone().add(V3(-.75, 0, 0)), { n: 1, tex: sparkTex, color: 0xffffff, size: .14, speed: .2, up: 0, grav: 0, life: .5 });
  }
  if (bat) bat.lookTarget = drag && tool ? tool.g.position : null;
  // how much dirt is left (checked a few times a second)
  if (phase === 'scrub' && dirt && t - dirtyAt > .3) { dirtyAt = t; if (countDirty(dirt) < dirt.start * .1) cleanDone(); }
}

export function start() {
  setView({ x: 0, y: 1.0, z: .9, w: 7.0, wTall: 5.0, h: 5.0, pitch: .26, lift: .12 });
  buildTub();
  Object.assign(input, { down, move, up });
  onFrame(update);
  progress(ROUNDS, 0);
  if (TEST) window.__v2 = {
    G, get bat() { return bat; }, get bubbles() { return bubbles.length; }, get drops() { return drops.length; }, get dirtLeft() { return dirt ? countDirty(dirt) / dirt.start : 0; },
    toolScreen: () => tool && sp(tool.g.position.clone()), batScreen: () => sp(bat.root.position.clone()),
    bubbleScreens: () => bubbles.map(b => sp(b.m.getWorldPosition(V3()))), dropScreens: () => drops.map(m => sp(m.getWorldPosition(V3()))),
    faceScreen: () => sp(bat.inner.localToWorld(V3(0, .05, 1))),
  };
  startRound();
}
