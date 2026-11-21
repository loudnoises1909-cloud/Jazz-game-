// Froggy Tag: a grassy maze diorama on the table. Hold a finger down and the bat steps towards it through the
// open paths; catch the frog on its lily pad. Five mazes, each a little bigger; from the second, Froggy hops away.
import {
  THREE, TEST, rand, clamp, V3, E, sleep, stage, setView, glowTex, sparkTex, M, mesh, RoundedBoxGeometry, BATS, makeBat,
  burst, confetti, tween, SFX, tone, noise, say, onFrame, input, floorPlane, sp, progress, showAgain, furShells, fbm,
} from '../engine.js';

const ROUNDS = 5, SIZES = [[3, 3], [4, 3], [4, 4], [5, 4], [6, 4]];
const DIRS = { n: [-1, 0], s: [1, 0], e: [0, 1], w: [0, -1] }, OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 783.99, 659.25, 587.33];
const TOP = -.37 + .14; // board surface height
let M_ = null, C = .85, cx0 = 0, cz0 = 1.1, board = null, bat = null, frog = null, pad = null;
let pos = [0, 0], frogAt = [0, 0], phase = 'idle', round = 0, finger = null, moving = false, hopped = false, steps = 0;
let stepT = 0, idleT = null, hintSaid = false, bumpAt = 0, trail = {}, hints = [];
const G = { get phase() { return phase; }, get round() { return round; } };
const pick = a => a[Math.random() * a.length | 0];

// ───────────────────────── maze logic (same rules as the 2D game) ─────────────────────────
function genMaze(cols, rows) {
  const c = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ n: 1, s: 1, e: 1, w: 1, v: 0, t: {} })));
  const stack = [[0, 0]]; c[0][0].v = 1;
  while (stack.length) {
    const [r, k] = stack[stack.length - 1], nb = [];
    for (const d in DIRS) { const nr = r + DIRS[d][0], nk = k + DIRS[d][1]; if (nr >= 0 && nr < rows && nk >= 0 && nk < cols && !c[nr][nk].v) nb.push([nr, nk, d]); }
    if (!nb.length) { stack.pop(); continue; }
    const [nr, nk, d] = pick(nb); c[r][k][d] = 0; c[nr][nk][OPP[d]] = 0; c[nr][nk].v = 1; stack.push([nr, nk]);
  }
  return { cols, rows, c };
}
const open = (r, k, d) => !M_.c[r][k][d];
function bfs(from) {
  const { rows, cols } = M_, dist = Array.from({ length: rows }, () => Array(cols).fill(-1)), prev = {};
  const q = [from]; dist[from[0]][from[1]] = 0;
  while (q.length) {
    const [r, k] = q.shift();
    for (const d in DIRS) { if (!open(r, k, d)) continue; const nr = r + DIRS[d][0], nk = k + DIRS[d][1]; if (dist[nr][nk] < 0) { dist[nr][nk] = dist[r][k] + 1; prev[nr + ',' + nk] = [r, k]; q.push([nr, nk]); } }
  }
  return { dist, prev };
}
function farthest(from) { const { dist } = bfs(from); let best = from, bd = -1; dist.forEach((row, r) => row.forEach((d, k) => { if (d > bd) { bd = d; best = [r, k]; } })); return best; }
const cellPos = (r, k, y = TOP) => V3(cx0 + (k - (M_.cols - 1) / 2) * C, y, cz0 + (r - (M_.rows - 1) / 2) * C);

