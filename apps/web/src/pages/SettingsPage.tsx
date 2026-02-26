import { useEffect, useState } from 'react';

const API = 'http://localhost:7128/api';

type Preset = { key: string; name: string; isDefault: boolean };

export function SettingsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);

  async function loadPresets() {
    const data = await fetch(`${API}/presets`).then((res) => res.json());
    setPresets(data);
  }

  async function activate(key: string) {
    await fetch(`${API}/presets/${key}/activate`, { method: 'POST' });
    await loadPresets();
  }

  useEffect(() => {
    loadPresets();
  }, []);

  return (
    <section className="card">
      <h2>UI Presets</h2>
      <p>Switch between SimplyPrint-like and Klipper style layout packs.</p>
      {presets.map((preset) => (
        <div key={preset.key} className="row">
          <span>{preset.name} {preset.isDefault ? '(active)' : ''}</span>
          {!preset.isDefault && <button onClick={() => activate(preset.key)}>Activate</button>}
        </div>
      ))}
    </section>
  );
}
