import { useSimStore } from "../store";
import { ScenarioSelector } from "./ScenarioSelector";
import { SaveLoadButtons } from "./SaveLoadButtons";
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
}

export function ControlPanel({
  onTogglePause,
  onSetSpeed,
  onReset,
  onClear,
}: Props) {
  const paused = useSimStore((s) => s.frame?.paused ?? false);
  const speed = useSimStore((s) => s.frame?.speed_multiplier ?? 1);
  const bodyCount = useSimStore((s) => s.frame?.bodies.length ?? 0);
  const interactionMode = useSimStore((s) => s.interactionMode);
  const setInteractionMode = useSimStore((s) => s.setInteractionMode);

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

      <div className="mb-3">
        <span className="text-white/60 text-xs block mb-1.5">Scenarios:</span>
        <ScenarioSelector />
      </div>

      <div className="flex items-center justify-between text-white/40 text-xs">
        <div>
          <div>Bodies: {bodyCount}</div>
          <div>Space=pause R=reset C=clear</div>
        </div>
        <SaveLoadButtons />
      </div>
    </div>
  );
}
