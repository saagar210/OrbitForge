import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";

export function SaveLoadButtons() {
  const handleSave = async () => {
    try {
      const json = await invoke<string>("export_state");
      const filePath = await save({
        filters: [{ name: "OrbitForge", extensions: ["json"] }],
        defaultPath: "simulation.json",
      });
      if (filePath) {
        await writeTextFile(filePath, json);
      }
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const handleLoad = async () => {
    try {
      const filePath = await open({
        filters: [{ name: "OrbitForge", extensions: ["json"] }],
        multiple: false,
      });
      if (filePath) {
        const json = await readTextFile(filePath as string);
        await invoke("import_state", { json });
      }
    } catch (err) {
      console.error("Load failed:", err);
    }
  };

  return (
    <div className="flex gap-1.5">
      <button
        onClick={handleSave}
        className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors text-white/70"
      >
        Save
      </button>
      <button
        onClick={handleLoad}
        className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors text-white/70"
      >
        Load
      </button>
    </div>
  );
}
