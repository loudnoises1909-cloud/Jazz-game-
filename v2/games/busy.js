// Busy Board: a wooden board of six gadgets to tap. A T-Rex in a box, a lamp with a sleepy bat, gears that play a tune,
// a door with a T-Rex behind it, a rocket that flies out of the cave, and a prize wheel whose prize rains down.
import {
  THREE, TEST, rand, clamp, V3, E, sleep, stage, setView, glowTex, sparkTex, woodTex, M, mesh, RoundedBoxGeometry, BATS, makeBat,
  burst, confetti, tween, bez, SFX, tone, noise, now, say, MOUTH, onFrame, input, pick, sp, progress, furShells, hideDecor,
} from '../engine.js';

const CELLS = ['rex', 'lamp', 'crank', 'door', 'rocket', 'spin'];
const PLATE = { rex: 0xefe2c4, lamp: 0x22364f, crank: 0xe6dcc0, door: 0x5f8f3a, rocket: 0x17233a, spin: 0x9fcbd6 };
const board = new THREE.Group(), gad = {}, tried = new Set();
let allDone = false, hintT = null, lastTap = 0, lastPrize = null;
const pickOne = a => a[Math.random() * a.length | 0];

// ───────────────────────── sounds ─────────────────────────
const S = {
  roar: () => { tone({ f: 150, f2: 70, type: 'sawtooth', d: .75, v: .07 }); tone({ f: 110, f2: 55, type: 'square', d: .6, v: .04 }); noise({ d: .6, v: .08, f1: 300, f2: 120 }); },
  click: () => tone({ f: 1800, f2: 1200, type: 'square', d: .03, v: .05 }),
  tick: () => tone({ f: 2200, d: .025, v: .04, type: 'triangle' }),
  musicBox: (i) => [1046.5, 1318.5, 1568, 2093, 1568, 1318.5][i % 6] && tone({ f: [1046.5, 1318.5, 1568, 2093, 1568, 1318.5][i % 6], d: .5, v: .06 }),
  creak: () => { tone({ f: 280, f2: 420, type: 'sawtooth', d: .4, v: .025 }); },
  beep: (f) => tone({ f, d: .16, v: .09, type: 'triangle' }),
  rumble: () => noise({ d: 1.6, v: .2, f1: 200, f2: 1600 }),
  boom: () => { noise({ d: .5, v: .2, f1: 900, f2: 200 }); SFX.sparkle(); },
};

