// Bat Cave 3D: the menu. A bat idles in the cave; tap a card to play. Hold the house button to come back.
import { BATS, makeBat, setView, TEST, $, audioOn } from './engine.js';

setView({ x: 0, y: 1.3, z: .8, w: 7.4, h: 5.3, pitch: .197, lift: .3 });
const menuBat = makeBat(BATS[0], { blobY: -.36 });
menuBat.base.set(0, 1.5, .25);
let started = false;

async function play(k) {
  if (started) return; started = true;
  audioOn();
  $('#menu').classList.add('hide'); $('#classic').style.display = 'none';
  menuBat.dispose();
  $('#home').style.display = '';
  const m = await import(`./games/${k}.js`);
  m.start();
}
document.querySelectorAll('#cards .card').forEach(c => c.addEventListener('click', () => play(c.dataset.g)));
if (/\/v2\/?/.test(location.pathname)) $('#classic').style.display = '';

// hold the house button for a second to return to the menu
{
  const h = $('#home'); let t = null;
  const down = () => { h.classList.add('hold'); t = setTimeout(() => location.reload(), 1000); };
  const up = () => { h.classList.remove('hold'); clearTimeout(t); };
  h.addEventListener('pointerdown', down); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => h.addEventListener(ev, up));
}
if (TEST) { window.__menu = { play }; const g = new URLSearchParams(location.hash.slice(1)).get('g'); if (g) play(g); }
