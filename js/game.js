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

  const BUBBLE_COUNT = 7;
  const bubbles = [];
  const particles = [];
  const rings = [];

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

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
      y: fromEdge ? H + r * 2 : rand(r, H - r),
      vx: rand(-0.4, 0.4),
      vy: rand(-0.5, -0.2),
      r,
      colorIndex,
      color: COLORS[colorIndex],
      // Wobble gives each bubble a gentle jellyfish breathe as it drifts.
      wobblePhase: rand(0, Math.PI * 2),
      wobbleSpeed: rand(0.02, 0.045),
      // Bubbles grow in rather than blink in.
      scale: fromEdge ? 1 : 0,
    };
    bubbles.push(b);
    if (fromEdge) PeckAudio.spawn();
  }

  for (let i = 0; i < BUBBLE_COUNT; i++) spawnBubble(false);

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
      const angle = (Math.PI * 2 * i) / count + rand(-0.25, 0.25);
      const speed = rand(1.5, 5);
      const sparkle = Math.random() < 0.45;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rand(0, 1),
        r: sparkle ? rand(4, 9) : rand(3, 7),
        color: sparkle && Math.random() < 0.5 ? '#ffffff' : color,
        life: 1,
        decay: rand(0.018, 0.032),
        sparkle,
        spin: rand(-0.15, 0.15),
        angle: rand(0, Math.PI * 2),
      });
    }
  }

  // Melody streak: pops within a few seconds of each other climb the
  // pentatonic ladder, so rapid pecking plays a rising song. The sky's
  // hue drifts along with the streak.
  const STREAK_WINDOW = 4000;
  let streak = 0;
  let lastPopTime = -Infinity;
  let hueShift = 0;

  function popBubble(b, index) {
    bubbles.splice(index, 1);
    const now = performance.now();
    if (now - lastPopTime > STREAK_WINDOW) streak = 0;
    streak++;
    lastPopTime = now;
    PeckAudio.pop(b.colorIndex, streak - 1);
    burst(b.x, b.y, b.color, 18);
    rings.push({ x: b.x, y: b.y, r: b.r * 0.6, max: b.r * 2.4, color: b.color, life: 1 });
    spawnBubble(true);
  }

  function handlePeck(x, y) {
    PeckAudio.unlock();
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
  // treat a swipe over a bubble as a peck too.
  const activePointers = new Set();

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    activePointers.add(e.pointerId);
    requestWakeLock();
    handlePeck(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (activePointers.has(e.pointerId)) handlePeck(e.clientX, e.clientY);
  });
  const releasePointer = (e) => activePointers.delete(e.pointerId);
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);

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

  function update() {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.wobblePhase += b.wobbleSpeed;
      b.x += b.vx + Math.sin(b.wobblePhase * 0.7) * 0.25;
      b.y += b.vy;
      if (b.scale < 1) b.scale = Math.min(1, b.scale + 0.04);
      // Bounce softly off the side walls.
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
      // Drift up and off the top, then float back in from the bottom.
      if (b.y < -b.r * 2) {
        b.y = H + b.r * 2;
        b.x = rand(b.r, W - b.r);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.07;
      p.angle += p.spin;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      ring.r += (ring.max - ring.r) * 0.14;
      ring.life -= 0.045;
      if (ring.life <= 0) rings.splice(i, 1);
    }

    if (butterfly) {
      const bf = butterfly;
      bf.x += bf.vx;
      bf.phase += 0.03;
      bf.wing += 0.35;
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
    hueShift += (hueTarget - hueShift) * 0.02;
  }

  function drawBubble(b) {
    const wob = 1 + Math.sin(b.wobblePhase) * 0.04;
    const rx = b.r * b.scale * wob;
    const ry = b.r * b.scale * (2 - wob);

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

  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, `hsl(${197 + hueShift}, 71%, 73%)`);
    sky.addColorStop(1, `hsl(${203 + hueShift}, 100%, 89%)`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

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

  function frame() {
    update();
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
