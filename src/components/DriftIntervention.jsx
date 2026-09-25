import { formatRelativeTime } from '../utils/formatTime';

export default function DriftIntervention({
  task,
  currentStep,
  driftData,
  onContinue,
  onTakeBreak,
  onChangeTask,
  onWhereWasI,
}) {
  const duration = driftData?.duration || 0;

  return (
    <div className="drift-overlay">
      <div className="drift-modal animate-slide-up" role="dialog" aria-modal="true" aria-labelledby="drift-title">
        <div className="drift-emoji" aria-hidden="true">🌱</div>
        <h2 id="drift-title" className="drift-title">Welcome back</h2>
        
        <p className="drift-message">
          {duration > 0 
            ? `You stepped away for ${formatRelativeTime(duration)}.` 
            : 'You stepped away for a brief moment.'}
        </p>

        <p className="drift-message" style={{ marginBottom: 'var(--space-2)' }}>
          Ready to continue with:
        </p>

        <div className="drift-step">
          {currentStep?.title || task}
        </div>

        <div className="drift-actions">
          <button className="btn btn-primary btn-block" onClick={onContinue}>
            Continue
          </button>
          <button className="btn btn-secondary btn-block" onClick={onWhereWasI}>
            🗺️ Where was I?
          </button>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-ghost" onClick={onTakeBreak} style={{ flex: 1 }}>
              Take a short break
            </button>
            <button className="btn btn-ghost" onClick={onChangeTask} style={{ flex: 1 }}>
              Change task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
