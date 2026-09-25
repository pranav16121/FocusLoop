import { useState } from 'react';

const DURATION_PRESETS = [10, 15, 20, 25, 30, 45];

export default function TaskSetup({ task, onStart, onBack }) {
  const [duration, setDuration] = useState(20);
  const [customDuration, setCustomDuration] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  const handleStart = () => {
    const mins = customDuration ? parseInt(customDuration, 10) : duration;
    onStart(mins || 20);
  };

  return (
    <div className="animate-slide-up" style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
      <p className="text-sm text-tertiary" style={{ marginBottom: 'var(--space-2)' }}>Your task</p>
      <h2 className="heading-2" style={{ marginBottom: 'var(--space-8)' }}>{task}</h2>

      <div style={{ marginBottom: 'var(--space-6)' }}>
        <p className="text-sm text-secondary" style={{ marginBottom: 'var(--space-3)' }}>Session length</p>
        <div className="chip-group" style={{ justifyContent: 'center' }}>
          {DURATION_PRESETS.map((d) => (
            <button
              key={d}
              className={`chip ${duration === d && !customDuration ? 'selected' : ''}`}
              onClick={() => { setDuration(d); setCustomDuration(''); }}
            >
              {d} min
            </button>
          ))}
          <input
            type="number"
            className="text-input"
            placeholder="Custom"
            value={customDuration}
            onChange={(e) => setCustomDuration(e.target.value)}
            style={{ width: '80px', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-full)', textAlign: 'center', fontSize: 'var(--font-size-sm)' }}
            min="1"
            max="120"
            aria-label="Custom duration in minutes"
          />
        </div>
      </div>

      {!showOptions && (
        <button className="btn btn-ghost btn-sm" onClick={() => setShowOptions(true)} style={{ marginBottom: 'var(--space-4)' }}>
          More options
        </button>
      )}

      {showOptions && (
        <div className="animate-fade-in" style={{ marginBottom: 'var(--space-6)' }}>
          <p className="text-sm text-secondary" style={{ marginBottom: 'var(--space-3)' }}>How does this feel?</p>
          <div className="chip-group" style={{ justifyContent: 'center' }}>
            <button className="chip">Easy</button>
            <button className="chip">Moderate</button>
            <button className="chip">Challenging</button>
            <button className="chip">I don't know where to start</button>
          </div>
        </div>
      )}

      <div className="btn-group" style={{ justifyContent: 'center', marginTop: 'var(--space-4)' }}>
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
        <button className="btn btn-primary btn-lg" onClick={handleStart}>Let's go</button>
      </div>
    </div>
  );
}
