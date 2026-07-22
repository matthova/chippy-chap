# Peck Party 🦜

A mobile-friendly browser game designed for a parrot to play, hosted on GitHub Pages.

## Design principles (why a parrot will like it)

- **Huge targets.** Parrots peck with a beak — a single hard point of contact. Every
  interactive object is large and forgiving (generous hit radius).
- **Instant reward.** Every peck produces an immediate sound + burst of color. Parrots
  are highly responsive to audio feedback and cause-and-effect play.
- **Pleasant sounds only.** All audio is synthesized on a pentatonic scale via the
  Web Audio API — chirps, whistles, and bells that can never clash. No audio assets,
  no loading, no jump scares.
- **No fail state.** Nothing bad can ever happen. No game over, no score pressure,
  no timers, no menus a bird can wander into.
- **Bold color & motion.** Saturated, high-contrast drifting orbs on a calm gradient
  sky — motion attracts attention, contrast makes targets obvious.
- **Static & offline-friendly.** Pure HTML/CSS/JS, no build step, no dependencies —
  drops straight onto GitHub Pages.

## Core plan

Build the playable core: a full-screen canvas of colorful drifting bubbles.
Pecking (tapping) a bubble pops it with a synthesized chirp and a particle burst,
and a new bubble floats in to replace it. Mobile viewport locked (no zoom, no
scroll, no text selection), multi-touch supported, works from a relative path so
GitHub Pages "just works."

Files: `index.html`, `style.css`, `js/audio.js`, `js/game.js`.

## Ten polish steps (one commit each)

1. **Bird-song audio engine.** Give each bubble color its own voice (chirp, whistle,
   bell, marimba) on a pentatonic scale, with subtle random detune so no two pops
   sound identical. Warm "bloop" spawn sounds.
2. **Visual juice.** Sparkle particle bursts, expanding ripple rings, soft glow and
   sheen on bubbles, squash-and-pop animation, gentle wobble while drifting.
3. **Parrot-proof input.** Generous hit-testing (nearest bubble within peck radius),
   rapid-peck and multi-touch handling, suppress double-tap zoom / pinch / context
   menu / selection, and request a screen Wake Lock so the screen never sleeps
   mid-play.
4. **Special guest: the butterfly.** Occasionally a butterfly flutters across the
   screen; pecking it plays a little melody flourish and a rainbow burst.
5. **Melody streaks.** Consecutive pops climb a pentatonic melody ladder, so fast
   pecking literally plays a song. The background hue drifts subtly with the streak.
6. **Attract mode.** After a stretch with no pecks, bubbles pulse and emit soft
   sparkles + quiet chirps to lure the parrot back to the screen.
7. **Human corner.** A hidden long-press (3s) settings panel for the human:
   volume, bubble count, drift speed, and color theme — impossible for a pecking
   bird to open by accident.
8. **Sky cycle themes.** Day / sunset / twilight jungle gradient skies with drifting
   clouds and stars, selectable from the human corner.
9. **Performance & battery.** Cap device-pixel-ratio, pool particles, pause the loop
   when the tab is hidden, keep per-frame allocations near zero — smooth on an old
   phone or tablet strapped to a cage.
10. **PWA + ship it.** Web app manifest + icon (installable, full-screen, no browser
    chrome), offline service worker with relative paths, README with tips for
    introducing the game to your parrot, and a GitHub Pages deploy workflow.
