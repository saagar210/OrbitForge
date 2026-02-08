mod barneshut;
mod commands;
mod galaxy;
mod gpu_gravity;
mod physics;
mod procedural;
mod scenarios;
mod simulation;

use commands::SimState;
use simulation::SimulationState;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let sim_state = Arc::new(Mutex::new(SimulationState::new()));

    // Init GPU gravity (best-effort, falls back to CPU)
    {
        let mut sim = sim_state.lock().unwrap();
        match gpu_gravity::GpuGravity::new() {
            Some(gpu) => {
                sim.gpu = Some(Arc::new(gpu));
                println!("GPU gravity compute initialized");
            }
            None => {
                println!("GPU gravity not available, using CPU");
            }
        }
    }

    // Load default scenario
    {
        let mut sim = sim_state.lock().unwrap();
        scenarios::load_sun_earth(&mut sim);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(sim_state.clone() as SimState)
        .invoke_handler(tauri::generate_handler![
            commands::toggle_pause,
            commands::set_speed,
            commands::load_test_scenario,
            commands::clear_simulation,
            commands::add_body,
            commands::remove_body,
            commands::update_body,
            commands::update_body_velocity,
            commands::load_scenario,
            commands::predict_orbit,
            commands::export_state,
            commands::import_state,
            commands::set_spacecraft_thrust,
            commands::generate_system,
            commands::load_galaxy_collision,
            commands::set_theta,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            let state_clone = sim_state.clone();
            thread::spawn(move || {
                let tick_duration = Duration::from_secs_f64(1.0 / 120.0);
                loop {
                    let start = Instant::now();

                    let (frame, collisions) = {
                        let mut sim = state_clone.lock().unwrap();
                        let collisions = sim.step();
                        let frame = sim.to_frame();
                        (frame, collisions)
                    };

                    let _ = handle.emit("simulation-state", &frame);

                    for collision in &collisions {
                        let _ = handle.emit("collision", collision);
                    }

                    let elapsed = start.elapsed();
                    if elapsed < tick_duration {
                        thread::sleep(tick_duration - elapsed);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
