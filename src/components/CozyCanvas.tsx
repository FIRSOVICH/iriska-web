import { useEffect, useRef } from 'react';
import { useTheme } from '../state/theme';

interface Props { mode: string; }

export default function CozyCanvas({ mode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { accent } = useTheme();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (mode === 'off') return;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    let raf: number;
    let W = 0, H = 0;
    type Particle = Record<string, number>;
    let parts: Particle[] = [];

    const resize = () => {
      W = cv.width  = cv.offsetWidth;
      H = cv.height = cv.offsetHeight;
      initParticles();
    };

    const counts: Record<string, number> = { rain:120, snow:80, fire:60, stars:200, soft:5 };

    function spawn(): Particle {
      switch (mode) {
        case 'rain':  return { x: Math.random()*W, y: Math.random()*H, v: 6+Math.random()*6, l: 8+Math.random()*10 };
        case 'snow':  return { x: Math.random()*W, y: Math.random()*H, v: .5+Math.random(), r: 1+Math.random()*2.5, dx: Math.random()-.5 };
        case 'fire':  return { x: W/2+(Math.random()-.5)*120, y: H, v: 1+Math.random()*2, r: 1+Math.random()*3, life: 1 };
        case 'stars': return { x: Math.random()*W, y: Math.random()*H, r: Math.random()*1.4, p: Math.random()*Math.PI*2 };
        case 'soft':  return { x: Math.random()*W, y: Math.random()*H, r: 120+Math.random()*160, dx: (Math.random()-.5)*.4, dy: (Math.random()-.5)*.4 };
        default:      return {};
      }
    }

    function initParticles() {
      parts = [];
      const n = reduce ? 0 : (counts[mode] || 0);
      for (let i = 0; i < n; i++) parts.push(spawn());
    }

    function frame() {
      ctx.clearRect(0, 0, W, H);

      if (mode === 'rain') {
        ctx.strokeStyle = 'rgba(150,180,220,.35)';
        ctx.lineWidth = 1;
        parts.forEach((p) => {
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y+p.l); ctx.stroke();
          p.y += p.v;
          if (p.y > H) { p.y = -p.l; p.x = Math.random()*W; }
        });
      } else if (mode === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,.82)';
        parts.forEach((p) => {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
          p.y += p.v; p.x += p.dx;
          if (p.y > H) { p.y = -5; p.x = Math.random()*W; }
        });
      } else if (mode === 'fire') {
        const g = ctx.createRadialGradient(W/2, H, 10, W/2, H, 220);
        g.addColorStop(0, 'rgba(224,145,60,.22)');
        g.addColorStop(1, 'rgba(224,145,60,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        parts.forEach((p) => {
          ctx.fillStyle = `rgba(255,${140+(Math.random()*80)|0},40,${p.life})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
          p.y -= p.v; p.life -= .012; p.x += (Math.random()-.5);
          if (p.life <= 0) Object.assign(p, spawn());
        });
      } else if (mode === 'stars') {
        parts.forEach((p) => {
          p.p += .03;
          const a = .3 + Math.abs(Math.sin(p.p))*.6;
          ctx.fillStyle = `rgba(255,250,230,${a})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
        });
      } else if (mode === 'soft') {
        ctx.globalCompositeOperation = 'lighter';
        parts.forEach((p, i) => {
          const col = i % 2 ? accent.c : accent.c2;
          const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          gr.addColorStop(0, col+'2A');
          gr.addColorStop(1, col+'00');
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
          p.x += p.dx; p.y += p.dy;
          if (p.x < -p.r) p.x = W+p.r;
          if (p.x > W+p.r) p.x = -p.r;
          if (p.y < -p.r) p.y = H+p.r;
          if (p.y > H+p.r) p.y = -p.r;
        });
        ctx.globalCompositeOperation = 'source-over';
      }

      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [mode, accent, reduce]);

  if (mode === 'off') return null;

  return (
    <canvas
      ref={canvasRef}
      className="cozy-canvas"
      style={{ opacity: mode === 'soft' ? 0.88 : 0.75 }}
    />
  );
}
