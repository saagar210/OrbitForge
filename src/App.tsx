import { useEffect, useRef, useCallback, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { ThreeRenderer } from "./renderer/ThreeRenderer";
import { InteractionManager } from "./interaction/InteractionManager";
import { ControlPanel } from "./components/ControlPanel";
import { BodyInfoPanel } from "./components/BodyInfoPanel";
import { Minimap } from "./components/Minimap";
import { OrbitalElementsHUD } from "./components/OrbitalElementsHUD";
import { EnergyGraph } from "./components/EnergyGraph";
import { HohmannPanel } from "./components/HohmannPanel";
import { GravityAssistPanel } from "./components/GravityAssistPanel";
import { MissionPanel } from "./components/MissionPanel";
import { AudioManager } from "./audio/AudioManager";
import { useSimStore } from "./store";
import type { SimulationFrame, CollisionEvent } from "./types";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ThreeRenderer | null>(null);
  const interactionRef = useRef<InteractionManager | null>(null);

  const setFrame = useSimStore((s) => s.setFrame);
  const setSelectedBody = useSimStore((s) => s.setSelectedBody);
  const selectedBodyId = useSimStore((s) => s.selectedBodyId);
  const followBodyId = useSimStore((s) => s.followBodyId);
  const interactionMode = useSimStore((s) => s.interactionMode);
  const showLabels = useSimStore((s) => s.showLabels);
  const showVectors = useSimStore((s) => s.showVectors);
  const showBarycenter = useSimStore((s) => s.showBarycenter);
  const showLagrangePoints = useSimStore((s) => s.showLagrangePoints);
  const showKeplerAreas = useSimStore((s) => s.showKeplerAreas);
  const showGravityField = useSimStore((s) => s.showGravityField);
  const showOrbitalPlanes = useSimStore((s) => s.showOrbitalPlanes);
  const screenshotMode = useSimStore((s) => s.screenshotMode);
  const toggleScreenshotMode = useSimStore((s) => s.toggleScreenshotMode);
  const audioEnabled = useSimStore((s) => s.audioEnabled);
  const audioVolume = useSimStore((s) => s.audioVolume);
  const placementZ = useSimStore((s) => s.placementZ);

  const audioManager = useMemo(() => new AudioManager(), []);

  // Cleanup AudioManager on unmount
  useEffect(() => {
    return () => audioManager.dispose();
  }, [audioManager]);

  // Init renderer + interaction manager
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new ThreeRenderer(container);
    rendererRef.current = renderer;
    renderer.start();

    const interaction = new InteractionManager(renderer, (id) => {
      setSelectedBody(id);
    });
    interactionRef.current = interaction;

    const unlistenState = listen<SimulationFrame>("simulation-state", (event) => {
      setFrame(event.payload);
      renderer.updateFrame(event.payload);
    });

    const unlistenCollision = listen<CollisionEvent>("collision", (event) => {
      const { position, combined_mass } = event.payload;
      renderer.addCollisionFlash(position.x, position.y, position.z);
      if (useSimStore.getState().audioEnabled) {
        audioManager.playCollision(combined_mass);
      }
    });

    return () => {
      interaction.destroy();
      interactionRef.current = null;
      renderer.stop();
      rendererRef.current = null;
      unlistenState.then((fn) => fn());
      unlistenCollision.then((fn) => fn());
    };
  }, [setFrame, setSelectedBody]);

  // Sync interaction mode
  useEffect(() => {
    interactionRef.current?.setMode(interactionMode);
  }, [interactionMode]);

  // Sync placement Z
  useEffect(() => {
    interactionRef.current?.setPlacementZ(placementZ);
  }, [placementZ]);

  // Sync selection highlight + prediction
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setSelectedBody(selectedBodyId);

    if (selectedBodyId !== null) {
      invoke<{ x: number; y: number; z: number }[]>("predict_orbit", {
        bodyId: selectedBodyId,
        steps: 500,
      })
        .then((path) => renderer.setPredictionPath(path))
        .catch(() => renderer.clearPrediction());
    } else {
      renderer.clearPrediction();
    }
  }, [selectedBodyId]);

  // Sync follow-cam
  useEffect(() => {
    rendererRef.current?.setFollowTarget(followBodyId);
  }, [followBodyId]);

  // Sync display toggles
  useEffect(() => {
    rendererRef.current?.setLabelsVisible(showLabels);
  }, [showLabels]);

  useEffect(() => {
    rendererRef.current?.setShowVectors(showVectors);
  }, [showVectors]);

  useEffect(() => {
    rendererRef.current?.setShowBarycenter(showBarycenter);
  }, [showBarycenter]);

  useEffect(() => {
    rendererRef.current?.setShowLagrangePoints(showLagrangePoints);
  }, [showLagrangePoints]);

  useEffect(() => {
    rendererRef.current?.setShowKeplerAreas(showKeplerAreas);
  }, [showKeplerAreas]);

  useEffect(() => {
    rendererRef.current?.setShowGravityField(showGravityField);
  }, [showGravityField]);

  useEffect(() => {
    rendererRef.current?.setShowOrbitalPlanes(showOrbitalPlanes);
  }, [showOrbitalPlanes]);

  // Audio
  useEffect(() => {
    if (audioEnabled) {
      audioManager.startAmbient();
    } else {
      audioManager.stopAmbient();
    }
  }, [audioEnabled, audioManager]);

  useEffect(() => {
    audioManager.setVolume(audioVolume);
  }, [audioVolume, audioManager]);

  // Periodically refresh prediction for selected body
  useEffect(() => {
    if (selectedBodyId === null) return;
    const interval = setInterval(() => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      invoke<{ x: number; y: number; z: number }[]>("predict_orbit", {
        bodyId: selectedBodyId,
        steps: 500,
      })
        .then((path) => renderer.setPredictionPath(path))
        .catch(() => {});
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedBodyId]);

  const handleTogglePause = useCallback(() => {
    invoke("toggle_pause").catch(console.error);
  }, []);

  const handleSetSpeed = useCallback((speed: number) => {
    invoke("set_speed", { multiplier: speed }).catch(console.error);
  }, []);

  const setFollowBody = useSimStore((s) => s.setFollowBody);

  const handleReset = useCallback(() => {
    setSelectedBody(null);
    setFollowBody(null);
    invoke("load_test_scenario").catch(console.error);
  }, [setSelectedBody, setFollowBody]);

  const handleClear = useCallback(() => {
    setSelectedBody(null);
    setFollowBody(null);
    invoke("clear_simulation").catch(console.error);
  }, [setSelectedBody, setFollowBody]);

  const setRecording = useSimStore((s) => s.setRecording);

  const handleToggleRecording = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (renderer.isRecording) {
      renderer.stopRecording().catch(console.error);
      setRecording(false);
    } else {
      renderer.startRecording();
      setRecording(true);
    }
  }, [setRecording]);

  // Keyboard shortcuts + spacecraft thrust
  useEffect(() => {
    const thrustKeys = new Set<string>();
    const thrustPower = 500;

    const sendThrust = () => {
      if (selectedBodyId === null) return;
      let tx = 0, ty = 0, tz = 0;
      if (thrustKeys.has("KeyW")) ty += thrustPower;
      if (thrustKeys.has("KeyS")) ty -= thrustPower;
      if (thrustKeys.has("KeyD")) tx += thrustPower;
      if (thrustKeys.has("KeyA")) tx -= thrustPower;
      if (thrustKeys.has("ShiftLeft") || thrustKeys.has("ShiftRight")) {
        tx *= 2; ty *= 2; tz *= 2;
      }
      invoke("set_spacecraft_thrust", { id: selectedBodyId, tx, ty, tz }).catch(() => {});
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          handleTogglePause();
          break;
        case "KeyR":
          if (!thrustKeys.has("KeyW") && !thrustKeys.has("KeyA") && !thrustKeys.has("KeyS") && !thrustKeys.has("KeyD")) {
            handleReset();
          }
          break;
        case "KeyC":
          if (!thrustKeys.has("KeyW") && !thrustKeys.has("KeyA") && !thrustKeys.has("KeyS") && !thrustKeys.has("KeyD")) {
            handleClear();
          }
          break;
        case "Escape":
          setSelectedBody(null);
          break;
        case "F12": {
          e.preventDefault();
          const renderer = rendererRef.current;
          if (renderer) {
            const dataUrl = renderer.takeScreenshot(2);
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = `orbitforge-${Date.now()}.png`;
            a.click();
          }
          break;
        }
        case "F11":
          e.preventDefault();
          toggleScreenshotMode();
          break;
        case "KeyW":
        case "KeyA":
        case "KeyS":
        case "KeyD":
        case "ShiftLeft":
        case "ShiftRight":
          thrustKeys.add(e.code);
          sendThrust();
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight"].includes(e.code)) {
        thrustKeys.delete(e.code);
        sendThrust();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [handleTogglePause, handleReset, handleClear, setSelectedBody, selectedBodyId]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
      />
      {!screenshotMode && (
        <>
          <ControlPanel
            onTogglePause={handleTogglePause}
            onSetSpeed={handleSetSpeed}
            onReset={handleReset}
            onClear={handleClear}
            onToggleRecording={handleToggleRecording}
          />
          <BodyInfoPanel />
          <OrbitalElementsHUD />
          <EnergyGraph />
          <HohmannPanel />
          <GravityAssistPanel />
          <MissionPanel />
          <Minimap />
        </>
      )}
    </div>
  );
}