// ───────────────────────── models ─────────────────────────
const green = new THREE.MeshPhysicalMaterial({ color: 0x4f8f3a, roughness: .4, clearcoat: .6, clearcoatRoughness: .3, sheen: .3, sheenColor: new THREE.Color(0xb8f08a), envMapIntensity: .5 });
const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: .3, envMapIntensity: 1 });
const ivory = new THREE.MeshPhysicalMaterial({ color: 0xf6f0e0, roughness: .25, clearcoat: .8 });
function makeRex() {
  const r = new THREE.Group();
  const neck = mesh(new THREE.CylinderGeometry(.22, .28, .5, 20), green); neck.position.y = -.35; r.add(neck);
  const head = mesh(new THREE.SphereGeometry(.42, 40, 28), green); head.scale.set(1, .85, 1.05); r.add(head);
  const snout = mesh(new RoundedBoxGeometry(.6, .32, .55, 4, .14), green); snout.position.set(0, -.02, .38); r.add(snout);
  const jaw = new THREE.Group(); jaw.position.set(0, -.15, .1); r.add(jaw);
  const lj = mesh(new RoundedBoxGeometry(.52, .14, .62, 4, .06), new THREE.MeshPhysicalMaterial({ color: 0xb8d88a, roughness: .5, clearcoat: .4 })); lj.position.set(0, -.04, .3); jaw.add(lj);
  const mouthIn = mesh(new RoundedBoxGeometry(.48, .04, .55, 2, .02), M.gloss(0x6a1a2a, .5), false); mouthIn.position.set(0, .03, .3); jaw.add(mouthIn);
  for (let i = 0; i < 6; i++) { const t = mesh(new THREE.ConeGeometry(.035, .09, 8), ivory, false); t.rotation.x = Math.PI; const a = i / 5; t.position.set(-.2 + a * .4, -.2, .62 - Math.abs(a - .5) * .12); r.add(t); }
  [-1, 1].forEach(sd => {
    const ew = mesh(new THREE.SphereGeometry(.11, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0xfbf6e8, roughness: .06, clearcoat: 1 })); ew.position.set(sd * .22, .2, .22); r.add(ew);
    const pu = mesh(new THREE.SphereGeometry(.06, 14, 10), M.gloss(0x111111, .08)); pu.position.set(sd * .23, .21, .31); r.add(pu);
    const br = mesh(new THREE.CapsuleGeometry(.035, .12, 4, 8), M.gloss(0x2f5a22, .4)); br.rotation.z = Math.PI / 2 + sd * .3; br.position.set(sd * .22, .34, .24); r.add(br);
    const no = mesh(new THREE.SphereGeometry(.025, 8, 6), M.gloss(0x1a2a12, .4)); no.position.set(sd * .1, .1, .66); r.add(no);
  });
  for (let i = 0; i < 4; i++) { const sp_ = mesh(new THREE.ConeGeometry(.06, .14, 8), new THREE.MeshPhysicalMaterial({ color: 0xe8822a, roughness: .4 })); sp_.position.set(0, .34 - i * .02, -.05 - i * .14); sp_.rotation.x = -.4 - i * .25; r.add(sp_); }
  r.userData.jaw = jaw;
  return r;
}
function gearShape(R, r, teeth, hole) {
  const s = new THREE.Shape();
  for (let i = 0; i < teeth * 4; i++) { const a = i / (teeth * 4) * Math.PI * 2, rr = (i % 4 < 2) ? R : r; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  s.closePath(); const h = new THREE.Path(); h.absarc(0, 0, hole, 0, Math.PI * 2, true); s.holes.push(h); return s;
}
const extr = (shape, d = .12) => new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 2, curveSegments: 24 });
function makePrize(k) {
  const g = new THREE.Group();
  if (k === 'candy') {
    const m = new THREE.MeshPhysicalMaterial({ color: 0xe86a8a, roughness: .2, clearcoat: 1 });
    const c = mesh(new THREE.SphereGeometry(.2, 20, 14), m); c.scale.set(1.3, 1, 1); g.add(c);
    [-1, 1].forEach(sd => { const w = mesh(new THREE.ConeGeometry(.14, .2, 12), m); w.rotation.z = sd * Math.PI / 2; w.position.x = sd * .32; g.add(w); });
  } else if (k === 'lollipop') {
    const d = mesh(new THREE.CylinderGeometry(.24, .24, .08, 32), new THREE.MeshPhysicalMaterial({ color: 0xf0b93a, roughness: .2, clearcoat: 1 })); d.rotation.x = Math.PI / 2; g.add(d);
    const sw = mesh(new THREE.TorusGeometry(.13, .03, 8, 32), new THREE.MeshPhysicalMaterial({ color: 0xd63b2a, roughness: .2, clearcoat: 1 })); sw.position.z = .045; g.add(sw);
    const st = mesh(new THREE.CylinderGeometry(.025, .025, .45, 8), ivory); st.position.y = -.42; g.add(st);
  } else if (k === 'car') {
    const b = mesh(new RoundedBoxGeometry(.6, .18, .3, 3, .06), new THREE.MeshPhysicalMaterial({ color: 0x2c5fbf, roughness: .25, clearcoat: 1 })); g.add(b);
    const cab = mesh(new RoundedBoxGeometry(.32, .16, .26, 3, .06), new THREE.MeshPhysicalMaterial({ color: 0x9fd0f0, roughness: .1, clearcoat: 1 })); cab.position.set(-.04, .15, 0); g.add(cab);
    [[-.18, -.15], [.18, -.15], [-.18, .15], [.18, .15]].forEach(([x, z]) => { const w = mesh(new THREE.CylinderGeometry(.08, .08, .06, 16), M.gloss(0x1a1a1a, .5)); w.rotation.x = Math.PI / 2; w.position.set(x, -.09, z); g.add(w); });
  } else if (k === 'ball') {
    const b = mesh(new THREE.SphereGeometry(.22, 32, 20), new THREE.MeshPhysicalMaterial({ color: 0xd63b2a, roughness: .3, clearcoat: .8 })); g.add(b);
    const band = mesh(new THREE.TorusGeometry(.222, .04, 8, 40), new THREE.MeshPhysicalMaterial({ color: 0xf6f0e0, roughness: .3, clearcoat: .8 })); g.add(band);
    const b2 = mesh(new THREE.TorusGeometry(.222, .04, 8, 40), new THREE.MeshPhysicalMaterial({ color: 0x2c5fbf, roughness: .3, clearcoat: .8 })); b2.rotation.y = Math.PI / 2; g.add(b2);
  } else if (k === 'rex') { const r = makeRex(); r.scale.setScalar(.42); r.children[0].visible = false; g.add(r); }
  else if (k === 'star') {
    const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? .12 : .28; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } s.closePath();
    const m = mesh(extr(s, .06), new THREE.MeshPhysicalMaterial({ color: 0xf0b93a, roughness: .25, clearcoat: 1, emissive: 0x6a4a00, emissiveIntensity: .3 })); m.position.z = -.03; g.add(m);
  }
  return g;
}
const PRIZES = ['candy', 'lollipop', 'car', 'ball', 'rex', 'star'];
const WHEEL_COLS = [0xd63b2a, 0xf0b93a, 0x2f8a4e, 0x2c5fbf, 0xe86a8a, 0xe8822a];

