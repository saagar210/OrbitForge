use crate::physics::{CelestialBody, Vec2};
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
    pub vx: f64,
    pub vy: f64,
    pub mass: f64,
    pub radius: f64,
    pub color: String,
    pub name: String,
    pub is_fixed: bool,
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
    let body = CelestialBody::new(
        id,
        &body_data.name,
        Vec2::new(body_data.x, body_data.y),
        Vec2::new(body_data.vx, body_data.vy),
        mass,
        radius,
        &body_data.color,
        body_data.is_fixed,
    );
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
pub fn update_body_velocity(state: State<SimState>, id: u32, vx: f64, vy: f64) {
    let mut sim = state.lock().unwrap();
    if let Some(body) = sim.find_body_mut(id) {
        body.velocity = Vec2::new(vx, vy);
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
        _ => {}
    }
}

#[tauri::command]
pub fn predict_orbit(state: State<SimState>, body_id: u32, steps: u32) -> Vec<Vec2> {
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
    new_state.prime_accelerations();
    let mut sim = state.lock().unwrap();
    *sim = new_state;
    Ok(())
}
