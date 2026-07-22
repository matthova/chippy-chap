// The human corner — a hidden settings panel opened by holding the
// bottom-right corner for three seconds. A pecking bird taps fast and
// moves a lot, so a long still press in one small corner is a
// human-only gesture. Settings persist in localStorage.

const PeckSettings = (() => {
  const KEY = 'peck-party-settings';
  const THEMES = ['day', 'sunset', 'twilight'];
  const DEFAULTS = { volume: 0.6, bubbles: 7, speed: 1, theme: 'day' };
  const values = { ...DEFAULTS };

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const k of Object.keys(DEFAULTS)) {
      if (typeof DEFAULTS[k] === 'number') {
        if (typeof saved[k] === 'number' && isFinite(saved[k])) values[k] = saved[k];
      } else if (k === 'theme' && THEMES.includes(saved[k])) {
        values[k] = saved[k];
      }
    }
  } catch (err) { /* private browsing etc. — defaults are fine */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(values)); } catch (err) { /* ignore */ }
  }

  function get(k) { return values[k]; }

  function set(k, v) {
    values[k] = v;
    save();
    if (k === 'volume') PeckAudio.setVolume(v);
  }

  // --- Panel wiring ---------------------------------------------------

  const panel = document.getElementById('settings');
  const inputs = {
    volume: document.getElementById('set-volume'),
    bubbles: document.getElementById('set-bubbles'),
    speed: document.getElementById('set-speed'),
  };

  for (const [k, input] of Object.entries(inputs)) {
    input.addEventListener('input', () => set(k, parseFloat(input.value)));
  }

  // Sync the audio engine with the persisted volume at startup.
  PeckAudio.setVolume(values.volume);

  const themeButtons = Array.from(document.querySelectorAll('.theme-btn'));
  function refreshThemeButtons() {
    for (const btn of themeButtons) {
      btn.classList.toggle('active', btn.dataset.theme === values.theme);
    }
  }
  for (const btn of themeButtons) {
    btn.addEventListener('click', () => {
      set('theme', btn.dataset.theme);
      refreshThemeButtons();
    });
  }

  function open() {
    for (const [k, input] of Object.entries(inputs)) input.value = values[k];
    refreshThemeButtons();
    panel.classList.remove('hidden');
  }

  function close() {
    panel.classList.add('hidden');
  }

  document.getElementById('settings-close').addEventListener('click', close);

  function isOpen() {
    return !panel.classList.contains('hidden');
  }

  // --- Long-press detection in the corner zone ------------------------

  const HOLD_MS = 3000;
  const ZONE = 96;      // px square in the bottom-right corner
  const SLOP = 24;      // max finger drift before the hold is cancelled
  let hold = null;

  window.addEventListener('pointerdown', (e) => {
    // Any new touch cancels an in-progress hold. This both fixes a timer
    // leak (overwriting `hold` orphaned its 3s timer, so a mashing parrot
    // could accidentally open the panel) and means the hold only completes
    // for a single, still, uninterrupted press — a human-only gesture.
    if (hold) {
      clearTimeout(hold.timer);
      hold = null;
    }
    if (isOpen()) return;
    const inZone = e.clientX > window.innerWidth - ZONE && e.clientY > window.innerHeight - ZONE;
    if (!inZone) return;
    hold = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      timer: setTimeout(() => { hold = null; open(); }, HOLD_MS),
    };
  });

  function cancelHold(e) {
    if (hold && hold.id === e.pointerId) {
      clearTimeout(hold.timer);
      hold = null;
    }
  }

  window.addEventListener('pointermove', (e) => {
    if (hold && hold.id === e.pointerId &&
        Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > SLOP) {
      cancelHold(e);
    }
  });
  window.addEventListener('pointerup', cancelHold);
  window.addEventListener('pointercancel', cancelHold);

  return { get, set, isOpen };
})();
