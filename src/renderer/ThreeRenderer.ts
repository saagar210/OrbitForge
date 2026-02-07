import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { SimulationFrame, CelestialBody } from "../types";

const STARFIELD_COUNT = 2000;
const STARFIELD_RADIUS = 50000;
const MAX_TRAIL_POINTS = 500;

interface BodyVisuals {
  group: THREE.Group;
  mesh: THREE.Mesh;
  glow: THREE.Sprite;
  light: THREE.PointLight | null;
  trail: THREE.Line;
  lastRadius: number;
  lastColor: string;
  lastIsFixed: boolean;
}

export class ThreeRenderer {
  private container: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  private bodyMap = new Map<number, BodyVisuals>();
  private groupsCache = new Map<number, THREE.Group>();
  private frame: SimulationFrame | null = null;
  private animationId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Starfield
  private starfield: THREE.Points | null = null;

  // Selection
  private selectedBodyId: number | null = null;
  private selectionRing: THREE.Mesh | null = null;

  // Follow-cam
  private followTargetId: number | null = null;

  // Prediction line
  private predictionLine: THREE.Line | null = null;

  // Collision flash sprites
  private collisionFlashes: { sprite: THREE.Sprite; birth: number }[] = [];

  // Glow texture (shared)
  private glowTexture: THREE.Texture;

