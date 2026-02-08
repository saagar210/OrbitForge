use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

const MAX_TRAIL_POINTS: usize = 500;

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct TrailPoint {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub speed: f64,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Vec3 {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z }
    }

    pub fn zero() -> Self {
        Self { x: 0.0, y: 0.0, z: 0.0 }
    }

    pub fn magnitude(&self) -> f64 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    #[allow(dead_code)]
    pub fn normalize(&self) -> Self {
        let mag = self.magnitude();
        if mag == 0.0 {
            return Self::zero();
        }
        Self {
            x: self.x / mag,
            y: self.y / mag,
            z: self.z / mag,
        }
    }

    pub fn scale(&self, s: f64) -> Self {
        Self {
            x: self.x * s,
            y: self.y * s,
            z: self.z * s,
        }
    }

    #[allow(dead_code)]
    pub fn dot(&self, other: &Self) -> f64 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }

    #[allow(dead_code)]
    pub fn cross(&self, other: &Self) -> Self {
        Self {
            x: self.y * other.z - self.z * other.y,
            y: self.z * other.x - self.x * other.z,
            z: self.x * other.y - self.y * other.x,
        }
    }
}

impl std::ops::Add for Vec3 {
    type Output = Self;
    fn add(self, rhs: Self) -> Self {
        Self {
            x: self.x + rhs.x,
            y: self.y + rhs.y,
            z: self.z + rhs.z,
        }
    }
}

impl std::ops::Sub for Vec3 {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self {
        Self {
            x: self.x - rhs.x,
            y: self.y - rhs.y,
            z: self.z - rhs.z,
        }
    }
}

impl std::ops::AddAssign for Vec3 {
    fn add_assign(&mut self, rhs: Self) {
        self.x += rhs.x;
        self.y += rhs.y;
        self.z += rhs.z;
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BodyType {
    Star,
    Planet,
    Spacecraft,
}

impl Default for BodyType {
    fn default() -> Self {
        BodyType::Planet
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CelestialBody {
    pub id: u32,
    pub position: Vec3,
    pub velocity: Vec3,
    #[serde(default)]
    pub acceleration: Vec3,
    pub mass: f64,
    pub radius: f64,
    pub color: String,
    pub trail: VecDeque<TrailPoint>,
    pub is_fixed: bool,
    pub name: String,
    #[serde(default)]
    pub body_type: BodyType,
    #[serde(default)]
    pub thrust: Vec3,
    #[serde(default = "default_fuel")]
    pub fuel: f64,
    #[serde(default = "default_fuel")]
    pub max_fuel: f64,
}

fn default_fuel() -> f64 {
    100.0
}

impl CelestialBody {
    pub fn new(
        id: u32,
        name: &str,
        position: Vec3,
        velocity: Vec3,
        mass: f64,
        radius: f64,
        color: &str,
        is_fixed: bool,
    ) -> Self {
        let body_type = if is_fixed { BodyType::Star } else { BodyType::Planet };
        Self {
            id,
            position,
            velocity,
            acceleration: Vec3::zero(),
            mass,
            radius,
            color: color.to_string(),
            trail: VecDeque::with_capacity(MAX_TRAIL_POINTS),
            is_fixed,
            name: name.to_string(),
            body_type,
            thrust: Vec3::zero(),
            fuel: 100.0,
            max_fuel: 100.0,
        }
    }

    pub fn record_trail(&mut self) {
        self.trail.push_back(TrailPoint {
            x: self.position.x,
            y: self.position.y,
            z: self.position.z,
            speed: self.velocity.magnitude(),
        });
        if self.trail.len() > MAX_TRAIL_POINTS {
            self.trail.pop_front();
        }
    }
}
