import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  saveCurrentSession, 
  getCurrentSession, 
  clearCurrentSession, 
  saveCurrentTask, 
  getCurrentTask, 
  clearCurrentTask, 
  addSessionToHistory,
  getSessionDefaults,
  getRevisionSchedule,
  saveRevisionSchedule,
} from '../services/storageService';
import { createReminder, upsertReminder } from '../engine/revision';
import { startClock, pauseClock, resumeClock, clockElapsed } from '../engine/sessionClock';

export const SESSION_STATES = {
  IDLE: 'idle',
  TASK_ENTRY: 'task-entry',
  BREAKDOWN: 'breakdown',
  FOCUS: 'focus',
  PAUSED: 'paused',
  DRIFT: 'drift',
  CONTEXT_RECOVERY: 'context-recovery',
  BREAK: 'break',
  COMPLETED: 'completed',
  REFLECTION: 'reflection',
  REVISION: 'revision',
  EXAM_PLANNER: 'exam-planner',
  ADAPTIVE: 'adaptive',
  HISTORY: 'history',
  SETTINGS: 'settings',
};

export function useSessionManager() {
  const [view, setView] = useState(SESSION_STATES.IDLE);
  const [task, setTask] = useState(null);
  const [steps, setSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(20);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  // Elapsed seconds frozen by an explicit user pause; null while the clock runs.
  const [pausedElapsed, setPausedElapsed] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(0);
  const [interruptionCount, setInterruptionCount] = useState(0);
  const [lastDriftData, setLastDriftData] = useState(null);
  const [reflectionData, setReflectionData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [referenceMode, setReferenceMode] = useState(false);
  const [parkingLot, setParkingLot] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [studyPlan, setStudyPlan] = useState(null);
  const startTimeRef = useRef(null);
  
  // Restore session on mount
  useEffect(() => {
    const savedTask = getCurrentTask();
    const savedSession = getCurrentSession();
    if (savedTask && savedSession) {
      const sessionData = getSessionDefaults(savedSession);
      setTask(savedTask.task);
      setSteps(savedTask.steps || []);
      setCurrentStepIndex(savedTask.currentStepIndex || 0);
      setSessionDuration(sessionData.duration || 20);
      // A paused session stays frozen; any other running state counts time away as elapsed.
      const wasPaused = sessionData.state === SESSION_STATES.PAUSED;
      const restoredPause = wasPaused ? (sessionData.pausedElapsed ?? sessionData.elapsed ?? 0) : null;
      const restoredElapsed = clockElapsed({ startTime: sessionData.startTime, pausedElapsed: restoredPause });
      setElapsedSeconds(Math.max(wasPaused ? 0 : (sessionData.elapsed || 0), restoredElapsed));
      setSessionStartTime(sessionData.startTime || null);
      setPausedElapsed(restoredPause);
      setCompletedSteps(savedTask.completedSteps || 0);
      setInterruptionCount(sessionData.interruptions || 0);
      setReferenceMode(sessionData.referenceMode === true);
      setParkingLot(sessionData.parkingLot || []);
      setSnapshots(sessionData.snapshots || []);
      setStudyPlan(savedTask.studyPlan || sessionData.studyPlan || null);
      // Don't auto-resume to focus, go to context recovery
      if ([SESSION_STATES.FOCUS, SESSION_STATES.PAUSED, SESSION_STATES.DRIFT, SESSION_STATES.CONTEXT_RECOVERY].includes(sessionData.state)) {
        setView(SESSION_STATES.CONTEXT_RECOVERY);
      } else if (savedSession.state === SESSION_STATES.BREAKDOWN) {
        setView(SESSION_STATES.BREAKDOWN);
      }
    }
  }, []);
  
  const persistState = useCallback((currentView, snapshot = {}) => {
    const nextTask = snapshot.task ?? task;
    const nextSteps = snapshot.steps ?? steps;
    const nextStepIndex = snapshot.currentStepIndex ?? currentStepIndex;
    const nextCompletedSteps = snapshot.completedSteps ?? completedSteps;
    const nextDuration = snapshot.duration ?? sessionDuration;
    const nextElapsed = snapshot.elapsed ?? elapsedSeconds;
    const nextInterruptions = snapshot.interruptions ?? interruptionCount;
    const nextStartTime = snapshot.startTime ?? sessionStartTime;
    const nextPausedElapsed = snapshot.pausedElapsed !== undefined ? snapshot.pausedElapsed : pausedElapsed;
    const nextReferenceMode = snapshot.referenceMode ?? referenceMode;
    const nextParkingLot = snapshot.parkingLot ?? parkingLot;
    const nextSnapshots = snapshot.snapshots ?? snapshots;
    const nextStudyPlan = snapshot.studyPlan ?? studyPlan;

    if (nextTask) {
      saveCurrentTask({
        task: nextTask,
        steps: nextSteps,
        currentStepIndex: nextStepIndex,
        completedSteps: nextCompletedSteps,
        studyPlan: nextStudyPlan,
      });
    }
    saveCurrentSession({
      state: currentView || view,
      duration: nextDuration,
      elapsed: nextElapsed,
      interruptions: nextInterruptions,
      startTime: nextStartTime,
      pausedElapsed: nextPausedElapsed,
      referenceMode: nextReferenceMode,
      parkingLot: nextParkingLot,
      snapshots: nextSnapshots,
      studyPlan: nextStudyPlan,
    });
  }, [task, steps, currentStepIndex, completedSteps, view, sessionDuration, elapsedSeconds, interruptionCount, sessionStartTime, pausedElapsed, referenceMode, parkingLot, snapshots, studyPlan]);
  
  const startNewTask = useCallback((taskText, duration = 20, metadata = {}) => {
    setTask(taskText);
    setSessionDuration(duration);
    setCurrentStepIndex(0);
    setCompletedSteps(0);
    setInterruptionCount(0);
    setLastDriftData(null);
    setReferenceMode(false);
    setParkingLot([]);
    setSnapshots([]);
    setStudyPlan(metadata.studyPlan || null);
    setView(SESSION_STATES.BREAKDOWN);
    setIsLoading(true);
  }, []);
  
  const setBreakdownSteps = useCallback((newSteps) => {
    setSteps(newSteps);
    setIsLoading(false);
    persistState(SESSION_STATES.BREAKDOWN, { steps: newSteps });
  }, [persistState]);

  const updateStudyPlan = useCallback((nextPlan) => {
    setStudyPlan(nextPlan);
    persistState(undefined, { studyPlan: nextPlan });
  }, [persistState]);
  
  const startFocus = useCallback((durationOverride) => {
    const nextDuration = durationOverride || sessionDuration;
    setSessionDuration(nextDuration);
    setElapsedSeconds(0);
    const clock = startClock();
    setSessionStartTime(clock.startTime);
    setPausedElapsed(null);
    startTimeRef.current = Date.now();
    setView(SESSION_STATES.FOCUS);
    persistState(SESSION_STATES.FOCUS, { duration: nextDuration, elapsed: 0, startTime: clock.startTime, pausedElapsed: null });
  }, [persistState, sessionDuration]);
  
  const pauseSession = useCallback((actualElapsed) => {
    const clock = pauseClock({ startTime: sessionStartTime, pausedElapsed });
    const frozen = actualElapsed ?? clock.pausedElapsed;
    setPausedElapsed(frozen);
    setElapsedSeconds(frozen);
    setView(SESSION_STATES.PAUSED);
    persistState(SESSION_STATES.PAUSED, { elapsed: frozen, pausedElapsed: frozen });
  }, [persistState, sessionStartTime, pausedElapsed]);

  // Used by Pause→Resume and by every "Continue" (drift card, "Where was I?").
  // A running clock is left untouched, so the start timestamp, elapsed time and progress survive.
  const resumeSession = useCallback(() => {
    const clock = resumeClock({ startTime: sessionStartTime, pausedElapsed });
    setSessionStartTime(clock.startTime);
    setPausedElapsed(null);
    setElapsedSeconds(clockElapsed(clock));
    setView(SESSION_STATES.FOCUS);
    persistState(SESSION_STATES.FOCUS, { startTime: clock.startTime, pausedElapsed: null, elapsed: clockElapsed(clock) });
  }, [persistState, sessionStartTime, pausedElapsed]);
  
  const completeStep = useCallback((actualElapsed = elapsedSeconds) => {
    const newCompleted = completedSteps + 1;
    const newIndex = currentStepIndex + 1;
    const updatedSteps = steps.map((s, idx) => ({
      ...s,
      completed: idx < newIndex
    }));

    setCompletedSteps(newCompleted);
    setSteps(updatedSteps);
    setElapsedSeconds(actualElapsed);

    // Study-plan topics get a "Revisit this topic" reminder (1/3/7/14 days).
    const finishedStep = steps[currentStepIndex];
    if (finishedStep?.topicId) {
      saveRevisionSchedule(upsertReminder(getRevisionSchedule(), createReminder({ topicId: finishedStep.topicId, title: finishedStep.title, task })));
    }

    const nextView = newIndex >= steps.length ? SESSION_STATES.COMPLETED : SESSION_STATES.FOCUS;
    setCurrentStepIndex(newIndex);
    setView(nextView);
    persistState(nextView, {
      steps: updatedSteps,
      currentStepIndex: newIndex,
      completedSteps: newCompleted,
      elapsed: actualElapsed,
    });
  }, [completedSteps, currentStepIndex, steps, task, elapsedSeconds, persistState]);
  
  const triggerDrift = useCallback((count, driftData) => {
    setInterruptionCount(count);
    if (driftData) {
      setLastDriftData(driftData);
      if (driftData.elapsed !== undefined) setElapsedSeconds(driftData.elapsed);
    }
    setView(SESSION_STATES.DRIFT);
    persistState(SESSION_STATES.DRIFT, {
      elapsed: driftData?.elapsed ?? elapsedSeconds,
      interruptions: count,
    });
  }, [persistState, elapsedSeconds]);
  
  const continueFromDrift = useCallback(() => {
    resumeSession();
  }, [resumeSession]);

  const showContextRecovery = useCallback(() => {
    setView(SESSION_STATES.CONTEXT_RECOVERY);
  }, []);

  const persistElapsed = useCallback((elapsed) => {
    setElapsedSeconds(elapsed);
    persistState(undefined, { elapsed });
  }, [persistState]);
  
  const endSession = useCallback((actualElapsed) => {
    setElapsedSeconds(actualElapsed || 0);
    setView(SESSION_STATES.COMPLETED);
    persistState(SESSION_STATES.COMPLETED);
  }, [persistState]);
  
  const saveReflection = useCallback((reflection) => {
    setReflectionData(reflection);
    const sessionRecord = {
      task,
      steps: steps.map(s => ({ title: s.title, completed: s.completed })),
      totalSteps: steps.length,
      completedSteps,
      duration: Math.max(1, Math.round(elapsedSeconds / 60)),
      interruptions: interruptionCount,
      reflection,
      startTime: sessionStartTime,
      endTime: new Date().toISOString(),
      parkingLot,
      snapshots,
    };
    addSessionToHistory(sessionRecord);
    clearCurrentSession();

    // If there are still steps remaining in the task, preserve the task so user can continue later
    if (completedSteps < steps.length && currentStepIndex < steps.length) {
      saveCurrentTask({
        task,
        steps,
        currentStepIndex,
        completedSteps,
      });
    } else {
      clearCurrentTask();
    }
  }, [task, steps, completedSteps, currentStepIndex, elapsedSeconds, interruptionCount, sessionStartTime, parkingLot, snapshots]);
  
  const dismissCurrentTask = useCallback(() => {
    clearCurrentTask();
    clearCurrentSession();
    setTask(null);
    setSteps([]);
    setCurrentStepIndex(0);
    setCompletedSteps(0);
    setInterruptionCount(0);
    setReferenceMode(false);
    setParkingLot([]);
    setSnapshots([]);
    setStudyPlan(null);
    setView(SESSION_STATES.IDLE);
  }, []);

  const goToReflection = useCallback(() => {
    setView(SESSION_STATES.REFLECTION);
  }, []);
  
  const goHome = useCallback(() => {
    setView(SESSION_STATES.IDLE);
  }, []);
  
  const showHistory = useCallback(() => {
    setView(SESSION_STATES.HISTORY);
  }, []);
  
  const showSettings = useCallback(() => {
    setView(SESSION_STATES.SETTINGS);
  }, []);
  
  const continueLastSession = useCallback(() => {
    const savedTask = getCurrentTask();
    if (savedTask) {
      setTask(savedTask.task);
      setSteps(savedTask.steps || []);
      setCurrentStepIndex(savedTask.currentStepIndex || 0);
      setCompletedSteps(savedTask.completedSteps || 0);
      const savedSession = getSessionDefaults(getCurrentSession() || {});
      setReferenceMode(savedSession.referenceMode === true);
      setParkingLot(savedSession.parkingLot || []);
      setSnapshots(savedSession.snapshots || []);
      setStudyPlan(savedTask.studyPlan || savedSession.studyPlan || null);
      setView(SESSION_STATES.CONTEXT_RECOVERY);
    }
  }, []);
  
  return {
    view,
    task,
    steps,
    currentStepIndex,
    sessionDuration,
    sessionStartTime,
    elapsedSeconds,
    completedSteps,
    interruptionCount,
    lastDriftData,
    reflectionData,
    isLoading,
    setView,
    setTask,
    setSteps,
    setSessionDuration,
    setElapsedSeconds,
    setInterruptionCount,
    setLastDriftData,
    referenceMode,
    parkingLot,
    snapshots,
    studyPlan,
    setReferenceMode: (enabled) => {
      setReferenceMode(enabled);
      persistState(undefined, { referenceMode: enabled });
    },
    addParkingItem: (text) => {
      const item = { id: Date.now().toString(36), text, status: 'open', createdAt: new Date().toISOString() };
      const nextItems = [...parkingLot, item];
      setParkingLot(nextItems);
      persistState(undefined, { parkingLot: nextItems });
    },
    updateParkingItem: (id, status) => {
      const nextItems = parkingLot.map(item => item.id === id ? { ...item, status } : item);
      setParkingLot(nextItems);
      persistState(undefined, { parkingLot: nextItems });
    },
    addSnapshot: (text) => {
      const snapshot = { id: Date.now().toString(36), text, createdAt: new Date().toISOString() };
      const nextSnapshots = [...snapshots, snapshot];
      setSnapshots(nextSnapshots);
      persistState(undefined, { snapshots: nextSnapshots });
    },
    startNewTask,
    setBreakdownSteps,
    updateStudyPlan,
    startFocus,
    pauseSession,
    resumeSession,
    completeStep,
    triggerDrift,
    continueFromDrift,
    showContextRecovery,
    persistElapsed,
    endSession,
    saveReflection,
    dismissCurrentTask,
    goToReflection,
    goHome,
    showHistory,
    showSettings,
    continueLastSession,
    persistState,
  };
}
