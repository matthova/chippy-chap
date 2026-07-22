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
      birth: performance.now(),
    };
    bubbles.push(b);
  }

  for (let i = 0; i < BUBBLE_COUNT; i++) spawnBubble(false);

  function popBubble(b, index) {
    bubbles.splice(index, 1);
    PeckAudio.pop(b.colorIndex);
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + rand(-0.2, 0.2);
      const speed = rand(1.5, 4.5);
      particles.push({
        x: b.x,
        y: b.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: rand(3, 7),
        color: b.color,
        life: 1,
      });
    }
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
      b.x += b.vx;
      b.y += b.vy;
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
      p.vy += 0.08;
      p.life -= 0.025;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawBubble(b) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();
    // A soft highlight so bubbles read as shiny and peckable.
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fill();
  }

  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#87ceeb');
    sky.addColorStop(1, '#c9ecff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    for (const b of bubbles) drawBubble(b);

    for (const p of particles) {
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
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
