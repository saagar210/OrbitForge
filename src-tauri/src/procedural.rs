use crate::physics::{CelestialBody, Vec3};
use crate::simulation::SimulationState;
use rand::Rng;

pub fn generate_system(
    state: &mut SimulationState,
    star_mass: f64,
    planet_count: u32,
    min_spacing: f64,
    max_radius: f64,
) {
    state.clear();
    let mut rng = rand::rng();

    // Central star
    let star_id = state.allocate_id();
    let star_radius = (star_mass / 1000.0).cbrt().max(8.0).min(30.0);
    let hue = rng.random_range(30..60);
    let star_color = format!("hsl({}, 80%, 70%)", hue);
    let star = CelestialBody::new(
        star_id,
        "Star",
        Vec3::zero(),
        Vec3::zero(),
        star_mass,
        star_radius,
        &star_color,
        true,
    );
    state.bodies.push(star);

    // Generate planets
    let mut orbit_radius = min_spacing;
    let spacing_step = if planet_count > 1 {
        (max_radius - min_spacing) / (planet_count - 1) as f64
    } else {
        0.0
    };

    let planet_names = [
        "Alpha", "Beta", "Gamma", "Delta", "Epsilon",
        "Zeta", "Eta", "Theta", "Iota", "Kappa",
        "Lambda", "Mu", "Nu", "Xi", "Omicron",
        "Pi", "Rho", "Sigma", "Tau", "Upsilon",
    ];

    for i in 0..planet_count {
        let idx = i as usize;
        let name = if idx < planet_names.len() {
            planet_names[idx]
        } else {
            "Planet"
        };

        // Randomize orbit radius slightly
        let jitter = rng.random_range(-0.15..0.15) * spacing_step;
        let r = (orbit_radius + jitter).max(min_spacing);

        // Random mass (log-scale)
        let mass_exp = rng.random_range(-1.0..3.0_f64);
        let mass = 10.0_f64.powf(mass_exp);

        // Radius proportional to mass
        let radius = (mass.cbrt() * 3.0).max(2.0).min(18.0);

        // Random color
        let h = rng.random_range(0..360);
        let s = rng.random_range(40..80);
        let l = rng.random_range(50..80);
        let color = format!("hsl({}, {}%, {}%)", h, s, l);

        // Circular orbital velocity
        let v = (state.g * star_mass / r).sqrt();

        // Random starting angle
        let angle = rng.random_range(0.0..std::f64::consts::TAU);

        // Small random inclination
        let inclination = rng.random_range(-0.15..0.15_f64);

        let px = r * angle.cos();
        let py = r * angle.sin();
        let vx = -v * angle.sin() * inclination.cos();
        let vy = v * angle.cos() * inclination.cos();
        let vz = v * inclination.sin();

        let planet_id = state.allocate_id();
        let body = CelestialBody::new(
            planet_id,
            name,
            Vec3::new(px, py, 0.0),
            Vec3::new(vx, vy, vz),
            mass,
            radius,
            &color,
            false,
        );
        state.bodies.push(body);

        orbit_radius += spacing_step;
    }

    state.prime_accelerations();
}
