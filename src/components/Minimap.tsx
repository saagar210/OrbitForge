import { useRef, useEffect } from "react";
import { useSimStore } from "../store";
import type { SimulationFrame } from "../types";

const SIZE = 200;
const PADDING = 20;

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<SimulationFrame | null>(null);

  // Update ref on every store change without causing effect re-runs
  useEffect(() => {
    return useSimStore.subscribe((s) => {
      frameRef.current = s.frame;
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let lastDraw = 0;

    const draw = (now: number) => {
      animId = requestAnimationFrame(draw);
      // Throttle to ~15fps
      if (now - lastDraw < 66) return;
      lastDraw = now;

      const frame = frameRef.current;

      ctx.fillStyle = "rgba(0, 8, 16, 0.85)";
      ctx.fillRect(0, 0, SIZE, SIZE);

      if (!frame || frame.bodies.length === 0) return;

      // Calculate bounds
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      for (const body of frame.bodies) {
        minX = Math.min(minX, body.position.x);
        maxX = Math.max(maxX, body.position.x);
        minY = Math.min(minY, body.position.y);
        maxY = Math.max(maxY, body.position.y);
      }

      const rangeX = Math.max(maxX - minX, 100);
      const rangeY = Math.max(maxY - minY, 100);
      const range = Math.max(rangeX, rangeY);
      const scale = (SIZE - PADDING * 2) / range;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      for (const body of frame.bodies) {
        const x = SIZE / 2 + (body.position.x - cx) * scale;
        const y = SIZE / 2 + (body.position.y - cy) * scale;
        const r = Math.max(2, body.radius * scale * 0.5);

        ctx.fillStyle = body.color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Border
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, SIZE, SIZE);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      className="absolute bottom-4 right-4 rounded-lg pointer-events-none"
    />
  );
}
