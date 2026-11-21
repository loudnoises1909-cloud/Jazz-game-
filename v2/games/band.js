// Bat Band: five bats on a little stage. Tap a bat and it sings its note; play the xylophone, drum and maracas;
// tap the record player and everyone dances under the spotlights.
import {
  THREE, TEST, rand, V3, E, sleep, stage, setView, canvasTex, glowTex, sparkTex, woodTex, M, mesh, RoundedBoxGeometry, BATS, makeBat,
  burst, tween, SFX, tone, noise, say, onFrame, input, pick, sp, progress, musicLevel, getAudio,
} from '../engine.js';

const hz = n => 440 * Math.pow(2, n / 12);
const BAT_NOTES = [-7, -4, -2, 0, 3].map(hz);          // D4 F4 G4 A4 C5
const XYLO = [5, 8, 10, 12, 15, 17, 20, 22].map(hz);    // D5 F5 G5 A5 C6 D6 F6 G6
const BAR_COLS = [0xd63b2a, 0xe8822a, 0xf0b93a, 0x5aa33a, 0x2fa3a0, 0x2c5fbf, 0x4a3fa8, 0x8a3fa8];
let bats = [], bars = [], drum = null, shaker = null, player = null, spots = [], foot = [], sign = null;
let dancing = false, danceSaid = false, beatTimer = null, xyLast = -1, xyDown = false, hintT = null;
const G = { get dancing() { return dancing; } };

// ───────────────────────── sound ─────────────────────────
// a little sung "aah": a buzzy tone with vibrato through a vowel-shaped filter
function sing(f) {
  const { AC, master } = getAudio(); if (!AC) return;
  const t = AC.currentTime, o = AC.createOscillator(), o2 = AC.createOscillator(), lfo = AC.createOscillator(), lg = AC.createGain();
  const f1 = AC.createBiquadFilter(), f2 = AC.createBiquadFilter(), g = AC.createGain(), mix = AC.createGain();
  o.type = 'sawtooth'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 1.003;
  lfo.frequency.value = 5.5; lg.gain.value = f * .012; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  f1.type = 'bandpass'; f1.frequency.value = 800; f1.Q.value = 5; f2.type = 'bandpass'; f2.frequency.value = 1200; f2.Q.value = 6;
  o.connect(f1); o.connect(f2); o2.connect(mix); f1.connect(mix); f2.connect(mix); mix.connect(g); g.connect(master);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.22, t + .06); g.gain.setValueAtTime(.22, t + .4); g.gain.exponentialRampToValueAtTime(.001, t + .9);
  [o, o2, lfo].forEach(x => { x.start(t); x.stop(t + .95); });
}
const mallet = f => { tone({ f, d: .7, v: .16 }); tone({ f: f * 3.98, d: .08, v: .04 }); };
const boom = () => { tone({ f: 130, f2: 48, d: .4, v: .5 }); noise({ d: .15, v: .12, f1: 1800, f2: 600 }); };
const shake = () => { noise({ d: .09, v: .12, f1: 5000, f2: 7000 }); setTimeout(() => noise({ d: .09, v: .1, f1: 6000, f2: 5000 }), 110); };
// the dance track: kick, snare, bass and a hook, scheduled ahead on the audio clock
function startBeat() {
  const { AC } = getAudio(); if (!AC) return;
  const step = 60 / 116 / 2, bass = [-21, -21, -14, -14, -16, -16, -19, -19].map(hz), hook = [5, -1, 8, -1, 10, 8, 5, -1, 3, -1, 5, -1, 8, 5, 3, -1];
  let next = AC.currentTime + .05, i = 0;
  beatTimer = setInterval(() => {
    while (next < AC.currentTime + .3) {
      if (i % 4 === 0) tone({ f: 120, f2: 45, at: next, d: .22, v: .55 });
      if (i % 4 === 2) noise({ at: next, d: .12, v: .12, f1: 2400, f2: 1200 });
      if (i % 2 === 1) noise({ at: next, d: .04, v: .05, f1: 8000, f2: 9000 });
      if (i % 2 === 0) tone({ f: bass[(i / 2 | 0) % 8], at: next, d: .26, v: .14, type: 'triangle' });
      const h = hook[i % 16]; if (h >= 0) { tone({ f: hz(h), at: next, d: .3, v: .07 }); tone({ f: hz(h) * 3.98, at: next, d: .05, v: .02 }); }
      next += step; i++;
    }
  }, 60);
}
function stopBeat() { clearInterval(beatTimer); beatTimer = null; }

