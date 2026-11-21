// Bat Cave 3D: the menu. A bat idles in the cave; tap a card to play. Tap the house button to come back.
import { BATS, makeBat, setView, TEST, $, audioOn, resetGame } from './engine.js';

let menuBat = null, playing = false, n = 0;
function showMenu() {
  setView({ x: 0, y: 1.3, z: .8, w: 7.4, h: 5.3, pitch: .197, lift: .3 });
  menuBat = makeBat(BATS[0], { blobY: -.36 }); menuBat.base.set(0, 1.5, .25);
  $('#menu').classList.remove('hide'); $('#home').style.display = 'none';
  if (/\/v2\/?/.test(location.pathname)) $('#classic').style.display = '';
  playing = false;
}
async function play(k) {
  if (playing) return; playing = true;
  audioOn();
  $('#menu').classList.add('hide'); $('#classic').style.display = 'none';
  if (menuBat) { menuBat.dispose(); menuBat = null; }
  $('#home').style.display = '';
  // a fresh copy of the game module each time, so it starts from scratch
  const m = await import(`./games/${k}.js?run=${++n}`);
  m.start();
}
function home() { if (!playing) return; resetGame(); showMenu(); }
document.querySelectorAll('#cards .card').forEach(c => c.addEventListener('click', () => play(c.dataset.g)));
$('#home').addEventListener('click', home);
showMenu();
if (TEST) { window.__menu = { play, home }; const g = new URLSearchParams(location.hash.slice(1)).get('g'); if (g) play(g); }
