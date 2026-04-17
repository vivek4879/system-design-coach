import { useState } from "react";
import type { Settings } from "../types";

interface SettingsModalProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [draft, setDraft] = useState<Settings>({ ...settings });

  function handleSave() {
    onSave(draft);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="btn-icon" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div className="settings-row">
            <label className="settings-label" htmlFor="model-select">
              Model
            </label>
            <select
              id="model-select"
              className="settings-select"
              value={draft.model}
              onChange={(e) =>
                setDraft({ ...draft, model: e.target.value as Settings["model"] })
              }
            >
              <option value="haiku">Haiku (fast, lightweight)</option>
              <option value="sonnet">Sonnet (balanced)</option>
              <option value="opus">Opus (most capable)</option>
            </select>
          </div>

          <div className="settings-row">
            <label className="settings-label" htmlFor="effort-select">
              Thinking Effort
            </label>
            <select
              id="effort-select"
              className="settings-select"
              value={draft.effort}
              onChange={(e) =>
                setDraft({ ...draft, effort: e.target.value as Settings["effort"] })
              }
            >
              <option value="low">Low (quick answers)</option>
              <option value="medium">Medium</option>
              <option value="high">High (thorough)</option>
              <option value="max">Max (deepest reasoning)</option>
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
