import { create } from "zustand";
import type { SimulationFrame, InteractionMode, ScenarioInfo } from "./types";

interface SimStore {
  frame: SimulationFrame | null;
  selectedBodyId: number | null;
  followBodyId: number | null;
  interactionMode: InteractionMode;
  scenarios: ScenarioInfo[];
  setFrame: (frame: SimulationFrame) => void;
  setSelectedBody: (id: number | null) => void;
  setFollowBody: (id: number | null) => void;
  setInteractionMode: (mode: InteractionMode) => void;
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
  ],
  setFrame: (frame) => set({ frame }),
  setSelectedBody: (id) => set({ selectedBodyId: id }),
  setFollowBody: (id) => set({ followBodyId: id }),
  setInteractionMode: (mode) => set({ interactionMode: mode }),
}));
