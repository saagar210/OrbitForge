use crate::physics::{CelestialBody, Vec3};
use crate::simulation::SimulationState;
use rand::Rng;

fn add_planet(
    state: &mut SimulationState,
    name: &str,
    orbit_radius: f64,
    mass: f64,
    radius: f64,
    color: &str,
    sun_mass: f64,
) {
    let id = state.allocate_id();
    let v = (state.g * sun_mass / orbit_radius).sqrt();
    let body = CelestialBody::new(
        id,
        name,
        Vec3::new(orbit_radius, 0.0, 0.0),
        Vec3::new(0.0, v, 0.0),
        mass,
        radius,
        color,
        false,
    );
    state.bodies.push(body);
}

fn add_planet_inclined(
    state: &mut SimulationState,
    name: &str,
    orbit_radius: f64,
    mass: f64,
    radius: f64,
    color: &str,
    sun_mass: f64,
    inclination: f64,
    start_angle: f64,
) {
    let id = state.allocate_id();
    let v = (state.g * sun_mass / orbit_radius).sqrt();
    // Position: rotate start_angle in xy-plane
    let px = orbit_radius * start_angle.cos();
    let py = orbit_radius * start_angle.sin();
    // Velocity perpendicular to position, inclined by inclination angle
    // In-plane perpendicular direction to position
    let vx = -v * start_angle.sin() * inclination.cos();
    let vy = v * start_angle.cos() * inclination.cos();
    let vz = v * inclination.sin();
    let body = CelestialBody::new(
        id,
        name,
        Vec3::new(px, py, 0.0),
        Vec3::new(vx, vy, vz),
        mass,
        radius,
        color,
        false,
    );
    state.bodies.push(body);
}

fn add_sun(state: &mut SimulationState, mass: f64, radius: f64) {
    let id = state.allocate_id();
    let sun = CelestialBody::new(
        id,
        "Sun",
        Vec3::new(0.0, 0.0, 0.0),
        Vec3::zero(),
        mass,
        radius,
        "#FFD700",
        true,
    );
    state.bodies.push(sun);
}

pub fn load_sun_earth(state: &mut SimulationState) {
    state.clear();

    let sun_mass: f64 = 50000.0;
    let orbit_radius: f64 = 250.0;
    let orbital_velocity = (state.g * sun_mass / orbit_radius).sqrt();

    let sun_id = state.allocate_id();
    let sun = CelestialBody::new(
        sun_id,
        "Sun",
        Vec3::new(0.0, 0.0, 0.0),
        Vec3::zero(),
        sun_mass,
        20.0,
        "#FFD700",
        true,
    );

    let earth_id = state.allocate_id();
    let earth = CelestialBody::new(
        earth_id,
        "Earth",
        Vec3::new(orbit_radius, 0.0, 0.0),
        Vec3::new(0.0, orbital_velocity, 0.0),
        1.0,
        8.0,
        "#4A90D9",
        false,
    );

    state.bodies.push(sun);
    state.bodies.push(earth);
    state.prime_accelerations();
}

pub fn load_inner_solar(state: &mut SimulationState) {
    state.clear();

    let sun_mass = 50000.0;
    add_sun(state, sun_mass, 20.0);

    // Mass ratios relative to Earth: Mercury=0.055, Venus=0.815, Earth=1, Mars=0.107
    // Orbital radii scaled for visual clarity
    add_planet(state, "Mercury", 150.0, 0.055, 4.0, "#B5B5B5", sun_mass);
    add_planet(state, "Venus", 220.0, 0.815, 7.0, "#E8CDA0", sun_mass);
    add_planet(state, "Earth", 300.0, 1.0, 8.0, "#4A90D9", sun_mass);
    add_planet(state, "Mars", 400.0, 0.107, 5.0, "#C1440E", sun_mass);

    state.prime_accelerations();
}

pub fn load_outer_solar(state: &mut SimulationState) {
    state.clear();

    let sun_mass = 50000.0;
    add_sun(state, sun_mass, 20.0);

    // Mass ratios: Jupiter=317.8, Saturn=95.2, Uranus=14.5, Neptune=17.1 (relative to Earth)
    add_planet(state, "Jupiter", 500.0, 317.8, 16.0, "#C88B3A", sun_mass);
    add_planet(state, "Saturn", 700.0, 95.2, 14.0, "#EAD6B8", sun_mass);
    add_planet(state, "Uranus", 950.0, 14.5, 10.0, "#72B2C4", sun_mass);
    add_planet(state, "Neptune", 1200.0, 17.1, 10.0, "#3B5BA5", sun_mass);

    state.prime_accelerations();
}

