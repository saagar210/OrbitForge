import type { Vec3 } from "../types";

export interface LagrangePoints {
  L1: Vec3;
  L2: Vec3;
  L3: Vec3;
  L4: Vec3;
  L5: Vec3;
}

export function computeLagrangePoints(
  primaryPos: Vec3,
  primaryMass: number,
  secondaryPos: Vec3,
  secondaryMass: number,
): LagrangePoints {
  const dx = secondaryPos.x - primaryPos.x;
  const dy = secondaryPos.y - primaryPos.y;
  const dz = secondaryPos.z - primaryPos.z;
  const R = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (R < 0.001) {
    const zero = { x: 0, y: 0, z: 0 };
    return { L1: zero, L2: zero, L3: zero, L4: zero, L5: zero };
  }

  // Unit direction from primary to secondary
  const ux = dx / R;
  const uy = dy / R;
  const uz = dz / R;

  // Mass ratio
  const mu = secondaryMass / (primaryMass + secondaryMass);

  // L1: Between bodies, closer to secondary
  const cbrtMu3 = Math.cbrt(mu / 3);
  const rL1 = R * (1 - cbrtMu3);
  const L1: Vec3 = {
    x: primaryPos.x + ux * rL1,
    y: primaryPos.y + uy * rL1,
    z: primaryPos.z + uz * rL1,
  };

  // L2: Beyond secondary (away from primary)
  const rL2 = R * (1 + cbrtMu3);
  const L2: Vec3 = {
    x: primaryPos.x + ux * rL2,
    y: primaryPos.y + uy * rL2,
    z: primaryPos.z + uz * rL2,
  };

  // L3: Beyond primary (opposite side from secondary)
  const rL3 = R * (1 + (5 * mu) / 12);
  const L3: Vec3 = {
    x: primaryPos.x - ux * rL3,
    y: primaryPos.y - uy * rL3,
    z: primaryPos.z - uz * rL3,
  };

  // L4/L5: Equilateral triangle positions in the orbital plane
  // Find a perpendicular vector in the orbital plane
  // Use cross product with a reference vector to get perpendicular direction
  let px: number, py: number, pz: number;
  if (Math.abs(uz) < 0.9) {
    // Cross with Z-axis: (ux,uy,uz) × (0,0,1) = (uy, -ux, 0)
    const pmag = Math.sqrt(ux * ux + uy * uy);
    if (pmag < 0.001) {
      px = 1; py = 0; pz = 0;
    } else {
      px = uy / pmag; py = -ux / pmag; pz = 0;
    }
  } else {
    // Cross with X-axis: (ux,uy,uz) × (1,0,0) = (0, uz, -uy)
    const pmag = Math.sqrt(uz * uz + uy * uy);
    px = 0; py = uz / pmag; pz = -uy / pmag;
  }

  const midX = (primaryPos.x + secondaryPos.x) / 2;
  const midY = (primaryPos.y + secondaryPos.y) / 2;
  const midZ = (primaryPos.z + secondaryPos.z) / 2;
  const h = R * (Math.sqrt(3) / 2);

  const L4: Vec3 = { x: midX + px * h, y: midY + py * h, z: midZ + pz * h };
  const L5: Vec3 = { x: midX - px * h, y: midY - py * h, z: midZ - pz * h };

  return { L1, L2, L3, L4, L5 };
}

export function findTwoBodyPair(
  bodies: { id: number; position: Vec3; mass: number; is_fixed: boolean }[],
): { primary: typeof bodies[0]; secondary: typeof bodies[0] } | null {
  if (bodies.length < 2) return null;

  // Find heaviest body as primary
  let primary = bodies[0];
  for (const b of bodies) {
    if (b.mass > primary.mass) primary = b;
  }

  // Find second heaviest as secondary
  let secondary: typeof bodies[0] | null = null;
  for (const b of bodies) {
    if (b.id === primary.id) continue;
    if (!secondary || b.mass > secondary.mass) secondary = b;
  }

  if (!secondary) return null;
  return { primary, secondary };
}
