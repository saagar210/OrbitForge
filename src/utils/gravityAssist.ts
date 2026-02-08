export interface GravityAssistResult {
  deflectionAngle: number; // radians
  exitSpeed: number;
  deltaV: number;
  periapsis: number;
}

/**
 * Compute gravity assist parameters for a flyby.
 * @param vInfinity - approach velocity relative to the body (hyperbolic excess speed)
 * @param rPeriapsis - closest approach distance from body center
 * @param bodyMass - mass of the body being used for the assist
 * @param G - gravitational constant
 */
export function computeGravityAssist(
  vInfinity: number,
  rPeriapsis: number,
  bodyMass: number,
  G = 100,
): GravityAssistResult {
  const mu = G * bodyMass;

  // Hyperbolic orbit parameters
  // Semi-major axis: a = -mu / v_inf^2
  // Eccentricity: e = 1 + r_p * v_inf^2 / mu
  const e = 1 + (rPeriapsis * vInfinity * vInfinity) / mu;

  // Deflection angle: delta = 2 * arcsin(1/e)
  const deflectionAngle = e > 1 ? 2 * Math.asin(1 / e) : Math.PI;

  // Exit speed equals approach speed (in body frame)
  const exitSpeed = vInfinity;

  // Delta-V gained in the inertial frame depends on the turn angle
  // Maximum possible dv = 2 * vInfinity * sin(delta/2)
  const deltaV = 2 * vInfinity * Math.sin(deflectionAngle / 2);

  return {
    deflectionAngle,
    exitSpeed,
    deltaV,
    periapsis: rPeriapsis,
  };
}

/**
 * Find the approach velocity of a body relative to a target body.
 */
export function computeRelativeVelocity(
  bodyVel: { x: number; y: number; z: number },
  targetVel: { x: number; y: number; z: number },
): number {
  const dx = bodyVel.x - targetVel.x;
  const dy = bodyVel.y - targetVel.y;
  const dz = bodyVel.z - targetVel.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