// ───────────────────────── the board ─────────────────────────
function cellCenter(i) { return V3((i % 3 - 1) * 2.35, i < 3 ? 1.05 : -1.05, .2); }
function buildBoard() {
  board.position.set(0, 1.88, -.45); board.rotation.x = -.06; stage.add(board);
  const wood = new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: .5, clearcoat: .3, envMapIntensity: .4 });
  board.add(mesh(new RoundedBoxGeometry(7.5, 4.5, .32, 4, .12), wood, true, true));
  [-3.2, 3.2].forEach(x => { const f = mesh(new RoundedBoxGeometry(.5, .3, 1.2, 2, .08), wood, true, true); f.position.set(x, -2.32, .1); board.add(f); });
  CELLS.forEach((k, i) => {
    const c = cellCenter(i), g = new THREE.Group(); g.position.copy(c); board.add(g);
    const plate = mesh(new RoundedBoxGeometry(2.15, 1.95, .08, 3, .05), new THREE.MeshPhysicalMaterial({ color: PLATE[k], roughness: .55, clearcoat: .3 }), false, true); plate.position.z = -.02; g.add(plate);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { const b = mesh(new THREE.SphereGeometry(.05, 12, 8), gold, false); b.scale.z = .5; b.position.set(sx * .95, sy * .85, .03); g.add(b); });
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.95, .9), new THREE.MeshBasicMaterial({ visible: false })); hit.position.z = .4; hit.userData.k = k; g.add(hit);
    gad[k] = { g, hit, busy: false, plate };
  });
  buildRexBox(gad.rex); buildLamp(gad.lamp); buildCrank(gad.crank); buildDoor(gad.door); buildRocket(gad.rocket); buildWheel(gad.spin);
}
function buildRexBox(G) {
  const box = mesh(new RoundedBoxGeometry(.95, .7, .6, 3, .06), new THREE.MeshPhysicalMaterial({ color: 0xd63b2a, roughness: .35, clearcoat: .7 })); box.position.set(-.15, -.45, .35); G.g.add(box);
  [[-.42, -.2], [.12, -.6]].forEach(([x, y]) => { const s = makePrize('star'); s.scale.setScalar(.5); s.position.set(x, y, .66); G.g.add(s); });
  const lid = new THREE.Group(); lid.position.set(-.15, -.1, .05); G.g.add(lid);
  const lm = mesh(new RoundedBoxGeometry(1.0, .08, .64, 2, .03), new THREE.MeshPhysicalMaterial({ color: 0xf0b93a, roughness: .35, clearcoat: .7 })); lm.position.z = .3; lid.add(lm);
  const crank = new THREE.Group(); crank.position.set(.36, -.45, .35); G.g.add(crank);
  const axle = mesh(new THREE.CylinderGeometry(.04, .04, .2, 10), gold); axle.rotation.z = Math.PI / 2; axle.position.x = .1; crank.add(axle);
  const arm = mesh(new RoundedBoxGeometry(.06, .3, .06, 2, .02), gold); arm.position.set(.2, .12, 0); crank.add(arm);
  const knob = mesh(new THREE.SphereGeometry(.07, 12, 8), M.gloss(0x2c5fbf, .3)); knob.position.set(.2, .27, .06); crank.add(knob);
  const rex = makeRex(); rex.scale.setScalar(.55); rex.position.set(-.15, -.5, .35); G.g.add(rex); rex.visible = false;
  Object.assign(G, { lid, crank, rex });
}
function buildLamp(G) {
  const cord = mesh(new THREE.CylinderGeometry(.015, .015, .5, 6), M.matte(0x111111)); cord.position.set(.55, .7, .2); G.g.add(cord);
  const cap = mesh(new THREE.CylinderGeometry(.08, .1, .12, 12), M.metal(0x9aa3ad)); cap.position.set(.55, .42, .2); G.g.add(cap);
  const bulbMat = new THREE.MeshPhysicalMaterial({ color: 0xdedede, roughness: .1, clearcoat: 1, transparent: true, opacity: .75, emissive: 0xffd27a, emissiveIntensity: 0 });
  const bulb = mesh(new THREE.SphereGeometry(.17, 24, 16), bulbMat, false); bulb.position.set(.55, .23, .2); G.g.add(bulb);
  const light = new THREE.PointLight(0xffd27a, 0, 4, 2); light.position.copy(bulb.position).add(V3(0, 0, .3)); G.g.add(light);
  const branch = mesh(new THREE.CylinderGeometry(.035, .04, 1.1, 8), M.matte(0x6b4426)); branch.rotation.z = Math.PI / 2; branch.position.set(-.45, .55, .2); G.g.add(branch);
  // a small pink bat asleep, hanging upside down from the branch
  const hang = new THREE.Group(); hang.position.set(-.45, .5, .25); hang.rotation.z = Math.PI; G.g.add(hang);
  const b = makeBat(BATS[2], { scale: .24, furN: .35, blobY: -50 }); b.noBlob = true; hang.add(b.root);
  b.base.set(0, .26, 0); b.flapAmp = 0; b.bobAmt = .2; b.wingLift = -.7; b.setMood('sleep');
  const sw = mesh(new RoundedBoxGeometry(.32, .48, .1, 2, .04), M.gloss(0xe6dcc0, .4)); sw.position.set(.55, -.55, .1); G.g.add(sw);
  const tog = new THREE.Group(); tog.position.set(.55, -.55, .16); G.g.add(tog);
  const tm = mesh(new RoundedBoxGeometry(.1, .2, .1, 2, .04), M.gloss(0xd63b2a, .3)); tm.position.y = .06; tog.add(tm); tog.rotation.x = .4;
  Object.assign(G, { bulbMat, light, hang, bat: b, tog, on: false, hue: 0 });
}
function buildCrank(G) {
  const g1 = mesh(extr(gearShape(.48, .38, 10, .1)), gold); g1.position.set(-.38, .25, .05); G.g.add(g1);
  const g2 = mesh(extr(gearShape(.32, .23, 7, .07)), M.metal(0xb8bcc6)); g2.position.set(.32, .52, .05); G.g.add(g2);
  const chest = mesh(new RoundedBoxGeometry(1.1, .55, .45, 3, .05), new THREE.MeshPhysicalMaterial({ map: woodTex, color: 0x9a6a3a, roughness: .5 })); chest.position.set(-.3, -.55, .25); G.g.add(chest);
  const handle = new THREE.Group(); handle.position.set(.6, -.4, .2); G.g.add(handle);
  const disc = mesh(new THREE.CylinderGeometry(.25, .25, .08, 24), M.metal(0x8a929c)); disc.rotation.x = Math.PI / 2; handle.add(disc);
  const arm = mesh(new RoundedBoxGeometry(.08, .36, .06, 2, .02), gold); arm.position.set(0, .18, .06); handle.add(arm);
  const knob = mesh(new THREE.SphereGeometry(.09, 14, 10), M.gloss(0xd63b2a, .3)); knob.position.set(0, .36, .12); handle.add(knob);
  Object.assign(G, { g1, g2, handle });
}
function buildDoor(G) {
  const frame = mesh(new RoundedBoxGeometry(1.15, 1.6, .12, 2, .04), new THREE.MeshPhysicalMaterial({ color: 0x3a2a1a, roughness: .6 })); frame.position.z = .02; G.g.add(frame);
  const inside = mesh(new THREE.PlaneGeometry(1.0, 1.45), M.matte(0x0e1424, 1), false); inside.position.z = .085; G.g.add(inside);
  const rex = makeRex(); rex.scale.setScalar(.6); rex.position.set(0, -.05, -.1); G.g.add(rex);
  const hinge = new THREE.Group(); hinge.position.set(-.5, 0, .12); G.g.add(hinge);
  const leaf = mesh(new RoundedBoxGeometry(1.0, 1.45, .08, 3, .03), new THREE.MeshPhysicalMaterial({ color: 0xd63b2a, roughness: .4, clearcoat: .5 })); leaf.position.x = .5; hinge.add(leaf);
  [.33, -.33].forEach(y => { const p = mesh(new RoundedBoxGeometry(.7, .48, .03, 2, .02), new THREE.MeshPhysicalMaterial({ color: 0xb02f22, roughness: .5 })); p.position.set(.5, y, .05); hinge.add(p); });
  const knob = mesh(new THREE.SphereGeometry(.06, 14, 10), gold); knob.position.set(.88, 0, .08); hinge.add(knob);
  Object.assign(G, { hinge, rex });
}
function buildRocket(G) {
  const win = mesh(new RoundedBoxGeometry(.9, 1.7, .05, 2, .04), M.matte(0x0a0f22, 1), false); win.position.set(.45, 0, .02); G.g.add(win);
  for (let i = 0; i < 14; i++) { const s = mesh(new THREE.SphereGeometry(.015, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff6d8 }), false); s.position.set(.45 + rand(-.4, .4), rand(-.8, .8), .06); G.g.add(s); }
  const lever = new THREE.Group(); lever.position.set(-.55, -.6, .15); G.g.add(lever);
  const base = mesh(new RoundedBoxGeometry(.5, .25, .3, 2, .05), new THREE.MeshPhysicalMaterial({ color: 0xf0b93a, roughness: .35, clearcoat: .6 })); G.g.add(base); base.position.set(-.55, -.72, .15);
  const stick = mesh(new THREE.CylinderGeometry(.04, .04, .6, 10), M.metal(0xb8bcc6)); stick.position.y = .3; lever.add(stick);
  const ball = mesh(new THREE.SphereGeometry(.12, 16, 12), M.gloss(0xd63b2a, .25)); ball.position.y = .62; lever.add(ball);
  lever.rotation.z = .5;
  Object.assign(G, { lever, rocket: newRocket(G) });
}
function newRocket(G) {
  const r = new THREE.Group(); r.position.set(.45, -.45, .3); G.g.add(r);
  const body = mesh(new THREE.CylinderGeometry(.15, .17, .6, 24), new THREE.MeshPhysicalMaterial({ color: 0xf6f0e0, roughness: .3, clearcoat: .8 })); r.add(body);
  const nose = mesh(new THREE.ConeGeometry(.15, .3, 24), M.gloss(0xd63b2a, .3)); nose.position.y = .45; r.add(nose);
  const port = mesh(new THREE.CircleGeometry(.07, 20), new THREE.MeshPhysicalMaterial({ color: 0x9fd0f0, roughness: .1, clearcoat: 1 })); port.position.set(0, .08, .165); r.add(port);
  for (let i = 0; i < 3; i++) { const f = mesh(new RoundedBoxGeometry(.04, .22, .18, 2, .015), M.gloss(0xd63b2a, .3)); const a = i / 3 * Math.PI * 2; f.position.set(Math.sin(a) * .18, -.25, Math.cos(a) * .18); f.rotation.y = a; r.add(f); }
  r.scale.setScalar(.001); tween(.4, e => r.scale.setScalar(Math.max(.001, e)), E.back);
  return r;
}
function buildWheel(G) {
  const post = mesh(new THREE.CylinderGeometry(.05, .06, .9, 10), M.matte(0x6b4426)); post.position.set(0, -.5, .05); G.g.add(post);
  const wheel = new THREE.Group(); wheel.position.set(0, .05, .12); G.g.add(wheel);
  for (let i = 0; i < 6; i++) {
    const s = mesh(new THREE.CylinderGeometry(.78, .78, .08, 32, 1, false, i * Math.PI / 3, Math.PI / 3), new THREE.MeshPhysicalMaterial({ color: WHEEL_COLS[i], roughness: .35, clearcoat: .6 })); s.rotation.x = Math.PI / 2; wheel.add(s);
    const a = (i + .5) * Math.PI / 3, p = makePrize(PRIZES[i]); p.scale.setScalar(.6); p.position.set(Math.sin(a) * .5, Math.cos(a) * .5, .1); wheel.add(p);
  }
  const hub = mesh(new THREE.CylinderGeometry(.12, .12, .14, 20), gold); hub.rotation.x = Math.PI / 2; hub.position.z = .05; wheel.add(hub);
  const rim = mesh(new THREE.TorusGeometry(.79, .035, 8, 64), gold); wheel.add(rim);
  const ptr = mesh(new THREE.ConeGeometry(.09, .2, 3), M.gloss(0x1a1a1a, .3)); ptr.rotation.z = Math.PI; ptr.position.set(0, .9, .2); G.g.add(ptr);
  Object.assign(G, { wheel, vel: 0, lastSeg: 0 });
}

