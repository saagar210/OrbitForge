use crate::physics::{CelestialBody, Vec2};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationFrame {
    pub bodies: Vec<CelestialBody>,
    pub tick: u64,
    pub paused: bool,
    pub speed_multiplier: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollisionEvent {
    pub absorbed_id: u32,
    pub survivor_id: u32,
    pub position: Vec2,
    pub combined_mass: f64,
}

#[derive(Serialize, Deserialize)]
pub struct SimulationState {
    pub bodies: Vec<CelestialBody>,
    pub tick: u64,
    pub dt: f64,
    pub g: f64,
    pub softening: f64,
    pub paused: bool,
    pub speed_multiplier: f64,
    pub next_id: u32,
}

impl SimulationState {
    pub fn new() -> Self {
        Self {
            bodies: Vec::new(),
            tick: 0,
            dt: 0.016,
            g: 100.0,
            softening: 10.0,
            paused: false,
            speed_multiplier: 1.0,
            next_id: 0,
        }
    }

    pub fn allocate_id(&mut self) -> u32 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    pub fn add_body(&mut self, body: CelestialBody) -> u32 {
        let id = body.id;
        self.bodies.push(body);
        self.compute_accelerations();
        id
    }

    pub fn remove_body(&mut self, id: u32) {
        self.bodies.retain(|b| b.id != id);
    }

    pub fn find_body_mut(&mut self, id: u32) -> Option<&mut CelestialBody> {
        self.bodies.iter_mut().find(|b| b.id == id)
    }

    pub fn find_body(&self, id: u32) -> Option<&CelestialBody> {
        self.bodies.iter().find(|b| b.id == id)
    }

    pub fn step(&mut self) -> Vec<CollisionEvent> {
        if self.paused || self.bodies.is_empty() {
            return Vec::new();
        }

        let sub_steps = self.speed_multiplier.ceil() as u32;
        let dt = self.dt * self.speed_multiplier / sub_steps as f64;

        let mut all_collisions = Vec::new();

        for _ in 0..sub_steps {
            self.step_verlet(dt);
            let collisions = self.check_collisions();
            all_collisions.extend(collisions);
        }

        if self.tick % 2 == 0 {
            for body in self.bodies.iter_mut() {
                if !body.is_fixed {
                    body.record_trail();
                }
            }
        }

        self.tick += 1;
        all_collisions
    }

    fn step_verlet(&mut self, dt: f64) {
        for body in self.bodies.iter_mut() {
            if body.is_fixed {
                continue;
            }
            body.position = body.position
                + body.velocity.scale(dt)
                + body.acceleration.scale(0.5 * dt * dt);
        }

        let old_accelerations: Vec<Vec2> =
            self.bodies.iter().map(|b| b.acceleration).collect();

        self.compute_accelerations();

        for (i, body) in self.bodies.iter_mut().enumerate() {
            if body.is_fixed {
                continue;
            }
            body.velocity += (old_accelerations[i] + body.acceleration).scale(0.5 * dt);
        }
    }

    fn compute_accelerations(&mut self) {
        let n = self.bodies.len();
        let mut accels = vec![Vec2::zero(); n];

        for i in 0..n {
            if self.bodies[i].is_fixed {
                continue;
            }
            for j in 0..n {
                if i == j {
                    continue;
                }
                let diff = self.bodies[j].position - self.bodies[i].position;
                let dist_sq = diff.x * diff.x + diff.y * diff.y + self.softening * self.softening;
                let dist = dist_sq.sqrt();
                let force_mag = self.g * self.bodies[j].mass / dist_sq;
                let dir = diff.scale(1.0 / dist);
                accels[i] += dir.scale(force_mag);
            }
        }

        for (i, body) in self.bodies.iter_mut().enumerate() {
            body.acceleration = accels[i];
        }
    }

    fn check_collisions(&mut self) -> Vec<CollisionEvent> {
        let mut collisions = Vec::new();
        let mut absorbed: Vec<bool> = vec![false; self.bodies.len()];

        let n = self.bodies.len();
        for i in 0..n {
            if absorbed[i] {
                continue;
            }
            for j in (i + 1)..n {
                if absorbed[j] {
                    continue;
                }
                let diff = self.bodies[j].position - self.bodies[i].position;
                let dist = (diff.x * diff.x + diff.y * diff.y).sqrt();
                let overlap = self.bodies[i].radius + self.bodies[j].radius;

                if dist < overlap {
                    let (survivor_idx, absorbed_idx) = if self.bodies[i].mass >= self.bodies[j].mass
                    {
                        (i, j)
                    } else {
                        (j, i)
                    };

                    let m1 = self.bodies[survivor_idx].mass;
                    let m2 = self.bodies[absorbed_idx].mass;
                    let total_mass = m1 + m2;

                    let new_velocity = Vec2::new(
                        (m1 * self.bodies[survivor_idx].velocity.x
                            + m2 * self.bodies[absorbed_idx].velocity.x)
                            / total_mass,
                        (m1 * self.bodies[survivor_idx].velocity.y
                            + m2 * self.bodies[absorbed_idx].velocity.y)
                            / total_mass,
                    );

                    let new_position = Vec2::new(
                        (m1 * self.bodies[survivor_idx].position.x
                            + m2 * self.bodies[absorbed_idx].position.x)
                            / total_mass,
                        (m1 * self.bodies[survivor_idx].position.y
                            + m2 * self.bodies[absorbed_idx].position.y)
                            / total_mass,
                    );

                    let r1 = self.bodies[survivor_idx].radius;
                    let r2 = self.bodies[absorbed_idx].radius;
                    let new_radius = (r1 * r1 * r1 + r2 * r2 * r2).cbrt();

                    let collision = CollisionEvent {
                        absorbed_id: self.bodies[absorbed_idx].id,
                        survivor_id: self.bodies[survivor_idx].id,
                        position: new_position,
                        combined_mass: total_mass,
                    };

                    self.bodies[survivor_idx].mass = total_mass;
                    self.bodies[survivor_idx].velocity = new_velocity;
                    self.bodies[survivor_idx].position = new_position;
                    self.bodies[survivor_idx].radius = new_radius;
                    if self.bodies[absorbed_idx].is_fixed {
                        self.bodies[survivor_idx].is_fixed = true;
                    }

                    absorbed[absorbed_idx] = true;
                    collisions.push(collision);
                }
            }
        }

        // Remove absorbed bodies in reverse to preserve indices
        let mut i = self.bodies.len();
        while i > 0 {
            i -= 1;
            if absorbed[i] {
                self.bodies.remove(i);
            }
        }

        collisions
    }

    pub fn predict_orbit(&self, body_id: u32, steps: u32) -> Vec<Vec2> {
        let mut pred = SimulationState {
            bodies: self.bodies.clone(),
            tick: 0,
            dt: self.dt,
            g: self.g,
            softening: self.softening,
            paused: false,
            speed_multiplier: 1.0,
            next_id: self.next_id,
        };

        for body in pred.bodies.iter_mut() {
            body.trail.clear();
        }

        let mut path = Vec::with_capacity(steps as usize);

        for _ in 0..steps {
            pred.step_verlet(pred.dt);
            if let Some(body) = pred.find_body(body_id) {
                path.push(body.position);
            } else {
                break;
            }
        }

        path
    }

    pub fn to_frame(&self) -> SimulationFrame {
        SimulationFrame {
            bodies: self.bodies.clone(),
            tick: self.tick,
            paused: self.paused,
            speed_multiplier: self.speed_multiplier,
        }
    }

    pub fn prime_accelerations(&mut self) {
        self.compute_accelerations();
    }

    pub fn clear(&mut self) {
        self.bodies.clear();
        self.tick = 0;
        self.next_id = 0;
    }
}
