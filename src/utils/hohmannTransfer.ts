export interface HohmannResult {
  deltaV1: number;
  deltaV2: number;
  totalDeltaV: number;
  transferTime: number;
  transferPoints: { x: number; y: number; z: number }[];
}

/**
 * Compute a Hohmann transfer orbit between two circular orbits.
 * @param r1 - radius of inner orbit
 * @param r2 - radius of outer orbit
 * @param mu - gravitational parameter (G * M_central)
 * @param centerX - x position of central body
 * @param centerY - y position of central body
 * @param numPoints - number of points to generate for the transfer ellipse
 */
export function computeHohmannTransfer(
  r1: number,
  r2: number,
  mu: number,
  centerX = 0,
  centerY = 0,
  numPoints = 100,
): HohmannResult {
  const [rInner, rOuter] = r1 < r2 ? [r1, r2] : [r2, r1];

  // Semi-major axis of transfer ellipse
  const aTransfer = (rInner + rOuter) / 2;

  // Circular velocities
  const v1Circular = Math.sqrt(mu / rInner);
  const v2Circular = Math.sqrt(mu / rOuter);

  // Transfer orbit velocities at periapsis and apoapsis (vis-viva)
  const v1Transfer = Math.sqrt(mu * (2 / rInner - 1 / aTransfer));
  const v2Transfer = Math.sqrt(mu * (2 / rOuter - 1 / aTransfer));

  // Delta-v at each burn
  const deltaV1 = Math.abs(v1Transfer - v1Circular);
  const deltaV2 = Math.abs(v2Circular - v2Transfer);

  // Transfer time = half the period of the transfer ellipse
  const transferTime = Math.PI * Math.sqrt(aTransfer ** 3 / mu);

  // Generate ellipse points (half ellipse from periapsis to apoapsis)
  const transferPoints: { x: number; y: number; z: number }[] = [];
  const e = (rOuter - rInner) / (rOuter + rInner); // eccentricity

  for (let i = 0; i <= numPoints; i++) {
    const theta = (i / numPoints) * Math.PI; // 0 to PI (half orbit)
    const r = aTransfer * (1 - e * e) / (1 + e * Math.cos(theta));
    transferPoints.push({
      x: centerX + r * Math.cos(theta),
      y: centerY + r * Math.sin(theta),
      z: 0,
    });
  }

  return {
    deltaV1,
    deltaV2,
    totalDeltaV: deltaV1 + deltaV2,
    transferTime,
    transferPoints,
  };
}
