// Bat Doctor: listen to the heart, match the bandage to the scrape, tap to heal, and the bat flies home.
import {
  THREE, TEST, $, rand, clamp, V3, E, sleep, stage, camera, setView, heartTex, M, mesh, BATS, makeBat, makeSteth, makeBandage, makeTool,
  TABLE_Y, TOOL_Z, burst, confetti, tween, bez, SFX, say, MOUTH, onFrame, input, ray, pick, dragPlane, sp, progress, showAgain, isSpeaking,
} from '../engine.js';

// ───────────────────────── game flow ─────────────────────────
let bat = null, tools = [], phase = 'menu', round = 0, taps = 0, hintTimer = null;
const G = { get phase() { return phase; }, get round() { return round; } };

function clearTools() { tools.forEach(t => t.holder.removeFromParent()); tools = []; }
function popIn(T, delay = 0) {
  T.active = true; T.holder.scale.setScalar(.001);
  return sleep(delay).then(() => { SFX.pop(); return tween(.55, e => T.holder.scale.setScalar(Math.max(.001, e)), E.back); });
}
function popOut(T) { T.active = false; return tween(.35, e => T.holder.scale.setScalar(Math.max(.001, 1 - e)), E.io).then(() => { T.gone = true; T.holder.removeFromParent(); }); }
function sendHome(T) {
  const from = T.holder.position.clone(), rz = T.obj.rotation.z;
  return tween(.5, e => { T.holder.position.lerpVectors(from, T.home, e); T.obj.rotation.z = rz * (1 - e); T.obj.rotation.x = T.restTilt * e; T.holder.scale.setScalar(1.12 - .12 * e); }, E.back);
}
function armHint(fn) { clearTimeout(hintTimer); hintTimer = setTimeout(fn, 9000); }

async function playRound() {
  const cfg = BATS[round % BATS.length], kind = ['heart', 'star', 'circle'][round % 3];
  if (bat) bat.dispose();
  clearTools(); taps = 0;
  bat = makeBat(cfg, { scrape: kind }); bat.hurt = false;
  phase = 'intro';
  // fly in from the left, swooping past the lantern
  const p0 = V3(-10, 5, -4), p1 = V3(-3.5, 5.2, 1.5), p2 = V3(0, 1.62, .25);
  bat.flapSpeed = 13; bat.propSpeed = 22; bat.offset.set(0, 0, 0); bat.base.copy(p0); bat.last.copy(p0);
  SFX.whoosh(); setTimeout(SFX.squeak, 500);
  await tween(2.1, e => bat.base.copy(bez(p0, p1, p2, e)), E.out);
  bat.flapSpeed = 7; bat.propSpeed = 3;
  await squashHop(); bat.setMood('open'); SFX.squeak();
  await say('n_' + cfg.name); bat.setMood('happy');
  // stethoscope
  const st = makeTool('steth', makeSteth(), V3(-.7, TABLE_Y - .12, TOOL_Z)); tools.push(st);
  await popIn(st);
  phase = 'listen'; await say('listen');
  armHint(() => hint());
}
async function squashHop() {
  await tween(.14, e => bat.squash = -.12 * e);
  await tween(.4, e => bat.squash = -.12 * (1 - e) + Math.sin(e * Math.PI) * .1, E.out);
  bat.squash = 0;
}
function hint() {
  if (!['listen', 'bandage'].includes(phase) || drag) return armHint(hint);
  const right = tools.find(t => t.active && (phase === 'listen' ? t.kind === 'steth' : t.kind === bat.scrapeKind));
  if (right) { right.wiggle = 1.6; burst(right.holder.position.clone().add(V3(0, .4, 0)), { n: 10, size: .3, speed: 1.6, up: .8, grav: -1 }); }
  say(phase === 'listen' ? 'listen' : 'p_scrape'); armHint(hint);
}

