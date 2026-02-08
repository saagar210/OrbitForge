import { useMemo } from "react";
import { useSimStore } from "../store";
import { computeOrbitalElements, findDominantBody } from "../utils/orbitalMechanics";

const G = 100.0; // Must match Rust simulation constant

function formatNum(n: number): string {
  if (!isFinite(n)) return "\u221E";
  if (Math.abs(n) >= 1e6) return n.toExponential(2);
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

export function OrbitalElementsHUD() {
  const show = useSimStore((s) => s.showOrbitalElements);
  const selectedBodyId = useSimStore((s) => s.selectedBodyId);
  const frame = useSimStore((s) => s.frame);

  const elements = useMemo(() => {
    if (!frame || selectedBodyId === null) return null;
    const body = frame.bodies.find((b) => b.id === selectedBodyId);
    if (!body || body.is_fixed) return null;

    const dominant = findDominantBody(body.id, body.position, frame.bodies, G);
    if (!dominant) return null;

    return computeOrbitalElements(body.position, body.velocity, dominant.position, dominant.mass, G);
  }, [frame, selectedBodyId]);

  if (!show || !elements) return null;

  const rows = [
    ["Semi-major axis", formatNum(elements.semiMajorAxis)],
    ["Eccentricity", formatNum(elements.eccentricity)],
    ["Inclination", `${(elements.inclination * 180 / Math.PI).toFixed(1)}\u00B0`],
    ["Period", formatNum(elements.period)],
    ["Apoapsis", formatNum(elements.apoapsis)],
    ["Periapsis", formatNum(elements.periapsis)],
    ["Spec. Energy", formatNum(elements.specificEnergy)],
    ["Ang. Momentum", formatNum(elements.specificAngularMomentum)],
  ];

  const orbitType =
    elements.eccentricity < 0.01
      ? "Circular"
      : elements.eccentricity < 1
        ? "Elliptical"
        : elements.eccentricity === 1
          ? "Parabolic"
          : "Hyperbolic";

  return (
    <div className="absolute top-[320px] right-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-white text-xs select-none border border-white/10 w-52">
      <div className="font-medium mb-2 text-blue-300">
        Orbital Elements ({orbitType})
      </div>
      <table className="w-full">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="text-white/50 pr-2 py-0.5">{label}</td>
              <td className="text-right font-mono">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