// ───────────────────────── props ─────────────────────────
const rockGeos = Array.from({ length: 4 }, (_, j) => { const g = new THREE.SphereGeometry(1, 24, 16), p = g.attributes.position, v = V3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + (fbm(v.x * 1.5 + j * 3, v.y * 1.5, v.z * 1.5) - .5) * .6); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g; });
const leafGeo = (() => { const g = new THREE.SphereGeometry(1, 28, 20), p = g.attributes.position, v = V3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + (fbm(v.x * 2.5, v.y * 2.5, v.z * 2.5) - .5) * .45); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g; })();
const MAT = {
  rock: new THREE.MeshStandardMaterial({ color: 0x7a737c, roughness: .9, envMapIntensity: .2 }),
  leaf: new THREE.MeshPhysicalMaterial({ color: 0x3f7a35, roughness: .75, sheen: .6, sheenColor: new THREE.Color(0x9fd07a), envMapIntensity: .3 }),
  leaf2: new THREE.MeshPhysicalMaterial({ color: 0x4f8f3a, roughness: .75, sheen: .6, sheenColor: new THREE.Color(0xb8e08a), envMapIntensity: .3 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: .85 }),
  cut: new THREE.MeshStandardMaterial({ color: 0xc89a62, roughness: .8 }),
  water: new THREE.MeshPhysicalMaterial({ color: 0x3f8ccf, roughness: .06, clearcoat: 1, transparent: true, opacity: .85, envMapIntensity: 1.3 }),
  frame: new THREE.MeshPhysicalMaterial({ color: 0x7a4e2d, roughness: .55, clearcoat: .3, envMapIntensity: .4 }),
};
// one obstacle along a wall between two cells; `along` is the wall's direction (x or z)
function obstacle(type, p, along) {
  const g = new THREE.Group(); g.position.copy(p); if (along === 'z') g.rotation.y = Math.PI / 2;
  if (type === 'hedge') [-.32, 0, .32].forEach((x, i) => { const s = C * rand(.17, .22); const m = mesh(leafGeo, i % 2 ? MAT.leaf : MAT.leaf2); m.scale.set(s * 1.1, s * 1.05, s); m.position.set(x * C, s * .8, 0); m.rotation.y = rand(0, 6); g.add(m); });
  else if (type === 'rock') [-.25, .22].forEach(x => { const s = C * rand(.16, .22), m = mesh(pick(rockGeos), MAT.rock); m.scale.set(s * 1.2, s * .85, s); m.position.set(x * C, s * .5, rand(-.04, .04)); m.rotation.y = rand(0, 6); g.add(m); });
  else if (type === 'log') {
    const L = C * 1.02, r = C * .12, log = mesh(new THREE.CylinderGeometry(r, r * 1.05, L, 20), MAT.bark); log.rotation.z = Math.PI / 2; log.position.y = r; g.add(log);
    [-1, 1].forEach(sd => { const end = mesh(new THREE.CircleGeometry(r * .95, 20), MAT.cut, false); end.position.set(sd * (L / 2 + .002), r, 0); end.rotation.y = sd * Math.PI / 2; g.add(end); });
    const knot = mesh(new THREE.SphereGeometry(r * .3, 10, 8), MAT.bark); knot.position.set(C * .15, r * 1.9, 0); g.add(knot);
  } else if (type === 'water') {
    const w = mesh(new RoundedBoxGeometry(C * 1.02, .05, C * .3, 2, .02), MAT.water, false, true); w.position.y = .01; g.add(w);
    [-.3, .3].forEach(x => { const st = mesh(pick(rockGeos), MAT.rock); st.scale.set(.07, .04, .07); st.position.set(x * C, .03, C * .17 * (x > 0 ? 1 : -1)); g.add(st); });
  } else if (type === 'tree') {
    const trunk = mesh(new THREE.CylinderGeometry(C * .05, C * .07, C * .5, 12), MAT.bark); trunk.position.y = C * .25; g.add(trunk);
    [[0, .6, 0, .3], [-.12, .5, .05, .22], [.13, .52, -.04, .22]].forEach(([x, y, z, s], i) => { const m = mesh(leafGeo, i ? MAT.leaf2 : MAT.leaf); m.scale.setScalar(C * s); m.position.set(x * C, y * C, z * C); g.add(m); });
    [-.3, .3].forEach(x => { const s = C * .14, m = mesh(leafGeo, MAT.leaf); m.scale.set(s, s * .8, s); m.position.set(x * C, s * .6, 0); g.add(m); });
  }
  return g;
}
function makeFrog() {
  const f = new THREE.Group();
  const skin = new THREE.MeshPhysicalMaterial({ color: 0x4f9a3a, roughness: .35, clearcoat: .7, clearcoatRoughness: .25, sheen: .3, sheenColor: new THREE.Color(0xc8f0a0), envMapIntensity: .6 });
  const belly = new THREE.MeshPhysicalMaterial({ color: 0xd8e8a0, roughness: .5, clearcoat: .4 });
  const body = mesh(new THREE.SphereGeometry(.5, 40, 28), skin); body.scale.set(1.15, .78, 1); body.position.y = .38; f.add(body);
  const b2 = mesh(new THREE.SphereGeometry(.42, 32, 20), belly); b2.scale.set(1.05, .65, .7); b2.position.set(0, .3, .22); f.add(b2);
  [-1, 1].forEach(sd => {
    const thigh = mesh(new THREE.SphereGeometry(.24, 24, 16), skin); thigh.scale.set(.9, .7, 1.3); thigh.position.set(sd * .48, .2, -.05); f.add(thigh);
    const foot = mesh(new THREE.SphereGeometry(.14, 16, 10), skin); foot.scale.set(1.4, .35, 1.1); foot.position.set(sd * .5, .04, .28); f.add(foot);
    const arm = mesh(new THREE.SphereGeometry(.1, 14, 10), skin); arm.scale.set(.8, 1.4, .8); arm.position.set(sd * .3, .14, .38); f.add(arm);
    const eb = mesh(new THREE.SphereGeometry(.19, 28, 20), skin); eb.position.set(sd * .24, .72, .12); f.add(eb);
    const ew = mesh(new THREE.SphereGeometry(.15, 28, 20), new THREE.MeshPhysicalMaterial({ color: 0xf6f2e6, roughness: .06, clearcoat: 1 })); ew.position.set(sd * .25, .76, .2); f.add(ew);
    const pu = mesh(new THREE.SphereGeometry(.075, 16, 12), M.gloss(0x0c0808, .08)); pu.position.set(sd * .25, .77, .33); f.add(pu);
    const hl = mesh(new THREE.SphereGeometry(.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(sd * .25 + .03, .8, .39); f.add(hl);
    const ck = mesh(new THREE.SphereGeometry(.07, 12, 8), new THREE.MeshPhysicalMaterial({ color: 0xe8807a, roughness: .5 })); ck.scale.z = .3; ck.position.set(sd * .4, .42, .38); f.add(ck);
  });
  const smile = new THREE.CatmullRomCurve3([V3(-.32, .44, .42), V3(-.15, .36, .5), V3(0, .35, .52), V3(.15, .36, .5), V3(.32, .44, .42)]);
  f.add(mesh(new THREE.TubeGeometry(smile, 20, .022, 8), M.gloss(0x1f3a14, .4), false));
  return f;
}
function makePad() {
  const sh = new THREE.Shape(); sh.absarc(0, 0, .5, .35, Math.PI * 2 - .05, false); sh.lineTo(0, 0); sh.closePath();
  const m = mesh(new THREE.ExtrudeGeometry(sh, { depth: .03, bevelEnabled: true, bevelThickness: .01, bevelSize: .015, bevelSegments: 2, curveSegments: 40 }),
    new THREE.MeshPhysicalMaterial({ color: 0x3f8a3a, roughness: .4, clearcoat: .5, sheen: .5, sheenColor: new THREE.Color(0xa8e08a) }), false, true);
  m.rotation.x = -Math.PI / 2;
  const g = new THREE.Group(); g.add(m);
  const water = mesh(new THREE.CircleGeometry(.58, 40), MAT.water, false, true); water.rotation.x = -Math.PI / 2; water.position.y = -.005; g.add(water);
  const fl = mesh(new THREE.SphereGeometry(.08, 12, 8), new THREE.MeshPhysicalMaterial({ color: 0xf2a6c0, roughness: .4 })); fl.position.set(.28, .06, -.18); fl.scale.y = .6; g.add(fl);
  return g;
}

// ───────────────────────── a board for one round ─────────────────────────
function buildBoard() {
  if (board) board.removeFromParent();
  board = new THREE.Group(); stage.add(board);
  const { cols, rows } = M_, W = cols * C, D = rows * C;
  // wooden tray with grass growing in it
  const tray = mesh(new RoundedBoxGeometry(W + .36, .2, D + .36, 3, .06), MAT.frame, true, true); tray.position.set(cx0, TOP - .1, cz0); board.add(tray);
  const soil = mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0x3d5a24, roughness: 1 }), false, true); soil.rotation.x = -Math.PI / 2; soil.position.set(cx0, TOP + .002, cz0); board.add(soil);
  const gg = new THREE.PlaneGeometry(W, D, 1, 1); gg.rotateX(-Math.PI / 2);
  const grass = furShells(gg, 0x5c9a3e, { n: 14, len: .09, den: W / 7, droop: 0, root: .45, tip: 1.2 }); grass.position.set(cx0, TOP + .004, cz0); board.add(grass);
  // obstacles on the inside walls; the tray frame is the outside wall
  const types = ['hedge', 'rock', 'log', 'water', 'tree'];
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const cell = M_.c[r][k];
    if (k < cols - 1 && cell.e) { const t = pick(types); cell.t.e = t; M_.c[r][k + 1].t.w = t; board.add(obstacle(t, cellPos(r, k).add(V3(C / 2, 0, 0)), 'z')); }
    if (r < rows - 1 && cell.s) { const t = pick(types); cell.t.s = t; M_.c[r + 1][k].t.n = t; board.add(obstacle(t, cellPos(r, k).add(V3(0, 0, C / 2)), 'x')); }
  }
  // a few flowers in the grass
  for (let i = 0; i < cols * rows; i++) { const f = mesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshPhysicalMaterial({ color: pick([0xf0b93a, 0xffffff, 0xe8807a]), roughness: .5 }), false); f.position.set(cx0 + rand(-W / 2, W / 2) * .95, TOP + .09, cz0 + rand(-D / 2, D / 2) * .95); board.add(f); }
  trail = {}; hints = [];
  board.scale.setScalar(.001);
}
const trailMat = new THREE.MeshBasicMaterial({ color: 0xfff2c4, transparent: true, opacity: .7 });
function trailDot(r, k) {
  if (trail[r + ',' + k]) return;
  const d = new THREE.Mesh(new THREE.CircleGeometry(.07, 16), trailMat); d.rotation.x = -Math.PI / 2; d.position.copy(cellPos(r, k, TOP + .1)); board.add(d); trail[r + ',' + k] = d;
}