async function onStethOnChest(T) {
  phase = 'busy'; clearTimeout(hintTimer); T.active = false; drag = null;
  const target = () => bat.worldOf(bat.chest).add(V3(0, 0, .22));
  const from = T.holder.position.clone();
  const rz0 = T.obj.rotation.z, s0 = T.holder.scale.x;
  await tween(.45, e => { T.holder.position.lerpVectors(from, target(), e); T.obj.rotation.x = 0; T.obj.rotation.z = rz0 + (-Math.PI / 2 - .2 - rz0) * e; T.holder.scale.setScalar(s0 + (.8 - s0) * e); }, E.out);
  bat.setMood('happy'); bat.bobAmt = .3; bat.flapAmp = .25;
  // four heartbeats: the heart glows and the bat swells a little with each one
  for (let i = 0; i < 4; i++) {
    SFX.beat();
    burst(bat.worldOf(bat.chest).add(V3(-.35, .25, .3)), { n: 1, tex: heartTex, color: 0xffffff, size: .55, speed: .3, up: 1.6, grav: 0, life: 1.4, additive: false });
    await tween(.2, e => { const k = Math.sin(e * Math.PI); bat.heart.material.opacity = .9 * k; bat.heartGlow.material.opacity = .85 * k; bat.heart.scale.setScalar(1 + .25 * k); bat.squash = .03 * k; T.holder.position.copy(target()); });
    await tween(.22, e => { const k = Math.sin(e * Math.PI) * .7; bat.heart.material.opacity = .9 * k; bat.heartGlow.material.opacity = .85 * k; bat.heart.scale.setScalar(1 + .2 * k); T.holder.position.copy(target()); });
    await sleep(380);
  }
  bat.squash = 0; bat.setMood('open'); SFX.giggle();
  await say('heartOk'); bat.setMood('happy');
  await popOut(T); bat.bobAmt = 1; bat.flapAmp = .42;
  // now the scrape
  bat.hurt = true; bat.setMood('worried'); bat.wobble = .06; bat.flapAmp = .16; bat.flapSpeed = 5;
  setTimeout(() => bat && (bat.wobble = 0), 600);
  SFX.boing();
  const kinds = ['heart', 'star', 'circle'].sort(() => Math.random() - .5);
  kinds.forEach((k, i) => { const T2 = makeTool(k, makeBandage(k), V3((i - 1) * 2.05, TABLE_Y + .08, TOOL_Z)); T2.obj.scale.setScalar(.82); tools.push(T2); });
  await Promise.all(tools.filter(t => !t.gone).map((t, i) => popIn(t, i * 160)));
  phase = 'bandage';
  await say('p_scrape');
  armHint(hint);
}
async function onWrongBandage(T) {
  T.active = false; drag = null; SFX.boing(); bat.wobble = .08; setTimeout(() => bat && (bat.wobble = 0), 500);
  const from = T.obj.rotation.z;
  await Promise.all([sendHome(T), tween(.5, e => T.obj.rotation.y = Math.sin(e * Math.PI * 4) * .5 * (1 - e))]);
  T.obj.rotation.z = from * 0; T.active = true;
  if (!isSpeaking()) say('wrong');
}
async function onRightBandage(T) {
  phase = 'busy'; clearTimeout(hintTimer); T.active = false; drag = null;
  const wing = bat.wings[1];
  wing.attach(T.holder);
  const p0 = T.holder.position.clone(), q0 = T.holder.quaternion.clone(), s0 = T.holder.scale.x, oz = T.obj.rotation.clone();
  const pEnd = bat.scrape.position.clone().add(V3(0, 0, .07)), qEnd = new THREE.Quaternion();
  await tween(.4, e => { T.holder.position.lerpVectors(p0, pEnd, e); T.holder.quaternion.slerpQuaternions(q0, qEnd, e); T.holder.scale.setScalar(s0 + (.64 - s0) * e); T.obj.rotation.set(oz.x * (1 - e), oz.y * (1 - e), oz.z * (1 - e)); }, E.out);
  bat.scrape.visible = false; bat.hurt = false;
  SFX.chime(); burst(bat.scrapeWorld(), { n: 30 });
  bat.setMood('open'); bat.flapAmp = .42; bat.flapSpeed = 7;
  await Promise.all(tools.filter(t => t !== T && !t.gone).map(popOut));
  await squashHop();
  await say('match');
  bat.setMood('happy'); phase = 'tap';
  await say('tap');
}
async function onBatTap() {
  if (phase === 'tap') {
    taps++; SFX.giggle(); bat.setMood('open'); bat.wobble = .07;
    burst(bat.root.position.clone().add(V3(0, 1, .6)), { n: 6, tex: heartTex, color: 0xffffff, size: .5, speed: 1.5, up: 2.2, grav: -.3, life: 1.6, additive: false });
    setTimeout(() => bat && (bat.wobble = 0), 400);
    squashHop();
    if (taps >= 3) { phase = 'busy'; await sleep(500); await flyHome(); }
    return;
  }
  if (phase === 'listen' || phase === 'bandage' || phase === 'end') { SFX.squeak(); bat.wobble = .05; setTimeout(() => bat && (bat.wobble = 0), 300); }
}
async function flyHome() {
  bat.setMood('open'); await say('healed');
  bat.flapSpeed = 14; bat.propSpeed = 30; SFX.whoosh(); setTimeout(SFX.squeak, 300);
  const start = bat.base.clone();
  // a happy loop-the-loop, then out through the cave mouth to the moon
  await tween(1.1, e => { const a = e * Math.PI * 2; bat.base.set(start.x + Math.sin(a) * 1.2, start.y + (1 - Math.cos(a)) * 1.1, start.z); bat.inner.rotation.x = -a; }, E.io);
  bat.inner.rotation.x = 0;
  const p0 = bat.base.clone(), p1 = V3(3.5, 5, -2), p2 = MOUTH.clone().add(V3(0, 0, -.5));
  await tween(2.2, e => { bat.base.copy(bez(p0, p1, p2, e)); bat.root.scale.setScalar(1 - e * .45); }, E.io);
  SFX.sparkle(); burst(MOUTH.clone().add(V3(0, 0, .6)), { n: 34, size: .6, speed: 3, color: 0xfff6c8 });
  bat.root.visible = false; bat.blob.visible = false;
  phase = 'end';
  await say('home');
  round++;
  progress(5, Math.min(5, round));
  if (round % 5 === 0) { confetti(V3(0, 2, 0)); await say('party'); }
  showAgain(playRound);
}