// ───────────────────────── the stage ─────────────────────────
const velvet = new THREE.MeshPhysicalMaterial({ color: 0x8e1a24, roughness: .85, sheen: 1, sheenColor: new THREE.Color(0xff7a7a), sheenRoughness: .5, side: THREE.DoubleSide, envMapIntensity: .2 });
const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: .3, envMapIntensity: 1 });
function curtain(w, h, folds, amp) {
  const g = new THREE.PlaneGeometry(w, h, 60, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x / w * Math.PI * 2 * folds) * amp); }
  g.computeVertexNormals(); return g;
}
function buildStage() {
  [-1, 1].forEach(sd => {
    const c = mesh(curtain(2.4, 7, 5, .16), velvet, true, false); c.position.set(sd * 5.0, 2.3, -.9); c.rotation.y = -sd * .25; stage.add(c);
    const tie = mesh(new THREE.TorusGeometry(.32, .06, 8, 24), gold); tie.position.set(sd * 4.6, 1.2, -.7); tie.rotation.y = Math.PI / 2; stage.add(tie);
  });
  const val = mesh(curtain(11, 1.1, 14, .1), velvet); val.position.set(0, 5.4, -.95); stage.add(val);
  const fr = mesh(new THREE.BoxGeometry(11, .06, .06), gold); fr.position.set(0, 4.85, -.88); stage.add(fr);
  // marquee sign with chasing bulbs
  const st = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#5e1016'; g.fillRect(0, 0, w, h); g.font = '700 84px Fredoka, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffd36a'; g.shadowColor = '#ff9a3a'; g.shadowBlur = 18; g.fillText('BAT BAND', w / 2, h / 2 + 4); });
  sign = new THREE.Group(); sign.position.set(0, 4.55, -.7); stage.add(sign);
  sign.add(mesh(new RoundedBoxGeometry(3.4, .85, .14, 3, .06), new THREE.MeshPhysicalMaterial({ color: 0x5e1016, roughness: .5, clearcoat: .5 })));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.1, .74), new THREE.MeshStandardMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: .9 })); face.position.z = .075; sign.add(face);
  sign.userData.bulbs = [];
  for (let i = 0; i < 22; i++) {
    const t = i / 22, per = 2 * (3.3 + .8), d = t * per; let x, y;
    if (d < 3.3) { x = -1.65 + d; y = .4; } else if (d < 4.1) { x = 1.65; y = .4 - (d - 3.3); } else if (d < 7.4) { x = 1.65 - (d - 4.1); y = -.4; } else { x = -1.65; y = -.4 + (d - 7.4); }
    const m = new THREE.MeshStandardMaterial({ color: 0xfff2c4, emissive: 0xffc860, emissiveIntensity: 2 });
    const b = mesh(new THREE.SphereGeometry(.045, 10, 8), m, false); b.position.set(x, y, .09); sign.add(b); sign.userData.bulbs.push(m);
  }
  // footlights along the front of the table
  for (let i = 0; i < 11; i++) { const m = new THREE.MeshStandardMaterial({ color: 0xfff2c4, emissive: 0xffb860, emissiveIntensity: 2.2 }); const b = mesh(new THREE.SphereGeometry(.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m, false); b.position.set(-4.2 + i * .84, -.37, 3.25); stage.add(b); foot.push(m); }
  // spotlights from above
  [[-3, 0xff8ad0], [0, 0xfff0c0], [3, 0x8ad0ff]].forEach(([x, c], i) => {
    const s = new THREE.SpotLight(c, i === 1 ? 30 : 0, 16, .32, .6, 1.4); s.position.set(x, 7.5, 3); s.target.position.set(x * .6, 1, -.4); stage.add(s); stage.add(s.target); spots.push(s);
  });
}
function buildInstruments() {
  // xylophone: eight bars on a wooden frame
  const xy = new THREE.Group(); xy.position.set(-1.0, -.2, 2.05); stage.add(xy);
  const frameM = new THREE.MeshPhysicalMaterial({ map: woodTex, color: 0x8a5a33, roughness: .5 });
  [-.32, .32].forEach(z => { const r = mesh(new RoundedBoxGeometry(3.4, .1, .12, 2, .03), frameM); r.position.set(0, -.05, z); xy.add(r); });
  XYLO.forEach((f, i) => {
    const len = .95 - i * .065, b = mesh(new RoundedBoxGeometry(.34, .09, len, 3, .03), new THREE.MeshPhysicalMaterial({ color: BAR_COLS[i], roughness: .25, clearcoat: .9 }));
    b.position.set(-1.45 + i * .41, .04, 0); xy.add(b); b.userData.i = i; bars.push(b);
    [-1, 1].forEach(sd => { const n = mesh(new THREE.SphereGeometry(.025, 8, 6), gold, false); n.position.set(b.position.x, .09, sd * len * .3); xy.add(n); });
  });
  // drum
  drum = new THREE.Group(); drum.position.set(1.65, -.37, 2.0); stage.add(drum);
  const shell = mesh(new THREE.CylinderGeometry(.48, .48, .5, 40, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xd63b2a, roughness: .3, clearcoat: .8, side: THREE.DoubleSide })); shell.position.y = .25; drum.add(shell);
  const head = mesh(new THREE.CircleGeometry(.47, 40), new THREE.MeshPhysicalMaterial({ color: 0xf6f0e0, roughness: .6 })); head.rotation.x = -Math.PI / 2; head.position.y = .5; drum.add(head); drum.userData.head = head;
  [.02, .48].forEach(y => { const r = mesh(new THREE.TorusGeometry(.49, .03, 8, 40), gold); r.rotation.x = Math.PI / 2; r.position.y = y; drum.add(r); });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, z = mesh(new THREE.CylinderGeometry(.012, .012, .5, 6), gold); z.position.set(Math.cos(a) * .5, .25, Math.sin(a) * .5); z.rotation.z = (i % 2 ? .5 : -.5); drum.add(z); }
  // maracas
  shaker = new THREE.Group(); shaker.position.set(-3.55, -.3, 2.1); stage.add(shaker);
  [[-.2, .3, 0xf0b93a], [.2, -.3, 0x2fa3a0]].forEach(([x, rz, c]) => {
    const m = new THREE.Group(); m.position.x = x; m.rotation.z = rz; shaker.add(m);
    const h = mesh(new THREE.SphereGeometry(.2, 24, 16), new THREE.MeshPhysicalMaterial({ color: c, roughness: .3, clearcoat: .8 })); h.scale.y = 1.2; h.position.y = .45; m.add(h);
    const st = mesh(new THREE.CylinderGeometry(.04, .05, .45, 10), new THREE.MeshPhysicalMaterial({ map: woodTex, color: 0xb07a4a })); st.position.y = .12; m.add(st);
  });
  shaker.rotation.x = -.5;
  // record player
  player = new THREE.Group(); player.position.set(3.55, -.37, 2.0); player.rotation.y = -.3; stage.add(player);
  player.add(mesh(new RoundedBoxGeometry(1.3, .32, 1.1, 3, .06), new THREE.MeshPhysicalMaterial({ map: woodTex, color: 0x9a6a3a, roughness: .45, clearcoat: .4 })));
  player.children[0].position.y = .16;
  const disc = new THREE.Group(); disc.position.set(-.12, .34, 0); player.add(disc);
  disc.add(mesh(new THREE.CylinderGeometry(.46, .46, .025, 48), new THREE.MeshPhysicalMaterial({ color: 0x141414, roughness: .25, clearcoat: 1 })));
  const lab = mesh(new THREE.CylinderGeometry(.14, .14, .03, 24), M.gloss(0xd63b2a, .4)); disc.add(lab);
  for (let i = 1; i < 5; i++) { const gr = mesh(new THREE.TorusGeometry(.16 + i * .065, .004, 4, 48), M.matte(0x2a2a2a, .4), false); gr.rotation.x = Math.PI / 2; gr.position.y = .014; disc.add(gr); }
  const arm = new THREE.Group(); arm.position.set(.48, .38, -.35); player.add(arm);
  const ab = mesh(new THREE.CylinderGeometry(.018, .018, .6, 8), M.metal(0xd9dde6)); ab.rotation.z = Math.PI / 2; ab.rotation.y = .7; ab.position.set(-.22, .02, .2); arm.add(ab);
  arm.add(mesh(new THREE.CylinderGeometry(.07, .07, .08, 16), M.metal(0xb8bcc6)));
  const btn = mesh(new THREE.CylinderGeometry(.07, .07, .04, 16), M.gloss(0x2fa3a0, .3)); btn.position.set(.45, .34, .35); player.add(btn);
  Object.assign(player.userData, { disc, arm });
}
function buildBats() {
  bats = BATS.map((cfg, i) => {
    const b = makeBat(cfg, { scale: .5, furN: .45, blobY: -.36 });
    b.base.set(-3.4 + i * 1.7, 1.35 + (i % 2) * .25, -.45); b.flapAmp = .18; b.flapSpeed = 5; b.bobAmt = .6;
    b.userData = { i, home: b.base.clone() };
    return b;
  });
}

