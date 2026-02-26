import { Link, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>PrintPilot</h1>
        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/settings">Settings</Link>
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