// ───────────────────────── gadget actions ─────────────────────────
async function play(k) {
  const G = gad[k]; if (G.busy) return; G.busy = true;
  try { await ACT[k](G); } finally { G.busy = false; }
  if (!tried.has(k)) { tried.add(k); progress(6, tried.size); }
  if (!allDone && tried.size === CELLS.length) { allDone = true; flock(); await say('y_all'); }
}
const ACT = {
  async rex(G) {
    await tween(1.1, e => { G.crank.rotation.x = -e * Math.PI * 4; if ((e * 6 | 0) !== ((e - .02) * 6 | 0)) S.musicBox(e * 6 | 0); });
    S.click(); G.rex.visible = true;
    await Promise.all([tween(.25, e => G.lid.rotation.x = -e * 2.0, E.out), tween(.55, e => { G.rex.position.y = -.5 + e * 1.0; }, E.back)]);
    S.roar(); burst(G.g.localToWorld(V3(-.15, .6, .6)), { n: 12, size: .25 });
    await tween(.8, e => { G.rex.userData.jaw.rotation.x = Math.abs(Math.sin(e * Math.PI * 3)) * .5; G.rex.rotation.z = Math.sin(e * Math.PI * 4) * .15; });
    await sleep(1200);
    await tween(.4, e => G.rex.position.y = .5 - e * 1.0);
    G.rex.visible = false; await tween(.25, e => G.lid.rotation.x = -2 * (1 - e)); S.click();
  },
  async lamp(G) {
    S.click(); G.on = !G.on;
    await tween(.12, e => G.tog.rotation.x = G.on ? .4 - e * .8 : -.4 + e * .8);
    if (!G.on) { G.bulbMat.emissiveIntensity = 0; G.light.intensity = 0; return; }
    const cols = [0xffd27a, 0xff7a5c, 0x7ad0ff, 0x9dff8a, 0xff9ad2, 0xc8a0ff], c = cols[G.hue++ % cols.length];
    G.bulbMat.emissive.setHex(c); G.light.color.setHex(c); G.bulbMat.emissiveIntensity = 3; G.light.intensity = 6;
    // the light wakes the little bat; it flips over and does a loop round the cave
    const b = G.bat; b.setMood('open'); SFX.squeak();
    await tween(.3, e => G.hang.rotation.z = Math.PI * (1 - e));
    b.flapAmp = .45; b.flapSpeed = 14; b.wingLift = 0; b.propSpeed = 25;
    const start = b.base.clone();
    await tween(3.2, e => { const a = e * Math.PI * 2; b.base.set(start.x + Math.sin(a) * 6, start.y + Math.sin(e * Math.PI) * 4.5, start.z - (1 - Math.cos(a)) * 3); }, E.io);
    b.base.copy(start); b.flapAmp = 0; b.wingLift = -.7;
    await tween(.3, e => G.hang.rotation.z = Math.PI * e);
    b.setMood('sleep');
  },
  async crank(G) {
    let i = 0;
    await tween(2, e => { const a = e * Math.PI * 4; G.handle.rotation.z = -a; G.g1.rotation.z = -a * .6; G.g2.rotation.z = a * .6 * 10 / 7; const n = e * 12 | 0; if (n !== i) { i = n; S.musicBox(n); S.tick(); } });
    burst(G.g.localToWorld(V3(-.3, -.2, .6)), { n: 14, size: .3, color: 0xffe08a });
  },
  async door(G) {
    S.creak();
    await tween(.5, e => G.hinge.rotation.y = -e * 1.9, E.out);
    await tween(.4, e => G.rex.position.z = -.1 + e * .35, E.back);
    S.roar(); await tween(.9, e => { G.rex.userData.jaw.rotation.x = Math.abs(Math.sin(e * Math.PI * 3)) * .55; G.rex.rotation.y = Math.sin(e * Math.PI * 2) * .3; });
    await sleep(900);
    await tween(.3, e => G.rex.position.z = .25 - e * .35);
    S.creak(); await tween(.5, e => G.hinge.rotation.y = -1.9 * (1 - e));
  },
  async rocket(G) {
    await tween(.2, e => G.lever.rotation.z = .5 - e * 1.0); S.click();
    for (const f of [660, 660, 660]) { S.beep(f); await sleep(380); }
    S.beep(1320); S.rumble();
    const r = G.rocket; stage.attach(r);
    const p0 = r.position.clone(), p1 = p0.clone().add(V3(0, 5, 2)), p2 = MOUTH.clone();
    let last = 0;
    await tween(2.6, (e, raw) => {
      const p = bez(p0, p1, p2, e), q = bez(p0, p1, p2, Math.min(1, e + .02)); r.position.copy(p);
      r.quaternion.setFromUnitVectors(V3(0, 1, 0), q.sub(p).normalize()); r.scale.setScalar(Math.max(.001, 1.6 * (1 - e * .6)));
      if (raw - last > .03) { last = raw; burst(r.position.clone(), { n: 2, tex: glowTex, color: 0xffa24f, size: .35, speed: .4, up: -.5, grav: 0, life: .5 }); burst(r.position.clone(), { n: 1, tex: glowTex, color: 0x9a9aa8, size: .5, speed: .3, up: 0, grav: .3, life: 1.2, additive: false }); }
    }, E.lin);
    r.removeFromParent();
    // fireworks through the cave mouth
    for (let i = 0; i < 4; i++) { S.boom(); burst(MOUTH.clone().add(V3(rand(-1.5, 1.5), rand(-.5, 1.5), 0)), { n: 30, color: [0xffe08a, 0xff7a5c, 0x7ad0ff, 0x9dff8a][i], size: .5, speed: 4, up: .5, grav: -1.5, life: 1.4 }); await sleep(350); }
    await tween(.2, e => G.lever.rotation.z = -.5 + e * 1.0);
    G.rocket = newRocket(G);
  },
  async spin(G) {
    const target = Math.random() * 6 | 0, turns = 3 + Math.random() * 1.5 | 0;
    // segment i is centred at angle (i + .5)·60° from the top, so stop the wheel with that segment under the pointer
    const from = G.wheel.rotation.z % (Math.PI * 2), to = turns * Math.PI * 2 + (target + .5) * Math.PI / 3;
    let seg = -1;
    await tween(3.2, e => { G.wheel.rotation.z = from + (to - from) * e; const s = Math.floor(G.wheel.rotation.z / (Math.PI / 3)); if (s !== seg) { seg = s; S.tick(); } }, E.out);
    lastPrize = PRIZES[target];
    SFX.chime(); say('y_prize');
    rain(lastPrize);
    await sleep(1500);
  },
};

