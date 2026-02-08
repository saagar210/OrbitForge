import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSimStore } from "../store";

export function ProceduralGeneratorPanel() {
  const setSelectedBody = useSimStore((s) => s.setSelectedBody);
  const setFollowBody = useSimStore((s) => s.setFollowBody);

  const [starMass, setStarMass] = useState(50000);
  const [planetCount, setPlanetCount] = useState(6);
  const [minSpacing, setMinSpacing] = useState(120);
  const [maxRadius, setMaxRadius] = useState(1000);
  const [expanded, setExpanded] = useState(false);

  const handleGenerate = useCallback(() => {
    setSelectedBody(null);
    setFollowBody(null);
    invoke("generate_system", {
      starMass,
      planetCount,
      minSpacing,
      maxRadius,
    }).catch(console.error);
  }, [starMass, planetCount, minSpacing, maxRadius, setSelectedBody, setFollowBody]);

  return (
    <div className="mt-2 pt-2 border-t border-white/10">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-white/60 text-xs hover:text-white/80 transition-colors w-full text-left"
      >
        {expanded ? "▾" : "▸"} Procedural Generator
      </button>
      {expanded && (
        <div className="mt-2 space-y-2 text-xs">
          <div>
            <label className="text-white/50 block">Star Mass: {starMass}</label>
            <input
              type="range"
              min={1000}
              max={200000}
              step={1000}
              value={starMass}
              onChange={(e) => setStarMass(parseInt(e.target.value))}
              className="w-full accent-blue-400"
            />
          </div>
          <div>
            <label className="text-white/50 block">Planets: {planetCount}</label>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={planetCount}
              onChange={(e) => setPlanetCount(parseInt(e.target.value))}
              className="w-full accent-blue-400"
            />
          </div>
          <div>
            <label className="text-white/50 block">Min Spacing: {minSpacing}</label>
            <input
              type="range"
              min={50}
              max={500}
              step={10}
              value={minSpacing}
              onChange={(e) => setMinSpacing(parseInt(e.target.value))}
              className="w-full accent-blue-400"
            />
          </div>
          <div>
            <label className="text-white/50 block">Max Radius: {maxRadius}</label>
            <input
              type="range"
              min={200}
              max={3000}
              step={50}
              value={maxRadius}
              onChange={(e) => setMaxRadius(parseInt(e.target.value))}
              className="w-full accent-blue-400"
            />
          </div>
          <button
            onClick={handleGenerate}
            className="w-full px-2 py-1.5 bg-purple-500/30 hover:bg-purple-500/50 rounded text-purple-200 transition-colors font-medium"
          >
            Generate System
          </button>
        </div>
      )}
    </div>
  );
}
