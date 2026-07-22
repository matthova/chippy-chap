// Peck Party — a bubble-popping game for parrots.
// Big drifting bubbles; pecking one pops it with a chirp and a burst of color.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, DPR = 1;

  const COLORS = [
    '#ff4757', // red
    '#ffa502', // orange
    '#ffdd33', // yellow
    '#2ed573', // green
    '#1e90ff', // blue
    '#a55eea', // purple
    '#ff6b9d', // pink
    '#00d2d3', // teal
  ];

  // Sky themes. Hues are HSL triples so the melody-streak hue drift can
  // ride on top of any theme.
  const THEMES = {
    day:      { top: [197, 71, 73], bottom: [203, 100, 89], stars: false, cloud: 'rgba(255, 255, 255, 0.85)' },
    sunset:   { top: [265, 45, 48], bottom: [24, 100, 68],  stars: false, cloud: 'rgba(255, 214, 189, 0.75)' },
    twilight: { top: [232, 45, 16], bottom: [258, 38, 34],  stars: true,  cloud: null },
  };

  function currentThemeName() {
    const name = typeof PeckSettings !== 'undefined' ? PeckSettings.get('theme') : 'day';
    return THEMES[name] ? name : 'day';
  }

  // Clouds and stars are decorations regenerated on resize.
  const clouds = [];
  const stars = [];

  function makeDecorations() {
    clouds.length = 0;
    for (let i = 0; i < 4; i++) {
      const scale = rand(0.5, 1.1) * Math.min(W, H) / 6;
      const puffs = [];
      for (let j = 0; j < 5; j++) {
        puffs.push({
          dx: (j - 2) * scale * 0.55 + rand(-scale * 0.15, scale * 0.15),
          dy: rand(-scale * 0.2, scale * 0.2),
          r: scale * rand(0.45, 0.75) * (1 - Math.abs(j - 2) * 0.18),
        });
      }
      clouds.push({
        x: rand(0, W),
        y: rand(H * 0.05, H * 0.45),
        v: rand(0.08, 0.25),
        scale,
        puffs,
      });
    }
    stars.length = 0;
    for (let i = 0; i < 42; i++) {
      stars.push({
        x: rand(0, W),
        y: rand(0, H * 0.75),
        r: rand(0.8, 2.2),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.01, 0.04),
      });
    }
  }

  const BUBBLE_COUNT = 7; // fallback if settings are unavailable
  const bubbles = [];
  const particles = [];
  const particlePool = []; // recycled particle objects to avoid GC churn
  const rings = [];

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    makeDecorations();
  }
  window.addEventListener('resize', resize);

  function rand(a, b) { return a + Math.random() * (b - a); }

  function bubbleRadius() {
    // Bubbles scale with the screen but stay big enough for a beak:
    // roughly 1/6 of the shorter screen edge, never tiny.
    return Math.max(44, Math.min(W, H) / 6.5);
  }

  function spawnBubble(fromEdge) {
    const r = bubbleRadius() * rand(0.85, 1.15);
    const colorIndex = Math.floor(Math.random() * COLORS.length);
    const b = {
      x: rand(r, W - r),
      y: fromEdge ? H + r : rand(r, H - r),
      vx: rand(-0.4, 0.4),
      vy: rand(-0.5, -0.2),
      // Edge spawns swim up briskly until on screen, then drift normally —
      // otherwise a replacement can take tens of seconds to reappear.
      entryVy: fromEdge ? rand(-3.4, -2.4) : 0,
      entering: fromEdge,
      r,
      colorIndex,
      color: COLORS[colorIndex],
      // Wobble gives each bubble a gentle jellyfish breathe as it drifts.
      wobblePhase: rand(0, Math.PI * 2),
      wobbleSpeed: rand(0.02, 0.045),
      // Bubbles grow in rather than blink in.
      scale: fromEdge ? 1 : 0,
      // Attract-mode pulse, decays after each cue.
      pulse: 0,
    };
    bubbles.push(b);
    if (fromEdge) PeckAudio.spawn();
  }

  function targetBubbleCount() {
    return typeof PeckSettings !== 'undefined'
      ? Math.round(PeckSettings.get('bubbles'))
      : BUBBLE_COUNT;
  }

  function driftSpeed() {
    return typeof PeckSettings !== 'undefined' ? PeckSettings.get('speed') : 1;
  }

  // Initial layout must run after all decoration state above is declared.
  resize();

  for (let i = 0; i < targetBubbleCount(); i++) spawnBubble(false);

  // The butterfly: an occasional special guest that flutters across the
  // screen. Catching it earns a melody flourish and a rainbow burst.
  let butterfly = null;
  let nextButterflyAt = performance.now() + rand(15000, 30000);

  function spawnButterfly() {
    const fromLeft = Math.random() < 0.5;
    const size = bubbleRadius() * 0.65;
    butterfly = {
      x: fromLeft ? -size * 2 : W + size * 2,
      baseY: rand(H * 0.15, H * 0.6),
      y: 0,
      vx: (fromLeft ? 1 : -1) * rand(1.4, 2.2),
      size,
      phase: rand(0, Math.PI * 2),
      wing: rand(0, Math.PI * 2),
      hue: rand(0, 360),
    };
  }

  function catchButterfly() {
    PeckAudio.flourish();
    // Rainbow burst: sparkles in every bubble color.
    for (let i = 0; i < COLORS.length; i++) {
      burst(butterfly.x, butterfly.y, COLORS[i], 4);
    }
    rings.push({ x: butterfly.x, y: butterfly.y, r: butterfly.size, max: butterfly.size * 4, color: '#ffffff', life: 1 });
    butterfly = null;
    nextButterflyAt = performance.now() + rand(20000, 45000);
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      // Cap the particle population so a frenzy of pecks can't tank an
      // old tablet's frame rate.
      if (particles.length >= 280) return;
      const angle = (Math.PI * 2 * i) / count + rand(-0.25, 0.25);
      const speed = rand(1.5, 5);
      const sparkle = Math.random() < 0.45;
      const p = particlePool.pop() || {};
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - rand(0, 1);
      p.r = sparkle ? rand(4, 9) : rand(3, 7);
      p.color = sparkle && Math.random() < 0.5 ? '#ffffff' : color;
      p.life = 1;
      p.decay = rand(0.018, 0.032);
      p.sparkle = sparkle;
      p.spin = rand(-0.15, 0.15);
      p.angle = rand(0, Math.PI * 2);
      particles.push(p);
    }
  }

  // Melody streak: pops within a few seconds of each other climb the
  // pentatonic ladder, so rapid pecking plays a rising song. The sky's
  // hue drifts along with the streak.
  const STREAK_WINDOW = 4000;
  let streak = 0;
  let lastPopTime = -Infinity;
  let hueShift = 0;

  // Attract mode: after a quiet stretch, bubbles take turns pulsing and
  // shedding soft sparkles with a gentle chirp to lure the bird back.
  const ATTRACT_AFTER = 12000;
  let lastInteraction = performance.now();
  let nextAttractCue = 0;

  function popBubble(b, index) {
    bubbles.splice(index, 1);
    const now = performance.now();
    if (now - lastPopTime > STREAK_WINDOW) streak = 0;
    streak++;
    lastPopTime = now;
    PeckAudio.pop(b.colorIndex, streak - 1);
    burst(b.x, b.y, b.color, 18);
    rings.push({ x: b.x, y: b.y, r: b.r * 0.6, max: b.r * 2.4, color: b.color, life: 1 });
    // Replacement bubbles are spawned by the count reconciler in update().
  }

  function handlePeck(x, y) {
    PeckAudio.unlock();
    lastInteraction = performance.now();
    // The butterfly is the prize — check it first, with an extra-generous
    // hit radius since it moves.
    if (butterfly && Math.hypot(butterfly.x - x, butterfly.y - y) < butterfly.size * 1.8) {
      catchButterfly();
      return;
    }
    // Pop the bubble nearest the peck, with a forgiving hit radius.
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < b.r * 1.35 && d < bestDist) {
        best = i;
        bestDist = d;
      }
    }
    if (best >= 0) popBubble(bubbles[best], best);
  }

  // A parrot often drags its beak across the screen rather than tapping —
  // treat a swipe over a bubble as a peck too. Each active pointer tracks
  // where it last pecked so a still finger (micro-jitter during the human's
  // settings hold) doesn't machine-gun pops.
  const activePointers = new Map();

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    requestWakeLock();
    handlePeck(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointermove', (e) => {
    const last = activePointers.get(e.pointerId);
    if (!last) return;
    // A hovering mouse (button already released) must never peck.
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      activePointers.delete(e.pointerId);
      return;
    }
    if (Math.hypot(e.clientX - last.x, e.clientY - last.y) < 8) return;
    last.x = e.clientX;
    last.y = e.clientY;
    handlePeck(e.clientX, e.clientY);
  });

  // Release on window, not the canvas: when the settings overlay opens
  // beneath a held pointer, or a drag ends off-canvas, the canvas never
  // sees the pointerup and the id would stay stuck forever.
  const releasePointer = (e) => {
    activePointers.delete(e.pointerId);
    // Touch grants user activation on release, not press — unlocking here
    // guarantees the very first peck's audio starts as the beak lifts.
    PeckAudio.unlock();
  };
  window.addEventListener('pointerup', releasePointer);
  window.addEventListener('pointercancel', releasePointer);

  // Suppress every browser gesture a beak could trigger: double-tap zoom,
  // pinch zoom, long-press context menu, and legacy touch scrolling.
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('dblclick', (e) => e.preventDefault());
  window.addEventListener('gesturestart', (e) => e.preventDefault());
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  // Keep the screen awake while the bird plays. Wake locks are released by
  // the OS when the tab is hidden, so re-request on return.
  let wakeLock = null;
  async function requestWakeLock() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (err) {
      // Denied (e.g. low battery) — the game plays fine regardless.
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock();
  });
  // Wake locks need visibility, not a gesture — grab one at startup so the
  // tablet doesn't doze off before the bird ever gets its first peck in.
  requestWakeLock();

  // k is the timestep in units of a 60fps frame, so all motion tuned at
  // 60Hz runs the same speed on 120Hz phones and through jank.
  function update(k) {
    const spd = driftSpeed();

    // Keep the bubble population matched to the settings slider: spawn
    // replacements from the bottom edge, trim extras one per frame.
    const target = targetBubbleCount();
    if (bubbles.length < target) spawnBubble(true);
    else if (bubbles.length > target) bubbles.pop();

    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.wobblePhase += b.wobbleSpeed * k;
      b.x += (b.vx + Math.sin(b.wobblePhase * 0.7) * 0.25) * spd * k;
      if (b.entering && b.y < H - b.r * 1.4) b.entering = false;
      b.y += (b.entering ? b.entryVy : b.vy) * spd * k;
      if (b.scale < 1) b.scale = Math.min(1, b.scale + 0.04 * k);
      if (b.pulse > 0) b.pulse = Math.max(0, b.pulse - 0.015 * k);
      // Bounce softly off the side walls.
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
      // Drift up and off the top, then swim back in from the bottom.
      if (b.y < -b.r * 2) {
        b.y = H + b.r;
        b.x = rand(b.r, W - b.r);
        b.entering = true;
        b.entryVy = rand(-3.4, -2.4);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.vy += 0.07 * k;
      p.angle += p.spin * k;
      p.life -= p.decay * k;
      if (p.life <= 0) {
        // Swap-remove keeps this O(1); draw order of dots doesn't matter.
        particles[i] = particles[particles.length - 1];
        particles.pop();
        particlePool.push(p);
      }
    }

    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      ring.r += (ring.max - ring.r) * Math.min(0.14 * k, 1);
      ring.life -= 0.045 * k;
      if (ring.life <= 0) rings.splice(i, 1);
    }

    if (butterfly) {
      const bf = butterfly;
      bf.x += bf.vx * spd * k;
      bf.phase += 0.03 * k;
      bf.wing += 0.35 * k;
      bf.y = bf.baseY + Math.sin(bf.phase * 2.1) * H * 0.06 + Math.sin(bf.phase * 5.3) * 12;
      if ((bf.vx > 0 && bf.x > W + bf.size * 3) || (bf.vx < 0 && bf.x < -bf.size * 3)) {
        butterfly = null;
        nextButterflyAt = performance.now() + rand(15000, 35000);
      }
    } else if (performance.now() > nextButterflyAt) {
      spawnButterfly();
    }

    // Ease the sky hue toward the current streak, and let lapsed streaks
    // fade gracefully back to the base sky.
    if (performance.now() - lastPopTime > STREAK_WINDOW) streak = 0;
    const hueTarget = Math.min(streak, 15) * 9;
    hueShift += (hueTarget - hueShift) * Math.min(0.02 * k, 1);

    // Attract mode cues while the screen sits untouched. Only visible
    // bubbles are picked — a coo from an offscreen bubble just confuses.
    const now = performance.now();
    if (now - lastInteraction > ATTRACT_AFTER && now > nextAttractCue) {
      const visible = bubbles.filter((b) => b.y - b.r < H && b.y + b.r > 0);
      if (visible.length > 0) {
        const b = visible[Math.floor(Math.random() * visible.length)];
        b.pulse = 1;
        burst(b.x, b.y - b.r, b.color, 5);
        PeckAudio.coo();
        nextAttractCue = now + rand(2000, 3500);
      }
    }

    for (const c of clouds) {
      c.x += c.v * spd * k;
      if (c.x - c.scale * 2.5 > W) c.x = -c.scale * 2.5;
    }
    for (const s of stars) s.phase += s.speed * k;
  }

  function drawBubble(b) {
    const wob = 1 + Math.sin(b.wobblePhase) * 0.04;
    const pulseBoost = 1 + Math.sin(b.pulse * Math.PI) * 0.16;
    const rx = b.r * b.scale * wob * pulseBoost;
    const ry = b.r * b.scale * (2 - wob) * pulseBoost;

    ctx.save();
    ctx.translate(b.x, b.y);

    // Soft glow halo behind the bubble.
    const glow = ctx.createRadialGradient(0, 0, rx * 0.6, 0, 0, rx * 1.35);
    glow.addColorStop(0, b.color + '55');
    glow.addColorStop(1, b.color + '00');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, rx * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // Body: shaded sphere with a lit top-left.
    const body = ctx.createRadialGradient(-rx * 0.3, -ry * 0.35, rx * 0.1, 0, 0, rx);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.25, b.color);
    body.addColorStop(1, shade(b.color, -0.3));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crisp sheen streak.
    ctx.beginPath();
    ctx.ellipse(-rx * 0.38, -ry * 0.42, rx * 0.22, ry * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fill();

    ctx.restore();
  }

  // Darken or lighten a #rrggbb color by amount in [-1, 1].
  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clamp(((n >> 16) & 255) * (1 + amount));
    const g = clamp(((n >> 8) & 255) * (1 + amount));
    const bl = clamp((n & 255) * (1 + amount));
    return `rgb(${r},${g},${bl})`;
  }

  function drawSparkle(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    const r = p.r * p.life;
    // Four-pointed star.
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
    ctx.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
    ctx.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
    ctx.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r);
    ctx.fill();
    ctx.restore();
  }

  function drawButterfly(bf) {
    const flap = Math.sin(bf.wing);
    const s = bf.size;
    ctx.save();
    ctx.translate(bf.x, bf.y);
    if (bf.vx < 0) ctx.scale(-1, 1);
    ctx.rotate(Math.sin(bf.phase * 2.1) * 0.15);

    // Wings: two pairs of ellipses that fold with the flap.
    const wingScale = 0.35 + Math.abs(flap) * 0.65;
    const wingColor = `hsl(${bf.hue}, 90%, 65%)`;
    const wingColor2 = `hsl(${(bf.hue + 40) % 360}, 90%, 72%)`;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(1, side);
      ctx.fillStyle = wingColor;
      ctx.beginPath();
      ctx.ellipse(-s * 0.05, -s * 0.5 * wingScale, s * 0.55, s * 0.62 * wingScale, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = wingColor2;
      ctx.beginPath();
      ctx.ellipse(-s * 0.3, -s * 0.38 * wingScale, s * 0.34, s * 0.42 * wingScale, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Body and antennae.
    ctx.fillStyle = '#4a3728';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.5, s * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a3728';
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 0.45, side * s * 0.05);
      ctx.quadraticCurveTo(s * 0.75, side * s * 0.3, s * 0.85, side * s * 0.22);
      ctx.stroke();
    }
    ctx.restore();
  }

  // The sky gradient only changes when the theme, streak hue, or screen
  // height changes — cache it instead of rebuilding every frame.
  let skyKey = '';
  let skyGrad = null;

  function draw() {
    const themeName = currentThemeName();
    const theme = THEMES[themeName];
    const key = `${themeName}|${hueShift.toFixed(1)}|${H}`;
    if (key !== skyKey) {
      skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      const [th, ts, tl] = theme.top;
      const [bh, bs, bl] = theme.bottom;
      skyGrad.addColorStop(0, `hsl(${th + hueShift}, ${ts}%, ${tl}%)`);
      skyGrad.addColorStop(1, `hsl(${bh + hueShift}, ${bs}%, ${bl}%)`);
      skyKey = key;
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    if (theme.stars) {
      for (const s of stars) {
        ctx.globalAlpha = 0.35 + Math.abs(Math.sin(s.phase)) * 0.65;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = '#fff8e1';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (theme.cloud) {
      ctx.fillStyle = theme.cloud;
      for (const c of clouds) {
        for (const p of c.puffs) {
          ctx.beginPath();
          ctx.arc(c.x + p.dx, c.y + p.dy, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    for (const ring of rings) {
      ctx.globalAlpha = Math.max(ring.life, 0) * 0.7;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 4 * ring.life + 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const b of bubbles) drawBubble(b);

    if (butterfly) drawButterfly(butterfly);

    for (const p of particles) {
      ctx.globalAlpha = Math.max(p.life, 0);
      if (p.sparkle) {
        drawSparkle(p);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Run at the display's rate with delta-time, and stop entirely while
  // the tab is hidden to save battery.
  let rafId = null;
  let lastFrameTime = 0;

  function frame(t) {
    if (!lastFrameTime) lastFrameTime = t;
    // Clamp so a background stall doesn't produce one giant leap.
    const k = Math.min((t - lastFrameTime) / (1000 / 60), 3);
    lastFrameTime = t;
    update(k);
    draw();
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (rafId === null) {
      lastFrameTime = 0;
      rafId = requestAnimationFrame(frame);
    }
  });
})();
