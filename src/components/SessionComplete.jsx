import { useState, useEffect } from 'react';
import { generateSessionReflection, generateAdaptivePlan } from '../services/aiService';
import { getSessionHistory } from '../services/storageService';
import { formatMinutes } from '../utils/formatTime';

const FEELINGS = ['Easy', 'Okay', 'Difficult'];
const OBSTACLES = ['Phone', 'Other tabs', 'Environment', 'Task felt too difficult', 'Lost interest', 'Needed a break', 'Other'];

export default function SessionComplete({
  task,
  steps,
  _currentStepIndex,
  completedSteps,
  elapsedSeconds,
  interruptionCount,
  onSaveReflection,
  onStartNextSession,
  onGoHome,
}) {
  const [feeling, setFeeling] = useState(null);
  const [obstacles, setObstacles] = useState([]);
  const [aiReflection, setAiReflection] = useState(null);
  const [adaptivePlan, setAdaptivePlan] = useState(null);
  const [saved, setSaved] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(20);

  const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
  const hasRemainingSteps = steps && steps.length > completedSteps;
  const nextStep = steps?.[completedSteps];

  useEffect(() => {
    async function fetchInsights() {
      try {
        const history = getSessionHistory();
        const [reflResult, planResult] = await Promise.all([
          generateSessionReflection(task, steps, completedSteps, durationMinutes, interruptionCount),
          generateAdaptivePlan(history),
        ]);
        if (reflResult) setAiReflection(reflResult);
        if (planResult) {
          setAdaptivePlan(planResult);
          if (planResult.recommendedDuration) {
            setSelectedDuration(planResult.recommendedDuration);
          }
        }
      } catch {
        // Silently fallback
      }
    }
    fetchInsights();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleObstacle = (o) => {
    setObstacles(prev =>
      prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]
    );
  };

  const handleSave = () => {
    onSaveReflection({
      feeling,
      obstacles,
      aiReflection,
      durationMinutes,
    });
    setSaved(true);
  };

  if (saved) {
    return (
      <div className="focus-container animate-fade-in" style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }} aria-hidden="true">🌱</div>
        <h2 className="heading-2">Session saved</h2>
        <p className="text-secondary" style={{ marginTop: 'var(--space-1)', marginBottom: 'var(--space-6)' }}>
          Nice work. Take a deep breath.
        </p>

        {adaptivePlan && (
          <div className="card card-accent" style={{ marginBottom: 'var(--space-6)', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <span className="badge badge-accent" style={{ fontWeight: 600 }}>Adaptive Recommendation</span>
              <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{selectedDuration} min</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text)', marginBottom: 'var(--space-3)' }}>
              {adaptivePlan.reason || 'A 20-minute session will work well for your next small step.'}
            </p>

            {hasRemainingSteps && nextStep && (
              <div style={{ padding: 'var(--space-3)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', marginBottom: 'var(--space-3)' }}>
                <p className="text-sm text-tertiary" style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Next step in "{task}"
                </p>
                <p style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: '2px' }}>
                  {nextStep.title}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="text-sm text-secondary">Adjust:</span>
              {[10, 15, 20, 25, 30].map(d => (
                <button
                  key={d}
                  className={`chip ${selectedDuration === d ? 'selected' : ''}`}
                  onClick={() => setSelectedDuration(d)}
                  style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--font-size-xs)' }}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="btn-group" style={{ justifyContent: 'center' }}>
          {hasRemainingSteps ? (
            <button 
              className="btn btn-primary btn-lg" 
              onClick={() => onStartNextSession(selectedDuration)}
            >
              Start Next Step ({selectedDuration}m)
            </button>
          ) : (
            <button className="btn btn-primary btn-lg" onClick={onGoHome}>
              Back to Home
            </button>
          )}
          <button className="btn btn-secondary" onClick={onGoHome}>
            {hasRemainingSteps ? 'Take a break & go home' : 'Done'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-slide-up" style={{ padding: 'var(--space-6) 0', maxWidth: '480px', margin: '0 auto' }}>
      <div className="text-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }} aria-hidden="true">🎉</div>
        <h2 className="heading-2">Session complete</h2>
        <p className="text-secondary" style={{ marginTop: 'var(--space-1)' }}>
          You focused for {formatMinutes(durationMinutes)}. That is real progress.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
          <span className="text-sm text-secondary">Steps completed</span>
          <span className="text-sm" style={{ fontWeight: 600 }}>{completedSteps} / {steps.length}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="text-sm text-secondary">Attention drifts caught</span>
          <span className="text-sm" style={{ fontWeight: 600 }}>{interruptionCount}</span>
        </div>
      </div>

      {aiReflection?.reflection && (
        <div className="card card-compact animate-fade-in" style={{ marginBottom: 'var(--space-4)', background: 'var(--color-bg-subtle)', border: 'none' }}>
          <p className="text-sm" style={{ fontStyle: 'italic', color: 'var(--color-text)' }}>
            "{aiReflection.reflection}"
          </p>
          {aiReflection.suggestion && (
            <p className="text-sm text-tertiary" style={{ marginTop: 'var(--space-2)' }}>
              {aiReflection.suggestion}
            </p>
          )}
        </div>
      )}

      <div style={{ marginBottom: 'var(--space-6)' }}>
        <p className="text-sm text-secondary text-center" style={{ marginBottom: 'var(--space-3)' }}>
          How did that session feel?
        </p>
        <div className="reflection-options">
          {FEELINGS.map(f => (
            <button
              key={f}
              className={`reflection-option ${feeling === f ? 'selected' : ''}`}
              onClick={() => setFeeling(f)}
              aria-pressed={feeling === f}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-6)' }}>
        <p className="text-sm text-secondary text-center" style={{ marginBottom: 'var(--space-3)' }}>
          What got in the way? <span className="text-tertiary">(optional)</span>
        </p>
        <div className="reflection-options">
          {OBSTACLES.map(o => (
            <button
              key={o}
              className={`reflection-option ${obstacles.includes(o) ? 'selected' : ''}`}
              onClick={() => toggleObstacle(o)}
              aria-pressed={obstacles.includes(o)}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <div className="text-center">
        <button className="btn btn-primary btn-lg btn-block" onClick={handleSave}>
          Save & view next plan
        </button>
        <div style={{ marginTop: 'var(--space-3)' }}>
          <button className="btn btn-ghost btn-sm" onClick={handleSave}>
            Skip reflection
          </button>
        </div>
      </div>
    </div>
  );
}
