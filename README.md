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

- Single file: `index.html` (no build, no internet needed once loaded).
- Made for tablets and phones (touch), works with a mouse too.
- Voice: grown-ups press and hold the ⚙︎ button (top right) for ~2 seconds to
  record each line in their own voice. Recordings are stored on that device only
  (IndexedDB). Lines without a recording use the device's built-in voice.
- Recording needs the page served over `https://` (browsers block the microphone
  on files opened directly).
