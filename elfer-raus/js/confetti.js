/* ============================================================
   confetti.js — the "colors blast" department.
   A tiny dependency-free canvas confetti engine.
   ============================================================ */

const Confetti = (() => {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let rafId = null;

  const PALETTE = ['#e94f4f', '#f4c531', '#3ecf6e', '#3f8ef7', '#ff5e7e', '#8f5eff', '#ffffff'];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function spawn(x, y, count, power) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 0.7 + 0.3) * power;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - power * 0.35,
        size: Math.random() * 7 + 4,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        life: 1,
        decay: Math.random() * 0.012 + 0.008,
        shape: Math.random() < 0.5 ? 'rect' : 'circle',
      });
    }
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0 && p.y < canvas.height + 40);
    for (const p of particles) {
      p.vy += 0.18;            // gravity
      p.vx *= 0.99;            // drag
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= p.decay;

      ctx.save();
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (particles.length) {
      rafId = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      rafId = null;
    }
  }

  return {
    /** Small pop — e.g. a card being played. */
    pop(x, y) {
      spawn(x ?? canvas.width / 2, y ?? canvas.height / 2, 26, 7);
    },
    /** Medium burst — e.g. a row being opened with an 11. */
    burst(x, y) {
      spawn(x ?? canvas.width / 2, y ?? canvas.height / 2, 70, 11);
    },
    /** Full celebration — somebody won. Fire EVERYTHING. */
    megaBlast() {
      const w = canvas.width, h = canvas.height;
      spawn(w * 0.5, h * 0.55, 130, 14);
      let i = 0;
      const interval = setInterval(() => {
        spawn(Math.random() * w, h * (0.25 + Math.random() * 0.5), 60, 12);
        if (++i >= 6) clearInterval(interval);
      }, 320);
    },
  };
})();
