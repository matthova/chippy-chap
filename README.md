# Peck Party 🦜

A bubble-popping game designed for a **parrot** to play on a phone or tablet.
Big drifting bubbles pop with cheerful synthesized chirps when pecked — no menus,
no score, no way to lose, nothing scary. Pure HTML/CSS/JS with zero dependencies,
built to be hosted on GitHub Pages.

## Play

Play the game [here](https://matthova.github.io/chippy-chap/)

Enable GitHub Pages for this repo (Settings → Pages → Source: **GitHub Actions**)
and the included workflow deploys `main` automatically. Then open the page on a
phone or tablet, tap once (the first tap unlocks audio), and hand it to the bird.

For the best experience, **Add to Home Screen** — the game installs as a
full-screen app with no browser chrome for the bird to peck.

## What's inside

- **Bubbles** drift and wobble; pecking one pops it with a pentatonic chirp,
  whistle, bell, or marimba note (each color has its own voice) and a sparkle burst.
- **Melody streaks** — rapid pecks climb the scale, so fast play sounds like a song.
- **A butterfly** flutters by now and then; catching it earns a rainbow flourish.
- **Attract mode** — after 12 quiet seconds, bubbles pulse and coo to invite the
  bird back.
- **Parrot-proofing** — multi-touch and beak-drag pecks work; pinch zoom,
  double-tap zoom, long-press menus, and scrolling are all suppressed; a Wake Lock
  keeps the screen on.
- **The human corner** — hold the bottom-right corner for 3 seconds to open
  settings: volume, bubble count, drift speed, and day/sunset/twilight skies.
- **Offline PWA** — a service worker caches everything, so it keeps working
  without a connection.

## Tips for introducing your parrot

1. Start with the volume around half and the drift speed low.
2. Play a round yourself while the bird watches — parrots learn by imitation.
3. Reward early pecks with praise or a treat so the screen becomes a happy place.
4. Use a sturdy stand or case; enthusiastic beaks are stronger than they look.
5. Wipe the screen often, and always supervise — screens are for play sessions,
   not for chewing.

## Develop

No build step. Serve the folder and open it:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

Icons are generated, not drawn: `node scripts/make-icons.mjs`.
