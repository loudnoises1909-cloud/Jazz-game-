# Bat Doctor

A toddler game. Five pink bats (Doowy, Hoowy, Tooby, Boopy, Zoomy) each need the
doctor. Every visit follows the same routine:

1. Listen to the heart with the stethoscope.
2. Check the temperature with the thermometer.
3. Fix the problem with the right tool:
   - scrape → the bandage with the same shape and colour
   - bump on the head → ice bag
   - splinter → tweezers
   - hungry and weak (cold, tired heart) → shoe box, blanket, bottle of milk
4. Tap the bat 3 times to fill the stars, and it flies to its picture frame.

Heal all 5 to start the party. Drag a tool, or just tap it.

After healing, the bat flies home under the moon and a family postcard collects
in its frame. Holiday postcards (Halloween, Thanksgiving, Christmas, New Year,
Easter, 4th of July) are used when that holiday is close; otherwise everyday ones
(beach, camping, picnic, snow day, birthday, dinosaur museum, stargazing, rainy
day) are shuffled.

- The game is `index.html` (no build step). Made for tablets and phones (touch),
  works with a mouse too.
- Grown-ups: press and hold the ⚙︎ button (top right) for ~2 seconds for settings
  (sound effects, device voice, postcard theme).

## Recording the voice

The voice ships with the app; players never record anything.

1. Open `studio.html` from an `https://` address (or in Chrome on a computer) and
   record each of the 25 lines. Takes are trimmed and levelled automatically and
   kept in that browser until you download them.
2. Click **Download all (zip)**, unzip, and put the `.wav` files in `voice-takes/`.
3. Run `bash tools/build-voices.sh` (needs ffmpeg). It writes `voice/<line>.mp3`
   and `voice/voices.json`.

Any line without a recording falls back to the device's built-in voice. The
line list in `studio.html` must match `LINES` in `index.html`.
