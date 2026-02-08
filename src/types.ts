export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  z: number;
  speed: number;
}

export type BodyType = "star" | "planet" | "spacecraft";

export interface CelestialBody {
  id: number;
  position: Vec3;
  velocity: Vec3;
  acceleration: Vec3;
  mass: number;
  radius: number;
  color: string;
  trail: TrailPoint[];
  is_fixed: boolean;
  name: string;
  body_type: BodyType;
  thrust: Vec3;
  fuel: number;
  max_fuel: number;
}

export interface EnergyData {
  kinetic: number;
  potential: number;
  total: number;
}

export interface SimulationFrame {
  bodies: CelestialBody[];
  tick: number;
  paused: boolean;
  speed_multiplier: number;
  energy: EnergyData;
}

export type InteractionMode = "select" | "place" | "slingshot";

export interface CollisionEvent {
  absorbed_id: number;
  survivor_id: number;
  position: Vec3;
  combined_mass: number;
}

export interface ScenarioInfo {
  id: string;
  name: string;
  description: string;
}
