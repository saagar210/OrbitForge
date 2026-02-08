import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { ParticleSystem } from "./ParticleSystem";
import { KeplerOverlay } from "./KeplerOverlay";
import { VideoRecorder } from "../utils/videoRecorder";
import { computeLagrangePoints, findTwoBodyPair } from "../utils/lagrangePoints";
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
  label: CSS2DObject;
  velocityArrow: THREE.ArrowHelper | null;
  accelArrow: THREE.ArrowHelper | null;
  cometTail: THREE.Sprite | null;
  orbitalPlane: THREE.Mesh | null;
  lastRadius: number;
  lastColor: string;
  lastIsFixed: boolean;
  lastName: string;
}

export class ThreeRenderer {
  private container: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private labelRenderer: CSS2DRenderer;
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

  // Debris particles
  private particleSystem: ParticleSystem;

  // Barycenter crosshair
  private barycenter: THREE.Group | null = null;
  private showBarycenter = false;

  // Lagrange point markers
  private lagrangeMarkers: THREE.Sprite[] = [];
  private lagrangeLabels: CSS2DObject[] = [];
  private showLagrangePoints = false;

  // Kepler's Laws overlay
  private keplerOverlay: KeplerOverlay;

  // Gravity field heatmap
  private gravityField: THREE.Mesh | null = null;
  private gravityMaterial: THREE.ShaderMaterial | null = null;
  private showGravityField = false;

  // Display toggles
  private labelsVisible = true;
  private vectorsVisible = false;
  private orbitalPlanesVisible = false;

  // Video recording
  private videoRecorder = new VideoRecorder();

  // InstancedMesh for small bodies (asteroids)
  private static readonly SMALL_BODY_THRESHOLD = 0.1;
  private static readonly MAX_INSTANCES = 2000;
  private instancedMesh: THREE.InstancedMesh | null = null;
  private instancedIds: number[] = []; // maps instance index → body id
  private tempMatrix = new THREE.Matrix4();

  constructor(container: HTMLDivElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
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

    // Bloom post-processing
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      1.5,  // strength
      0.4,  // radius
      0.6,  // threshold
    );
    this.composer.addPass(bloomPass);

    // CSS2D label renderer (overlay)
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.top = "0";
    this.labelRenderer.domElement.style.left = "0";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    container.appendChild(this.labelRenderer.domElement);

    // Generate shared glow texture
    this.glowTexture = this.createGlowTexture();

    // Debris particle system
    this.particleSystem = new ParticleSystem(this.scene);

    // Starfield
    this.createStarfield();

    // Gravity field heatmap
    this.createGravityField();

    // Kepler overlay
    this.keplerOverlay = new KeplerOverlay(this.scene);

    // Lagrange point markers
    this.createLagrangeMarkers();

    // Barycenter crosshair
    this.createBarycenter();

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

