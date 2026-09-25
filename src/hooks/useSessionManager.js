import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  saveCurrentSession, 
  getCurrentSession, 
  clearCurrentSession, 
  saveCurrentTask, 
  getCurrentTask, 
  clearCurrentTask, 
  addSessionToHistory 
} from '../services/storageService';

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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(0);
  const [interruptionCount, setInterruptionCount] = useState(0);
  const [lastDriftData, setLastDriftData] = useState(null);
  const [reflectionData, setReflectionData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const startTimeRef = useRef(null);
  
  // Restore session on mount
  useEffect(() => {
    const savedTask = getCurrentTask();
    const savedSession = getCurrentSession();
    if (savedTask && savedSession) {
      setTask(savedTask.task);
      setSteps(savedTask.steps || []);
      setCurrentStepIndex(savedTask.currentStepIndex || 0);
      setSessionDuration(savedSession.duration || 20);
      setElapsedSeconds(savedSession.elapsed || 0);
      setSessionStartTime(savedSession.startTime || null);
      setCompletedSteps(savedTask.completedSteps || 0);
      setInterruptionCount(savedSession.interruptions || 0);
      // Don't auto-resume to focus, go to context recovery
      if (savedSession.state === SESSION_STATES.FOCUS || savedSession.state === SESSION_STATES.PAUSED) {
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

    if (nextTask) {
      saveCurrentTask({
        task: nextTask,
        steps: nextSteps,
        currentStepIndex: nextStepIndex,
        completedSteps: nextCompletedSteps,
      });
    }
    saveCurrentSession({
      state: currentView || view,
      duration: nextDuration,
      elapsed: nextElapsed,
      interruptions: nextInterruptions,
      startTime: nextStartTime,
    });
  }, [task, steps, currentStepIndex, completedSteps, view, sessionDuration, elapsedSeconds, interruptionCount, sessionStartTime]);
  
  const startNewTask = useCallback((taskText, duration = 20) => {
    setTask(taskText);
    setSessionDuration(duration);
    setCurrentStepIndex(0);
    setCompletedSteps(0);
    setInterruptionCount(0);
    setLastDriftData(null);
    setView(SESSION_STATES.BREAKDOWN);
    setIsLoading(true);
  }, []);
  
  const setBreakdownSteps = useCallback((newSteps) => {
    setSteps(newSteps);
    setIsLoading(false);
    persistState(SESSION_STATES.BREAKDOWN, { steps: newSteps });
  }, [persistState]);
  
  const startFocus = useCallback((durationOverride) => {
    const nextDuration = durationOverride || sessionDuration;
    setSessionDuration(nextDuration);
    setElapsedSeconds(0);
    const now = new Date().toISOString();
    setSessionStartTime(now);
    startTimeRef.current = Date.now();
    setView(SESSION_STATES.FOCUS);
    persistState(SESSION_STATES.FOCUS, { duration: nextDuration, elapsed: 0, startTime: now });
  }, [persistState, sessionDuration]);
  
  const pauseSession = useCallback(() => {
    setView(SESSION_STATES.PAUSED);
    persistState(SESSION_STATES.PAUSED);
  }, [persistState]);
  
  const resumeSession = useCallback(() => {
    setView(SESSION_STATES.FOCUS);
    persistState(SESSION_STATES.FOCUS);
  }, [persistState]);
  
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

    if (newIndex >= steps.length) {
      setView(SESSION_STATES.COMPLETED);
    } else {
      setCurrentStepIndex(newIndex);
    }
    persistState(newIndex >= steps.length ? SESSION_STATES.COMPLETED : view, {
      steps: updatedSteps,
      currentStepIndex: newIndex,
      completedSteps: newCompleted,
      elapsed: actualElapsed,
    });
  }, [completedSteps, currentStepIndex, steps, elapsedSeconds, view, persistState]);
  
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
    setView(SESSION_STATES.FOCUS);
    persistState(SESSION_STATES.FOCUS);
  }, [persistState]);
  
  const showContextRecovery = useCallback(() => {
    setView(SESSION_STATES.CONTEXT_RECOVERY);
  }, []);
  
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
  }, [task, steps, completedSteps, currentStepIndex, elapsedSeconds, interruptionCount, sessionStartTime]);
  
  const dismissCurrentTask = useCallback(() => {
    clearCurrentTask();
    clearCurrentSession();
    setTask(null);
    setSteps([]);
    setCurrentStepIndex(0);
    setCompletedSteps(0);
    setInterruptionCount(0);
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
    startNewTask,
    setBreakdownSteps,
    startFocus,
    pauseSession,
    resumeSession,
    completeStep,
    triggerDrift,
    continueFromDrift,
    showContextRecovery,
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
