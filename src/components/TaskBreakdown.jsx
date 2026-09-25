import { useState, useEffect } from 'react';

export default function TaskBreakdown({ task, steps, isLoading, onStartFocus, onBack, onUpdateSteps }) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editValue, setEditValue] = useState('');
  const [newStepTitle, setNewStepTitle] = useState('');
  const [isAddingStep, setIsAddingStep] = useState(false);

  useEffect(() => {
    if (!isLoading && steps.length > 0) {
      setRevealedCount(0);
      const interval = setInterval(() => {
        setRevealedCount(prev => {
          if (prev >= steps.length) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, 150);
      return () => clearInterval(interval);
    }
  }, [isLoading, steps.length]);

  const handleRemoveStep = (index) => {
    const newSteps = steps.filter((_, i) => i !== index);
    onUpdateSteps(newSteps);
  };

  const handleEditStep = (index) => {
    setEditingIndex(index);
    setEditValue(steps[index].title);
  };

  const handleSaveEdit = () => {
    if (editValue.trim() && editingIndex >= 0) {
      const newSteps = [...steps];
      newSteps[editingIndex] = { ...newSteps[editingIndex], title: editValue.trim() };
      onUpdateSteps(newSteps);
    }
    setEditingIndex(-1);
    setEditValue('');
  };

  const handleAddStep = () => {
    if (newStepTitle.trim()) {
      const newSteps = [...steps, { title: newStepTitle.trim(), description: '', estimatedMinutes: 10, completed: false }];
      onUpdateSteps(newSteps);
      setNewStepTitle('');
      setIsAddingStep(false);
      setRevealedCount(newSteps.length);
    }
  };

  const allRevealed = revealedCount >= steps.length;

  return (
    <div className="animate-slide-up" style={{ padding: 'var(--space-6) 0', maxWidth: '540px', margin: '0 auto' }}>
      <p className="text-sm text-tertiary text-center" style={{ marginBottom: 'var(--space-1)' }}>Your task</p>
      <h2 className="heading-2 text-center" style={{ marginBottom: 'var(--space-2)' }}>{task}</h2>
      <p className="text-center text-secondary" style={{ marginBottom: 'var(--space-6)' }}>
        Let's make this smaller. One small step at a time.
      </p>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div className="loading-dots">
            <div className="loading-dot" />
            <div className="loading-dot" />
            <div className="loading-dot" />
          </div>
          <p className="text-sm text-tertiary" style={{ marginTop: 'var(--space-2)' }}>
            Breaking task into manageable micro-steps...
          </p>
        </div>
      ) : (
        <>
          <ol className="step-list" style={{ marginBottom: 'var(--space-4)' }}>
            {steps.map((step, index) => (
              <li
                key={index}
                className="step-item step-enter"
                style={{
                  opacity: index < revealedCount ? 1 : 0,
                  transform: index < revealedCount ? 'translateX(0)' : 'translateX(-10px)',
                  transition: 'opacity 0.25s ease, transform 0.25s ease',
                }}
              >
                <div className="step-checkbox" aria-hidden="true">
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                    {index + 1}
                  </span>
                </div>
                <div className="step-content">
                  {editingIndex === index ? (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <input
                        type="text"
                        className="text-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        autoFocus
                        style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)' }}
                      />
                      <button className="btn btn-sm btn-secondary" onClick={handleSaveEdit}>Save</button>
                    </div>
                  ) : (
                    <>
                      <div className="step-title">{step.title}</div>
                      {step.description && <div className="step-description">{step.description}</div>}
                    </>
                  )}
                </div>
                {step.estimatedMinutes && (
                  <span className="step-estimate">{step.estimatedMinutes}m</span>
                )}
                {editingIndex !== index && (
                  <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleEditStep(index)}
                      aria-label={`Edit step ${index + 1}`}
                      style={{ padding: 'var(--space-1)' }}
                      title="Edit step"
                    >
                      ✏️
                    </button>
                    {steps.length > 1 && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleRemoveStep(index)}
                        aria-label={`Remove step ${index + 1}`}
                        style={{ padding: 'var(--space-1)' }}
                        title="Remove step"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>

          {/* Add Step */}
          {allRevealed && (
            <div style={{ marginBottom: 'var(--space-6)', textAlign: 'left' }}>
              {!isAddingStep ? (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setIsAddingStep(true)}
                  style={{ color: 'var(--color-accent)', fontSize: 'var(--font-size-sm)' }}
                >
                  + Add a custom step
                </button>
              ) : (
                <div className="card card-compact animate-fade-in" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="Enter new step..."
                    value={newStepTitle}
                    onChange={(e) => setNewStepTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddStep()}
                    autoFocus
                    style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', flex: 1 }}
                  />
                  <button className="btn btn-sm btn-primary" onClick={handleAddStep} disabled={!newStepTitle.trim()}>
                    Add
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setIsAddingStep(false)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {allRevealed && (
            <div className="animate-fade-in" style={{ textAlign: 'center' }}>
              <p className="text-sm text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
                Ready when you are. Starting with: <strong>{steps[0]?.title}</strong>
              </p>
              <div className="btn-group" style={{ justifyContent: 'center' }}>
                <button className="btn btn-ghost" onClick={onBack}>Back</button>
                <button className="btn btn-primary btn-lg" onClick={onStartFocus}>
                  Start Focus Session
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
