import type { Vec3 } from "../types";

export interface OrbitalElements {
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  period: number;
  apoapsis: number;
  periapsis: number;
  specificEnergy: number;
  specificAngularMomentum: number;
}

export function computeOrbitalElements(
  bodyPos: Vec3,
  bodyVel: Vec3,
  centralPos: Vec3,
  centralMass: number,
  G: number,
): OrbitalElements | null {
  // Relative position and velocity
  const rx = bodyPos.x - centralPos.x;
  const ry = bodyPos.y - centralPos.y;
  const rz = bodyPos.z - centralPos.z;
  const vx = bodyVel.x;
  const vy = bodyVel.y;
  const vz = bodyVel.z;

  const r = Math.sqrt(rx * rx + ry * ry + rz * rz);
  const v = Math.sqrt(vx * vx + vy * vy + vz * vz);
  const mu = G * centralMass;

  if (r < 0.001 || mu < 0.001) return null;

  // Specific angular momentum vector h = r × v
  const hx = ry * vz - rz * vy;
  const hy = rz * vx - rx * vz;
  const hz = rx * vy - ry * vx;
  const hMag = Math.sqrt(hx * hx + hy * hy + hz * hz);

  // Inclination
  const inclination = hMag > 0.001 ? Math.acos(Math.min(1, Math.abs(hz) / hMag)) : 0;

  // Specific orbital energy (vis-viva)
  const energy = 0.5 * v * v - mu / r;

  // Semi-major axis
  if (Math.abs(energy) < 1e-10) return null; // Parabolic edge case
  const a = -mu / (2 * energy);

  // Eccentricity vector: e = (v × h) / mu - r_hat
  // v × h
  const vhx = vy * hz - vz * hy;
  const vhy = vz * hx - vx * hz;
  const vhz = vx * hy - vy * hx;
  const ex = vhx / mu - rx / r;
  const ey = vhy / mu - ry / r;
  const ez = vhz / mu - rz / r;
  const e = Math.sqrt(ex * ex + ey * ey + ez * ez);

  // Period (only meaningful for elliptical orbits)
  const period = e < 1 ? 2 * Math.PI * Math.sqrt(Math.abs(a * a * a) / mu) : Infinity;

  // Apoapsis and periapsis
  const periapsis = Math.abs(a) * (1 - e);
  const apoapsis = e < 1 ? a * (1 + e) : Infinity;

  return {
    semiMajorAxis: a,
    eccentricity: e,
    inclination,
    period,
    apoapsis,
    periapsis,
    specificEnergy: energy,
    specificAngularMomentum: hMag,
  };
}

export function findDominantBody(
  bodyId: number,
  bodyPos: Vec3,
  bodies: { id: number; position: Vec3; mass: number; is_fixed: boolean }[],
  G: number,
): { position: Vec3; mass: number } | null {
  let bestInfluence = 0;
  let dominant: { position: Vec3; mass: number } | null = null;

  for (const other of bodies) {
    if (other.id === bodyId) continue;
    const dx = other.position.x - bodyPos.x;
    const dy = other.position.y - bodyPos.y;
    const dz = other.position.z - bodyPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 0.001) continue;
    const influence = G * other.mass / (dist * dist);
    if (influence > bestInfluence) {
      bestInfluence = influence;
      dominant = { position: other.position, mass: other.mass };
    }
  }

  return dominant;
}
