import { useState } from 'react';
import { getCurrentTask, getSessionHistory, getSettings, clearCurrentTask } from '../services/storageService';
import { formatDate, formatMinutes } from '../utils/formatTime';
import { MAX_SOURCE_LENGTH } from '../algorithms/studyEngine';

const DURATION_PRESETS = [10, 15, 20, 25, 30, 45];
const SAMPLE_PROMPT = "Study Network Analysis for tomorrow's exam";

export default function HomeScreen({ onStartTask, onStartMaterial, onContinueSession }) {
  const [taskInput, setTaskInput] = useState('');
  const [materialInput, setMaterialInput] = useState('');
  const [inputMode, setInputMode] = useState('task');
  const [duration, setDuration] = useState(() => getSettings().focusDuration || 20);
  const [savedTask, setSavedTask] = useState(() => getCurrentTask());
  const [recentSessions] = useState(() => getSessionHistory().slice(-3).reverse());

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = taskInput.trim();
    if (trimmed) {
      onStartTask(trimmed, duration);
    }
  };

  const handleMaterialSubmit = (e) => {
    e.preventDefault();
    const trimmed = materialInput.trim();
    if (trimmed && onStartMaterial) {
      onStartMaterial(trimmed, duration);
    }
  };

  const handleDismissSavedTask = (e) => {
    e.stopPropagation();
    clearCurrentTask();
    setSavedTask(null);
  };

  const handleApplySample = () => {
    setTaskInput(SAMPLE_PROMPT);
  };

  return (
    <div className="welcome-section animate-fade-in">
      <h1 className="welcome-tagline">Get back to what matters.</h1>
      <p className="welcome-subtitle">
        Focus on one small step. If you drift, we'll help you pick it back up.
      </p>

      {savedTask && (
        <div
          className="card card-accent continue-card animate-slide-up"
          onClick={onContinueSession}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onContinueSession()}
          style={{ position: 'relative' }}
        >
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleDismissSavedTask}
            title="Dismiss saved session"
            aria-label="Dismiss saved session"
            style={{
              position: 'absolute',
              top: 'var(--space-2)',
              right: 'var(--space-2)',
              padding: '2px 8px',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            ✕
          </button>
          <div className="continue-label">Continue where you left off</div>
          <div className="continue-task">{savedTask.task}</div>
          <div className="continue-meta">
            {savedTask.completedSteps || 0} of {savedTask.steps?.length || 0} steps completed · Click to resume
          </div>
        </div>
      )}

      <form onSubmit={inputMode === 'task' ? handleSubmit : handleMaterialSubmit} className="welcome-input-area">
        <div className="chip-group" style={{ justifyContent: 'center', marginBottom: 'var(--space-4)' }} role="tablist" aria-label="Choose a starting point">
          <button
            type="button"
            className={`chip ${inputMode === 'task' ? 'selected' : ''}`}
            onClick={() => setInputMode('task')}
            role="tab"
            aria-selected={inputMode === 'task'}
          >
            Start with a task
          </button>
          <button
            type="button"
            className={`chip ${inputMode === 'material' ? 'selected' : ''}`}
            onClick={() => setInputMode('material')}
            role="tab"
            aria-selected={inputMode === 'material'}
          >
            Study pasted material
          </button>
        </div>

        {inputMode === 'material' ? (
          <>
            <textarea
              className="text-input text-input-lg"
              placeholder="Paste notes, a chapter, or a syllabus here..."
              value={materialInput}
              onChange={(e) => setMaterialInput(e.target.value)}
              aria-label="Study material"
              rows={7}
              maxLength={MAX_SOURCE_LENGTH}
              style={{ resize: 'vertical', minHeight: '150px' }}
            />
            <p className="text-sm text-tertiary" style={{ textAlign: 'left', marginTop: 'var(--space-2)' }}>
              Processed locally in your browser. Nothing is uploaded. {materialInput.length.toLocaleString()} / {MAX_SOURCE_LENGTH.toLocaleString()} characters
            </p>
          </>
        ) : (
        <div className="input-group">
          <input
            type="text"
            className="text-input text-input-lg"
            placeholder="What are you trying to work on?"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            aria-label="What are you trying to work on?"
            autoFocus
          />
        </div>
        )}

        {/* Quick Demo Pill */}
        {inputMode === 'task' && !taskInput && (
          <div style={{ marginTop: 'var(--space-2)', textAlign: 'left' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleApplySample}
              style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', padding: '2px 6px' }}
            >
              💡 Try: "{SAMPLE_PROMPT}"
            </button>
          </div>
        )}

        {/* Duration Selection */}
        <div style={{ marginTop: 'var(--space-4)', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span className="text-sm text-secondary">Session duration:</span>
            <span className="text-sm" style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{duration} minutes</span>
          </div>
          <div className="chip-group">
            {DURATION_PRESETS.map((d) => (
              <button
                type="button"
                key={d}
                className={`chip ${duration === d ? 'selected' : ''}`}
                onClick={() => setDuration(d)}
                style={{ padding: '4px 12px', fontSize: 'var(--font-size-xs)' }}
              >
                {d}m
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg btn-block"
          disabled={inputMode === 'task' ? !taskInput.trim() : !materialInput.trim()}
          style={{ marginTop: 'var(--space-6)' }}
        >
          {inputMode === 'task' ? 'Start Focus' : 'Build Study Plan'}
        </button>
      </form>

      {recentSessions.length > 0 && (
        <div style={{ width: '100%', maxWidth: '480px', marginTop: 'var(--space-4)' }}>
          <div className="text-sm text-tertiary" style={{ marginBottom: 'var(--space-2)', textAlign: 'left' }}>
            Recent focus sessions
          </div>
          {recentSessions.map((session, i) => (
            <div key={session.id || i} className="card card-compact" style={{ marginBottom: 'var(--space-2)', cursor: 'default', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-sm" style={{ fontWeight: 500 }}>{session.task}</span>
                <span className="text-sm text-tertiary">
                  {session.startTime ? formatDate(session.startTime) : 'Recent'}
                </span>
              </div>
              <div className="text-sm text-tertiary" style={{ marginTop: 'var(--space-1)' }}>
                {session.duration ? formatMinutes(session.duration) : '—'} · {session.completedSteps || 0} completed · {session.interruptions || 0} interruptions
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="welcome-philosophy">
        FocusLoop doesn't punish distraction.<br />
        It helps you return.
      </p>
    </div>
  );
}
