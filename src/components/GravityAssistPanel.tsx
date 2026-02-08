import { useMemo } from "react";
import { useSimStore } from "../store";
import { computeGravityAssist, computeRelativeVelocity } from "../utils/gravityAssist";
import type { CelestialBody } from "../types";

function useAssistData(): { spacecraft: CelestialBody; target: CelestialBody } | null {
  return useSimStore((s) => {
    if (!s.frame || s.selectedBodyId === null) return null;
    const spacecraft = s.frame.bodies.find((b) => b.id === s.selectedBodyId);
    if (!spacecraft) return null;

    // Find nearest massive body (not the spacecraft itself)
    let nearest: CelestialBody | null = null;
    let nearestDist = Infinity;
    for (const b of s.frame.bodies) {
      if (b.id === spacecraft.id || b.mass <= spacecraft.mass) continue;
      const dx = b.position.x - spacecraft.position.x;
      const dy = b.position.y - spacecraft.position.y;
      const dz = b.position.z - spacecraft.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = b;
      }
    }

    if (!nearest) return null;
    return { spacecraft, target: nearest };
  });
}

export function GravityAssistPanel() {
  const showGravityAssist = useSimStore((s) => s.showGravityAssist);
  const data = useAssistData();

  const result = useMemo(() => {
    if (!data) return null;
    const { spacecraft, target } = data;

    const vInf = computeRelativeVelocity(spacecraft.velocity, target.velocity);
    if (vInf < 0.01) return null;

    const dx = spacecraft.position.x - target.position.x;
    const dy = spacecraft.position.y - target.position.y;
    const dz = spacecraft.position.z - target.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const rPeriapsis = Math.max(target.radius * 1.5, distance * 0.3);

    return {
      ...computeGravityAssist(vInf, rPeriapsis, target.mass),
      vInf,
      distance,
    };
  }, [data]);

  if (!showGravityAssist || !data || !result) return null;

  const deg = (result.deflectionAngle * 180) / Math.PI;

  return (
    <div className="absolute bottom-32 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-3 text-white text-xs select-none border border-white/10 w-56">
      <div className="font-medium mb-2 text-white/80">Gravity Assist</div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-white/50">Target</span>
          <span>{data.target.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Distance</span>
          <span>{result.distance.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">V-infinity</span>
          <span>{result.vInf.toFixed(2)}</span>
        </div>
        <div className="border-t border-white/10 pt-1 mt-1" />
        <div className="flex justify-between">
          <span className="text-white/50">Deflection</span>
          <span>{deg.toFixed(1)}&deg;</span>
        </div>
        <div className="flex justify-between font-medium">
          <span className="text-white/50">Delta-V gain</span>
          <span>{result.deltaV.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Periapsis</span>
          <span>{result.periapsis.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}
