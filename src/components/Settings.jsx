import { useState } from 'react';
import { getSettings, saveSettings, clearAllData, exportData, importData } from '../services/storageService';
import { checkAIHealth } from '../services/aiService';
import { useEffect } from 'react';

export default function Settings({ onBack }) {
  const [settings, setSettings] = useState(getSettings());
  const [aiStatus, setAiStatus] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const updateSetting = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleAIToggle = (enabled) => {
    const updated = { ...settings, aiEnabled: enabled, mode: enabled ? 'ai-assisted' : 'local' };
    setSettings(updated);
    saveSettings(updated);
    if (enabled) {
      checkAIHealth().then(setAiStatus).catch(() => setAiStatus({ status: 'unavailable', mode: 'offline' }));
    } else {
      setAiStatus(null);
    }
  };

  const handleTestConnection = () => {
    checkAIHealth().then(setAiStatus).catch(() => setAiStatus({ status: 'unavailable', mode: 'offline' }));
  };

  const handleModeChange = (mode) => {
    const updated = { ...settings, mode, aiEnabled: mode === 'ai-assisted' };
    setSettings(updated);
    saveSettings(updated);
    if (updated.aiEnabled) handleTestConnection();
    else setAiStatus(null);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `focusloop-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      importData(JSON.parse(await file.text()));
      window.location.reload();
    } catch (error) {
      setAiStatus({ status: error.message, mode: 'error' });
    }
    event.target.value = '';
  };

  const handleClearData = () => {
    clearAllData();
    setShowClearConfirm(false);
    setSettings(getSettings());
  };

  // Apply theme
  useEffect(() => {
    const theme = settings.theme;
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }
  }, [settings.theme]);

  return (
    <div className="animate-fade-in" style={{ padding: 'var(--space-4) 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <h2 className="heading-2">Settings</h2>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)' }}>Focus</h3>

        <div className="settings-row">
          <div>
            <div className="settings-label">Default session length</div>
            <div className="text-sm text-tertiary">Starting duration for new sessions</div>
          </div>
          <select
            className="select"
            value={settings.focusDuration}
            onChange={(e) => updateSetting('focusDuration', parseInt(e.target.value))}
          >
            <option value={10}>10 min</option>
            <option value={15}>15 min</option>
            <option value={20}>20 min</option>
            <option value={25}>25 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-label">Inactivity threshold</div>
            <div className="text-sm text-tertiary">Seconds of no activity before prompting</div>
          </div>
          <select
            className="select"
            value={settings.inactivityThreshold}
            onChange={(e) => updateSetting('inactivityThreshold', parseInt(e.target.value))}
          >
            <option value={60}>1 min</option>
            <option value={120}>2 min</option>
            <option value={180}>3 min</option>
            <option value={300}>5 min</option>
            <option value={600}>10 min</option>
          </select>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-label">Tab-away threshold</div>
            <div className="text-sm text-tertiary">Seconds away before showing return prompt</div>
          </div>
          <select
            className="select"
            value={settings.tabAwayThreshold}
            onChange={(e) => updateSetting('tabAwayThreshold', parseInt(e.target.value))}
          >
            <option value={10}>10 sec</option>
            <option value={30}>30 sec</option>
            <option value={60}>1 min</option>
            <option value={120}>2 min</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)' }}>Mode</h3>
        <div className="settings-row">
          <div><div className="settings-label">How FocusLoop works</div><div className="text-sm text-tertiary">Local-only is the default.</div></div>
          <select className="select" value={settings.mode || (settings.aiEnabled ? 'ai-assisted' : 'local')} onChange={(event) => handleModeChange(event.target.value)}>
            <option value="local">Local-only</option>
            <option value="ai-assisted">AI-assisted</option>
          </select>
        </div>
        <p className="text-sm text-tertiary" style={{ marginTop: 'var(--space-3)' }}>Your files never leave your device.</p>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)' }}>Appearance</h3>

        <div className="settings-row">
          <div>
            <div className="settings-label">Theme</div>
          </div>
          <select
            className="select"
            value={settings.theme}
            onChange={(e) => updateSetting('theme', e.target.value)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-label">Sound effects</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => updateSetting('soundEnabled', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-label">Gentle interventions</div>
            <div className="text-sm text-tertiary">Show return prompts after interruptions</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.gentleInterventions}
              onChange={(e) => updateSetting('gentleInterventions', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)' }}>AI Status</h3>
        <div className="settings-row">
          <div>
            <div className="settings-label">AI enhancements</div>
            <div className="text-sm text-tertiary">Keep disabled to use local algorithms only</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.aiEnabled}
              onChange={(e) => handleAIToggle(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Mode</div>
          </div>
          <span className={`badge ${settings.aiEnabled && aiStatus?.aiAvailable ? 'badge-accent' : 'badge-warning'}`}>
            {!settings.aiEnabled ? '🔒 Local Mode' : aiStatus?.aiAvailable ? '🤖 AI Connected' : aiStatus?.status === 'unavailable' ? '📡 Server Offline' : '🎯 Demo Mode'}
          </span>
        </div>
        {settings.aiEnabled && (
          <button className="btn btn-secondary btn-sm" onClick={handleTestConnection}>
            Test connection
          </button>
        )}
        {!settings.aiEnabled && (
          <p className="text-sm text-tertiary" style={{ marginTop: 'var(--space-2)' }}>
            Local mode is active. Study plans, focus sessions, and review tools do not use an external AI provider.
          </p>
        )}
        {settings.aiEnabled && !aiStatus?.aiAvailable && (
          <p className="text-sm text-tertiary" style={{ marginTop: 'var(--space-2)' }}>
            AI features are using demo responses. Add an ANTHROPIC_API_KEY to the server .env to enable real AI.
          </p>
        )}
      </div>

      <div className="card">
        <h3 className="heading-3" style={{ marginBottom: 'var(--space-4)' }}>Data</h3>
        {!showClearConfirm ? (
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={handleExport}>Export JSON</button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>Import JSON<input type="file" accept="application/json,.json" onChange={handleImport} style={{ display: 'none' }} /></label>
            <button className="btn btn-ghost" onClick={() => setShowClearConfirm(true)} style={{ color: 'var(--color-error)' }}>Clear all data</button>
          </div>
        ) : (
          <div className="animate-fade-in">
            <p className="text-sm" style={{ marginBottom: 'var(--space-3)' }}>This will remove all sessions and settings. Are you sure?</p>
            <div className="btn-group">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowClearConfirm(false)}>Cancel</button>
              <button className="btn btn-sm" onClick={handleClearData} style={{ background: 'var(--color-error)', color: 'white' }}>Yes, clear everything</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