  constructor(container: HTMLDivElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x000810, 1);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      100000,
    );
    this.camera.position.set(0, 0, 800);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minDistance = 50;
    this.controls.maxDistance = 50000;
    this.controls.enablePan = true;

    // Ambient light so non-star bodies aren't fully black
    const ambient = new THREE.AmbientLight(0xffffff, 0.15);
    this.scene.add(ambient);

    // Subtle hemisphere light
    const hemi = new THREE.HemisphereLight(0x4466aa, 0x000000, 0.1);
    this.scene.add(hemi);

    // Generate shared glow texture
    this.glowTexture = this.createGlowTexture();

    // Starfield
    this.createStarfield();

    // Selection ring
    this.createSelectionRing();
  }

  private createGlowTexture(): THREE.Texture {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2,
    );
    gradient.addColorStop(0, "rgba(255,255,255,0.6)");
    gradient.addColorStop(0.3, "rgba(255,255,255,0.2)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  private createStarfield() {
    const positions = new Float32Array(STARFIELD_COUNT * 3);
    for (let i = 0; i < STARFIELD_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = STARFIELD_RADIUS * (0.3 + Math.random() * 0.7);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.7,
    });
    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

  private createSelectionRing() {
    const ringGeom = new THREE.RingGeometry(1, 1.15, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    });
    this.selectionRing = new THREE.Mesh(ringGeom, ringMat);
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);
  }

  private createBodyVisuals(body: CelestialBody): BodyVisuals {
    const group = new THREE.Group();

    const color = new THREE.Color(body.color);

    // Sphere mesh
    const geometry = new THREE.SphereGeometry(body.radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: body.is_fixed ? color : new THREE.Color(0x000000),
      emissiveIntensity: body.is_fixed ? 0.8 : 0,
      roughness: body.is_fixed ? 0.3 : 0.7,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    // Glow sprite
    const spriteMat = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: color,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: body.is_fixed ? 0.8 : 0.4,
    });
    const glow = new THREE.Sprite(spriteMat);
    const glowScale = body.radius * (body.is_fixed ? 6 : 3);
    glow.scale.set(glowScale, glowScale, 1);
    group.add(glow);

    // Point light for stars/suns
    let light: THREE.PointLight | null = null;
    if (body.is_fixed) {
      light = new THREE.PointLight(color, 2, 5000);
      group.add(light);
    }

    // Trail line
    const trailPositions = new Float32Array(MAX_TRAIL_POINTS * 3);
    const trailGeom = new THREE.BufferGeometry();
    trailGeom.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
    trailGeom.setDrawRange(0, 0);
    const trailMat = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.4,
    });
    const trail = new THREE.Line(trailGeom, trailMat);
    this.scene.add(trail);

    group.position.set(body.position.x, body.position.y, 0);
    this.scene.add(group);

    return {
      group, mesh, glow, light, trail,
      lastRadius: body.radius,
      lastColor: body.color,
      lastIsFixed: body.is_fixed,
    };
  }

  updateFrame(frame: SimulationFrame) {
    this.frame = frame;
  }

  start() {
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    const render = () => {
      this.update();
      this.renderer.render(this.scene, this.camera);
      this.animationId = requestAnimationFrame(render);
    };
    render();
  }

  stop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Dispose all body visuals
    for (const [, visuals] of this.bodyMap) {
      this.disposeBodyVisuals(visuals);
    }
    this.bodyMap.clear();

    // Dispose starfield
    if (this.starfield) {
      this.starfield.geometry.dispose();
      (this.starfield.material as THREE.Material).dispose();
    }

    // Dispose selection ring
    if (this.selectionRing) {
      this.selectionRing.geometry.dispose();
      (this.selectionRing.material as THREE.Material).dispose();
    }

    // Dispose prediction line
    this.clearPrediction();

    // Dispose collision flashes
    for (const { sprite } of this.collisionFlashes) {
      (sprite.material as THREE.Material).dispose();
    }
    this.collisionFlashes = [];

    // Dispose shared texture
    this.glowTexture.dispose();

    // Remove canvas from DOM (guard against already-detached container)
    try {
      this.container.removeChild(this.renderer.domElement);
    } catch {
      // Container may already be unmounted by React
    }
    this.renderer.dispose();
  }

  private disposeBodyVisuals(visuals: BodyVisuals) {
    this.scene.remove(visuals.group);
    this.scene.remove(visuals.trail);
    visuals.mesh.geometry.dispose();
    (visuals.mesh.material as THREE.Material).dispose();
    (visuals.glow.material as THREE.Material).dispose();
    visuals.trail.geometry.dispose();
    (visuals.trail.material as THREE.Material).dispose();
  }

  private handleResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private update() {
    this.controls.update();

    if (!this.frame) return;

    const currentIds = new Set<number>();

    for (const body of this.frame.bodies) {
      currentIds.add(body.id);
      let visuals = this.bodyMap.get(body.id);

      if (!visuals) {
        visuals = this.createBodyVisuals(body);
        this.bodyMap.set(body.id, visuals);
      }

      // Update position
      visuals.group.position.set(body.position.x, body.position.y, 0);

      // Update visuals if body properties changed (e.g. via editor)
      this.syncBodyVisuals(visuals, body);

      // Update trail
      this.updateTrail(visuals, body);
    }

    // Rebuild groups cache for InteractionManager
    this.groupsCache.clear();
    for (const [id, v] of this.bodyMap) {
      this.groupsCache.set(id, v.group);
    }

    // Remove stale bodies
    for (const [id, visuals] of this.bodyMap) {
      if (!currentIds.has(id)) {
        this.disposeBodyVisuals(visuals);
        this.bodyMap.delete(id);
      }
    }

    // Update selection ring
    this.updateSelectionRing();

    // Update follow-cam
    this.updateFollowCam();

    // Update collision flashes
    this.updateCollisionFlashes();
  }

  private syncBodyVisuals(visuals: BodyVisuals, body: CelestialBody) {
    if (body.radius !== visuals.lastRadius) {
      visuals.mesh.geometry.dispose();
      visuals.mesh.geometry = new THREE.SphereGeometry(body.radius, 32, 32);
      const glowScale = body.radius * (body.is_fixed ? 6 : 3);
      visuals.glow.scale.set(glowScale, glowScale, 1);
      visuals.lastRadius = body.radius;
    }

    if (body.color !== visuals.lastColor) {
      const color = new THREE.Color(body.color);
      (visuals.mesh.material as THREE.MeshStandardMaterial).color.copy(color);
      (visuals.glow.material as THREE.SpriteMaterial).color.copy(color);
      (visuals.trail.material as THREE.LineBasicMaterial).color.copy(color);
      if (body.is_fixed) {
        (visuals.mesh.material as THREE.MeshStandardMaterial).emissive.copy(color);
      }
      if (visuals.light) visuals.light.color.copy(color);
      visuals.lastColor = body.color;
    }

    if (body.is_fixed !== visuals.lastIsFixed) {
      const mat = visuals.mesh.material as THREE.MeshStandardMaterial;
      const color = new THREE.Color(body.color);
      mat.emissive.copy(body.is_fixed ? color : new THREE.Color(0x000000));
      mat.emissiveIntensity = body.is_fixed ? 0.8 : 0;
      mat.roughness = body.is_fixed ? 0.3 : 0.7;
      (visuals.glow.material as THREE.SpriteMaterial).opacity = body.is_fixed ? 0.8 : 0.4;
      const glowScale = body.radius * (body.is_fixed ? 6 : 3);
      visuals.glow.scale.set(glowScale, glowScale, 1);

      if (body.is_fixed && !visuals.light) {
        visuals.light = new THREE.PointLight(color, 2, 5000);
        visuals.group.add(visuals.light);
      } else if (!body.is_fixed && visuals.light) {
        visuals.group.remove(visuals.light);
        visuals.light.dispose();
        visuals.light = null;
      }
      visuals.lastIsFixed = body.is_fixed;
    }
  }

  private updateTrail(visuals: BodyVisuals, body: CelestialBody) {
    const trail = body.trail;
    if (trail.length === 0) return;

    const posAttr = visuals.trail.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < trail.length && i < MAX_TRAIL_POINTS; i++) {
      posAttr.array[i * 3] = trail[i].x;
      posAttr.array[i * 3 + 1] = trail[i].y;
      posAttr.array[i * 3 + 2] = 0;
    }
    posAttr.needsUpdate = true;
    visuals.trail.geometry.setDrawRange(0, Math.min(trail.length, MAX_TRAIL_POINTS));
  }

  // --- Public API for interaction ---

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getRendererDomElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  getBodyGroups(): ReadonlyMap<number, THREE.Group> {
    return this.groupsCache;
  }

  setSelectedBody(id: number | null) {
    this.selectedBodyId = id;
  }

  private updateSelectionRing() {
    if (this.selectedBodyId === null || !this.selectionRing) {
      if (this.selectionRing) this.selectionRing.visible = false;
      return;
    }
    const visuals = this.bodyMap.get(this.selectedBodyId);
    if (!visuals) {
      this.selectionRing.visible = false;
      return;
    }
    const body = this.frame?.bodies.find((b) => b.id === this.selectedBodyId);
    if (!body) {
      this.selectionRing.visible = false;
      return;
    }

    const scale = body.radius * 1.8;
    this.selectionRing.scale.set(scale, scale, 1);
    this.selectionRing.position.copy(visuals.group.position);
    this.selectionRing.position.z = 0.1;
    this.selectionRing.visible = true;

    // Pulse effect
    const pulse = 0.9 + 0.1 * Math.sin(Date.now() * 0.005);
    this.selectionRing.scale.multiplyScalar(pulse);
  }

  // Follow-cam
  setFollowTarget(id: number | null) {
    this.followTargetId = id;
    if (id === null) {
      this.controls.target.set(0, 0, 0);
    }
  }

  private updateFollowCam() {
    if (this.followTargetId === null) return;
    const visuals = this.bodyMap.get(this.followTargetId);
    if (!visuals) {
      this.followTargetId = null;
      return;
    }
    const pos = visuals.group.position;
    this.controls.target.set(pos.x, pos.y, pos.z);
  }

  // Prediction path
  setPredictionPath(points: { x: number; y: number }[]) {
    this.clearPrediction();
    if (points.length < 2) return;

    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = 0;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineDashedMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      dashSize: 5,
      gapSize: 3,
    });
    this.predictionLine = new THREE.Line(geom, mat);
    this.predictionLine.computeLineDistances();
    this.scene.add(this.predictionLine);
  }

  clearPrediction() {
    if (this.predictionLine) {
      this.scene.remove(this.predictionLine);
      this.predictionLine.geometry.dispose();
      (this.predictionLine.material as THREE.Material).dispose();
      this.predictionLine = null;
    }
  }

  // Collision flash
  addCollisionFlash(x: number, y: number) {
    const spriteMat = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 1,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(x, y, 0);
    sprite.scale.set(10, 10, 1);
    this.scene.add(sprite);
    this.collisionFlashes.push({ sprite, birth: Date.now() });
  }

  private updateCollisionFlashes() {
    const now = Date.now();
    const duration = 500;
    this.collisionFlashes = this.collisionFlashes.filter(({ sprite, birth }) => {
      const age = now - birth;
      if (age > duration) {
        this.scene.remove(sprite);
        (sprite.material as THREE.Material).dispose();
        return false;
      }
      const t = age / duration;
      const scale = 10 + t * 80;
      sprite.scale.set(scale, scale, 1);
      (sprite.material as THREE.SpriteMaterial).opacity = 1 - t;
      return true;
    });
  }
}
