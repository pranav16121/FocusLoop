import { useState } from 'react';

export default function RecallReview({ topic, cards, onRate, onFinish }) {
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[cardIndex];

  if (!card) {
    return <div className="recall-screen"><h2 className="heading-2">Recall complete</h2><button className="btn btn-primary" onClick={onFinish}>Return to focus</button></div>;
  }

  const rate = (rating) => {
    onRate(card.id, rating);
    if (cardIndex + 1 >= cards.length) onFinish();
    else {
      setCardIndex(cardIndex + 1);
      setFlipped(false);
    }
  };

  return (
    <div className="recall-screen animate-slide-up">
      <p className="text-sm text-tertiary">Quick recall</p>
      <h2 className="heading-2">{topic?.title || 'Review this topic'}</h2>
      <p className="text-secondary" style={{ marginTop: 'var(--space-2)' }}>{cardIndex + 1} of {cards.length}</p>
      <button className={`recall-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-label={flipped ? 'Hide recall answer' : 'Reveal recall answer'}>
        <span className="recall-kind">{card.kind}</span>
        <strong>{flipped ? 'Answer' : 'Prompt'}</strong>
        <span>{flipped ? card.answer : card.prompt}</span>
        {!flipped && <small>Tap to reveal</small>}
      </button>
      {flipped ? (
        <div className="recall-actions">
          <button className="btn btn-secondary" onClick={() => rate('missed')}>Missed</button>
          <button className="btn btn-secondary" onClick={() => rate('almost')}>Almost</button>
          <button className="btn btn-primary" onClick={() => rate('got-it')}>Got it</button>
        </div>
      ) : <button className="btn btn-primary" onClick={() => setFlipped(true)}>Reveal answer</button>}
      <button className="btn btn-ghost btn-sm" onClick={onFinish}>Skip recall</button>
    </div>
  );
}
