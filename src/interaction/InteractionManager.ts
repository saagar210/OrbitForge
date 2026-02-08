import * as THREE from "three";
import { invoke } from "@tauri-apps/api/core";
import type { ThreeRenderer } from "../renderer/ThreeRenderer";
import type { InteractionMode } from "../types";

export class InteractionManager {
  private renderer: ThreeRenderer;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  private mode: InteractionMode = "select";
  private onSelect: (id: number | null) => void;

  // Slingshot state
  private slingshotBodyId: number | null = null;
  private slingshotStart: THREE.Vector3 | null = null;
  private slingshotPlane: THREE.Plane | null = null;
  private arrowLine: THREE.Line | null = null;
  private isDragging = false;

  // Place mode ghost
  private ghostMesh: THREE.Mesh | null = null;

  // Bound handlers
  private handlePointerDown: (e: PointerEvent) => void;
  private handlePointerMove: (e: PointerEvent) => void;
  private handlePointerUp: (e: PointerEvent) => void;

  constructor(
    renderer: ThreeRenderer,
    onSelect: (id: number | null) => void,
  ) {
    this.renderer = renderer;
    this.onSelect = onSelect;

    this.handlePointerDown = this._onPointerDown.bind(this);
    this.handlePointerMove = this._onPointerMove.bind(this);
    this.handlePointerUp = this._onPointerUp.bind(this);

    const el = renderer.getRendererDomElement();
    el.addEventListener("pointerdown", this.handlePointerDown);
    el.addEventListener("pointermove", this.handlePointerMove);
    el.addEventListener("pointerup", this.handlePointerUp);

    // Create ghost mesh for place mode
    const ghostGeom = new THREE.SphereGeometry(6, 16, 16);
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.3,
    });
    this.ghostMesh = new THREE.Mesh(ghostGeom, ghostMat);
    this.ghostMesh.visible = false;
    renderer.getScene().add(this.ghostMesh);
  }

  setMode(mode: InteractionMode) {
    this.mode = mode;
    if (this.ghostMesh) {
      this.ghostMesh.visible = mode === "place";
    }
    this.cleanupSlingshot();
  }

  setPlacementZ(z: number) {
    this.plane.set(new THREE.Vector3(0, 0, 1), -z);
  }

  destroy() {
    const el = this.renderer.getRendererDomElement();
    el.removeEventListener("pointerdown", this.handlePointerDown);
    el.removeEventListener("pointermove", this.handlePointerMove);
    el.removeEventListener("pointerup", this.handlePointerUp);

    if (this.ghostMesh) {
      this.renderer.getScene().remove(this.ghostMesh);
      this.ghostMesh.geometry.dispose();
      (this.ghostMesh.material as THREE.Material).dispose();
    }
    this.cleanupSlingshot();
  }

  private updateMouseNDC(e: PointerEvent) {
    const rect = this.renderer.getRendererDomElement().getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private getWorldPosition(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.mouse, this.renderer.getCamera());
    const target = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.plane, target);
    return hit ? target : null;
  }

  private getWorldPositionOnPlane(plane: THREE.Plane): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.mouse, this.renderer.getCamera());
    const target = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(plane, target);
    return hit ? target : null;
  }

  private getIntersectedBodyId(): number | null {
    this.raycaster.setFromCamera(this.mouse, this.renderer.getCamera());
    const groups = this.renderer.getBodyGroups();
    const meshes: THREE.Object3D[] = [];
    const idMap = new Map<THREE.Object3D, number>();

    for (const [id, group] of groups) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshes.push(child);
          idMap.set(child, id);
        }
      });
    }

    const intersects = this.raycaster.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      return idMap.get(intersects[0].object) ?? null;
    }
    return null;
  }

  private _onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    this.updateMouseNDC(e);

    if (this.mode === "select") {
      const bodyId = this.getIntersectedBodyId();
      this.onSelect(bodyId);
    } else if (this.mode === "place") {
      const worldPos = this.getWorldPosition();
      if (worldPos) {
        const isSpacecraft = e.shiftKey;
        invoke("add_body", {
          bodyData: {
            x: worldPos.x,
            y: worldPos.y,
            z: worldPos.z,
            vx: 0,
            vy: 0,
            vz: 0,
            mass: isSpacecraft ? 0.5 : 1.0,
            radius: isSpacecraft ? 4.0 : 6.0,
            color: isSpacecraft ? "#00AAFF" : "#00FF88",
            name: isSpacecraft ? "Spacecraft" : "New Body",
            is_fixed: false,
            body_type: isSpacecraft ? "spacecraft" : "planet",
          },
        }).catch(console.error);
      }
    } else if (this.mode === "slingshot") {
      const bodyId = this.getIntersectedBodyId();
      if (bodyId !== null) {
        this.slingshotBodyId = bodyId;
        const groups = this.renderer.getBodyGroups();
        const group = groups.get(bodyId);
        if (group) {
          this.slingshotStart = group.position.clone();
          // Create a plane through the body, facing the camera
          const cam = this.renderer.getCamera();
          const normal = new THREE.Vector3().subVectors(cam.position, this.slingshotStart).normalize();
          this.slingshotPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, this.slingshotStart);
          this.isDragging = true;
          this.renderer.setControlsEnabled(false);
        }
      }
    }
  }

  private _onPointerMove(e: PointerEvent) {
    this.updateMouseNDC(e);

    // Update ghost mesh position in place mode
    if (this.mode === "place" && this.ghostMesh) {
      const worldPos = this.getWorldPosition();
      if (worldPos) {
        this.ghostMesh.position.copy(worldPos);
        this.ghostMesh.visible = true;
      }
    }

    // Update slingshot arrow
    if (this.isDragging && this.slingshotStart && this.slingshotPlane) {
      const worldPos = this.getWorldPositionOnPlane(this.slingshotPlane);
      if (worldPos) {
        this.updateArrow(this.slingshotStart, worldPos);
      }
    }
  }

  private _onPointerUp(e: PointerEvent) {
    this.updateMouseNDC(e);

    if (this.isDragging && this.slingshotBodyId !== null && this.slingshotStart && this.slingshotPlane) {
      const worldPos = this.getWorldPositionOnPlane(this.slingshotPlane);
      if (worldPos) {
        // Velocity is opposite to drag direction (slingshot)
        const dx = this.slingshotStart.x - worldPos.x;
        const dy = this.slingshotStart.y - worldPos.y;
        const dz = this.slingshotStart.z - worldPos.z;
        const scale = 0.5; // velocity scaling factor
        invoke("update_body_velocity", {
          id: this.slingshotBodyId,
          vx: dx * scale,
          vy: dy * scale,
          vz: dz * scale,
        }).catch(console.error);
      }
    }
    this.cleanupSlingshot();
    if (this.isDragging) {
      this.renderer.setControlsEnabled(true);
    }
    this.isDragging = false;
    this.slingshotBodyId = null;
    this.slingshotStart = null;
    this.slingshotPlane = null;
  }

  private updateArrow(from: THREE.Vector3, to: THREE.Vector3) {
    this.cleanupSlingshot();

    const positions = new Float32Array([
      from.x, from.y, from.z,
      to.x, to.y, to.z,
    ]);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xff4444,
      linewidth: 2,
    });
    this.arrowLine = new THREE.Line(geom, mat);
    this.renderer.getScene().add(this.arrowLine);
  }

  private cleanupSlingshot() {
    if (this.arrowLine) {
      this.renderer.getScene().remove(this.arrowLine);
      this.arrowLine.geometry.dispose();
      (this.arrowLine.material as THREE.Material).dispose();
      this.arrowLine = null;
    }
  }
}
