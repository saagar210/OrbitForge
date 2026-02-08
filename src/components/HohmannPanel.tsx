import { useMemo } from "react";
import { useSimStore } from "../store";
import { computeHohmannTransfer } from "../utils/hohmannTransfer";
import type { CelestialBody } from "../types";

function useTwoBodies(): { inner: CelestialBody; outer: CelestialBody; central: CelestialBody } | null {
  return useSimStore((s) => {
    if (!s.frame || s.frame.bodies.length < 3) return null;

    // Find the most massive body as central
    const sorted = [...s.frame.bodies].sort((a, b) => b.mass - a.mass);
    const central = sorted[0];

    // Need at least two orbiting bodies
    const orbiters = sorted.slice(1);
    if (orbiters.length < 2) return null;

    // Use selected body as one, find nearest other orbiter
    const selected = s.selectedBodyId !== null
      ? orbiters.find((b) => b.id === s.selectedBodyId) ?? orbiters[0]
      : orbiters[0];

    const other = orbiters.find((b) => b.id !== selected.id) ?? orbiters[1];

    const r1 = Math.sqrt(
      (selected.position.x - central.position.x) ** 2 +
      (selected.position.y - central.position.y) ** 2 +
      (selected.position.z - central.position.z) ** 2,
    );
    const r2 = Math.sqrt(
      (other.position.x - central.position.x) ** 2 +
      (other.position.y - central.position.y) ** 2 +
      (other.position.z - central.position.z) ** 2,
    );

    const [inner, outer] = r1 < r2 ? [selected, other] : [other, selected];
    return { inner, outer, central };
  });
}

export function HohmannPanel() {
  const showHohmann = useSimStore((s) => s.showHohmann);
  const data = useTwoBodies();

  const result = useMemo(() => {
    if (!data) return null;
    const { inner, outer, central } = data;
    const r1 = Math.sqrt(
      (inner.position.x - central.position.x) ** 2 +
      (inner.position.y - central.position.y) ** 2 +
      (inner.position.z - central.position.z) ** 2,
    );
    const r2 = Math.sqrt(
      (outer.position.x - central.position.x) ** 2 +
      (outer.position.y - central.position.y) ** 2 +
      (outer.position.z - central.position.z) ** 2,
    );
    const mu = 100 * central.mass; // G * M
    return computeHohmannTransfer(r1, r2, mu, central.position.x, central.position.y);
  }, [data]);

  if (!showHohmann || !data || !result) return null;

  return (
    <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-3 text-white text-xs select-none border border-white/10 w-56">
      <div className="font-medium mb-2 text-white/80">Hohmann Transfer</div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-white/50">From</span>
          <span>{data.inner.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">To</span>
          <span>{data.outer.name}</span>
        </div>
        <div className="border-t border-white/10 pt-1 mt-1" />
        <div className="flex justify-between">
          <span className="text-white/50">Burn 1 dv</span>
          <span>{result.deltaV1.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Burn 2 dv</span>
          <span>{result.deltaV2.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span className="text-white/50">Total dv</span>
          <span>{result.totalDeltaV.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Transfer time</span>
          <span>{result.transferTime.toFixed(1)} ticks</span>
        </div>
      </div>
    </div>
  );
}