// ───────────────────────── play ─────────────────────────
const noteTex = canvasTex(128, 128, g => {
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(46, 96, 22, 16, -.4, 0, 7); g.fill();
  g.fillRect(62, 22, 9, 76); g.beginPath(); g.moveTo(66, 22); g.quadraticCurveTo(100, 36, 96, 70); g.quadraticCurveTo(92, 48, 70, 44); g.fill();
});
function batSing(b) {
  const i = b.userData.i; sing(BAT_NOTES[i]);
  b.setMood('open'); clearTimeout(b.userData.t); b.userData.t = setTimeout(() => b.setMood('happy'), 700);
  const h = b.userData.home; tween(.45, e => { b.base.y = h.y + Math.sin(e * Math.PI) * .45; b.squash = Math.sin(e * Math.PI) * .08; });
  burst(b.root.position.clone().add(V3(.3, .7, .3)), { n: 1, tex: noteTex, color: [0xffd36a, 0xff8ad0, 0x8ad0ff, 0x9dff8a, 0xffa24f][i], size: .45, speed: .4, up: 1.4, grav: 0, life: 1.6, additive: false });
}
function hitBar(i) {
  if (i === xyLast) return; xyLast = i;
  mallet(XYLO[i]); const b = bars[i];
  tween(.25, e => b.position.y = .04 - Math.sin(e * Math.PI) * .04);
  burst(b.getWorldPosition(V3()).add(V3(0, .2, 0)), { n: 3, size: .18, speed: 1, up: 1, grav: -1, life: .6, color: BAR_COLS[i] });
}
async function toggleDance() {
  dancing = !dancing; SFX.pick();
  if (dancing) {
    startBeat(); spots.forEach(s => s.intensity = 30);
    bats.forEach(b => { b.flapAmp = .4; b.flapSpeed = 10; b.setMood('open'); });
    if (!danceSaid) { danceSaid = true; say('n_dance'); }
    progress(1, 1);
  } else {
    stopBeat(); spots.forEach((s, i) => s.intensity = i === 1 ? 30 : 0);
    bats.forEach(b => { b.flapAmp = .18; b.flapSpeed = 5; b.setMood('happy'); b.base.copy(b.userData.home); b.inner.rotation.y = 0; });
  }
}

