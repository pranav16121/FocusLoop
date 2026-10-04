import { useState, useEffect, useCallback, useRef } from 'react';
import { useTimer } from '../hooks/useTimer';
import { useDriftDetection } from '../hooks/useDriftDetection';
import { getLocalNextAction } from '../algorithms/studyEngine';

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
}) {
  const [helpText, setHelpText] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [helpLoading, setHelpLoading] = useState(false);
  const elapsedRef = useRef(elapsedSeconds || 0);
  const currentStep = steps[currentStepIndex];
  
  const handleTimerComplete = useCallback(() => {
    onEndSession(sessionDuration * 60);
  }, [onEndSession, sessionDuration]);

  const timer = useTimer(sessionDuration * 60, handleTimerComplete);
  const drift = useDriftDetection(!isPaused && timer.isRunning);

  // Start timer on mount
  useEffect(() => {
    timer.start(Math.max(0, (sessionDuration * 60) - (elapsedSeconds || 0)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track elapsed
  useEffect(() => {
    elapsedRef.current = (sessionDuration * 60) - timer.seconds;
  }, [timer.seconds, sessionDuration]);

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
      onPause();
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
