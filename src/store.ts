import { create } from "zustand";
import type { SimulationFrame, InteractionMode, ScenarioInfo, EnergyData } from "./types";
import type { MissionProgress } from "./missions/MissionDefinition";

interface SimStore {
  frame: SimulationFrame | null;
  selectedBodyId: number | null;
  followBodyId: number | null;
  interactionMode: InteractionMode;
  scenarios: ScenarioInfo[];
  showLabels: boolean;
  showVectors: boolean;
  showBarycenter: boolean;
  showOrbitalElements: boolean;
  showEnergyGraph: boolean;
  showLagrangePoints: boolean;
  showKeplerAreas: boolean;
  showGravityField: boolean;
  showOrbitalPlanes: boolean;
  showHohmann: boolean;
  showGravityAssist: boolean;
  showMissions: boolean;
  screenshotMode: boolean;
  recording: boolean;
  audioEnabled: boolean;
  audioVolume: number;
  activeMission: string | null;
  missionProgress: MissionProgress | null;
  placementZ: number;
  energyHistory: EnergyData[];
  setFrame: (frame: SimulationFrame) => void;
  setSelectedBody: (id: number | null) => void;
  setFollowBody: (id: number | null) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setPlacementZ: (z: number) => void;
  toggleLabels: () => void;
  toggleVectors: () => void;
  toggleBarycenter: () => void;
  toggleOrbitalElements: () => void;
  toggleEnergyGraph: () => void;
  toggleLagrangePoints: () => void;
  toggleKeplerAreas: () => void;
  toggleGravityField: () => void;
  toggleOrbitalPlanes: () => void;
  toggleHohmann: () => void;
  toggleGravityAssist: () => void;
  toggleMissions: () => void;
  toggleScreenshotMode: () => void;
  setRecording: (recording: boolean) => void;
  toggleAudio: () => void;
  setAudioVolume: (vol: number) => void;
  setActiveMission: (id: string | null) => void;
  updateMissionProgress: (progress: MissionProgress) => void;
}

export const useSimStore = create<SimStore>((set) => ({
  frame: null,
  selectedBodyId: null,
  followBodyId: null,
  interactionMode: "select",
  scenarios: [
    { id: "sun_earth", name: "Sun & Earth", description: "Simple two-body orbit" },
    { id: "inner_solar", name: "Inner Solar System", description: "Sun + Mercury, Venus, Earth, Mars" },
    { id: "outer_solar", name: "Outer Solar System", description: "Sun + Jupiter, Saturn, Uranus, Neptune" },
    { id: "full_solar", name: "Full Solar System", description: "Sun + all 8 planets" },
    { id: "binary_star", name: "Binary Star", description: "Two stars orbiting their barycenter" },
    { id: "figure_eight", name: "Figure-8", description: "Three-body periodic figure-8 solution" },
    { id: "inclined_solar", name: "Inclined Solar", description: "Full solar system with 3D orbital inclinations" },
    { id: "asteroid_belt", name: "Asteroid Belt", description: "Inner solar system with 200 asteroids" },
    { id: "galaxy_collision", name: "Galaxy Collision", description: "Two galaxies colliding (600 particles)" },
  ],
  showLabels: true,
  showVectors: false,
  showBarycenter: false,
  showOrbitalElements: false,
  showEnergyGraph: false,
  showLagrangePoints: false,
  showKeplerAreas: false,
  showGravityField: false,
  showOrbitalPlanes: false,
  showHohmann: false,
  showGravityAssist: false,
  showMissions: false,
  screenshotMode: false,
  recording: false,
  audioEnabled: false,
  audioVolume: 0.3,
  activeMission: null,
  missionProgress: null,
  placementZ: 0,
  energyHistory: [],
  setFrame: (frame) => set((s) => {
    const history = [...s.energyHistory, frame.energy];
    if (history.length > 300) history.splice(0, history.length - 300);
    return { frame, energyHistory: history };
  }),
  setSelectedBody: (id) => set({ selectedBodyId: id }),
  setFollowBody: (id) => set({ followBodyId: id }),
  setInteractionMode: (mode) => set({ interactionMode: mode }),
  setPlacementZ: (z) => set({ placementZ: z }),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleVectors: () => set((s) => ({ showVectors: !s.showVectors })),
  toggleBarycenter: () => set((s) => ({ showBarycenter: !s.showBarycenter })),
  toggleOrbitalElements: () => set((s) => ({ showOrbitalElements: !s.showOrbitalElements })),
  toggleEnergyGraph: () => set((s) => ({ showEnergyGraph: !s.showEnergyGraph })),
  toggleLagrangePoints: () => set((s) => ({ showLagrangePoints: !s.showLagrangePoints })),
  toggleKeplerAreas: () => set((s) => ({ showKeplerAreas: !s.showKeplerAreas })),
  toggleGravityField: () => set((s) => ({ showGravityField: !s.showGravityField })),
  toggleOrbitalPlanes: () => set((s) => ({ showOrbitalPlanes: !s.showOrbitalPlanes })),
  toggleHohmann: () => set((s) => ({ showHohmann: !s.showHohmann })),
  toggleGravityAssist: () => set((s) => ({ showGravityAssist: !s.showGravityAssist })),
  toggleMissions: () => set((s) => ({ showMissions: !s.showMissions })),
  toggleScreenshotMode: () => set((s) => ({ screenshotMode: !s.screenshotMode })),
  setRecording: (recording) => set({ recording }),
  toggleAudio: () => set((s) => ({ audioEnabled: !s.audioEnabled })),
  setAudioVolume: (vol) => set({ audioVolume: vol }),
  setActiveMission: (id) => set((s) => ({
    activeMission: id,
    missionProgress: id ? {
      missionId: id,
      objectiveStatus: Array(10).fill(false),
      startTick: s.frame?.tick ?? 0,
      completed: false,
      failed: false,
    } : null,
  })),
  updateMissionProgress: (progress) => set({ missionProgress: progress }),
}));
