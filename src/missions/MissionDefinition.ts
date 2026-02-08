import type { SimulationFrame } from "../types";

export type ObjectiveType =
  | "reach_orbit"      // Get within radius of a target orbit distance from central body
  | "reach_body"       // Get within radius of a target body
  | "achieve_speed"    // Reach a minimum speed
  | "survive_time";    // Survive for N ticks

export interface MissionObjective {
  type: ObjectiveType;
  description: string;
  /** For reach_orbit: target orbit radius */
  targetRadius?: number;
  /** For reach_body: target body name */
  targetBodyName?: string;
  /** For reach_body/reach_orbit: proximity threshold */
  threshold?: number;
  /** For achieve_speed: minimum speed */
  minSpeed?: number;
  /** For survive_time: required ticks */
  requiredTicks?: number;
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  scenarioId: string;
  objectives: MissionObjective[];
  timeLimit?: number; // ticks
}

export interface MissionProgress {
  missionId: string;
  objectiveStatus: boolean[];
  startTick: number;
  completed: boolean;
  failed: boolean;
}

export function checkObjective(
  obj: MissionObjective,
  frame: SimulationFrame,
  spacecraftId: number | null,
): boolean {
  if (spacecraftId === null) return false;
  const spacecraft = frame.bodies.find((b) => b.id === spacecraftId);
  if (!spacecraft) return false;

  switch (obj.type) {
    case "reach_orbit": {
      // Find largest mass body as central
      const central = frame.bodies.reduce((a, b) => (b.mass > a.mass ? b : a), frame.bodies[0]);
      if (!central || central.id === spacecraftId) return false;
      const dx = spacecraft.position.x - central.position.x;
      const dy = spacecraft.position.y - central.position.y;
      const dz = spacecraft.position.z - central.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return Math.abs(dist - (obj.targetRadius ?? 0)) < (obj.threshold ?? 30);
    }
    case "reach_body": {
      const target = frame.bodies.find((b) => b.name === obj.targetBodyName);
      if (!target) return false;
      const dx = spacecraft.position.x - target.position.x;
      const dy = spacecraft.position.y - target.position.y;
      const dz = spacecraft.position.z - target.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return dist < (obj.threshold ?? target.radius * 3);
    }
    case "achieve_speed": {
      const speed = Math.sqrt(
        spacecraft.velocity.x ** 2 + spacecraft.velocity.y ** 2 + spacecraft.velocity.z ** 2,
      );
      return speed >= (obj.minSpeed ?? 0);
    }
    case "survive_time": {
      // This is tracked externally by tick counting
      return false;
    }
    default:
      return false;
  }
}