// prizes fall onto the table and bounce
const falling = [];
function rain(k) {
  for (let i = 0; i < 22; i++) {
    const p = makePrize(k); p.position.set(rand(-4.2, 4.2), rand(5.5, 9), rand(.4, 3)); p.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6)); p.scale.setScalar(1.3); stage.add(p);
    falling.push({ p, v: rand(-1, 0), spin: V3(rand(-3, 3), rand(-3, 3), rand(-3, 3)), t: 0, b: 0 });
  }
}
// a flock of dark bats (and two pink ones) sweeps across the cave
const flyers = [];
function flock() {
  const wingS = new THREE.Shape(); wingS.moveTo(0, .05); wingS.quadraticCurveTo(.3, .35, .6, .2); wingS.quadraticCurveTo(.5, .05, .55, -.05); wingS.quadraticCurveTo(.35, -.02, .3, -.15); wingS.quadraticCurveTo(.15, -.05, 0, -.08);
  const wg = new THREE.ShapeGeometry(wingS, 12);
  for (let i = 0; i < 18; i++) {
    const pink = i % 9 === 4, col = pink ? 0xd3849e : 0x2a2433;
    const fm = new THREE.MeshStandardMaterial({ color: col, roughness: .7, side: THREE.DoubleSide });
    const g = new THREE.Group(), body = mesh(new THREE.SphereGeometry(.14, 14, 10), fm, false); body.scale.y = 1.2; g.add(body);
    const wl = new THREE.Group(), wr = new THREE.Group(); wl.add(mesh(wg, fm, false)); wr.add(mesh(wg, fm, false)); wl.scale.x = -1; wl.position.x = -.08; wr.position.x = .08; g.add(wl, wr);
    [-1, 1].forEach(sd => { const e = mesh(new THREE.ConeGeometry(.05, .12, 8), fm, false); e.position.set(sd * .07, .18, 0); g.add(e); });
    const y = rand(2.5, 6), z = rand(-6, 0), sp_ = rand(4, 6.5), s = rand(.6, 1.1);
    g.scale.setScalar(s); g.position.set(-14 - rand(0, 6), y, z); stage.add(g);
    flyers.push({ g, wl, wr, sp: sp_, y, ph: rand(0, 6) });
  }
  SFX.whoosh(); setTimeout(SFX.squeak, 400); setTimeout(SFX.squeak, 900);
}

