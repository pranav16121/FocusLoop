import { useState, useMemo } from 'react';
import { getSessionHistory } from '../services/storageService';
import { formatDate, formatMinutes } from '../utils/formatTime';

export default function SessionHistory({ onBack }) {
  const [expandedId, setExpandedId] = useState(null);
  const sessions = useMemo(() => [...getSessionHistory()].reverse(), []);

  const [now] = useState(() => Date.now());
  const weekStats = useMemo(() => {
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recent = sessions.filter(s => new Date(s.startTime || s.savedAt).getTime() > weekAgo);
    return {
      count: recent.length,
      totalMinutes: recent.reduce((sum, s) => sum + (s.duration || 0), 0),
      comebacks: recent.filter(s => (s.interruptions || 0) > 0).length,
    };
  }, [sessions, now]);

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="animate-fade-in" style={{ padding: 'var(--space-4) 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <h2 className="heading-2">Session History</h2>
      </div>

      {sessions.length > 0 && (
        <div className="history-summary-card">
          <div className="history-stat-box">
            <div className="history-stat-value">{weekStats.count}</div>
            <div className="history-stat-label">sessions this week</div>
          </div>
          <div className="history-stat-box">
            <div className="history-stat-value">{formatMinutes(weekStats.totalMinutes)}</div>
            <div className="history-stat-label">focused time</div>
          </div>
          <div className="history-stat-box">
            <div className="history-stat-value">{weekStats.totalInterruptions}</div>
            <div className="history-stat-label">comebacks</div>
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <p>No sessions yet.</p>
          <p className="text-sm text-tertiary" style={{ marginTop: 'var(--space-2)' }}>
            Complete a focus session to see it here.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {sessions.map((session) => (
            <div key={session.id || session.savedAt}>
              <div
                className="history-item"
                onClick={() => toggleExpand(session.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleExpand(session.id)}
              >
                <div className="history-date">
                  {session.startTime ? formatDate(session.startTime) : ''}
                </div>
                <div className="history-task">{session.task}</div>
                <div className="history-stats">
                  <span>{formatMinutes(session.duration || 0)}</span>
                  <span>{session.completedSteps || 0}/{session.totalSteps || 0} steps</span>
                  <span>{session.interruptions || 0} interruptions</span>
                </div>
              </div>

              {expandedId === session.id && (
                <div className="animate-fade-in" style={{ padding: 'var(--space-4)', background: 'var(--color-bg-subtle)', borderTop: '1px solid var(--color-border-light)' }}>
                  {session.steps && session.steps.length > 0 && (
                    <div style={{ marginBottom: 'var(--space-3)' }}>
                      <p className="text-sm text-tertiary" style={{ marginBottom: 'var(--space-2)' }}>Steps</p>
                      {session.steps.map((step, i) => (
                        <div key={i} className="text-sm" style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                          <span>{step.completed ? '✓' : '○'}</span>
                          <span>{step.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {session.reflection && (
                    <div>
                      <p className="text-sm text-tertiary" style={{ marginBottom: 'var(--space-1)' }}>Reflection</p>
                      {session.reflection.feeling && (
                        <p className="text-sm">Felt: {session.reflection.feeling}</p>
                      )}
                      {session.reflection.aiReflection?.reflection && (
                        <p className="text-sm" style={{ fontStyle: 'italic', marginTop: 'var(--space-1)', color: 'var(--color-text-secondary)' }}>
                          {session.reflection.aiReflection.reflection}
                        </p>
                      )}
                    </div>
                  )}
                  {session.recallCards?.length > 0 && (
                    <p className="text-sm text-tertiary" style={{ marginTop: 'var(--space-3)' }}>
                      {session.recallCards.length} recall cards reviewed
                    </p>
                  )}
                  {session.parkingLot?.length > 0 && (
                    <p className="text-sm text-tertiary" style={{ marginTop: 'var(--space-1)' }}>
                      {session.parkingLot.length} parked thoughts captured
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
