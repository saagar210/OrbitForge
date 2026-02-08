import { useSimStore } from "../store";
import { ScenarioSelector } from "./ScenarioSelector";
import { SaveLoadButtons } from "./SaveLoadButtons";
import { ProceduralGeneratorPanel } from "./ProceduralGeneratorPanel";
import type { InteractionMode } from "../types";

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4, 8];

const MODES: { id: InteractionMode; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "place", label: "Place" },
  { id: "slingshot", label: "Slingshot" },
];

interface Props {
  onTogglePause: () => void;
  onSetSpeed: (speed: number) => void;
  onReset: () => void;
  onClear: () => void;
  onToggleRecording: () => void;
}

export function ControlPanel({
  onTogglePause,
  onSetSpeed,
  onReset,
  onClear,
  onToggleRecording,
}: Props) {
  const paused = useSimStore((s) => s.frame?.paused ?? false);
  const speed = useSimStore((s) => s.frame?.speed_multiplier ?? 1);
  const bodyCount = useSimStore((s) => s.frame?.bodies.length ?? 0);
  const interactionMode = useSimStore((s) => s.interactionMode);
  const setInteractionMode = useSimStore((s) => s.setInteractionMode);
  const showLabels = useSimStore((s) => s.showLabels);
  const toggleLabels = useSimStore((s) => s.toggleLabels);
  const showVectors = useSimStore((s) => s.showVectors);
  const toggleVectors = useSimStore((s) => s.toggleVectors);
  const showBarycenter = useSimStore((s) => s.showBarycenter);
  const toggleBarycenter = useSimStore((s) => s.toggleBarycenter);
  const showOrbitalElements = useSimStore((s) => s.showOrbitalElements);
  const toggleOrbitalElements = useSimStore((s) => s.toggleOrbitalElements);
  const showEnergyGraph = useSimStore((s) => s.showEnergyGraph);
  const toggleEnergyGraph = useSimStore((s) => s.toggleEnergyGraph);
  const showLagrangePoints = useSimStore((s) => s.showLagrangePoints);
  const toggleLagrangePoints = useSimStore((s) => s.toggleLagrangePoints);
  const showKeplerAreas = useSimStore((s) => s.showKeplerAreas);
  const toggleKeplerAreas = useSimStore((s) => s.toggleKeplerAreas);
  const showGravityField = useSimStore((s) => s.showGravityField);
  const toggleGravityField = useSimStore((s) => s.toggleGravityField);
  const showOrbitalPlanes = useSimStore((s) => s.showOrbitalPlanes);
  const toggleOrbitalPlanes = useSimStore((s) => s.toggleOrbitalPlanes);
  const showHohmann = useSimStore((s) => s.showHohmann);
  const toggleHohmann = useSimStore((s) => s.toggleHohmann);
  const showGravityAssist = useSimStore((s) => s.showGravityAssist);
  const toggleGravityAssist = useSimStore((s) => s.toggleGravityAssist);
  const showMissions = useSimStore((s) => s.showMissions);
  const toggleMissions = useSimStore((s) => s.toggleMissions);
  const audioEnabled = useSimStore((s) => s.audioEnabled);
  const toggleAudio = useSimStore((s) => s.toggleAudio);
  const recording = useSimStore((s) => s.recording);
  const placementZ = useSimStore((s) => s.placementZ);
  const setPlacementZ = useSimStore((s) => s.setPlacementZ);

  return (
    <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg p-4 text-white text-sm select-none border border-white/10 max-w-sm">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onTogglePause}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded transition-colors font-medium"
        >
          {paused ? "Play" : "Pause"}
        </button>
        <button
          onClick={onReset}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded transition-colors"
        >
          Reset
        </button>
        <button
          onClick={onClear}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded transition-colors"
        >
          Clear
        </button>
        <button
          onClick={onToggleRecording}
          className={`px-3 py-1.5 rounded transition-colors ${
            recording
              ? "bg-red-500/80 text-white animate-pulse"
              : "bg-white/10 hover:bg-white/20"
          }`}
          title={recording ? "Stop recording (saves .webm)" : "Record video"}
        >
          {recording ? "Stop" : "Rec"}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-white/60 w-12">Speed:</span>
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSetSpeed(s)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              Math.abs(speed - s) < 0.01
                ? "bg-blue-500/80 text-white"
                : "bg-white/10 hover:bg-white/20 text-white/70"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-white/60 w-12">Mode:</span>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setInteractionMode(m.id)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              interactionMode === m.id
                ? "bg-blue-500/80 text-white"
                : "bg-white/10 hover:bg-white/20 text-white/70"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {interactionMode === "place" && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-white/60 text-xs w-12">Z: {placementZ.toFixed(0)}</span>
          <input
            type="range"
            min={-200}
            max={200}
            step={5}
            value={placementZ}
            onChange={(e) => setPlacementZ(parseFloat(e.target.value))}
            className="flex-1 accent-blue-400"
          />
        </div>
      )}

      <div className="mb-3">
        <span className="text-white/60 text-xs block mb-1.5">View:</span>
        <div className="flex flex-wrap gap-1">
          {([
            ["Labels", showLabels, toggleLabels],
            ["Vectors", showVectors, toggleVectors],
            ["Barycenter", showBarycenter, toggleBarycenter],
            ["Orbits", showOrbitalElements, toggleOrbitalElements],
            ["Energy", showEnergyGraph, toggleEnergyGraph],
            ["Lagrange", showLagrangePoints, toggleLagrangePoints],
            ["Kepler", showKeplerAreas, toggleKeplerAreas],
            ["Gravity", showGravityField, toggleGravityField],
            ["Planes", showOrbitalPlanes, toggleOrbitalPlanes],
            ["Hohmann", showHohmann, toggleHohmann],
            ["Assist", showGravityAssist, toggleGravityAssist],
            ["Missions", showMissions, toggleMissions],
            ["Audio", audioEnabled, toggleAudio],
          ] as [string, boolean, () => void][]).map(([label, active, toggle]) => (
            <button
              key={label}
              onClick={toggle}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                active
                  ? "bg-blue-500/80 text-white"
                  : "bg-white/10 hover:bg-white/20 text-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <span className="text-white/60 text-xs block mb-1.5">Scenarios:</span>
        <ScenarioSelector />
      </div>

      <ProceduralGeneratorPanel />

      <div className="flex items-center justify-between text-white/40 text-xs mt-2">
        <div>
          <div>Bodies: {bodyCount}</div>
          <div>Space=pause R=reset C=clear</div>
        </div>
        <SaveLoadButtons />
      </div>
    </div>
  );
}
