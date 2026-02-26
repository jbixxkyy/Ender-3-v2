import { useEffect, useMemo, useState } from 'react';

type Printer = { id: string; name: string; baseUrl: string };
type Profile = { id: string; name: string };
type SlicedFile = { id: string; name: string; sizeBytes: number; createdAt: string };

const API = 'http://localhost:7128/api';

export function DashboardPage() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [selectedProfile, setSelectedProfile] = useState('');
  const [statusText, setStatusText] = useState('No status yet');
  const [slicedFiles, setSlicedFiles] = useState<SlicedFile[]>([]);

  const canSlice = useMemo(() => Boolean(selectedPrinter && selectedProfile), [selectedPrinter, selectedProfile]);

  async function refresh() {
    const [printerRes, profileRes, filesRes] = await Promise.all([
      fetch(`${API}/printers`).then((r) => r.json()),
      fetch(`${API}/profiles`).then((r) => r.json()),
      fetch(`${API}/sliced-files`).then((r) => r.json())
    ]);
    setPrinters(printerRes);
    setProfiles(profileRes);
    setSlicedFiles(filesRes);
    if (!selectedPrinter && printerRes[0]) setSelectedPrinter(printerRes[0].id);
    if (!selectedProfile && profileRes[0]) setSelectedProfile(profileRes[0].id);
  }

  useEffect(() => {
    refresh();
    const ws = new WebSocket('ws://localhost:7128/api/ws/status');
    ws.onmessage = (event) => setStatusText(`Live: ${event.data}`);
    return () => ws.close();
  }, []);

  async function addPrinter(formData: FormData) {
    await fetch(`${API}/printers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.get('name'),
        baseUrl: formData.get('baseUrl'),
        apiKey: formData.get('apiKey')
      })
    });
    await refresh();
  }

  async function ensureProfile() {
    if (profiles.length > 0) return;
    await fetch(`${API}/profiles/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Draft Quality', sourceType: 'seed', config: { layerHeight: 0.2, speedPrint: 55 } })
    });
    await refresh();
  }

  async function sliceFile(formData: FormData) {
    if (!canSlice) return;
    const payload = new FormData();
    const file = formData.get('model') as File;
    payload.append('file', file);
    payload.append('printerId', selectedPrinter);
    payload.append('profileId', selectedProfile);
    payload.append('materialPreset', (formData.get('materialPreset') as string) || 'PLA');
    await fetch(`${API}/slice`, { method: 'POST', body: payload });
    await refresh();
  }

  async function sendFile(fileId: string) {
    await fetch(`${API}/sliced-files/${fileId}/send`, { method: 'POST' });
    alert('Sent. Print has NOT started.');
  }

  async function startPrint(fileId: string) {
    const confirmed = confirm('Start print now?');
    if (!confirmed) return;
    await fetch(`${API}/sliced-files/${fileId}/start`, { method: 'POST' });
    alert('Print start requested after explicit confirmation.');
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>Add Printer</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addPrinter(new FormData(e.currentTarget));
            e.currentTarget.reset();
          }}
        >
          <input name="name" placeholder="Printer name" required />
          <input name="baseUrl" placeholder="http://moonraker.local" required />
          <input name="apiKey" placeholder="API Key (optional)" />
          <button type="submit">Add Printer</button>
        </form>
      </section>

      <section className="card">
        <h2>Dashboard</h2>
        <button onClick={ensureProfile}>Seed Profile</button>
        <p>{statusText}</p>
        <ul>
          {printers.map((printer) => (
            <li key={printer.id}>{printer.name}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Slice STL/3MF</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sliceFile(new FormData(e.currentTarget));
          }}
        >
          <select value={selectedPrinter} onChange={(e) => setSelectedPrinter(e.target.value)}>
            <option value="">Select printer</option>
            {printers.map((printer) => (
              <option key={printer.id} value={printer.id}>{printer.name}</option>
            ))}
          </select>
          <select value={selectedProfile} onChange={(e) => setSelectedProfile(e.target.value)}>
            <option value="">Select profile</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name}</option>
            ))}
          </select>
          <input type="text" name="materialPreset" placeholder="PLA" />
          <input type="file" name="model" accept=".stl,.3mf" required />
          <button type="submit" disabled={!canSlice}>Slice</button>
        </form>
      </section>

      <section className="card">
        <h2>Sliced Files</h2>
        <ul>
          {slicedFiles.map((file) => (
            <li key={file.id}>
              <strong>{file.name}</strong> ({Math.round(file.sizeBytes / 1024)} KB)
              <div className="row">
                <button onClick={() => sendFile(file.id)}>Send to Printer</button>
                <button onClick={() => startPrint(file.id)}>Start Print</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
