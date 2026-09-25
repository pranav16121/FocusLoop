import { useState, useEffect } from 'react';
import { generateContextSummary } from '../services/aiService';
import { formatRelativeTime } from '../utils/formatTime';

export default function ContextRecovery({
  task,
  steps,
  currentStepIndex,
  interruptionDuration,
  onContinue,
  onReset,
  onGoHome,
}) {
  const [contextData, setContextData] = useState(null);
  const [loading, setLoading] = useState(true);

  const completedSteps = (steps || []).slice(0, currentStepIndex);
  const currentStep = steps?.[currentStepIndex];
  const nextStep = steps?.[currentStepIndex + 1];

  useEffect(() => {
    async function fetchContext() {
      try {
        const result = await generateContextSummary(
          task,
          steps,
          currentStepIndex,
          interruptionDuration || 0
        );
        setContextData(result);
      } catch {
        setContextData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchContext();
  }, [task, steps, currentStepIndex, interruptionDuration]);

  return (
    <div className="animate-slide-up" style={{ padding: 'var(--space-6) 0', maxWidth: '520px', margin: '0 auto' }}>
      <div className="text-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }} aria-hidden="true">🧭</div>
        <h2 className="heading-2">Here's where you left off</h2>
        {interruptionDuration > 0 ? (
          <p className="text-secondary" style={{ marginTop: 'var(--space-2)' }}>
            You stepped away for {formatRelativeTime(interruptionDuration)}. Zero worries — let's re-anchor.
          </p>
        ) : (
          <p className="text-secondary" style={{ marginTop: 'var(--space-2)' }}>
            One small step at a time. Here is your current anchor.
          </p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-3)' }}>
        <p className="text-sm text-tertiary" style={{ marginBottom: 'var(--space-1)' }}>Current focus</p>
        <h3 className="heading-3">{task}</h3>
      </div>

      {completedSteps.length > 0 && (
        <div className="card card-compact" style={{ marginBottom: 'var(--space-3)' }}>
          <p className="text-sm text-tertiary" style={{ marginBottom: 'var(--space-2)' }}>Completed steps</p>
          {completedSteps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
              <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>✓</span>
              <span className="text-sm text-secondary" style={{ textDecoration: 'line-through' }}>{step.title}</span>
            </div>
          ))}
        </div>
      )}

      {currentStep && (
        <div className="card card-accent" style={{ marginBottom: 'var(--space-3)' }}>
          <p className="text-sm" style={{ color: 'var(--color-accent)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
            Current step
          </p>
          <h3 className="heading-3">{currentStep.title}</h3>
          {currentStep.description && (
            <p className="text-sm text-secondary" style={{ marginTop: 'var(--space-1)' }}>{currentStep.description}</p>
          )}

          {contextData?.nextAction && (
            <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)' }}>
              <p className="text-sm text-tertiary" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 'var(--font-size-xs)' }}>
                Next immediate action
              </p>
              <p style={{ fontWeight: 500, color: 'var(--color-text)', marginTop: '2px' }}>
                {contextData.nextAction}
              </p>
            </div>
          )}
        </div>
      )}

      {nextStep && (
        <div className="card card-compact" style={{ marginBottom: 'var(--space-3)' }}>
          <p className="text-sm text-tertiary" style={{ marginBottom: 'var(--space-1)' }}>Coming up next</p>
          <p className="text-sm" style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>• {nextStep.title}</p>
        </div>
      )}

      {loading ? (
        <div className="loading-dots" style={{ padding: 'var(--space-4)' }}>
          <div className="loading-dot" />
          <div className="loading-dot" />
          <div className="loading-dot" />
        </div>
      ) : contextData?.summary && (
        <div className="card card-compact animate-fade-in" style={{ marginBottom: 'var(--space-6)', background: 'var(--color-bg-subtle)', border: 'none' }}>
          <p className="text-sm" style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
            "{contextData.summary}"
          </p>
        </div>
      )}

      <div className="text-center" style={{ marginTop: 'var(--space-6)' }}>
        <p className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
          Ready to pick it back up?
        </p>
        <div className="btn-group" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={onContinue}>
            Continue Session
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={onReset}
            title="Forget the interruption and restart clean"
          >
            Reset & restart
          </button>
          <button className="btn btn-ghost" onClick={onGoHome}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
