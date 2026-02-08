import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSimStore } from "../store";
import type { CelestialBody } from "../types";

function useSelectedBody(): CelestialBody | null {
  return useSimStore((s) => {
    if (s.selectedBodyId === null || !s.frame) return null;
    return s.frame.bodies.find((b) => b.id === s.selectedBodyId) ?? null;
  });
}

export function BodyInfoPanel() {
  const body = useSelectedBody();
  const selectedBodyId = useSimStore((s) => s.selectedBodyId);
  const followBodyId = useSimStore((s) => s.followBodyId);
  const setSelectedBody = useSimStore((s) => s.setSelectedBody);
  const setFollowBody = useSimStore((s) => s.setFollowBody);

  const [editName, setEditName] = useState("");
  const [editMass, setEditMass] = useState(1);
  const [editRadius, setEditRadius] = useState(6);

  useEffect(() => {
    if (body) {
      setEditName(body.name);
      setEditMass(body.mass);
      setEditRadius(body.radius);
    }
  }, [body?.id, body?.name, body?.mass, body?.radius]);

  const handleUpdate = useCallback(
    async (fields: Record<string, unknown>) => {
      if (selectedBodyId === null) return;
      try {
        await invoke("update_body", { id: selectedBodyId, fields });
      } catch (err) {
        console.error("Failed to update body:", err);
      }
    },
    [selectedBodyId],
  );

  const handleDelete = useCallback(async () => {
    if (selectedBodyId === null) return;
    try {
      await invoke("remove_body", { id: selectedBodyId });
      setSelectedBody(null);
      if (followBodyId === selectedBodyId) {
        setFollowBody(null);
      }
    } catch (err) {
      console.error("Failed to delete body:", err);
    }
  }, [selectedBodyId, followBodyId, setSelectedBody, setFollowBody]);

  const handleFollowToggle = useCallback(() => {
    if (followBodyId === selectedBodyId) {
      setFollowBody(null);
    } else {
      setFollowBody(selectedBodyId);
    }
  }, [followBodyId, selectedBodyId, setFollowBody]);

  if (!body) return null;

  const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2 + body.velocity.z ** 2);
  const isFollowing = followBodyId === selectedBodyId;

  return (
    <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white text-sm select-none border border-white/10 w-64">
      <div className="flex items-center justify-between mb-3">
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={() => handleUpdate({ name: editName })}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleUpdate({ name: editName });
          }}
          className="bg-white/10 rounded px-2 py-1 text-sm font-medium w-36 outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          onClick={() => setSelectedBody(null)}
          className="text-white/40 hover:text-white/80 ml-2"
        >
          x
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between text-white/60">
          <span>Position</span>
          <span>
            {body.position.x.toFixed(1)}, {body.position.y.toFixed(1)}, {body.position.z.toFixed(1)}
          </span>
        </div>
        <div className="flex justify-between text-white/60">
          <span>Velocity</span>
          <span>{speed.toFixed(2)}</span>
        </div>

        <div className="pt-2 border-t border-white/10">
          <label className="text-white/60 block mb-1">
            Mass: {editMass.toFixed(2)}
          </label>
          <input
            type="range"
            min={-1}
            max={5}
            step={0.01}
            value={Math.log10(Math.max(0.1, editMass))}
            onChange={(e) => {
              const val = 10 ** parseFloat(e.target.value);
              setEditMass(val);
              handleUpdate({ mass: val });
            }}
            className="w-full accent-blue-400"
          />
        </div>

        <div>
          <label className="text-white/60 block mb-1">
            Radius: {editRadius.toFixed(1)}
          </label>
          <input
            type="range"
            min={1}
            max={50}
            step={0.5}
            value={editRadius}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setEditRadius(val);
              handleUpdate({ radius: val });
            }}
            className="w-full accent-blue-400"
          />
        </div>

        <div>
          <label className="text-white/60 block mb-1">Color</label>
          <input
            type="color"
            value={body.color}
            onChange={(e) => handleUpdate({ color: e.target.value })}
            className="w-8 h-6 bg-transparent border border-white/20 rounded cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-white/60">Fixed</label>
          <input
            type="checkbox"
            checked={body.is_fixed}
            onChange={(e) => handleUpdate({ is_fixed: e.target.checked })}
            className="accent-blue-400"
          />
        </div>

        <div className="flex justify-between text-white/60">
          <span>Type</span>
          <span className="capitalize">{body.body_type}</span>
        </div>

        {body.body_type === "spacecraft" && (
          <div className="pt-2 border-t border-white/10 space-y-1">
            <div className="flex justify-between text-white/60">
              <span>Fuel</span>
              <span>{body.fuel.toFixed(1)} / {body.max_fuel.toFixed(0)}</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${body.max_fuel > 0 ? (body.fuel / body.max_fuel) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-white/60">
              <span>Thrust</span>
              <span>{Math.sqrt(body.thrust.x ** 2 + body.thrust.y ** 2 + body.thrust.z ** 2).toFixed(1)}</span>
            </div>
            <div className="text-white/40 text-[10px]">WASD to thrust (while selected)</div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
        <button
          onClick={handleFollowToggle}
          className={`flex-1 px-2 py-1.5 rounded text-xs transition-colors ${
            isFollowing
              ? "bg-blue-500/60 text-white"
              : "bg-white/10 hover:bg-white/20 text-white/70"
          }`}
        >
          {isFollowing ? "Unfollow" : "Follow"}
        </button>
        <button
          onClick={handleDelete}
          className="flex-1 px-2 py-1.5 bg-red-500/20 hover:bg-red-500/40 rounded text-xs text-red-300 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
