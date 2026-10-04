import { useState } from 'react';
import { getSettings, saveSettings, clearAllData } from '../services/storageService';
import { checkAIHealth } from '../services/aiService';
import { useEffect } from 'react';

export default function Settings({ onBack }) {
  const [settings, setSettings] = useState(getSettings());
  const [aiStatus, setAiStatus] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    checkAIHealth().then(setAiStatus).catch(() => setAiStatus({ status: 'unavailable', mode: 'offline' }));
  }, []);

  const updateSetting = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
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
              onChange={(e) => updateSetting('aiEnabled', e.target.checked)}
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
          <button
            className="btn btn-ghost"
            onClick={() => setShowClearConfirm(true)}
            style={{ color: 'var(--color-error)' }}
          >
            Clear all data
          </button>
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
