import { useState, useEffect, useCallback, useRef } from 'react';
import { useTimer } from '../hooks/useTimer';
import { useDriftDetection } from '../hooks/useDriftDetection';
import { getLocalNextAction } from '../algorithms/studyEngine';
import { getSettings } from '../services/storageService';

export default function FocusSession({
  task,
  steps,
  currentStepIndex,
  sessionDuration,
  onCompleteStep,
  onEndSession,
  onPause,
  onResume,
  onDrift,
  onWhereWasI,
  isPaused,
  interruptionCount,
  elapsedSeconds,
  referenceMode,
  onToggleReferenceMode,
  parkingLot,
  onAddParkingItem,
  onUpdateParkingItem,
  onAddSnapshot,
  onPersistElapsed,
}) {
  const [helpText, setHelpText] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [helpLoading, setHelpLoading] = useState(false);
  const [parkingText, setParkingText] = useState('');
  const [showParkingLot, setShowParkingLot] = useState(false);
  const [snapshotText, setSnapshotText] = useState('');
  const [showSnapshotPrompt, setShowSnapshotPrompt] = useState(false);
  const [checkedActions, setCheckedActions] = useState([]);
  const nextSnapshotAtRef = useRef((getSettings().contextSnapshotInterval || 300));
  const elapsedRef = useRef(elapsedSeconds || 0);
  const currentStep = steps[currentStepIndex];
  const actionItems = (currentStep?.nextAction || getLocalNextAction(currentStep)).split(/\.\s+/).filter(Boolean);
  
  const handleTimerComplete = useCallback(() => {
    onEndSession(sessionDuration * 60);
  }, [onEndSession, sessionDuration]);

  const timer = useTimer(sessionDuration * 60, handleTimerComplete);
  const drift = useDriftDetection(!isPaused && timer.isRunning, { referenceMode });

  // Start timer on mount
  useEffect(() => {
    timer.start(Math.max(0, (sessionDuration * 60) - (elapsedSeconds || 0)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track elapsed
  useEffect(() => {
    elapsedRef.current = (sessionDuration * 60) - timer.seconds;
    if (elapsedRef.current > 0) {
      onPersistElapsed(elapsedRef.current);
    }
    const interval = getSettings().contextSnapshotInterval || 300;
    if (!isPaused && elapsedRef.current >= nextSnapshotAtRef.current && !showSnapshotPrompt) {
      setShowSnapshotPrompt(true);
      nextSnapshotAtRef.current += interval;
    }
  }, [timer.seconds, sessionDuration, isPaused, referenceMode, showSnapshotPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle drift detection
  useEffect(() => {
    if (drift.isDrifting && drift.driftData) {
      timer.pause();
      onDrift(drift.interruptionCount, { ...drift.driftData, elapsed: elapsedRef.current });
    }
  }, [drift.isDrifting, drift.driftData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle external pause
  useEffect(() => {
    if (isPaused && timer.isRunning) {
      timer.pause();
    } else if (!isPaused && timer.isPaused) {
      timer.resume();
      drift.dismissDrift();
    }
  }, [isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCheckedActions([]);
  }, [currentStepIndex]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.key.toLowerCase() === 'p' && event.ctrlKey && event.shiftKey) {
        event.preventDefault();
        setShowParkingLot(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const handleNeedHelp = () => {
    setShowHelp(true);
    setHelpLoading(true);
    if (currentStep?.nextAction) {
      setHelpText(currentStep.nextAction);
      setHelpLoading(false);
      return;
    }
    setHelpText(getLocalNextAction(currentStep));
    setHelpLoading(false);
  };

  const handlePauseResume = () => {
    if (timer.isRunning) {
      timer.pause();
      onPause(elapsedRef.current);
    } else {
      timer.resume();
      onResume();
    }
  };

  const handleCompleteStep = () => {
    setShowHelp(false);
    setHelpText(null);
    onCompleteStep(elapsedRef.current);
  };

  const handleEndSession = () => {
    timer.pause();
    onEndSession(elapsedRef.current);
  };

  const handleParkingSubmit = (event) => {
    event.preventDefault();
    const text = parkingText.trim();
    if (!text) return;
    onAddParkingItem(text);
    setParkingText('');
  };

  const handleSnapshotSubmit = (event) => {
    event.preventDefault();
    const text = snapshotText.trim();
    if (!text) return;
    onAddSnapshot(text);
    setSnapshotText('');
    setShowSnapshotPrompt(false);
  };

  const handleManualSimulateDrift = () => {
    drift.simulateDrift(180); // Simulate 3 minutes away
  };

  return (
    <div className="focus-container animate-fade-in">
      <div className="focus-task-label">Working on</div>
      <div className="focus-task-name">{task}</div>

      <div className="focus-current-step">
        {currentStep?.title || 'Your current step'}
      </div>

      {referenceMode && <div className="reference-mode-banner" role="status">Reference Mode is on. You can look things up without a return prompt.</div>}

      <div className="focus-action-checklist" aria-label="Micro-action checklist">
        <p className="text-sm text-secondary">Next tiny actions</p>
        {actionItems.map((action, index) => (
          <label className={`focus-action-item ${checkedActions.includes(index) ? 'checked' : ''}`} key={`${action}-${index}`}>
            <input
              type="checkbox"
              checked={checkedActions.includes(index)}
              onChange={() => setCheckedActions(previous => previous.includes(index) ? previous.filter(item => item !== index) : [...previous, index])}
            />
            <span>{action}{action.endsWith('.') ? '' : '.'}</span>
          </label>
        ))}
      </div>

      <div 
        className="timer-display" 
        role="timer" 
        aria-label={`${timer.minutes} minutes and ${timer.remainingSeconds} seconds remaining`}
      >
        {timer.display}
      </div>

      <div className="timer-progress">
        <div
          className="timer-progress-bar"
          style={{ width: `${timer.progress}%` }}
          role="progressbar"
          aria-valuenow={Math.round(timer.progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginTop: 'var(--space-2)' }}>
        <span className="badge">
          Step {currentStepIndex + 1} of {steps.length}
        </span>
        {interruptionCount > 0 && (
          <span className="badge badge-warning">
            {interruptionCount} {interruptionCount === 1 ? 'interruption' : 'interruptions'}
          </span>
        )}
      </div>

      <div className="focus-session-tools">
        <button className={`btn btn-sm ${referenceMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onToggleReferenceMode(!referenceMode)} aria-pressed={referenceMode}>
          {referenceMode ? 'Reference Mode ON' : 'Reference Mode'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowParkingLot(!showParkingLot)}>
          Parking lot {parkingLot.length > 0 ? `(${parkingLot.filter(item => item.status === 'open').length})` : ''} <span className="text-tertiary">Ctrl+Shift+P</span>
        </button>
      </div>

      {showSnapshotPrompt && (
        <form className="card card-accent focus-tool-card" onSubmit={handleSnapshotSubmit}>
          <p className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Where are you right now?</p>
          <textarea className="text-input" value={snapshotText} onChange={event => setSnapshotText(event.target.value)} placeholder="I finished..." rows="2" autoFocus />
          <div className="btn-group" style={{ marginTop: 'var(--space-2)' }}>
            <button className="btn btn-primary btn-sm" type="submit" disabled={!snapshotText.trim()}>Save snapshot</button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowSnapshotPrompt(false)}>Later</button>
          </div>
        </form>
      )}

      {showParkingLot && (
        <div className="card card-compact focus-tool-card">
          <p className="text-sm text-secondary" style={{ marginBottom: 'var(--space-2)' }}>Capture it and return to the task.</p>
          <form onSubmit={handleParkingSubmit} style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input className="text-input" value={parkingText} onChange={event => setParkingText(event.target.value)} placeholder="A thought to park..." aria-label="Thought to park" />
            <button className="btn btn-secondary btn-sm" type="submit">Add</button>
          </form>
          {parkingLot.filter(item => item.status === 'open').map(item => (
            <div key={item.id} className="parking-item">
              <span>{item.text}</span>
              <span className="parking-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => onUpdateParkingItem(item.id, 'completed')}>Done</button>
                <button className="btn btn-ghost btn-sm" onClick={() => onUpdateParkingItem(item.id, 'deferred')}>Defer</button>
                <button className="btn btn-ghost btn-sm" onClick={() => onUpdateParkingItem(item.id, 'deleted')} aria-label={`Delete ${item.text}`}>Delete</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="focus-controls">
        <button 
          className="btn btn-secondary" 
          onClick={handlePauseResume}
          aria-label={timer.isRunning ? 'Pause focus timer' : 'Resume focus timer'}
        >
          {timer.isRunning ? '⏸ Pause' : '▶ Resume'}
        </button>
        <button 
          className="btn btn-primary" 
          onClick={handleCompleteStep}
          aria-label="Complete current step"
        >
          ✓ Finish Step
        </button>
        <button 
          className="btn btn-ghost" 
          onClick={handleEndSession}
          aria-label="End focus session"
        >
          End Session
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-8)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button 
          className="btn btn-ghost btn-sm" 
          onClick={onWhereWasI}
          title="Recover context and see where you are"
        >
          🗺️ Where was I?
        </button>

        {!showHelp && (
          <button 
            className="btn btn-ghost btn-sm" 
            onClick={handleNeedHelp}
            title="Get a tiny next actionable prompt"
          >
            💡 Need help?
          </button>
        )}

        <button 
          className="btn btn-ghost btn-sm text-tertiary" 
          onClick={handleManualSimulateDrift}
          title="Simulate returning from stepping away (for demo testing)"
          style={{ fontSize: 'var(--font-size-xs)' }}
        >
          ⚡ Test Drift (3m away)
        </button>
      </div>

      {showHelp && (
        <div className="card card-compact animate-fade-in" style={{ maxWidth: '440px', width: '100%', textAlign: 'left', marginTop: 'var(--space-4)' }}>
          <p className="text-sm text-secondary" style={{ marginBottom: 'var(--space-1)' }}>Your next tiny action:</p>
          {helpLoading ? (
            <div className="loading-dots" style={{ padding: 'var(--space-2)' }}>
              <div className="loading-dot" />
              <div className="loading-dot" />
              <div className="loading-dot" />
            </div>
          ) : (
            <p style={{ fontWeight: 500, color: 'var(--color-text)' }}>{helpText}</p>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setShowHelp(false); setHelpText(null); }}
            style={{ marginTop: 'var(--space-2)', alignSelf: 'flex-start' }}
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