pub fn load_full_solar(state: &mut SimulationState) {
    state.clear();

    let sun_mass = 50000.0;
    add_sun(state, sun_mass, 20.0);

    add_planet(state, "Mercury", 120.0, 0.055, 3.0, "#B5B5B5", sun_mass);
    add_planet(state, "Venus", 180.0, 0.815, 6.0, "#E8CDA0", sun_mass);
    add_planet(state, "Earth", 250.0, 1.0, 7.0, "#4A90D9", sun_mass);
    add_planet(state, "Mars", 340.0, 0.107, 4.5, "#C1440E", sun_mass);
    add_planet(state, "Jupiter", 500.0, 317.8, 14.0, "#C88B3A", sun_mass);
    add_planet(state, "Saturn", 680.0, 95.2, 12.0, "#EAD6B8", sun_mass);
    add_planet(state, "Uranus", 900.0, 14.5, 9.0, "#72B2C4", sun_mass);
    add_planet(state, "Neptune", 1100.0, 17.1, 9.0, "#3B5BA5", sun_mass);

    state.prime_accelerations();
}

pub fn load_binary_star(state: &mut SimulationState) {
    state.clear();

    // Two equal-mass stars orbiting their barycenter
    let star_mass = 25000.0;
    let separation = 200.0; // distance from center to each star
    // Orbital velocity for binary: v = sqrt(G * m_other / (2 * separation))
    let v = (state.g * star_mass / (2.0 * separation)).sqrt();

    let id1 = state.allocate_id();
    let star1 = CelestialBody::new(
        id1,
        "Star A",
        Vec3::new(-separation, 0.0, 0.0),
        Vec3::new(0.0, -v, 0.0),
        star_mass,
        18.0,
        "#FFD700",
        false,
    );

    let id2 = state.allocate_id();
    let star2 = CelestialBody::new(
        id2,
        "Star B",
        Vec3::new(separation, 0.0, 0.0),
        Vec3::new(0.0, v, 0.0),
        star_mass,
        18.0,
        "#FF6B35",
        false,
    );

    // Test particle in a distant orbit around the pair
    let test_r = 600.0;
    let test_v = (state.g * (star_mass * 2.0) / test_r).sqrt();
    let id3 = state.allocate_id();
    let test_particle = CelestialBody::new(
        id3,
        "Test Particle",
        Vec3::new(test_r, 0.0, 0.0),
        Vec3::new(0.0, test_v, 0.0),
        0.01,
        4.0,
        "#FFFFFF",
        false,
    );

    state.bodies.push(star1);
    state.bodies.push(star2);
    state.bodies.push(test_particle);
    state.prime_accelerations();
}

pub fn load_figure_eight(state: &mut SimulationState) {
    state.clear();

    // Chenciner-Montgomery three-body figure-8 solution
    // Scaled to our G=100 system
    //
    // Original solution uses G=1, m=1, and specific initial conditions.
    // We scale positions by a factor and adjust velocities accordingly.
    // With G=100, m=mass, we need v_scaled = v_original * sqrt(G * m / scale)
    let mass = 100.0;
    let scale = 200.0; // position scaling factor

    // Original initial conditions (Chenciner-Montgomery):
    // Body 1: pos=(-0.97000436, 0.24308753), vel=(0.4662036850, 0.4323657300)
    // Body 2: pos=(0.97000436, -0.24308753), vel=(0.4662036850, 0.4323657300)
    // Body 3: pos=(0, 0), vel=(-0.93240737, -0.86473146)

    // Velocity scaling: v_new = v_old * sqrt(G * m / scale_factor)
    // For G=100, m=100, scale=200: factor = sqrt(100*100/200) = sqrt(50) ≈ 7.071
    let v_factor = (state.g * mass / scale).sqrt();

    let id1 = state.allocate_id();
    let b1 = CelestialBody::new(
        id1,
        "Body A",
        Vec3::new(-0.97000436 * scale, 0.24308753 * scale, 0.0),
        Vec3::new(0.4662036850 * v_factor, 0.4323657300 * v_factor, 0.0),
        mass,
        8.0,
        "#FF4444",
        false,
    );

    let id2 = state.allocate_id();
    let b2 = CelestialBody::new(
        id2,
        "Body B",
        Vec3::new(0.97000436 * scale, -0.24308753 * scale, 0.0),
        Vec3::new(0.4662036850 * v_factor, 0.4323657300 * v_factor, 0.0),
        mass,
        8.0,
        "#44FF44",
        false,
    );

    let id3 = state.allocate_id();
    let b3 = CelestialBody::new(
        id3,
        "Body C",
        Vec3::new(0.0, 0.0, 0.0),
        Vec3::new(-0.93240737 * v_factor, -0.86473146 * v_factor, 0.0),
        mass,
        8.0,
        "#4444FF",
        false,
    );

    state.bodies.push(b1);
    state.bodies.push(b2);
    state.bodies.push(b3);
    state.prime_accelerations();
}