// ───────────────────────── input ─────────────────────────
let drag = null;
function down(e) {
  const live = tools.filter(t => t.active);
  const hit = live.length && pick(live.map(t => t.hit));
  if (hit && (phase === 'listen' || phase === 'bandage')) {
    const T = hit.object.userData.tool, at = dragPlane(T.holder.position), p = at();
    drag = { T, at, goal: (p || T.holder.position.clone()).add(V3(0, .35, 0)), id: e.pointerId };
    SFX.pick(); clearTimeout(hintTimer);
    return;
  }
  if (bat && bat.root.visible && pick(bat.meshes)) onBatTap();
}
function move(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const p = drag.at(); if (p) drag.goal.copy(p.add(V3(0, .35, 0)));
}
function up(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const T = drag.T; drag = null; armHint(hint);
  if (T.active) sendHome(T);
}
function checkSnap() {
  if (!drag) return;
  const T = drag.T, a = sp(T.holder.position), r = Math.min(innerWidth, innerHeight) * .13;
  if (phase === 'listen' && T.kind === 'steth') {
    const b = sp(bat.worldOf(bat.chest)); if (Math.hypot(a.x - b.x, a.y - b.y) < r) onStethOnChest(T);
  } else if (phase === 'bandage') {
    const b = sp(bat.scrapeWorld()); if (Math.hypot(a.x - b.x, a.y - b.y) < r) (T.kind === bat.scrapeKind ? onRightBandage : onWrongBandage)(T);
  }
}
function update(t, dt) {
  if (drag) {
    const T = drag.T, prev = T.holder.position.clone();
    T.holder.position.lerp(drag.goal, 1 - Math.exp(-dt * 22));
    const vx = (T.holder.position.x - prev.x) / Math.max(dt, 1e-3);
    T.obj.rotation.z += (clamp(-vx * .06, -.5, .5) - T.obj.rotation.z) * Math.min(1, dt * 10);
    T.obj.rotation.x += (0 - T.obj.rotation.x) * Math.min(1, dt * 10);
    T.holder.scale.setScalar(T.holder.scale.x + (1.12 - T.holder.scale.x) * Math.min(1, dt * 12));
    checkSnap();
  }
  tools.forEach(T => { if (!T.active) T.wiggle = 0; if (T.wiggle > 0) { T.wiggle -= dt; T.obj.rotation.z = Math.sin(t * 22) * .22 * Math.min(1, T.wiggle); if (T.wiggle <= 0) T.obj.rotation.z = 0; } });
  if (bat) bat.lookTarget = drag ? drag.T.holder.position : null;
}

export function start() {
  setView({ x: 0, y: 1.3, z: .8, w: 7.4, h: 5.3, pitch: .197, lift: .3 });
  // the exam cushion the bat hovers over
  const cushion = mesh(new THREE.CylinderGeometry(1.5, 1.55, .26, 64), M.cloth(0x5a86ad), true, true);
  cushion.position.set(0, -.23, .25); stage.add(cushion);
  const puff = mesh(new THREE.TorusGeometry(1.5, .14, 18, 72), M.cloth(0x4d779c), true, true);
  puff.rotation.x = Math.PI / 2; puff.position.set(0, -.2, .25); stage.add(puff);
  Object.assign(input, { down, move, up });
  onFrame(update);
  progress(5, 0);
  if (TEST) window.__v2 = {
    G, get bat() { return bat; }, get tools() { return tools; }, get drag() { return drag; },
    toolScreen: kind => { const T = tools.find(t => t.kind === kind && t.active); return T && sp(T.holder.position.clone()); },
    chestScreen: () => sp(bat.worldOf(bat.chest)), scrapeScreen: () => sp(bat.scrapeWorld()), batScreen: () => sp(bat.root.position.clone().add(V3(0, .1, 0))),
  };
  playRound();
}
