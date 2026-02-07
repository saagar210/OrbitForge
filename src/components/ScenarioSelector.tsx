import { invoke } from "@tauri-apps/api/core";
import { useSimStore } from "../store";

export function ScenarioSelector() {
  const scenarios = useSimStore((s) => s.scenarios);

  const handleLoad = async (id: string) => {
    try {
      await invoke("load_scenario", { name: id });
    } catch (err) {
      console.error("Failed to load scenario:", err);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {scenarios.map((s) => (
        <button
          key={s.id}
          onClick={() => handleLoad(s.id)}
          title={s.description}
          className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors text-white/70 hover:text-white"
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}