// ───────────────────────── rounds ─────────────────────────
async function startRound() {
  phase = 'intro'; hopped = false; steps = 0; finger = null; hintSaid = hintSaid && round > 0;
  let [cols, rows] = SIZES[round];
  if (innerHeight > innerWidth) [cols, rows] = [rows, cols];
  C = Math.min(.9, 7.4 / cols, 4.0 / rows);
  let tries = 0;
  do { M_ = genMaze(cols, rows); pos = [0, 0]; frogAt = farthest([0, 0]); tries++; }
  while (bfs([0, 0]).dist[frogAt[0]][frogAt[1]] < Math.max(3, cols + rows - 2) && tries < 40);
  setView({ x: 0, y: TOP, z: cz0 + .1, w: cols * C + .55, h: rows * C * .82 + .75, pitch: .95, lift: .1 });
  buildBoard();
  // the bat: small, so it fits a maze cell
  if (bat) bat.dispose();
  bat = makeBat(BATS[round % BATS.length], { scale: C * .3, furN: .4, blobY: TOP + .02 });
  bat.base.copy(cellPos(0, 0, TOP + C * .48)); bat.flapAmp = .3; bat.flapSpeed = 9; bat.bobAmt = .4;
  bat.root.visible = false;
  if (!frog) { frog = makeFrog(); pad = makePad(); stage.add(pad); stage.add(frog); }
  const s = C * .62; frog.scale.setScalar(s); pad.scale.setScalar(C * .95);
  pad.position.copy(cellPos(frogAt[0], frogAt[1], TOP + .1)); frog.position.copy(pad.position).add(V3(0, .02, 0)); frog.rotation.y = 0;
  SFX.whoosh();
  await tween(.6, e => board.scale.setScalar(Math.max(.001, e)), E.back);
  // the board grows in place: scale it around its own centre
  bat.root.visible = true; trailDot(0, 0);
  ribbit();
  phase = 'play';
  say(round === 0 ? 'm_intro' : 'm_next');
  armIdle();
}
function ribbit() { tone({ f: 190, f2: 120, type: 'square', d: .12, v: .05 }); setTimeout(() => tone({ f: 170, f2: 110, type: 'square', d: .14, v: .05 }), 150); }
function bump(type) {
  if (type === 'rock') tone({ f: 110, f2: 60, d: .18, v: .3 });
  else if (type === 'log') { tone({ f: 260, f2: 180, type: 'triangle', d: .1, v: .2 }); }
  else if (type === 'water') noise({ d: .3, v: .14, f1: 2400, f2: 600 });
  else noise({ d: .22, v: .1, f1: 900, f2: 2200 });
}
function armIdle() {
  clearTimeout(idleT);
  idleT = setTimeout(() => {
    if (phase === 'play') { showHint(); if (!hintSaid) { hintSaid = true; say('m_hint'); } armIdle(); }
  }, 8000);
}
function showHint() {
  const { prev } = bfs(pos), path = []; let cur = frogAt;
  while (cur && !(cur[0] === pos[0] && cur[1] === pos[1])) { path.unshift(cur); cur = prev[cur[0] + ',' + cur[1]]; }
  path.slice(0, 3).forEach(([r, k], i) => setTimeout(() => burst(cellPos(r, k, TOP + .25), { n: 8, size: .3, speed: .8, up: .8, grav: -.6, life: 1.6, color: 0xffe08a }), i * 250));
}
async function step() {
  if (phase !== 'play' || moving || !finger) return;
  const [br, bk] = pos, [fr, fk] = finger;
  if (br === fr && bk === fk) return;
  const dr = fr - br, dk = fk - bk, opts = [];
  if (dr) opts.push([dr > 0 ? 's' : 'n', Math.abs(dr)]);
  if (dk) opts.push([dk > 0 ? 'e' : 'w', Math.abs(dk)]);
  opts.sort((a, b) => b[1] - a[1]);
  const go = opts.find(([d]) => open(br, bk, d));
  if (!go) {
    if (performance.now() - bumpAt > 700) { bumpAt = performance.now(); bat.wobble = .1; setTimeout(() => bat && (bat.wobble = 0), 300); bump(M_.c[br][bk].t[opts[0][0]]); }
    return;
  }
  const d = go[0], nr = br + DIRS[d][0], nk = bk + DIRS[d][1];
  moving = true; pos = [nr, nk];
  tone({ f: NOTES[steps++ % NOTES.length], d: .16, v: .1, type: 'triangle' });
  armIdle();
  const from = bat.base.clone(), to = cellPos(nr, nk, TOP + C * .48);
  await tween(.22, e => { bat.base.lerpVectors(from, to, e); bat.base.y += Math.sin(e * Math.PI) * C * .25; }, E.io);
  trailDot(nr, nk); moving = false;
  if (nr === frogAt[0] && nk === frogAt[1]) { caught(); return; }
  const near = bfs(pos).dist[frogAt[0]][frogAt[1]];
  if (!hopped && round > 0 && near > 0 && near <= 2) frogHop();
}
async function frogHop() {
  hopped = true; phase = 'hop';
  const to = farthest(pos);
  if (to[0] === frogAt[0] && to[1] === frogAt[1]) { phase = 'play'; return; }
  ribbit(); say('m_hop');
  frogAt = to;
  const a = frog.position.clone(), b = cellPos(to[0], to[1], TOP + .12), pa = pad.position.clone(), pb = cellPos(to[0], to[1], TOP + .1);
  await tween(.8, e => { frog.position.lerpVectors(a, b, e); frog.position.y += Math.sin(e * Math.PI) * C * 1.4; pad.position.lerpVectors(pa, pb, e); frog.rotation.y = e * Math.PI * 2; }, E.io);
  frog.rotation.y = 0; phase = 'play';
}
async function caught() {
  phase = 'caught'; clearTimeout(idleT);
  const c = frog.position.clone().add(V3(0, C * .5, 0));
  burst(c, { n: 26, size: .3 }); SFX.chime(); SFX.giggle(); setTimeout(ribbit, 350);
  tween(.6, e => { frog.position.y = TOP + .12 + Math.abs(Math.sin(e * Math.PI * 2)) * C * .5; });
  bat.setMood('open'); bat.wobble = .08; setTimeout(() => { if (bat) { bat.wobble = 0; bat.setMood('happy'); } }, 900);
  round++; progress(ROUNDS, round);
  await say(pick(['m_caught1', 'm_caught2']));
  await sleep(300);
  if (round >= ROUNDS) {
    phase = 'party'; confetti(c, 60); SFX.chime(); await say('m_party');
    showAgain(async () => { round = 0; progress(ROUNDS, 0); await shrink(); startRound(); });
    return;
  }
  await shrink();
  startRound();
}
async function shrink() { bat.root.visible = false; await tween(.45, e => board.scale.setScalar(Math.max(.001, 1 - e))); }

