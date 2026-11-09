# Bat Cave

A small collection of toddler games. The start screen is a menu; in a game,
press and hold the 🏠 button (top left) for a second to come back to it.

## Bat Builder

Build a machine from a blueprint, then make it go. White outlines on blue
engineer's paper show where each big piece goes; drag them on (tapping a piece
makes its outline glow). When it's built, a control appears on the workbench:

1. Bat-mobile (body, 2 wheels): pull the lever and it drives off and back.
2. Windmill (tower, roof, sails): turn the crank and the sails turn with it.
3. Robot T-Rex (tail, legs, body, head): push the button and it chomps and roars.
4. Rocket (fins, body, nose, window with a bat inside): push the button for a countdown and blast-off.
5. Bat house (walls, chimney, roof, door): pull the lever and the lights come on and bats fly home.

The first two builds are always the bat-mobile and the windmill; the other three
are shuffled. A green arrow appears after the machine has run once, so the child
decides when to move on.

## Froggy Tag

A friendly maze chase. The maze walls are nature obstacles (streams, rows of
trees, rock piles and fallen logs), each with its own bump sound.

In short: Froggy wants to play tag. Drag anywhere on the maze and
the bat follows your finger along the paths, one square at a time; walls block
it (a little "boing"), a breadcrumb trail shows where it has been and every step
plays the next note of a tune. Five mazes grow from 3×3 to 6×4 (turned upright
when the tablet is), and from the second maze Froggy hops away once when the bat
gets close. If nothing happens for a few seconds, glowing stars show the next
steps. Catching Froggy fills a lily pad at the top.

## Bat Doctor

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
   Click **Try in game** at any point to play the real game with the takes
   recorded so far (preview mode; nothing is uploaded).
2. Click **Download all (zip)**, unzip, and put the `.wav` files in `voice-takes/`.
3. Run `bash tools/build-voices.sh` (needs ffmpeg). It writes `voice/<line>.mp3`
   and `voice/voices.json`.

Any line without a recording falls back to the device's built-in voice. The
line list in `studio.html` must match `LINES` in `index.html`.
