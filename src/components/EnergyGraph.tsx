import { useRef, useEffect } from "react";
import { useSimStore } from "../store";

const WIDTH = 200;
const HEIGHT = 120;

export function EnergyGraph() {
  const show = useSimStore((s) => s.showEnergyGraph);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!show) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let lastDraw = 0;

    const draw = (now: number) => {
      animId = requestAnimationFrame(draw);
      if (now - lastDraw < 100) return; // ~10fps
      lastDraw = now;

      const history = useSimStore.getState().energyHistory;
      if (history.length < 2) return;

      ctx.fillStyle = "rgba(0, 8, 16, 0.9)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Find range
      let min = Infinity;
      let max = -Infinity;
      for (const e of history) {
        min = Math.min(min, e.kinetic, e.potential, e.total);
        max = Math.max(max, e.kinetic, e.potential, e.total);
      }
      const range = max - min || 1;
      const margin = range * 0.1;
      const yMin = min - margin;
      const yMax = max + margin;
      const yRange = yMax - yMin;

      const toX = (i: number) => (i / (history.length - 1)) * WIDTH;
      const toY = (v: number) => HEIGHT - ((v - yMin) / yRange) * HEIGHT;

      const drawLine = (key: "kinetic" | "potential" | "total", color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < history.length; i++) {
          const x = toX(i);
          const y = toY(history[i][key]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };

      drawLine("kinetic", "#44ff44");
      drawLine("potential", "#ff4444");
      drawLine("total", "#ffffff");

      // Legend
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "#44ff44";
      ctx.fillText("KE", 4, 12);
      ctx.fillStyle = "#ff4444";
      ctx.fillText("PE", 28, 12);
      ctx.fillStyle = "#ffffff";
      ctx.fillText("Total", 50, 12);

      // Border
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, WIDTH, HEIGHT);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [show]);

  if (!show) return null;

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      className="absolute bottom-4 left-4 rounded-lg pointer-events-none"
    />
  );
}
