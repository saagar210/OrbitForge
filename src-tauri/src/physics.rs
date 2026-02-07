use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

const MAX_TRAIL_POINTS: usize = 500;

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct Vec2 {
    pub x: f64,
    pub y: f64,
}

impl Vec2 {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }

    pub fn zero() -> Self {
        Self { x: 0.0, y: 0.0 }
    }

    pub fn magnitude(&self) -> f64 {
        (self.x * self.x + self.y * self.y).sqrt()
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
        }
    }

    pub fn scale(&self, s: f64) -> Self {
        Self {
            x: self.x * s,
            y: self.y * s,
        }
    }
}

impl std::ops::Add for Vec2 {
    type Output = Self;
    fn add(self, rhs: Self) -> Self {
        Self {
            x: self.x + rhs.x,
            y: self.y + rhs.y,
        }
    }
}

impl std::ops::Sub for Vec2 {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self {
        Self {
            x: self.x - rhs.x,
            y: self.y - rhs.y,
        }
    }
}

impl std::ops::AddAssign for Vec2 {
    fn add_assign(&mut self, rhs: Self) {
        self.x += rhs.x;
        self.y += rhs.y;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CelestialBody {
    pub id: u32,
    pub position: Vec2,
    pub velocity: Vec2,
    #[serde(skip)]
    pub acceleration: Vec2,
    pub mass: f64,
    pub radius: f64,
    pub color: String,
    pub trail: VecDeque<Vec2>,
    pub is_fixed: bool,
    pub name: String,
}

impl CelestialBody {
    pub fn new(
        id: u32,
        name: &str,
        position: Vec2,
        velocity: Vec2,
        mass: f64,
        radius: f64,
        color: &str,
        is_fixed: bool,
    ) -> Self {
        Self {
            id,
            position,
            velocity,
            acceleration: Vec2::zero(),
            mass,
            radius,
            color: color.to_string(),
            trail: VecDeque::with_capacity(MAX_TRAIL_POINTS),
            is_fixed,
            name: name.to_string(),
        }
    }

    pub fn record_trail(&mut self) {
        self.trail.push_back(self.position);
        if self.trail.len() > MAX_TRAIL_POINTS {
            self.trail.pop_front();
        }
    }
}
