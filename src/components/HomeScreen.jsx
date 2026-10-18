import { useState } from 'react';
import { getCurrentTask, getSessionHistory, getSettings, saveSettings, clearCurrentTask, getRevisionSchedule } from '../services/storageService';
import { getDueReviews } from '../engine/revision';
import { formatDate, formatMinutes } from '../utils/formatTime';
import { MAX_SOURCE_LENGTH } from '../algorithms/studyEngine';

const DURATION_PRESETS = [10, 15, 20, 25, 30, 45, 60];

const AI_NOTICE = 'Your topic and selected text are sent to Google Gemini to build this plan. Nothing is sent unless you click this.';

export default function HomeScreen({ onStartTask, onStartMaterial, onIngestFiles, onPlanWithAI, onContinueSession, onStartRevision, onOpenPlanner }) {
  const [aiEnabled] = useState(() => Boolean(getSettings().aiEnabled));
  const [showAiNotice, setShowAiNotice] = useState(false);
  const [isPlanningAI, setIsPlanningAI] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [materialInput, setMaterialInput] = useState('');
  const [inputMode, setInputMode] = useState('task');
  const [duration, setDuration] = useState(() => getSettings().focusDuration || 20);
  const [energy, setEnergy] = useState(() => getSettings().energy || 'medium');
  const [customDuration, setCustomDuration] = useState('');
  const [syllabusInput, setSyllabusInput] = useState('');
  const [examDate, setExamDate] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [savedTask, setSavedTask] = useState(() => getCurrentTask());
  const [recentSessions] = useState(() => getSessionHistory().slice(-3).reverse());
  const [fileError, setFileError] = useState('');
  const dueReviews = getDueReviews(getRevisionSchedule());
  const energyDuration = energy === 'low' ? Math.min(duration, 15) : energy === 'high' ? Math.max(duration, 25) : duration;
  const suggestedTopics = (savedTask?.steps || []).filter(step => {
    if (energy === 'low') return (step.complexity || 1) <= 2 || ['THEORY', 'DEFINITION'].includes(step.type);
    if (energy === 'high') return step.type === 'DERIVATION' || (step.complexity || 1) >= 4;
    return true;
  }).slice(0, 3);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = taskInput.trim();
    if (trimmed) {
      onStartTask(trimmed, energyDuration);
    }
  };

  const handleMaterialSubmit = (e) => {
    e.preventDefault();
    const trimmed = materialInput.trim();
    if (trimmed && onStartMaterial) {
      setIsParsing(true);
      Promise.resolve(onStartMaterial(trimmed, customDuration ? Number(customDuration) : energyDuration, {
        syllabusText: syllabusInput,
        examDate,
        hoursPerDay: Number(hoursPerDay) || null,
      })).finally(() => setIsParsing(false));
    }
  };

  // Files are read locally into the material box; the user then picks the offline or AI planner.
  const handleFileChange = async (event) => {
    const files = [...(event.target.files || [])];
    if (files.length === 0 || !onIngestFiles) return;
    setFileError('');
    try {
      setIsParsing(true);
      setMaterialInput(await onIngestFiles(files));
    } catch (error) {
      setFileError(error.message || 'This file could not be read locally.');
    } finally {
      setIsParsing(false);
    }
    event.target.value = '';
  };

  const canPlanWithAI = inputMode === 'task' ? Boolean(taskInput.trim()) : Boolean(materialInput.trim());

  const runPlanWithAI = async () => {
    setShowAiNotice(false);
    setIsPlanningAI(true);
    try {
      await onPlanWithAI({
        topic: taskInput.trim(),
        materialText: inputMode === 'material' ? materialInput.trim() : '',
        duration: customDuration ? Number(customDuration) : energyDuration,
        examDate,
        syllabusText: inputMode === 'material' ? syllabusInput : '',
        hoursPerDay: Number(hoursPerDay) || null,
      });
    } finally {
      setIsPlanningAI(false);
    }
  };

  const handlePlanWithAIClick = () => {
    if (!aiEnabled || !canPlanWithAI || !onPlanWithAI) return;
    if (!getSettings().aiPlanNoticeSeen) { setShowAiNotice(true); return; }
    runPlanWithAI();
  };

  const handleAcceptAiNotice = () => {
    saveSettings({ ...getSettings(), aiPlanNoticeSeen: true });
    runPlanWithAI();
  };

  const handleDismissSavedTask = (e) => {
    e.stopPropagation();
    clearCurrentTask();
    setSavedTask(null);
  };

  return (
    <div className="welcome-section animate-fade-in">
      <h1 className="welcome-tagline">When you lose focus, don’t lose context.</h1>
      <p className="welcome-subtitle">
        One calm next step, local study tools, and a gentle way back when context slips.
      </p>

      <form onSubmit={inputMode === 'task' ? handleSubmit : handleMaterialSubmit} className="welcome-input-area">
        <div className="chip-group" style={{ justifyContent: 'center', marginBottom: 'var(--space-4)' }} role="tablist" aria-label="Choose a starting point">
          <button
            type="button"
            className={`chip ${inputMode === 'task' ? 'selected' : ''}`}
            onClick={() => setInputMode('task')}
            role="tab"
            aria-selected={inputMode === 'task'}
          >
            Type a topic
          </button>
          <button
            type="button"
            className={`chip ${inputMode === 'material' ? 'selected' : ''}`}
            onClick={() => setInputMode('material')}
            role="tab"
            aria-selected={inputMode === 'material'}
          >
            Paste or upload material
          </button>
        </div>

        {inputMode === 'material' ? (
          <>
            <input
              type="text"
              className="text-input"
              placeholder="What are you trying to work on?"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              aria-label="What are you trying to work on?"
              style={{ marginBottom: 'var(--space-3)' }}
            />
            <textarea
              className="text-input text-input-lg"
              placeholder="Paste notes, a chapter, or a syllabus here..."
              value={materialInput}
              onChange={(e) => setMaterialInput(e.target.value)}
              aria-label="Study material"
              rows={5}
              maxLength={MAX_SOURCE_LENGTH}
              style={{ resize: 'vertical', minHeight: '120px' }}
            />
            <div className="home-material-meta">
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                Choose files
                <input
                  type="file"
                  multiple
                  accept=".txt,.md,.markdown,.pdf,.docx,.pptx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>
              <span className="text-sm text-tertiary">
                Read locally. Sent nowhere unless you click Plan with AI. {materialInput.length.toLocaleString()} / {MAX_SOURCE_LENGTH.toLocaleString()}
              </span>
            </div>
            {fileError && <p className="text-sm" style={{ color: 'var(--color-error)', marginTop: 'var(--space-2)' }}>{fileError}</p>}
          </>
        ) : (
          <div className="input-group">
            <input
              type="text"
              className="text-input text-input-lg"
              placeholder="What are you trying to work on?"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              aria-label="What are you trying to work on?"
              autoFocus
            />
          </div>
        )}

        {/* Duration Selection */}
        <div style={{ marginTop: 'var(--space-4)', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <span className="text-sm text-secondary">Session duration:</span>
            <span className="text-sm" style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{duration} minutes</span>
          </div>
          <div className="chip-group">
            {DURATION_PRESETS.map((d) => (
              <button
                type="button"
                key={d}
                className={`chip ${duration === d ? 'selected' : ''}`}
                onClick={() => setDuration(d)}
                style={{ padding: '4px 12px', fontSize: 'var(--font-size-xs)' }}
              >
                {d}m
              </button>
            ))}
            <input
              className="text-input duration-custom-input"
              type="number"
              min="5"
              max="120"
              placeholder="Custom"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              aria-label="Custom session length in minutes"
            />
          </div>
        </div>

        <details className="home-options">
          <summary className="text-sm text-secondary">Options</summary>
          <div className="energy-selector" role="group" aria-label="Energy mode">
            <span className="text-sm text-secondary">Energy</span>
            {['low', 'medium', 'high'].map(level => (
              <button type="button" key={level} className={`chip ${energy === level ? 'selected' : ''}`} onClick={() => { setEnergy(level); saveSettings({ ...getSettings(), energy: level }); }} aria-pressed={energy === level}>{level}</button>
            ))}
          </div>
          {inputMode === 'material' && (
            <textarea
              className="text-input"
              placeholder="Optional: paste past papers or a syllabus to boost important topics..."
              value={syllabusInput}
              onChange={(e) => setSyllabusInput(e.target.value)}
              rows={3}
              style={{ marginTop: 'var(--space-3)', resize: 'vertical' }}
            />
          )}
          <div className="material-options">
            <label className="text-sm text-secondary">Exam date (optional)
              <input className="text-input" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
            </label>
            {inputMode === 'material' && (
              <label className="text-sm text-secondary">Hours per day
                <input className="text-input" type="number" min="0.5" max="16" step="0.5" placeholder="Optional" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} />
              </label>
            )}
          </div>
        </details>

        <div className="home-actions">
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={isParsing || isPlanningAI || (inputMode === 'task' ? !taskInput.trim() : !materialInput.trim())}
          >
            {isParsing ? 'Reading locally...' : inputMode === 'task' ? 'Start Focus' : 'Build Study Plan'}
          </button>
          {aiEnabled && (
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={handlePlanWithAIClick}
              disabled={!canPlanWithAI || isParsing || isPlanningAI}
              title="Send your topic and short excerpts to Google Gemini"
            >
              {isPlanningAI ? 'Planning with AI...' : '✨ Plan with AI'}
            </button>
          )}
        </div>

        {showAiNotice && (
          <div className="card card-compact ai-notice" role="dialog" aria-label="Plan with AI privacy notice">
            <p className="text-sm">{AI_NOTICE}</p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAiNotice(false)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleAcceptAiNotice}>Continue</button>
            </div>
          </div>
        )}
      </form>

      {savedTask && (
        <div
          className="card card-accent continue-card animate-slide-up"
          onClick={onContinueSession}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onContinueSession()}
          style={{ position: 'relative' }}
        >
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleDismissSavedTask}
            title="Dismiss saved session"
            aria-label="Dismiss saved session"
            style={{
              position: 'absolute',
              top: 'var(--space-2)',
              right: 'var(--space-2)',
              padding: '2px 8px',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            ✕
          </button>
          <div className="continue-label">Continue where you left off</div>
          <div className="continue-task">{savedTask.task}</div>
          <div className="continue-meta">
            {savedTask.completedSteps || 0} of {savedTask.steps?.length || 0} steps completed · Click to resume
          </div>
        </div>
      )}

      {dueReviews.length > 0 && (
        <div className="card card-compact home-plan-card">
          <div className="continue-label">Revisit this topic</div>
          <div className="continue-task">{dueReviews.length} topic{dueReviews.length === 1 ? '' : 's'} to revisit today</div>
          <button className="btn btn-primary btn-sm" onClick={() => onStartRevision(dueReviews)}>Revisit now</button>
        </div>
      )}

      {savedTask?.studyPlan && (
        <div className="card card-compact home-plan-card">
          <div className="continue-label">Today's plan</div>
          <div className="continue-task">{savedTask.studyPlan.examDate ? `Exam plan for ${savedTask.studyPlan.examDate}` : 'Your next topics are ready to shape'}</div>
          <button className="btn btn-secondary btn-sm" onClick={onOpenPlanner}>View daily plan</button>
        </div>
      )}

      {savedTask && suggestedTopics.length > 0 && (
        <div className="card card-compact home-plan-card">
          <div className="continue-label">Today's focus lens</div>
          <div className="text-sm text-secondary">{energy === 'low' ? 'Gentle review' : energy === 'high' ? 'New and challenging material' : 'A balanced mix'}</div>
          <div className="energy-topic-list">{suggestedTopics.map(topic => <span className="badge" key={topic.title}>{topic.title}</span>)}</div>
        </div>
      )}

      {recentSessions.length > 0 && (
        <div style={{ width: '100%', maxWidth: '480px', marginTop: 'var(--space-4)' }}>
          <div className="text-sm text-tertiary" style={{ marginBottom: 'var(--space-2)', textAlign: 'left' }}>
            Recent focus sessions
          </div>
          {recentSessions.map((session, i) => (
            <div key={session.id || i} className="card card-compact" style={{ marginBottom: 'var(--space-2)', cursor: 'default', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-sm" style={{ fontWeight: 500 }}>{session.task}</span>
                <span className="text-sm text-tertiary">
                  {session.startTime ? formatDate(session.startTime) : 'Recent'}
                </span>
              </div>
              <div className="text-sm text-tertiary" style={{ marginTop: 'var(--space-1)' }}>
                {session.duration ? formatMinutes(session.duration) : '—'} · {session.completedSteps || 0} completed · {session.interruptions || 0} interruptions
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="welcome-philosophy">
        Choose material. Shape a plan. Focus, recover, and keep going.<br />
        Your files never leave your device. FocusLoop is not a medical device.
      </p>
    </div>
  );
}
