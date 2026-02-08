# OrbitForge

A real-time N-body gravity simulator where you can fling planets, crash stars, and pilot spacecraft through your own solar systems.

Built with Rust (physics) + React/Three.js (visuals) + Tauri 2 (desktop app).

![Tauri](https://img.shields.io/badge/Tauri_2-24C8D8?style=flat&logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=flat&logo=threedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)

## What You Can Do

**Create** — Place stars, planets, and spacecraft. Drag to set velocity. Build anything from a simple orbit to a full solar system.

**Simulate** — Watch gravity do its thing at up to 8x speed. Velocity Verlet integration keeps things accurate. Collisions merge bodies with momentum/mass/volume conservation.

**Fly** — Select a spacecraft, hit WASD, and thrust around. Shift doubles your power. Plan Hohmann transfers and gravity assists with the built-in tools.

**Explore** — Toggle orbital elements, Lagrange points, Kepler swept areas, gravity field heatmaps, orbital planes, energy graphs, and more. 13 visualization layers in total.

## Scenarios

| Preset | What it is |
|--------|-----------|
| Sun & Earth | The basics |
| Inner Solar System | Mercury through Mars |
| Outer Solar System | Jupiter through Neptune |
| Full Solar System | All 8 planets |
| Binary Star | Two stars in orbit |
| Figure-8 | Three bodies, one elegant loop |
| Inclined Solar | Tilted orbital planes |
| Asteroid Belt | Hundreds of rocks |
| Galaxy Collision | Two spiral galaxies smashing together |

Plus a **procedural generator** for creating custom systems.

## Performance

The physics engine scales automatically:

| Bodies | Algorithm | Complexity |
|--------|-----------|------------|
| < 50 | Brute force | O(n^2) |
| 50 - 500 | Barnes-Hut octree | O(n log n) |
| 500+ | wgpu compute shader | GPU-accelerated |

Simulation runs at 120Hz on a background thread. Rendering is decoupled via requestAnimationFrame.

## Controls

| Key | Action |
|-----|--------|
| `Space` | Pause / Play |
| `R` | Reset |
| `C` | Clear all bodies |
| `Esc` | Deselect |
| `W` `A` `S` `D` | Spacecraft thrust |
| `Shift` | Double thrust |
| `F11` | Screenshot mode |
| `F12` | Take screenshot |

Mouse: click to select, scroll to zoom, drag to orbit camera. In **Place** mode, click to drop a body and drag to set its velocity. **Slingshot** mode works the same way but reversed.

## Tech Stack

| Layer | Tech |
|-------|------|
| Physics engine | Rust (Velocity Verlet, Barnes-Hut, wgpu) |
| Desktop shell | Tauri 2 |
| UI framework | React 19 + Zustand |
| 3D renderer | Three.js (bloom, CSS2D labels, InstancedMesh) |
| Build tools | Vite, TypeScript (strict) |

16 Tauri IPC commands bridge the Rust simulation thread and the React frontend.

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

Requires [Rust](https://rustup.rs/), [Node.js](https://nodejs.org/), and the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).

## Features at a Glance

- 9 preset scenarios + procedural generation
- Real-time collision detection with conservation laws
- Orbit prediction and trail rendering
- Hohmann transfer calculator
- Gravity assist planner
- Mission system with objectives
- Minimap navigation
- Body info panel with orbital elements
- Energy graph (kinetic + potential + total)
- Lagrange point visualization
- Kepler swept area display
- Gravity field heatmap
- Save / Load / Share (JSON + clipboard)
- Video recording (WebM export)
- Spatial audio tied to collisions and events