// ───────────────────────── input and frame ─────────────────────────
function down(e) {
  armHint();
  const bh = pick(bars); if (bh) { xyDown = true; xyLast = -1; hitBar(bh.object.userData.i); return; }
  if (pick([drum], true)) { boom(); tween(.25, k => drum.userData.head.position.y = .5 - Math.sin(k * Math.PI) * .05); tween(.3, k => drum.scale.set(1 + Math.sin(k * Math.PI) * .06, 1 - Math.sin(k * Math.PI) * .05, 1 + Math.sin(k * Math.PI) * .06)); return; }
  if (pick([shaker], true)) { shake(); tween(.35, k => shaker.rotation.z = Math.sin(k * Math.PI * 4) * .35); return; }
  if (pick([player], true)) { toggleDance(); return; }
  for (const b of bats) if (pick(b.meshes)) { batSing(b); return; }
}
function move() { if (!xyDown) return; const bh = pick(bars); if (bh) hitBar(bh.object.userData.i); }
function up() { xyDown = false; xyLast = -1; }
function armHint() {
  clearTimeout(hintT);
  hintT = setTimeout(() => { if (!dancing) batSing(bats[Math.random() * bats.length | 0]); armHint(); }, 9000);
}
function update(t, dt) {
  // chasing sign bulbs and twinkling footlights
  sign.userData.bulbs.forEach((m, i) => m.emissiveIntensity = ((i + (t * (dancing ? 10 : 4) | 0)) % 3 === 0) ? 3 : .6);
  foot.forEach((m, i) => m.emissiveIntensity = dancing ? (((i + (t * 4 | 0)) % 2) ? 3 : .8) : 2.2);
  if (dancing) {
    player.userData.disc.rotation.y -= dt * 3.5;
    const beat = t * 116 / 60 * Math.PI;
    bats.forEach((b, i) => { const h = b.userData.home; b.base.y = h.y + Math.abs(Math.sin(beat + i * .7)) * .35; b.base.x = h.x + Math.sin(beat / 2 + i) * .15; b.inner.rotation.y = Math.sin(beat / 2 + i) * .5; });
    spots.forEach((s, i) => { s.target.position.x = Math.sin(t * (.8 + i * .3) + i * 2) * 3.5; s.target.position.y = 1 + Math.sin(t * 1.3 + i) * .6; });
  }
  bats.forEach(b => b.lookTarget = null);
}

export async function start() {
  setView({ x: 0, y: 1.55, z: .6, w: 9.0, h: 5.6, pitch: .2, lift: .25 });
  musicLevel(0);
  buildStage(); buildInstruments(); buildBats();
  Object.assign(input, { down, move, up });
  onFrame(update);
  progress(0, 0);
  if (TEST) window.__v2 = {
    G, batScreen: i => sp(bats[i].root.position.clone()), barScreen: i => sp(bars[i].getWorldPosition(V3())),
    drumScreen: () => sp(drum.position.clone().add(V3(0, .5, 0))), shakerScreen: () => sp(shaker.position.clone().add(V3(0, .35, 0))), playerScreen: () => sp(player.position.clone().add(V3(0, .3, 0))),
  };
  armHint();
  await sleep(600);
  say('n_intro');
}
