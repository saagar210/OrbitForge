import * as THREE from "three";

const MAX_PARTICLES = 500;
const PARTICLE_LIFETIME = 0.5; // seconds

interface Particle {
  active: boolean;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

export class ParticleSystem {
  private points: THREE.Points;
  private particles: Particle[];
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private lastTime = 0;

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.sizes = new Float32Array(MAX_PARTICLES);

    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
    }));

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(this.sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, material);
    scene.add(this.points);
    this.lastTime = performance.now() / 1000;
  }

  spawn(x: number, y: number, z: number, count: number, color: THREE.Color) {
    const numToSpawn = Math.min(count, 16);
    let spawned = 0;
    for (let i = 0; i < MAX_PARTICLES && spawned < numToSpawn; i++) {
      if (this.particles[i].active) continue;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 30 + Math.random() * 120;

      this.particles[i].active = true;
      this.particles[i].vx = Math.sin(phi) * Math.cos(theta) * speed;
      this.particles[i].vy = Math.sin(phi) * Math.sin(theta) * speed;
      this.particles[i].vz = Math.cos(phi) * speed;
      this.particles[i].life = PARTICLE_LIFETIME;

      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;

      // Randomize color slightly
      const hueShift = (Math.random() - 0.5) * 0.1;
      const hsl = { h: 0, s: 0, l: 0 };
      color.getHSL(hsl);
      const c = new THREE.Color().setHSL(hsl.h + hueShift, hsl.s, hsl.l);
      this.colors[i * 3] = c.r;
      this.colors[i * 3 + 1] = c.g;
      this.colors[i * 3 + 2] = c.b;

      this.sizes[i] = 2 + Math.random() * 4;

      spawned++;
    }
  }

  update() {
    const now = performance.now() / 1000;
    const dt = Math.min(now - this.lastTime, 0.05);
    this.lastTime = now;

    let anyActive = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.sizes[i] = 0;
        continue;
      }

      anyActive = true;

      // Move
      this.positions[i * 3] += p.vx * dt;
      this.positions[i * 3 + 1] += p.vy * dt;
      this.positions[i * 3 + 2] += p.vz * dt;

      // Fade and shrink
      const t = p.life / PARTICLE_LIFETIME;
      this.sizes[i] = (2 + Math.random() * 2) * t;

      // Slow down
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.vz *= 0.98;
    }

    if (anyActive) {
      const posAttr = this.points.geometry.getAttribute("position") as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
      const sizeAttr = this.points.geometry.getAttribute("size") as THREE.BufferAttribute;
      sizeAttr.needsUpdate = true;
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.points);
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
