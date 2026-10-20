import { useState } from 'react';
import { markReviewed, snoozeReminder } from '../engine/revision';

// Due "Revisit this topic" reminders. Reviewed advances the 1/3/7/14-day interval; Later snoozes a day.
export default function RevisionQueue({ schedule, due, onUpdate, onBack }) {
  const [list, setList] = useState(schedule);
  const [remaining, setRemaining] = useState(due);

  const apply = (entry, next) => {
    const updated = next ? list.map(item => (item.id === entry.id ? next : item)) : list.filter(item => item.id !== entry.id);
    setList(updated);
    onUpdate(updated);
    setRemaining(remaining.filter(item => item.id !== entry.id));
  };

  return (
    <div className="revision-screen animate-slide-up">
      <h2 className="heading-2">Revisit these topics</h2>
      {remaining.length === 0 ? (
        <>
          <p className="text-secondary" style={{ margin: 'var(--space-3) 0 var(--space-5)' }}>All caught up. Your next reminders are scheduled automatically.</p>
          <button className="btn btn-primary" onClick={onBack}>Back to Home</button>
        </>
      ) : (
        <>
          <ul className="revision-list">
            {remaining.map(entry => (
              <li key={entry.id} className="card card-compact revision-item">
                <div>
                  <div className="revision-title">{entry.title}</div>
                  {entry.task && <div className="text-sm text-tertiary">{entry.task}</div>}
                </div>
                <div className="revision-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => apply(entry, snoozeReminder(entry))}>Later</button>
                  <button className="btn btn-primary btn-sm" onClick={() => apply(entry, markReviewed(entry))}>Reviewed</button>
                </div>
              </li>
            ))}
          </ul>
          <button className="btn btn-ghost" onClick={onBack}>Back to Home</button>
        </>
      )}
    </div>
  );
}
