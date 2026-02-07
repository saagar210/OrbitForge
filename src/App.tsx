import { useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { ThreeRenderer } from "./renderer/ThreeRenderer";
import { InteractionManager } from "./interaction/InteractionManager";
import { ControlPanel } from "./components/ControlPanel";
import { BodyInfoPanel } from "./components/BodyInfoPanel";
import { Minimap } from "./components/Minimap";
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
      const { position } = event.payload;
      renderer.addCollisionFlash(position.x, position.y);
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

  // Sync selection highlight + prediction
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setSelectedBody(selectedBodyId);

    if (selectedBodyId !== null) {
      invoke<{ x: number; y: number }[]>("predict_orbit", {
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

  // Periodically refresh prediction for selected body
  useEffect(() => {
    if (selectedBodyId === null) return;
    const interval = setInterval(() => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      invoke<{ x: number; y: number }[]>("predict_orbit", {
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

  const handleReset = useCallback(() => {
    invoke("load_test_scenario").catch(console.error);
  }, []);

  const handleClear = useCallback(() => {
    invoke("clear_simulation").catch(console.error);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          handleTogglePause();
          break;
        case "KeyR":
          handleReset();
          break;
        case "KeyC":
          handleClear();
          break;
        case "Escape":
          setSelectedBody(null);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleTogglePause, handleReset, handleClear, setSelectedBody]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
      />
      <ControlPanel
        onTogglePause={handleTogglePause}
        onSetSpeed={handleSetSpeed}
        onReset={handleReset}
        onClear={handleClear}
      />
      <BodyInfoPanel />
      <Minimap />
    </div>
  );
}
