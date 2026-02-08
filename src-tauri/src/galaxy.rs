use crate::physics::{CelestialBody, Vec3};
use crate::simulation::SimulationState;
use rand::Rng;

pub fn generate_collision(
    state: &mut SimulationState,
    particles_per_galaxy: u32,
) {
    state.clear();

    let mut rng = rand::rng();
    let particles = particles_per_galaxy.min(500);

    // Galaxy 1: centered at (-400, 0, 0), moving right
    let center1 = Vec3::new(-400.0, 0.0, 0.0);
    let bulk_vel1 = Vec3::new(30.0, 5.0, 0.0);
    let core_mass1 = 100000.0;

    // Galaxy 2: centered at (400, 0, 0), moving left
    let center2 = Vec3::new(400.0, 0.0, 0.0);
    let bulk_vel2 = Vec3::new(-30.0, -5.0, 0.0);
    let core_mass2 = 80000.0;

    // Galaxy 1 core
    let id = state.allocate_id();
    state.bodies.push(CelestialBody::new(
        id, "Galaxy A Core", center1, bulk_vel1,
        core_mass1, 15.0, "#FFD700", false,
    ));

    // Galaxy 1 particles
    generate_disc(state, &mut rng, center1, bulk_vel1, core_mass1, particles, "A");

    // Galaxy 2 core
    let id = state.allocate_id();
    state.bodies.push(CelestialBody::new(
        id, "Galaxy B Core", center2, bulk_vel2,
        core_mass2, 13.0, "#FF6B35", false,
    ));

    // Galaxy 2 particles
    generate_disc(state, &mut rng, center2, bulk_vel2, core_mass2, particles, "B");

    state.prime_accelerations();
}

fn generate_disc(
    state: &mut SimulationState,
    rng: &mut impl Rng,
    center: Vec3,
    bulk_vel: Vec3,
    core_mass: f64,
    count: u32,
    prefix: &str,
) {
    let min_r = 30.0;
    let max_r = 300.0;

    for i in 0..count {
        // Exponential disc distribution (more particles near center)
        let u: f64 = rng.random();
        let r = min_r + (max_r - min_r) * u.sqrt();

        let angle: f64 = rng.random::<f64>() * std::f64::consts::TAU;

        // Slight z scatter for disc thickness
        let z_scatter = (rng.random::<f64>() - 0.5) * 20.0;

        let px = center.x + r * angle.cos();
        let py = center.y + r * angle.sin();
        let pz = center.z + z_scatter;

        // Circular orbital velocity around core
        let v = (state.g * core_mass / r).sqrt();
        let vx = bulk_vel.x - v * angle.sin();
        let vy = bulk_vel.y + v * angle.cos();
        let vz = bulk_vel.z;

        let mass = 0.01; // Small particles
        let radius = 1.0 + rng.random::<f64>() * 0.5;

        let color = if prefix == "A" { "#8888FF" } else { "#FF8888" };

        let id = state.allocate_id();
        state.bodies.push(CelestialBody::new(
            id,
            &format!("{}{}", prefix, i),
            Vec3::new(px, py, pz),
            Vec3::new(vx, vy, vz),
            mass,
            radius,
            color,
            false,
        ));
    }
}
