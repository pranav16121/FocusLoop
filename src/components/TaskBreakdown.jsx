import { useEffect, useState } from 'react';
import { packSessions } from '../algorithms/studyEngine';

function buildGroups(steps, sessionDuration) {
  const packed = packSessions(steps.map((step, index) => ({
    ...step,
    id: step.topicId || `step-${index}`,
  })), sessionDuration || 20);
  return packed.map((session, index) => ({
    id: session.id,
    name: `Session ${index + 1}`,
    targetMinutes: sessionDuration || 20,
    topicIds: session.topics,
  }));
}

function topicId(step, index) {
  return step.topicId || `step-${index}`;
}

export default function TaskBreakdown({ task, steps, sessionDuration, isLoading, onStartFocus, onBack, onUpdateSteps }) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editValue, setEditValue] = useState('');
  const [editMinutes, setEditMinutes] = useState(10);
  const [newStepTitle, setNewStepTitle] = useState('');
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [groups, setGroups] = useState(() => buildGroups(steps, sessionDuration));
  const [draggedIndex, setDraggedIndex] = useState(null);

  useEffect(() => {
    if (!isLoading && steps.length > 0) {
      setRevealedCount(0);
      const interval = setInterval(() => {
        setRevealedCount(previous => {
          if (previous >= steps.length) {
            clearInterval(interval);
            return previous;
          }
          return previous + 1;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isLoading, steps.length]);

  const updateGroups = (nextGroups) => {
    setGroups(nextGroups.filter(group => group.topicIds.length > 0));
  };

  const handleRemoveStep = (index) => {
    const removedId = topicId(steps[index], index);
    onUpdateSteps(steps.filter((_, stepIndex) => stepIndex !== index));
    updateGroups(groups.map(group => ({
      ...group,
      topicIds: group.topicIds.filter(id => id !== removedId),
    })));
  };

  const handleEditStep = (index) => {
    setEditingIndex(index);
    setEditValue(steps[index].title);
    setEditMinutes(steps[index].estimatedMinutes || 10);
  };

  const handleCancelEdit = () => {
    setEditingIndex(-1);
    setEditValue('');
    setEditMinutes(10);
  };

  const handleSaveEdit = () => {
    if (!editValue.trim() || editingIndex < 0) return;
    const updated = [...steps];
    updated[editingIndex] = {
      ...updated[editingIndex],
      title: editValue.trim(),
      estimatedMinutes: Math.min(180, Math.max(1, Number(editMinutes) || 1)),
    };
    onUpdateSteps(updated);
    handleCancelEdit();
  };

  const handleAddStep = () => {
    if (!newStepTitle.trim()) return;
    const newStep = {
      title: newStepTitle.trim(),
      description: 'A custom step for this study plan.',
      estimatedMinutes: 10,
      type: 'THEORY',
      completed: false,
    };
    const nextSteps = [...steps, newStep];
    onUpdateSteps(nextSteps);
    const nextGroups = groups.length > 0 ? [...groups] : [{ id: 'session-1', name: 'Session 1', targetMinutes: sessionDuration, topicIds: [] }];
    nextGroups[nextGroups.length - 1].topicIds.push(topicId(newStep, nextSteps.length - 1));
    setGroups(nextGroups);
    setNewStepTitle('');
    setIsAddingStep(false);
    setRevealedCount(nextSteps.length);
  };

  const handleDrop = (targetGroupId) => {
    if (draggedIndex === null) return;
    const draggedId = topicId(steps[draggedIndex], draggedIndex);
    const nextGroups = groups.map(group => ({ ...group, topicIds: group.topicIds.filter(id => id !== draggedId) }));
    const target = nextGroups.find(group => group.id === targetGroupId);
    if (target) target.topicIds.push(draggedId);
    const orderedIds = nextGroups.flatMap(group => group.topicIds);
    const nextSteps = orderedIds.map(id => steps.find((step, index) => topicId(step, index) === id)).filter(Boolean);
    onUpdateSteps(nextSteps);
    setGroups(nextGroups);
    setDraggedIndex(null);
  };

  const updateGroup = (groupId, changes) => {
    setGroups(groups.map(group => group.id === groupId ? { ...group, ...changes } : group));
  };

  const splitGroup = (groupId) => {
    const groupIndex = groups.findIndex(group => group.id === groupId);
    const group = groups[groupIndex];
    if (!group || group.topicIds.length < 2) return;
    const midpoint = Math.ceil(group.topicIds.length / 2);
    const first = { ...group, topicIds: group.topicIds.slice(0, midpoint) };
    const second = { id: `${group.id}-split`, name: `${group.name} - Part 2`, targetMinutes: group.targetMinutes, topicIds: group.topicIds.slice(midpoint) };
    setGroups([...groups.slice(0, groupIndex), first, second, ...groups.slice(groupIndex + 1)]);
  };

  const mergeGroup = (groupId) => {
    const groupIndex = groups.findIndex(group => group.id === groupId);
    if (groupIndex <= 0) return;
    const previous = groups[groupIndex - 1];
    const current = groups[groupIndex];
    const merged = { ...previous, topicIds: [...previous.topicIds, ...current.topicIds] };
    setGroups([...groups.slice(0, groupIndex - 1), merged, ...groups.slice(groupIndex + 1)]);
  };

  const moveGroup = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= groups.length) return;
    const reordered = [...groups];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setGroups(reordered);
  };

  const totalMinutes = steps.reduce((total, step) => total + (step.estimatedMinutes || 0), 0);
  const allRevealed = revealedCount >= steps.length;

  return (
    <div className="animate-slide-up plan-container">
      <p className="text-sm text-tertiary text-center">Your study plan</p>
      <h2 className="heading-2 text-center">{task}</h2>
      <p className="text-center text-secondary plan-intro">Shape the plan until it feels startable.</p>

      {!isLoading && steps.length > 0 && (
        <div className="plan-summary">
          <span className="badge badge-accent">{steps.length} topics</span>
          <span className="text-sm text-tertiary">{totalMinutes} minutes across {groups.length} sessions</span>
        </div>
      )}

      {isLoading ? (
        <div className="plan-loading">
          <div className="loading-dots"><div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" /></div>
          <p className="text-sm text-tertiary">Building your local study plan...</p>
        </div>
      ) : (
        <>
          <div className="plan-sessions">
            {groups.map((group, groupIndex) => {
              const groupSteps = group.topicIds.map(id => steps.find((step, index) => topicId(step, index) === id)).filter(Boolean);
              const groupMinutes = groupSteps.reduce((total, step) => total + (step.estimatedMinutes || 0), 0);
              return (
                <section
                  className="plan-session-card"
                  key={group.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(group.id)}
                >
                  <div className="plan-session-header">
                    <input className="plan-session-name" value={group.name} onChange={(event) => updateGroup(group.id, { name: event.target.value })} aria-label="Session name" />
                    <label className="plan-session-length">Target
                      <input type="number" min="5" max="180" value={group.targetMinutes} onChange={(event) => updateGroup(group.id, { targetMinutes: Number(event.target.value) || 5 })} aria-label="Session target minutes" /> min
                    </label>
                  </div>
                  <div className="plan-session-meta"><span>{groupMinutes}m estimated</span><span>{groupSteps.length} topics</span></div>
                  <div className="plan-topic-list">
                    {groupSteps.map((step) => {
                      const index = steps.indexOf(step);
                      return (
                        <article className="plan-topic" key={topicId(step, index)} draggable onDragStart={() => setDraggedIndex(index)}>
                          <span className="plan-topic-drag" aria-hidden="true">::</span>
                          <div className="plan-topic-content">
                            {editingIndex === index ? (
                              <div className="step-edit-form">
                                <label className="step-edit-field"><span className="step-edit-label">Topic name</span><input className="text-input" value={editValue} onChange={(event) => setEditValue(event.target.value)} autoFocus /></label>
                                <label className="step-edit-field step-edit-time"><span className="step-edit-label">Minutes</span><input className="text-input" type="number" min="1" max="180" value={editMinutes} onChange={(event) => setEditMinutes(event.target.value)} /></label>
                                <div className="step-edit-actions"><button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>Save</button><button className="btn btn-ghost btn-sm" onClick={handleCancelEdit}>Cancel</button></div>
                              </div>
                            ) : (
                              <>
                                <div className="plan-topic-title">{step.title}</div>
                                <div className="plan-topic-description">{step.description}</div>
                                <div className="plan-topic-indicators"><span className="badge">{(step.type || 'THEORY').toLowerCase()}</span><span className="text-sm text-tertiary">Difficulty {step.complexity || 1}/5</span><span className="text-sm text-tertiary">Importance {step.importance || 1}/5</span></div>
                              </>
                            )}
                          </div>
                          {editingIndex !== index && <><span className="step-estimate">{step.estimatedMinutes || 0}m</span><button className="btn btn-ghost btn-sm" onClick={() => handleEditStep(index)} aria-label={`Edit ${step.title}`}>Edit</button><button className="btn btn-ghost btn-sm" onClick={() => handleRemoveStep(index)} aria-label={`Delete ${step.title}`}>Delete</button></>}
                        </article>
                      );
                    })}
                  </div>
                  <div className="plan-session-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => splitGroup(group.id)} disabled={groupSteps.length < 2}>Split</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => mergeGroup(group.id)} disabled={groupIndex === 0}>Merge with previous</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => moveGroup(groupIndex, -1)} disabled={groupIndex === 0} aria-label="Move session up">Up</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => moveGroup(groupIndex, 1)} disabled={groupIndex === groups.length - 1} aria-label="Move session down">Down</button>
                  </div>
                </section>
              );
            })}
          </div>

          {allRevealed && <div className="plan-add-topic">
            {!isAddingStep ? <button className="btn btn-ghost btn-sm" onClick={() => setIsAddingStep(true)}>+ Add a custom topic</button> : <div className="card card-compact"><input className="text-input" placeholder="Topic name" value={newStepTitle} onChange={(event) => setNewStepTitle(event.target.value)} autoFocus /><div className="btn-group" style={{ marginTop: 'var(--space-2)' }}><button className="btn btn-primary btn-sm" onClick={handleAddStep}>Add topic</button><button className="btn btn-ghost btn-sm" onClick={() => setIsAddingStep(false)}>Cancel</button></div></div>}
          </div>}

          {allRevealed && <div className="plan-start-area"><p className="text-sm text-secondary">Ready to begin with: <strong>{steps[0]?.title}</strong></p><div className="btn-group" style={{ justifyContent: 'center' }}><button className="btn btn-ghost" onClick={onBack}>Back</button><button className="btn btn-primary btn-lg" onClick={onStartFocus}>Start Session 1</button></div></div>}
        </>
      )}
    </div>
  );
}