// ───────────────────────── input ─────────────────────────
let at = null;
function cellAt() {
  const p = at && at(); if (!p) return null;
  const k = Math.round((p.x - cx0) / C + (M_.cols - 1) / 2), r = Math.round((p.z - cz0) / C + (M_.rows - 1) / 2);
  return [clamp(r, 0, M_.rows - 1), clamp(k, 0, M_.cols - 1)];
}
function down(e) { at = floorPlane(TOP); finger = cellAt(); stepT = 0; armIdle(); }
function move(e) { if (finger) finger = cellAt(); }
function up(e) { finger = null; }
function update(t, dt) {
  if (finger && phase === 'play' && (stepT -= dt) <= 0) { stepT = .16; step(); }
  if (board) board.position.set(cx0 * (1 - board.scale.x), TOP * (1 - board.scale.y), cz0 * (1 - board.scale.z));
  if (frog && phase !== 'hop' && phase !== 'caught') { frog.scale.y = C * .62 * (1 + Math.sin(t * 3) * .03); }
  if (bat) bat.lookTarget = frog ? frog.position.clone().add(V3(0, C * .4, 0)) : null;
}

export function start() {
  Object.assign(input, { down, move, up });
  onFrame(update);
  progress(ROUNDS, 0);
  if (TEST) window.__v2 = {
    G, get pos() { return pos; }, get frogAt() { return frogAt; },
    cellScreen: (r, k) => sp(cellPos(r, k)),
    path: () => { const { prev } = bfs(pos), out = []; let cur = frogAt; while (cur && !(cur[0] === pos[0] && cur[1] === pos[1])) { out.unshift(cur); cur = prev[cur[0] + ',' + cur[1]]; } return out; },
  };
  startRound();
}
