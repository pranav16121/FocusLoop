import { useState } from 'react';
import { scheduleNextReview } from '../engine/revision';

export default function RevisionQueue({ schedule, onUpdate, onBack }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const card = schedule[index];

  if (!card) {
    return <div className="recall-screen"><h2 className="heading-2">Revision complete</h2><p className="text-secondary" style={{ margin: 'var(--space-3) 0 var(--space-5)' }}>Your next review is scheduled automatically.</p><button className="btn btn-primary" onClick={onBack}>Back to Home</button></div>;
  }

  const rate = (rating) => {
    const updated = scheduleNextReview(card, rating);
    onUpdate(schedule.map(item => item.id === card.id ? updated : item));
    setIndex(index + 1);
    setRevealed(false);
  };

  return (
    <div className="recall-screen animate-slide-up">
      <p className="text-sm text-tertiary">Revision queue</p>
      <h2 className="heading-2">{index + 1} of {schedule.length}</h2>
      <button className="recall-card" onClick={() => setRevealed(!revealed)}>
        <span className="recall-kind">{card.kind || 'concept'}</span>
        <strong>{revealed ? 'Answer' : 'Prompt'}</strong>
        <span>{revealed ? card.answer : card.prompt}</span>
      </button>
      {revealed ? <div className="recall-actions"><button className="btn btn-secondary" onClick={() => rate('missed')}>Missed</button><button className="btn btn-secondary" onClick={() => rate('almost')}>Almost</button><button className="btn btn-primary" onClick={() => rate('got-it')}>Got it</button></div> : <button className="btn btn-primary" onClick={() => setRevealed(true)}>Reveal answer</button>}
    </div>
  );
}
