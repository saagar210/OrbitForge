import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSimStore } from "../store";
import { MISSIONS } from "../missions/missions";
import { checkObjective } from "../missions/MissionDefinition";

export function MissionPanel() {
  const showMissions = useSimStore((s) => s.showMissions);
  const activeMission = useSimStore((s) => s.activeMission);
  const missionProgress = useSimStore((s) => s.missionProgress);
  const setActiveMission = useSimStore((s) => s.setActiveMission);
  const updateMissionProgress = useSimStore((s) => s.updateMissionProgress);
  const frame = useSimStore((s) => s.frame);
  const selectedBodyId = useSimStore((s) => s.selectedBodyId);

  // Check objectives each frame
  useEffect(() => {
    if (!activeMission || !missionProgress || !frame || missionProgress.completed || missionProgress.failed) return;

    const mission = MISSIONS.find((m) => m.id === activeMission);
    if (!mission) return;

    const elapsed = frame.tick - missionProgress.startTick;

    // Bind mission spacecraft once (prefer existing bound ID, then selected spacecraft, then first spacecraft found)
    let missionSpacecraftId = missionProgress.spacecraftId;
    if (missionSpacecraftId === null) {
      const selected = selectedBodyId !== null ? frame.bodies.find((b) => b.id === selectedBodyId) : null;
      const selectedSpacecraftId = selected?.body_type === "spacecraft" ? selected.id : null;
      const fallbackSpacecraftId = frame.bodies.find((b) => b.body_type === "spacecraft")?.id ?? null;
      missionSpacecraftId = selectedSpacecraftId ?? fallbackSpacecraftId;

      if (missionSpacecraftId !== null) {
        updateMissionProgress({ ...missionProgress, spacecraftId: missionSpacecraftId });
      }
    }

    const newStatus = [...missionProgress.objectiveStatus];
    let changed = false;

    for (let i = 0; i < mission.objectives.length; i++) {
      if (newStatus[i]) continue;
      const obj = mission.objectives[i];

      if (checkObjective(obj, frame, missionSpacecraftId, elapsed)) {
        newStatus[i] = true;
        changed = true;
      }
    }

    if (changed) {
      const completed = newStatus.every(Boolean);
      const failed = mission.timeLimit ? elapsed > mission.timeLimit : false;
      updateMissionProgress({ ...missionProgress, objectiveStatus: newStatus, completed, failed });
    } else if (mission.timeLimit && elapsed > mission.timeLimit && !missionProgress.failed) {
      updateMissionProgress({ ...missionProgress, failed: true });
    }
  }, [frame?.tick, activeMission, missionProgress, selectedBodyId, updateMissionProgress]);

  if (!showMissions) return null;

  const mission = activeMission ? MISSIONS.find((m) => m.id === activeMission) : null;

  const handleStart = (missionId: string) => {
    const m = MISSIONS.find((mi) => mi.id === missionId);
    if (!m) return;
    invoke("load_scenario", { name: m.scenarioId }).catch(console.error);
    setActiveMission(missionId);
  };

  const handleAbort = () => {
    setActiveMission(null);
  };

  return (
    <div className="absolute top-4 left-[26rem] bg-black/80 backdrop-blur-sm rounded-lg p-3 text-white text-xs select-none border border-white/10 w-60">
      <div className="font-medium mb-2 text-white/80">Missions</div>

      {!mission && (
        <div className="space-y-2">
          {MISSIONS.map((m) => (
            <button
              key={m.id}
              onClick={() => handleStart(m.id)}
              className="w-full text-left px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="font-medium">{m.name}</div>
              <div className="text-white/40 text-[10px]">{m.description}</div>
            </button>
          ))}
        </div>
      )}

      {mission && missionProgress && (
        <div className="space-y-2">
          <div className="font-medium text-sm">{mission.name}</div>
          <div className="text-white/50 text-[10px]">{mission.description}</div>

          {missionProgress.completed && (
            <div className="bg-green-500/20 text-green-300 px-2 py-1 rounded text-center font-medium">
              Mission Complete!
            </div>
          )}

          {missionProgress.failed && !missionProgress.completed && (
            <div className="bg-red-500/20 text-red-300 px-2 py-1 rounded text-center font-medium">
              Mission Failed
            </div>
          )}

          <div className="space-y-1">
            {mission.objectives.map((obj, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={missionProgress.objectiveStatus[i] ? "text-green-400" : "text-white/30"}>
                  {missionProgress.objectiveStatus[i] ? "[x]" : "[ ]"}
                </span>
                <span className={missionProgress.objectiveStatus[i] ? "text-white/70 line-through" : "text-white/70"}>
                  {obj.description}
                </span>
              </div>
            ))}
          </div>

          <div className="text-white/30 text-[10px]">
            Shift+click in Place mode to spawn spacecraft, then select it and use WASD to thrust.
          </div>

          <button
            onClick={handleAbort}
            className="w-full px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-300 transition-colors"
          >
            Abort Mission
          </button>
        </div>
      )}
    </div>
  );
}
