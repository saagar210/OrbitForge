import * as THREE from "three";
import type { SimulationFrame, CelestialBody } from "../types";

const NUM_SEGMENTS = 8;
const COLORS = [
  new THREE.Color(0x4488ff),
  new THREE.Color(0xff8844),
];

export class KeplerOverlay {
  private mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.MeshBasicMaterial;
  private visible = false;

  constructor(scene: THREE.Scene) {
    // Max triangles: each segment is a fan from central body through ~60 trail points
    // Preallocate for worst case
    const maxTriangles = NUM_SEGMENTS * 100;
    const positions = new Float32Array(maxTriangles * 3 * 3);
    const colors = new Float32Array(maxTriangles * 3 * 3);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.mesh.visible = visible;
    if (!visible) this.geometry.setDrawRange(0, 0);
  }

  update(frame: SimulationFrame, selectedBodyId: number | null) {
    if (!this.visible || selectedBodyId === null) {
      this.mesh.visible = false;
      return;
    }

    const body = frame.bodies.find((b) => b.id === selectedBodyId);
    if (!body || body.is_fixed || body.trail.length < 10) {
      this.mesh.visible = false;
      return;
    }

    // Find central body (largest gravitational influence)
    const central = this.findCentral(body, frame.bodies);
    if (!central) {
      this.mesh.visible = false;
      return;
    }

    const cx = central.position.x;
    const cy = central.position.y;
    const cz = central.position.z;
    const trail = body.trail;

    // Divide trail into equal segments
    const segLen = Math.floor(trail.length / NUM_SEGMENTS);
    if (segLen < 2) {
      this.mesh.visible = false;
      return;
    }

    const posAttr = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const colorAttr = this.geometry.getAttribute("color") as THREE.BufferAttribute;
    let vertIdx = 0;

    for (let s = 0; s < NUM_SEGMENTS; s++) {
      const start = s * segLen;
      const end = Math.min(start + segLen, trail.length);
      const color = COLORS[s % 2];

      for (let i = start; i < end - 1; i++) {
        if (vertIdx + 9 > posAttr.array.length) break;

        // Triangle: central → trail[i] → trail[i+1]
        posAttr.array[vertIdx] = cx;
        posAttr.array[vertIdx + 1] = cy;
        posAttr.array[vertIdx + 2] = cz;

        posAttr.array[vertIdx + 3] = trail[i].x;
        posAttr.array[vertIdx + 4] = trail[i].y;
        posAttr.array[vertIdx + 5] = trail[i].z;

        posAttr.array[vertIdx + 6] = trail[i + 1].x;
        posAttr.array[vertIdx + 7] = trail[i + 1].y;
        posAttr.array[vertIdx + 8] = trail[i + 1].z;

        // Colors
        colorAttr.array[vertIdx] = color.r;
        colorAttr.array[vertIdx + 1] = color.g;
        colorAttr.array[vertIdx + 2] = color.b;
        colorAttr.array[vertIdx + 3] = color.r;
        colorAttr.array[vertIdx + 4] = color.g;
        colorAttr.array[vertIdx + 5] = color.b;
        colorAttr.array[vertIdx + 6] = color.r;
        colorAttr.array[vertIdx + 7] = color.g;
        colorAttr.array[vertIdx + 8] = color.b;

        vertIdx += 9;
      }
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    this.geometry.setDrawRange(0, vertIdx / 3);
    this.mesh.visible = true;
  }

  private findCentral(
    body: CelestialBody,
    bodies: CelestialBody[],
  ): CelestialBody | null {
    const G = 100;
    let best = 0;
    let central: CelestialBody | null = null;
    for (const other of bodies) {
      if (other.id === body.id) continue;
      const dx = other.position.x - body.position.x;
      const dy = other.position.y - body.position.y;
      const dz = other.position.z - body.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 0.001) continue;
      const influence = G * other.mass / (dist * dist);
      if (influence > best) {
        best = influence;
        central = other;
      }
    }
    return central;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
