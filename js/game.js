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

  function popBubble(b, index) {
    bubbles.splice(index, 1);
    PeckAudio.pop(b.colorIndex);
    burst(b.x, b.y, b.color, 18);
    rings.push({ x: b.x, y: b.y, r: b.r * 0.6, max: b.r * 2.4, color: b.color, life: 1 });
    spawnBubble(true);
  }

  function handlePeck(x, y) {
    PeckAudio.unlock();
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

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handlePeck(e.clientX, e.clientY);
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

  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#87ceeb');
    sky.addColorStop(1, '#c9ecff');
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
