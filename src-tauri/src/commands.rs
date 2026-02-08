use crate::galaxy;
use crate::physics::{BodyType, CelestialBody, Vec3};
use crate::procedural;
use crate::scenarios;
use crate::simulation::SimulationState;
use serde::Deserialize;
use std::sync::{Arc, Mutex};
use tauri::State;

pub type SimState = Arc<Mutex<SimulationState>>;

#[derive(Deserialize)]
pub struct BodyData {
    pub x: f64,
    pub y: f64,
    #[serde(default)]
    pub z: f64,
    pub vx: f64,
    pub vy: f64,
    #[serde(default)]
    pub vz: f64,
    pub mass: f64,
    pub radius: f64,
    pub color: String,
    pub name: String,
    pub is_fixed: bool,
    #[serde(default)]
    pub body_type: BodyType,
}

#[derive(Deserialize)]
pub struct BodyUpdate {
    pub mass: Option<f64>,
    pub radius: Option<f64>,
    pub color: Option<String>,
    pub name: Option<String>,
    pub is_fixed: Option<bool>,
}

#[tauri::command]
pub fn toggle_pause(state: State<SimState>) -> bool {
    let mut sim = state.lock().unwrap();
    sim.paused = !sim.paused;
    sim.paused
}

#[tauri::command]
pub fn set_speed(state: State<SimState>, multiplier: f64) -> f64 {
    let mut sim = state.lock().unwrap();
    sim.speed_multiplier = multiplier.clamp(0.25, 8.0);
    sim.speed_multiplier
}

#[tauri::command]
pub fn load_test_scenario(state: State<SimState>) {
    let mut sim = state.lock().unwrap();
    scenarios::load_sun_earth(&mut sim);
}

#[tauri::command]
pub fn clear_simulation(state: State<SimState>) {
    let mut sim = state.lock().unwrap();
    sim.clear();
}

#[tauri::command]
pub fn add_body(state: State<SimState>, body_data: BodyData) -> u32 {
    let mut sim = state.lock().unwrap();
    let id = sim.allocate_id();
    let mass = body_data.mass.max(0.01);
    let radius = body_data.radius.max(0.5);
    let mut body = CelestialBody::new(
        id,
        &body_data.name,
        Vec3::new(body_data.x, body_data.y, body_data.z),
        Vec3::new(body_data.vx, body_data.vy, body_data.vz),
        mass,
        radius,
        &body_data.color,
        body_data.is_fixed,
    );
    body.body_type = body_data.body_type;
    sim.add_body(body);
    id
}

#[tauri::command]
pub fn remove_body(state: State<SimState>, id: u32) {
    let mut sim = state.lock().unwrap();
    sim.remove_body(id);
}

#[tauri::command]
pub fn update_body(state: State<SimState>, id: u32, fields: BodyUpdate) {
    let mut sim = state.lock().unwrap();
    if let Some(body) = sim.find_body_mut(id) {
        if let Some(mass) = fields.mass {
            body.mass = mass.max(0.01);
        }
        if let Some(radius) = fields.radius {
            body.radius = radius.max(0.5);
        }
        if let Some(color) = fields.color {
            body.color = color;
        }
        if let Some(name) = fields.name {
            body.name = name;
        }
        if let Some(is_fixed) = fields.is_fixed {
            body.is_fixed = is_fixed;
        }
    }
}

#[tauri::command]
pub fn update_body_velocity(state: State<SimState>, id: u32, vx: f64, vy: f64, vz: Option<f64>) {
    let mut sim = state.lock().unwrap();
    if let Some(body) = sim.find_body_mut(id) {
        body.velocity = Vec3::new(vx, vy, vz.unwrap_or(0.0));
    }
}

#[tauri::command]
pub fn set_spacecraft_thrust(state: State<SimState>, id: u32, tx: f64, ty: f64, tz: f64) {
    let mut sim = state.lock().unwrap();
    if let Some(body) = sim.find_body_mut(id) {
        if body.body_type == BodyType::Spacecraft {
            body.thrust = Vec3::new(tx, ty, tz);
        }
    }
}

#[tauri::command]
pub fn load_scenario(state: State<SimState>, name: String) {
    let mut sim = state.lock().unwrap();
    match name.as_str() {
        "sun_earth" => scenarios::load_sun_earth(&mut sim),
        "inner_solar" => scenarios::load_inner_solar(&mut sim),
        "outer_solar" => scenarios::load_outer_solar(&mut sim),
        "full_solar" => scenarios::load_full_solar(&mut sim),
        "binary_star" => scenarios::load_binary_star(&mut sim),
        "figure_eight" => scenarios::load_figure_eight(&mut sim),
        "inclined_solar" => scenarios::load_inclined_solar(&mut sim),
        "asteroid_belt" => scenarios::load_solar_with_belt(&mut sim),
        "galaxy_collision" => galaxy::generate_collision(&mut sim, 300),
        _ => {}
    }
}

#[tauri::command]
pub fn generate_system(
    state: State<SimState>,
    star_mass: f64,
    planet_count: u32,
    min_spacing: f64,
    max_radius: f64,
) {
    let mut sim = state.lock().unwrap();
    procedural::generate_system(&mut sim, star_mass, planet_count, min_spacing, max_radius);
}

#[tauri::command]
pub fn load_galaxy_collision(state: State<SimState>, particles_per_galaxy: Option<u32>) {
    let mut sim = state.lock().unwrap();
    galaxy::generate_collision(&mut sim, particles_per_galaxy.unwrap_or(300));
}

#[tauri::command]
pub fn set_theta(state: State<SimState>, theta: f64) {
    let mut sim = state.lock().unwrap();
    sim.theta = theta.clamp(0.0, 2.0);
}

#[tauri::command]
pub fn predict_orbit(state: State<SimState>, body_id: u32, steps: u32) -> Vec<Vec3> {
    let sim = state.lock().unwrap();
    sim.predict_orbit(body_id, steps.min(2000))
}

#[tauri::command]
pub fn export_state(state: State<SimState>) -> Result<String, String> {
    let sim = state.lock().unwrap();
    serde_json::to_string_pretty(&*sim).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_state(state: State<SimState>, json: String) -> Result<(), String> {
    let mut new_state: SimulationState =
        serde_json::from_str(&json).map_err(|e| e.to_string())?;

    // Ensure next_id won't collide with existing body IDs
    let max_id = new_state.bodies.iter().map(|b| b.id).max().unwrap_or(0);
    if new_state.next_id <= max_id {
        new_state.next_id = max_id + 1;
    }

    let mut sim = state.lock().unwrap();
    // Preserve GPU reference (lost during deserialization due to #[serde(skip)])
    new_state.gpu = sim.gpu.clone();
    new_state.prime_accelerations();
    *sim = new_state;
    Ok(())
}