// ───────────────────────── input and frame ─────────────────────────
function down() {
  const hits = Object.values(gad).map(G => G.hit);
  const h = pick(hits); if (!h) return;
  lastTap = performance.now(); armHint();
  play(h.object.userData.k);
}
function armHint() {
  clearTimeout(hintT);
  hintT = setTimeout(() => {
    const left = CELLS.filter(k => !tried.has(k) && !gad[k].busy), k = left.length ? pickOne(left) : null;
    if (k) { const G = gad[k]; tween(.6, e => G.g.scale.setScalar(1 + Math.sin(e * Math.PI * 3) * .05)); burst(G.g.localToWorld(V3(0, 0, .6)), { n: 8, size: .3, speed: 1.2, up: .6, grav: -.5 }); }
    armHint();
  }, 9000);
}
function update(t, dt) {
  for (let i = falling.length - 1; i >= 0; i--) {
    const f = falling[i]; f.t += dt;
    f.v -= 9.8 * dt; f.p.position.y += f.v * dt;
    if (f.p.position.y < -.2) { f.p.position.y = -.2; if (f.b++ < 2) { f.v = -f.v * .35; if (f.b === 1) tone({ f: rand(500, 900), d: .05, v: .03, type: 'triangle' }); } else f.v = 0; f.spin.multiplyScalar(.5); }
    f.p.rotation.x += f.spin.x * dt; f.p.rotation.y += f.spin.y * dt; f.p.rotation.z += f.spin.z * dt;
    if (f.t > 4.5) { const s = Math.max(0, 1.3 * (1 - (f.t - 4.5) * 2)); f.p.scale.setScalar(Math.max(.001, s)); if (s <= 0) { f.p.removeFromParent(); falling.splice(i, 1); } }
  }
  for (let i = flyers.length - 1; i >= 0; i--) {
    const f = flyers[i]; f.g.position.x += f.sp * dt; f.g.position.y = f.y + Math.sin(t * 2 + f.ph) * .4;
    const a = Math.sin(t * 16 + f.ph) * .9; f.wl.rotation.y = a; f.wr.rotation.y = -a;
    if (f.g.position.x > 16) { f.g.removeFromParent(); flyers.splice(i, 1); }
  }
  // a lit bulb glows a little brighter and dimmer
  if (gad.lamp && gad.lamp.on) gad.lamp.light.intensity = 6 + Math.sin(t * 6) * .4;
}

export async function start() {
  setView({ x: 0, y: 1.8, z: -.2, w: 8.4, h: 5.4, pitch: .12, lift: .25 });
  hideDecor(); buildBoard();
  input.down = down; input.move = null; input.up = null;
  onFrame(update);
  progress(6, 0);
  if (TEST) window.__v2 = {
    get tried() { return [...tried]; }, get allDone() { return allDone; }, get lastPrize() { return lastPrize; }, get busy() { return CELLS.filter(k => gad[k].busy); },
    cellScreen: k => sp(gad[k].g.localToWorld(V3(0, 0, .4))), get falling() { return falling.length; }, get flyers() { return flyers.length; },
  };
  armHint();
  await sleep(500);
  say('y_intro');
}