  private createGravityField() {
    const MAX_BODIES = 32;
    this.gravityMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        bodyPositions: { value: new Float32Array(MAX_BODIES * 2) },
        bodyMasses: { value: new Float32Array(MAX_BODIES) },
        bodyCount: { value: 0 },
        G: { value: 100.0 },
      },
      vertexShader: `
        varying vec2 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xy;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float bodyPositions[${MAX_BODIES * 2}];
        uniform float bodyMasses[${MAX_BODIES}];
        uniform int bodyCount;
        uniform float G;
        varying vec2 vWorldPos;

        vec3 viridis(float t) {
          // Simplified Viridis colormap
          t = clamp(t, 0.0, 1.0);
          vec3 c0 = vec3(0.267, 0.004, 0.329);
          vec3 c1 = vec3(0.282, 0.140, 0.458);
          vec3 c2 = vec3(0.127, 0.566, 0.551);
          vec3 c3 = vec3(0.993, 0.906, 0.144);
          if (t < 0.33) return mix(c0, c1, t / 0.33);
          if (t < 0.66) return mix(c1, c2, (t - 0.33) / 0.33);
          return mix(c2, c3, (t - 0.66) / 0.34);
        }

        void main() {
          float potential = 0.0;
          for (int i = 0; i < ${MAX_BODIES}; i++) {
            if (i >= bodyCount) break;
            vec2 bpos = vec2(bodyPositions[i*2], bodyPositions[i*2+1]);
            float mass = bodyMasses[i];
            float dist = length(vWorldPos - bpos);
            if (dist < 1.0) dist = 1.0;
            potential += G * mass / dist;
          }
          // Log scale for better visualization
          float logP = log(potential + 1.0) / 10.0;
          vec3 color = viridis(clamp(logP, 0.0, 1.0));
          gl_FragColor = vec4(color, 0.25);
        }
      `,
    });

    const geom = new THREE.PlaneGeometry(20000, 20000, 1, 1);
    this.gravityField = new THREE.Mesh(geom, this.gravityMaterial);
    this.gravityField.position.z = -1;
    this.gravityField.visible = false;
    this.scene.add(this.gravityField);
  }

  private createLagrangeMarkers() {
    const names = ["L1", "L2", "L3", "L4", "L5"];
    for (const name of names) {
      const mat = new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0x00ffcc,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.6,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(8, 8, 1);
      sprite.visible = false;
      this.scene.add(sprite);
      this.lagrangeMarkers.push(sprite);

      // Label
      const div = document.createElement("div");
      div.textContent = name;
      div.style.cssText = "color:#00ffcc;font-size:9px;text-shadow:0 0 4px #000;font-family:sans-serif;";
      const label = new CSS2DObject(div);
      label.position.set(0, 6, 0);
      label.visible = false;
      sprite.add(label);
      this.lagrangeLabels.push(label);
    }
  }

  private createBarycenter() {
    this.barycenter = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.7 });
    const size = 8;
    // Horizontal line
    const hGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-size, 0, 0), new THREE.Vector3(size, 0, 0),
    ]);
    this.barycenter.add(new THREE.Line(hGeom, mat));
    // Vertical line
    const vGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -size, 0), new THREE.Vector3(0, size, 0),
    ]);
    this.barycenter.add(new THREE.Line(vGeom, mat));
    this.barycenter.visible = false;
    this.scene.add(this.barycenter);
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

  private ensureInstancedMesh() {
    if (this.instancedMesh) return;
    const geom = new THREE.SphereGeometry(1, 8, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.8,
      metalness: 0.1,
    });
    this.instancedMesh = new THREE.InstancedMesh(geom, mat, ThreeRenderer.MAX_INSTANCES);
    this.instancedMesh.count = 0;
    this.instancedMesh.frustumCulled = false;
    this.scene.add(this.instancedMesh);
  }

  private isSmallBody(body: CelestialBody): boolean {
    return body.mass < ThreeRenderer.SMALL_BODY_THRESHOLD && !body.is_fixed && body.body_type !== "spacecraft";
  }

  private createBodyVisuals(body: CelestialBody): BodyVisuals {
    const group = new THREE.Group();

    const color = new THREE.Color(body.color);

    // Mesh geometry: cone for spacecraft, sphere for others
    const isSpacecraft = body.body_type === "spacecraft";
    const geometry = isSpacecraft
      ? new THREE.ConeGeometry(body.radius * 0.6, body.radius * 2, 8)
      : new THREE.SphereGeometry(body.radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: body.is_fixed ? color : (isSpacecraft ? new THREE.Color(0x224466) : new THREE.Color(0x000000)),
      emissiveIntensity: body.is_fixed ? 2.0 : (isSpacecraft ? 0.5 : 0),
      roughness: body.is_fixed ? 0.3 : 0.7,
      metalness: isSpacecraft ? 0.4 : 0.1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    if (isSpacecraft) {
      mesh.rotation.x = -Math.PI / 2; // Point cone forward (+Y by default)
    }
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

    // Trail line with per-vertex speed-based colors
    const trailPositions = new Float32Array(MAX_TRAIL_POINTS * 3);
    const trailColors = new Float32Array(MAX_TRAIL_POINTS * 3);
    const trailGeom = new THREE.BufferGeometry();
    trailGeom.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
    trailGeom.setAttribute("color", new THREE.BufferAttribute(trailColors, 3));
    trailGeom.setDrawRange(0, 0);
    const trailMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
    });
    const trail = new THREE.Line(trailGeom, trailMat);
    this.scene.add(trail);

    // Comet tail sprite (initially hidden)
    const cometTailMat = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: new THREE.Color(body.color).lerp(new THREE.Color(0xffffff), 0.5),
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0,
    });
    const cometTail = new THREE.Sprite(cometTailMat);
    cometTail.visible = false;
    group.add(cometTail);

    // Orbital plane disc (for non-fixed bodies)
    let orbitalPlane: THREE.Mesh | null = null;
    if (!body.is_fixed) {
      const planeGeom = new THREE.CircleGeometry(1, 64);
      const planeMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      orbitalPlane = new THREE.Mesh(planeGeom, planeMat);
      orbitalPlane.visible = false;
      this.scene.add(orbitalPlane);
    }

    // Velocity/acceleration arrows
    const velocityArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0x4488ff, 3, 2,
    );
    velocityArrow.visible = this.vectorsVisible;
    group.add(velocityArrow);

    const accelArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0xff4444, 3, 2,
    );
    accelArrow.visible = this.vectorsVisible;
    group.add(accelArrow);

    // Name label
    const labelDiv = document.createElement("div");
    labelDiv.textContent = body.name;
    labelDiv.style.cssText = "color:#fff;font-size:10px;text-shadow:0 0 4px #000;font-family:sans-serif;";
    const label = new CSS2DObject(labelDiv);
    label.position.set(0, body.radius + 5, 0);
    label.visible = this.labelsVisible;
    group.add(label);

    group.position.set(body.position.x, body.position.y, body.position.z);
    this.scene.add(group);

    return {
      group, mesh, glow, light, trail, label,
      velocityArrow, accelArrow, cometTail, orbitalPlane,
      lastRadius: body.radius,
      lastColor: body.color,
      lastIsFixed: body.is_fixed,
      lastName: body.name,
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
      this.composer.render();
      this.labelRenderer.render(this.scene, this.camera);
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

    // Dispose instanced mesh
    if (this.instancedMesh) {
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.scene.remove(this.instancedMesh);
      this.instancedMesh = null;
    }

    // Dispose starfield
    if (this.starfield) {
      this.starfield.geometry.dispose();
      (this.starfield.material as THREE.Material).dispose();
    }

    // Dispose barycenter
    if (this.barycenter) {
      this.barycenter.children.forEach((c) => {
        if (c instanceof THREE.Line) {
          c.geometry.dispose();
          (c.material as THREE.Material).dispose();
        }
      });
      this.scene.remove(this.barycenter);
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

    // Dispose Kepler overlay
    this.keplerOverlay.dispose(this.scene);

    // Dispose debris particles
    this.particleSystem.dispose(this.scene);

    // Dispose post-processing
    this.composer.dispose();

    // Dispose shared texture
    this.glowTexture.dispose();

    // Remove canvases from DOM (guard against already-detached container)
    try {
      this.container.removeChild(this.renderer.domElement);
      this.container.removeChild(this.labelRenderer.domElement);
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
    if (visuals.orbitalPlane) {
      this.scene.remove(visuals.orbitalPlane);
      visuals.orbitalPlane.geometry.dispose();
      (visuals.orbitalPlane.material as THREE.Material).dispose();
    }
  }

  private handleResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }

  private update() {
    this.controls.update();

    if (!this.frame) return;

    const currentIds = new Set<number>();
    let instanceIdx = 0;

    for (const body of this.frame.bodies) {
      currentIds.add(body.id);

      // Small bodies (asteroids) use instanced rendering
      if (this.isSmallBody(body)) {
        this.ensureInstancedMesh();
        if (instanceIdx < ThreeRenderer.MAX_INSTANCES) {
          this.tempMatrix.makeScale(body.radius, body.radius, body.radius);
          this.tempMatrix.setPosition(body.position.x, body.position.y, body.position.z);
          this.instancedMesh!.setMatrixAt(instanceIdx, this.tempMatrix);
          this.instancedIds[instanceIdx] = body.id;
          instanceIdx++;
        }
        // Remove full visuals if they exist (body mass might have changed)
        const existing = this.bodyMap.get(body.id);
        if (existing) {
          this.disposeBodyVisuals(existing);
          this.bodyMap.delete(body.id);
        }
        continue;
      }

      let visuals = this.bodyMap.get(body.id);

      if (!visuals) {
        visuals = this.createBodyVisuals(body);
        this.bodyMap.set(body.id, visuals);
      }

      // Update position
      visuals.group.position.set(body.position.x, body.position.y, body.position.z);

      // Update visuals if body properties changed (e.g. via editor)
      this.syncBodyVisuals(visuals, body);

      // Orient spacecraft cone toward velocity
      if (body.body_type === "spacecraft") {
        const vMag = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2 + body.velocity.z ** 2);
        if (vMag > 0.01) {
          const dir = new THREE.Vector3(body.velocity.x / vMag, body.velocity.y / vMag, body.velocity.z / vMag);
          const up = new THREE.Vector3(0, 1, 0);
          const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
          visuals.mesh.quaternion.copy(quat);
        }
      }

      // Update velocity/acceleration arrows
      if (this.vectorsVisible) {
        this.updateArrows(visuals, body);
      }

      // Spacecraft exhaust particles
      if (body.body_type === "spacecraft" && body.fuel > 0) {
        const thrustMag = Math.sqrt(body.thrust.x ** 2 + body.thrust.y ** 2 + body.thrust.z ** 2);
        if (thrustMag > 0.1) {
          const exhaustColor = new THREE.Color(0xff6600);
          this.particleSystem.spawn(
            body.position.x, body.position.y, body.position.z,
            2, exhaustColor,
          );
        }
      }

      // Update comet tail
      this.updateCometTail(visuals, body);

      // Update orbital plane
      if (this.orbitalPlanesVisible) {
        this.updateOrbitalPlane(visuals, body);
      }

      // Update trail
      this.updateTrail(visuals, body);
    }

    // Finalize instanced mesh count
    if (this.instancedMesh) {
      this.instancedMesh.count = instanceIdx;
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      this.instancedIds.length = instanceIdx;
    }

    // Remove stale bodies before rebuilding cache
    for (const [id, visuals] of this.bodyMap) {
      if (!currentIds.has(id)) {
        this.disposeBodyVisuals(visuals);
        this.bodyMap.delete(id);
      }
    }

    // Rebuild groups cache for InteractionManager
    this.groupsCache.clear();
    for (const [id, v] of this.bodyMap) {
      this.groupsCache.set(id, v.group);
    }

    // Update selection ring
    this.updateSelectionRing();

    // Update follow-cam
    this.updateFollowCam();

    // Update collision flashes
    this.updateCollisionFlashes();

    // Update debris particles
    this.particleSystem.update();

    // Update barycenter
    this.updateBarycenter();

    // Update Lagrange points
    this.updateLagrangePoints();

    // Update Kepler overlay
    if (this.frame) {
      this.keplerOverlay.update(this.frame, this.selectedBodyId);
    }

    // Update gravity field
    this.updateGravityField();
  }

  private syncBodyVisuals(visuals: BodyVisuals, body: CelestialBody) {
    if (body.radius !== visuals.lastRadius) {
      visuals.mesh.geometry.dispose();
      visuals.mesh.geometry = body.body_type === "spacecraft"
        ? new THREE.ConeGeometry(body.radius * 0.6, body.radius * 2, 8)
        : new THREE.SphereGeometry(body.radius, 32, 32);
      const glowScale = body.radius * (body.is_fixed ? 6 : 3);
      visuals.glow.scale.set(glowScale, glowScale, 1);
      visuals.label.position.set(0, body.radius + 5, 0);
      visuals.lastRadius = body.radius;
    }

    if (body.name !== visuals.lastName) {
      (visuals.label.element as HTMLDivElement).textContent = body.name;
      visuals.lastName = body.name;
    }

    if (body.color !== visuals.lastColor) {
      const color = new THREE.Color(body.color);
      (visuals.mesh.material as THREE.MeshStandardMaterial).color.copy(color);
      (visuals.glow.material as THREE.SpriteMaterial).color.copy(color);
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
      mat.emissiveIntensity = body.is_fixed ? 2.0 : 0;
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
    const colorAttr = visuals.trail.geometry.getAttribute("color") as THREE.BufferAttribute;

    // Find speed range for normalization
    let maxSpeed = 0;
    for (let i = 0; i < trail.length && i < MAX_TRAIL_POINTS; i++) {
      if (trail[i].speed > maxSpeed) maxSpeed = trail[i].speed;
    }
    if (maxSpeed < 0.001) maxSpeed = 1;

    const tmpColor = new THREE.Color();
    for (let i = 0; i < trail.length && i < MAX_TRAIL_POINTS; i++) {
      posAttr.array[i * 3] = trail[i].x;
      posAttr.array[i * 3 + 1] = trail[i].y;
      posAttr.array[i * 3 + 2] = trail[i].z;

      // Map speed → hue: blue (0.66) at slow → red (0.0) at fast
      const t = trail[i].speed / maxSpeed;
      tmpColor.setHSL(0.66 * (1 - t), 1, 0.5);
      colorAttr.array[i * 3] = tmpColor.r;
      colorAttr.array[i * 3 + 1] = tmpColor.g;
      colorAttr.array[i * 3 + 2] = tmpColor.b;
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    visuals.trail.geometry.setDrawRange(0, Math.min(trail.length, MAX_TRAIL_POINTS));
  }

  private updateBarycenter() {
    if (!this.barycenter || !this.showBarycenter || !this.frame) {
      if (this.barycenter) this.barycenter.visible = false;
      return;
    }
    const bodies = this.frame.bodies;
    if (bodies.length === 0) {
      this.barycenter.visible = false;
      return;
    }
    let totalMass = 0;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const b of bodies) {
      totalMass += b.mass;
      cx += b.mass * b.position.x;
      cy += b.mass * b.position.y;
      cz += b.mass * b.position.z;
    }
    cx /= totalMass;
    cy /= totalMass;
    cz /= totalMass;
    this.barycenter.position.set(cx, cy, cz);
    this.barycenter.visible = true;
  }

  private updateGravityField() {
    if (!this.gravityField || !this.gravityMaterial) return;
    if (!this.showGravityField || !this.frame) {
      this.gravityField.visible = false;
      return;
    }

    const bodies = this.frame.bodies;
    const maxBodies = 32;
    const count = Math.min(bodies.length, maxBodies);
    const positions = this.gravityMaterial.uniforms.bodyPositions.value as Float32Array;
    const masses = this.gravityMaterial.uniforms.bodyMasses.value as Float32Array;

    for (let i = 0; i < count; i++) {
      positions[i * 2] = bodies[i].position.x;
      positions[i * 2 + 1] = bodies[i].position.y;
      masses[i] = bodies[i].mass;
    }
    this.gravityMaterial.uniforms.bodyCount.value = count;
    this.gravityField.visible = true;
  }

  private updateLagrangePoints() {
    if (!this.showLagrangePoints || !this.frame) {
      for (const m of this.lagrangeMarkers) m.visible = false;
      for (const l of this.lagrangeLabels) l.visible = false;
      return;
    }

    const pair = findTwoBodyPair(this.frame.bodies);
    if (!pair) {
      for (const m of this.lagrangeMarkers) m.visible = false;
      for (const l of this.lagrangeLabels) l.visible = false;
      return;
    }

    const lp = computeLagrangePoints(
      pair.primary.position, pair.primary.mass,
      pair.secondary.position, pair.secondary.mass,
    );

    const points = [lp.L1, lp.L2, lp.L3, lp.L4, lp.L5];
    for (let i = 0; i < 5; i++) {
      this.lagrangeMarkers[i].position.set(points[i].x, points[i].y, points[i].z);
      this.lagrangeMarkers[i].visible = true;
      this.lagrangeLabels[i].visible = true;
    }
  }

  private updateCometTail(visuals: BodyVisuals, body: CelestialBody) {
    if (!visuals.cometTail || !this.frame) return;

    // Find nearest fixed (star) body
    let nearestStar: CelestialBody | null = null;
    let nearestDist = Infinity;
    for (const other of this.frame.bodies) {
      if (!other.is_fixed || other.id === body.id) continue;
      const dx = other.position.x - body.position.x;
      const dy = other.position.y - body.position.y;
      const dz = other.position.z - body.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestStar = other;
      }
    }

    const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2 + body.velocity.z ** 2);
    const showTail = nearestStar && speed > 1.5 && nearestDist < 2000 && !body.is_fixed;

    if (showTail && nearestStar) {
      // Point tail AWAY from star
      const dx = body.position.x - nearestStar.position.x;
      const dy = body.position.y - nearestStar.position.y;
      const angle = Math.atan2(dy, dx);

      const tailLength = Math.min(speed * 3, 120) * body.radius * 0.15;
      const tailWidth = body.radius * 1.5;

      visuals.cometTail.scale.set(tailLength, tailWidth, 1);
      // Offset tail center behind the body (away from star)
      visuals.cometTail.position.set(
        Math.cos(angle) * tailLength * 0.4,
        Math.sin(angle) * tailLength * 0.4,
        0,
      );
      visuals.cometTail.material.rotation = angle;
      const intensity = Math.min(speed / 10, 0.6);
      (visuals.cometTail.material as THREE.SpriteMaterial).opacity = intensity;
      visuals.cometTail.visible = true;
    } else {
      visuals.cometTail.visible = false;
    }
  }

  private updateArrows(visuals: BodyVisuals, body: CelestialBody) {
    const vel = body.velocity;
    const velMag = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
    if (visuals.velocityArrow) {
      if (velMag > 0.001) {
        visuals.velocityArrow.setDirection(new THREE.Vector3(vel.x / velMag, vel.y / velMag, vel.z / velMag));
        visuals.velocityArrow.setLength(Math.min(velMag * 10, 100), 3, 2);
        visuals.velocityArrow.visible = true;
      } else {
        visuals.velocityArrow.visible = false;
      }
    }

    const acc = body.acceleration;
    const accMag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    if (visuals.accelArrow) {
      if (accMag > 0.0001) {
        visuals.accelArrow.setDirection(new THREE.Vector3(acc.x / accMag, acc.y / accMag, acc.z / accMag));
        visuals.accelArrow.setLength(Math.min(accMag * 50, 80), 3, 2);
        visuals.accelArrow.visible = true;
      } else {
        visuals.accelArrow.visible = false;
      }
    }
  }

  private updateOrbitalPlane(visuals: BodyVisuals, body: CelestialBody) {
    if (!visuals.orbitalPlane || !this.frame) return;

    // Find dominant body (largest mass that isn't this body)
    let dominant: CelestialBody | null = null;
    for (const b of this.frame.bodies) {
      if (b.id === body.id) continue;
      if (!dominant || b.mass > dominant.mass) dominant = b;
    }
    if (!dominant) {
      visuals.orbitalPlane.visible = false;
      return;
    }

    // Position vector from dominant body to this body
    const rx = body.position.x - dominant.position.x;
    const ry = body.position.y - dominant.position.y;
    const rz = body.position.z - dominant.position.z;
    const orbitRadius = Math.sqrt(rx * rx + ry * ry + rz * rz);

    if (orbitRadius < 1) {
      visuals.orbitalPlane.visible = false;
      return;
    }

    // Angular momentum L = r x v (for orbital plane normal)
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const vz = body.velocity.z;
    const lx = ry * vz - rz * vy;
    const ly = rz * vx - rx * vz;
    const lz = rx * vy - ry * vx;
    const lMag = Math.sqrt(lx * lx + ly * ly + lz * lz);

    if (lMag < 0.001) {
      visuals.orbitalPlane.visible = false;
      return;
    }

    // Orient disc: normal = angular momentum direction
    const normal = new THREE.Vector3(lx / lMag, ly / lMag, lz / lMag);
    const up = new THREE.Vector3(0, 0, 1);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);

    visuals.orbitalPlane.quaternion.copy(quat);
    visuals.orbitalPlane.position.set(dominant.position.x, dominant.position.y, dominant.position.z);
    visuals.orbitalPlane.scale.setScalar(orbitRadius * 1.2);
    visuals.orbitalPlane.visible = true;
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

  setControlsEnabled(enabled: boolean) {
    this.controls.enabled = enabled;
  }

  setLabelsVisible(visible: boolean) {
    this.labelsVisible = visible;
    for (const [, visuals] of this.bodyMap) {
      visuals.label.visible = visible;
    }
  }

  setShowVectors(show: boolean) {
    this.vectorsVisible = show;
    for (const [, visuals] of this.bodyMap) {
      if (visuals.velocityArrow) visuals.velocityArrow.visible = show;
      if (visuals.accelArrow) visuals.accelArrow.visible = show;
    }
  }

  takeScreenshot(scale = 2): string {
    const w = this.container.clientWidth * scale;
    const h = this.container.clientHeight * scale;
    const oldW = this.renderer.domElement.width;
    const oldH = this.renderer.domElement.height;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer.render();
    const dataUrl = this.renderer.domElement.toDataURL("image/png");
    this.renderer.setSize(oldW, oldH, false);
    this.composer.setSize(oldW, oldH);
    this.camera.aspect = oldW / oldH;
    this.camera.updateProjectionMatrix();
    return dataUrl;
  }

  setShowOrbitalPlanes(show: boolean) {
    this.orbitalPlanesVisible = show;
    for (const [, visuals] of this.bodyMap) {
      if (visuals.orbitalPlane) {
        visuals.orbitalPlane.visible = show;
      }
    }
  }

  setShowGravityField(show: boolean) {
    this.showGravityField = show;
  }

  setShowKeplerAreas(show: boolean) {
    this.keplerOverlay.setVisible(show);
  }

  setShowLagrangePoints(show: boolean) {
    this.showLagrangePoints = show;
  }

  setShowBarycenter(show: boolean) {
    this.showBarycenter = show;
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
    this.selectionRing.position.z += 0.1;
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
  setPredictionPath(points: { x: number; y: number; z: number }[]) {
    this.clearPrediction();
    if (points.length < 2) return;

    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = points[i].z;
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
  addCollisionFlash(x: number, y: number, z = 0) {
    const spriteMat = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 1,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(x, y, z);
    sprite.scale.set(10, 10, 1);
    this.scene.add(sprite);
    this.collisionFlashes.push({ sprite, birth: Date.now() });

    // Spawn debris particles
    const debrisColor = new THREE.Color(0xff8844);
    this.particleSystem.spawn(x, y, z, 12, debrisColor);
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

  startRecording(): boolean {
    return this.videoRecorder.start(this.renderer.domElement, 30);
  }

  async stopRecording(): Promise<void> {
    const blob = await this.videoRecorder.stop();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orbitforge-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }

  get isRecording(): boolean {
    return this.videoRecorder.recording;
  }
}