pub fn load_inclined_solar(state: &mut SimulationState) {
    state.clear();

    let sun_mass = 50000.0;
    add_sun(state, sun_mass, 20.0);

    // Varied inclinations (radians) and starting angles for visual variety
    let pi = std::f64::consts::PI;
    add_planet_inclined(state, "Mercury", 150.0, 0.055, 4.0, "#B5B5B5", sun_mass, 0.12, 0.0);
    add_planet_inclined(state, "Venus", 220.0, 0.815, 7.0, "#E8CDA0", sun_mass, 0.06, pi * 0.5);
    add_planet_inclined(state, "Earth", 300.0, 1.0, 8.0, "#4A90D9", sun_mass, 0.0, pi);
    add_planet_inclined(state, "Mars", 400.0, 0.107, 5.0, "#C1440E", sun_mass, 0.03, pi * 1.3);
    add_planet_inclined(state, "Jupiter", 550.0, 317.8, 14.0, "#C88B3A", sun_mass, 0.02, pi * 0.7);
    add_planet_inclined(state, "Saturn", 720.0, 95.2, 12.0, "#EAD6B8", sun_mass, 0.04, pi * 1.8);
    add_planet_inclined(state, "Uranus", 950.0, 14.5, 10.0, "#72B2C4", sun_mass, 0.14, pi * 0.3);
    add_planet_inclined(state, "Neptune", 1200.0, 17.1, 10.0, "#3B5BA5", sun_mass, 0.03, pi * 1.1);

    state.prime_accelerations();
}

pub fn load_solar_with_belt(state: &mut SimulationState) {
    state.clear();

    let sun_mass = 50000.0;
    add_sun(state, sun_mass, 20.0);

    // Inner planets
    add_planet(state, "Mercury", 120.0, 0.055, 3.0, "#B5B5B5", sun_mass);
    add_planet(state, "Venus", 180.0, 0.815, 6.0, "#E8CDA0", sun_mass);
    add_planet(state, "Earth", 250.0, 1.0, 7.0, "#4A90D9", sun_mass);
    add_planet(state, "Mars", 340.0, 0.107, 4.5, "#C1440E", sun_mass);

    // Asteroid belt between Mars and Jupiter
    let inner_radius = 380.0;
    let outer_radius = 460.0;
    let count = 200;
    let mut rng = rand::rng();

    for i in 0..count {
        let r = inner_radius + rng.random::<f64>() * (outer_radius - inner_radius);
        let angle = rng.random::<f64>() * std::f64::consts::TAU;
        let v = (state.g * sun_mass / r).sqrt();
        let v_perturb = 1.0 + (rng.random::<f64>() - 0.5) * 0.02;
        let incl = (rng.random::<f64>() - 0.5) * 0.1;

        let id = state.allocate_id();
        let body = CelestialBody::new(
            id,
            &format!("Asteroid {}", i),
            Vec3::new(r * angle.cos(), r * angle.sin(), 0.0),
            Vec3::new(
                -v * angle.sin() * v_perturb,
                v * angle.cos() * v_perturb * incl.cos(),
                v * incl.sin() * v_perturb,
            ),
            0.001,
            1.0,
            "#888888",
            false,
        );
        state.bodies.push(body);
    }

    // Jupiter beyond the belt
    add_planet(state, "Jupiter", 500.0, 317.8, 14.0, "#C88B3A", sun_mass);

    state.prime_accelerations();
}
