// Peck Party audio — everything is synthesized with the Web Audio API.
// No assets, no loading. All pitches live on a pentatonic scale so any
// combination of pops sounds pleasant. Each bubble color has its own voice
// (chirp, whistle, bell, marimba), so the parrot learns that different
// colors make different sounds.

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

  function ready() {
    return ctx && ctx.state === 'running';
  }

  function note(index) {
    return SCALE[((index % SCALE.length) + SCALE.length) % SCALE.length];
  }

  // Small random detune keeps repeated pops from sounding machine-stamped.
  function detune(freq) {
    return freq * (1 + (Math.random() - 0.5) * 0.03);
  }

  function tone(freq, { type = 'sine', attack = 0.015, decay = 0.35, peak = 0.5, delay = 0 } = {}) {
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + attack + decay + 0.05);
    return osc;
  }

  // Voice 0 — chirp: a bright sine that swoops up and settles, like a budgie.
  function chirp(freq) {
    const now = ctx.currentTime;
    const osc = tone(freq, { peak: 0.5, decay: 0.3 });
    osc.frequency.setValueAtTime(freq * 0.7, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.05);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.11);
  }

  // Voice 1 — whistle: a longer, wavering note with vibrato.
  function whistle(freq) {
    const now = ctx.currentTime;
    const osc = tone(freq * 1.5, { peak: 0.35, attack: 0.03, decay: 0.5 });
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 7;
    lfoGain.gain.value = freq * 0.04;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + 0.6);
  }

  // Voice 2 — bell: a fundamental plus shimmering inharmonic partials.
  function bell(freq) {
    tone(freq, { peak: 0.4, decay: 0.6 });
    tone(freq * 2.4, { peak: 0.12, decay: 0.45 });
    tone(freq * 3.9, { peak: 0.06, decay: 0.3 });
  }

  // Voice 3 — marimba: short, woody, percussive.
  function marimba(freq) {
    tone(freq, { type: 'triangle', peak: 0.55, attack: 0.008, decay: 0.22 });
    tone(freq * 4, { type: 'sine', peak: 0.1, attack: 0.005, decay: 0.08 });
  }

  const VOICES = [chirp, whistle, bell, marimba];

  // Pop sound for a bubble: color decides the voice; the note can climb
  // with the player's streak so fast pecking plays a rising melody.
  function pop(colorIndex, noteIndex) {
    const c = ensureContext();
    if (!c) return;
    const voice = VOICES[((colorIndex % VOICES.length) + VOICES.length) % VOICES.length];
    voice(detune(note(noteIndex === undefined ? colorIndex : noteIndex)));
  }

  // A quiet, low "bloop" when a new bubble floats in. Only plays once the
  // context is unlocked — browsers block audio before the first gesture.
  function spawn() {
    if (!ready()) return;
    const now = ctx.currentTime;
    const osc = tone(120, { peak: 0.12, attack: 0.02, decay: 0.18 });
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);
  }

  // Celebration for catching the butterfly: a quick ascending pentatonic
  // arpeggio of bell tones.
  function flourish() {
    const c = ensureContext();
    if (!c) return;
    for (let i = 0; i < 5; i++) {
      const f = note(3 + i * 2);
      tone(f, { peak: 0.35, decay: 0.5, delay: i * 0.09 });
      tone(f * 2.4, { peak: 0.09, decay: 0.35, delay: i * 0.09 });
    }
  }

  // Mobile browsers require a user gesture before audio can play; the game
  // calls this from the first peck.
  function unlock() {
    ensureContext();
  }

  function setVolume(v) {
    if (!ctx) ensureContext();
    if (master) master.gain.value = Math.max(0, Math.min(1, v));
  }

  // A soft, quiet chirp used by attract mode to catch the bird's ear
  // without startling it. Skipped entirely until audio is unlocked.
  function coo() {
    if (!ready()) return;
    const now = ctx.currentTime;
    const freq = note(Math.floor(Math.random() * 5) + 3);
    const osc = tone(freq, { peak: 0.12, attack: 0.04, decay: 0.4 });
    osc.frequency.setValueAtTime(freq * 0.85, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.15);
  }

  return { pop, spawn, flourish, coo, unlock, setVolume, ready };
})();
