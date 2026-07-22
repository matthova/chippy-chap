// Peck Party audio — everything is synthesized with the Web Audio API.
// No assets, no loading. All pitches live on a pentatonic scale so any
// combination of pops sounds pleasant.

const PeckAudio = (() => {
  let ctx = null;
  let master = null;

  // C major pentatonic across two octaves — nothing here can sound sour.
  const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // A short cheerful chirp: a sine that sweeps up and rings out.
  function pop(noteIndex) {
    const c = ensureContext();
    if (!c) return;
    const now = c.currentTime;
    const freq = SCALE[((noteIndex % SCALE.length) + SCALE.length) % SCALE.length];

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.75, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.5, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Mobile browsers require a user gesture before audio can play; the game
  // calls this from the first peck.
  function unlock() {
    ensureContext();
  }

  return { pop, unlock };
})();
