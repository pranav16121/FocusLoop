import { useState } from 'react';
import { buildExamPlan, rebalanceExamPlan } from '../engine/planner';

export default function ExamPlanner({ topics, initialPlan, defaultDate, defaultHours, onSave, onBack }) {
  const [examDate, setExamDate] = useState(initialPlan?.examDate || defaultDate || '');
  const [hoursPerDay, setHoursPerDay] = useState(initialPlan?.hoursPerDay || defaultHours || 1);
  const [plan, setPlan] = useState(initialPlan || null);

  const handleBuild = () => {
    if (!examDate) return;
    const nextPlan = buildExamPlan(topics, examDate, hoursPerDay);
    setPlan(nextPlan);
    onSave(nextPlan);
  };

  const handleAdjust = () => {
    if (!plan) return;
    const nextPlan = rebalanceExamPlan(plan, topics);
    setPlan(nextPlan);
    onSave(nextPlan);
  };

  return (
    <div className="planner-screen animate-slide-up">
      <div className="text-center">
        <p className="text-sm text-tertiary">Exam planner</p>
        <h2 className="heading-2">A steady path to your exam</h2>
      </div>
      <div className="card planner-controls">
        <label className="text-sm text-secondary">Exam date<input className="text-input" type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} /></label>
        <label className="text-sm text-secondary">Hours per day<input className="text-input" type="number" min="0.5" max="16" step="0.5" value={hoursPerDay} onChange={(event) => setHoursPerDay(event.target.value)} /></label>
        <button className="btn btn-primary" onClick={handleBuild} disabled={!examDate}>Build daily plan</button>
      </div>
      {plan && <>
        <div className="planner-summary"><strong>{Math.round(plan.totalMinutes / 60 * 10) / 10} hours remaining</strong><span className="text-sm text-tertiary">{plan.daysAvailable} days available</span></div>
        {plan.adjusted && <p className="planner-adjusted">Plan adjusted.</p>}
        <div className="planner-week">
          {plan.days.slice(0, 7).map(day => <div className="planner-day" key={day.date}><strong>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</strong><span>{day.date.slice(5)}</span><b>{day.minutes}m</b><small>{day.topics.length} topics</small></div>)}
        </div>
        <div className="card planner-topic-list"><p className="text-sm text-secondary">Remaining topics</p>{topics.filter(topic => !topic.completed).map(topic => <div className="planner-topic-row" key={topic.id || topic.topicId || topic.title}><span>{topic.title}</span><span className="text-sm text-tertiary">{topic.estimatedMinutes || 0}m</span></div>)}</div>
        <div className="btn-group" style={{ justifyContent: 'center' }}><button className="btn btn-secondary" onClick={handleAdjust}>Rebalance from today</button><button className="btn btn-ghost" onClick={onBack}>Back</button></div>
      </>}
    </div>
  );
}
