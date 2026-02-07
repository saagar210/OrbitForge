export interface Vec2 {
  x: number;
  y: number;
}

export interface CelestialBody {
  id: number;
  position: Vec2;
  velocity: Vec2;
  mass: number;
  radius: number;
  color: string;
  trail: Vec2[];
  is_fixed: boolean;
  name: string;
}

export interface SimulationFrame {
  bodies: CelestialBody[];
  tick: number;
  paused: boolean;
  speed_multiplier: number;
}

export type InteractionMode = "select" | "place" | "slingshot";

export interface CollisionEvent {
  absorbed_id: number;
  survivor_id: number;
  position: Vec2;
  combined_mass: number;
}

export interface ScenarioInfo {
  id: string;
  name: string;
  description: string;
}
