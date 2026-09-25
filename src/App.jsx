import { useEffect, useCallback } from 'react';
import { useSessionManager, SESSION_STATES } from './hooks/useSessionManager';
import { generateTaskBreakdown } from './services/aiService';
import { getSettings } from './services/storageService';
import Header from './components/Header';
import HomeScreen from './components/HomeScreen';
import TaskBreakdown from './components/TaskBreakdown';
import FocusSession from './components/FocusSession';
import DriftIntervention from './components/DriftIntervention';
import ContextRecovery from './components/ContextRecovery';
import SessionComplete from './components/SessionComplete';
import SessionHistory from './components/SessionHistory';
import Settings from './components/Settings';

function App() {
  const session = useSessionManager();

  // Apply theme on mount
  useEffect(() => {
    const settings = getSettings();
    if (settings.theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (settings.theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    }
  }, []);

  // Handle starting a new task -> immediate breakdown
  const handleStartTask = useCallback(async (taskText, duration = 20) => {
    session.startNewTask(taskText, duration);

    try {
      const result = await generateTaskBreakdown(taskText, { duration });
      const steps = (result.steps || []).map(step => ({
        ...step,
        completed: false,
      }));
      session.setBreakdownSteps(steps);
    } catch (error) {
      console.error('Failed to generate breakdown:', error);
      session.setBreakdownSteps([
        { title: taskText, description: 'Work on this task', estimatedMinutes: duration, completed: false },
      ]);
    }
  }, [session]);

  // Handle step completion
  const handleCompleteStep = useCallback(() => {
    session.completeStep();
  }, [session]);

  // Handle drift -> show intervention
  const handleDrift = useCallback((count, driftData) => {
    session.triggerDrift(count, driftData);
  }, [session]);

  // Handle continue from drift
  const handleContinueFromDrift = useCallback(() => {
    session.continueFromDrift();
  }, [session]);

  // Handle "where was I?" from drift or focus
  const handleWhereWasI = useCallback(() => {
    session.showContextRecovery();
  }, [session]);

  // Handle continue from context recovery
  const handleContinueFromContext = useCallback(() => {
    session.resumeSession();
  }, [session]);

  // Handle reset from context recovery
  const handleResetFromContext = useCallback(() => {
    session.startFocus();
  }, [session]);

  // Handle end session
  const handleEndSession = useCallback((elapsedSeconds) => {
    session.endSession(elapsedSeconds);
  }, [session]);

  // Handle starting focus from breakdown
  const handleStartFocus = useCallback(() => {
    session.startFocus();
  }, [session]);

  // Handle starting next session from adaptive recommendation
  const handleStartNextSession = useCallback((recommendedDuration) => {
    session.startFocus(recommendedDuration);
  }, [session]);

  // Logo click -> go home
  const handleLogoClick = useCallback(() => {
    if (
      session.view === SESSION_STATES.FOCUS ||
      session.view === SESSION_STATES.PAUSED
    ) {
      session.persistState();
    }
    session.goHome();
  }, [session]);

  // Render current view
  const renderView = () => {
    switch (session.view) {
      case SESSION_STATES.IDLE:
        return (
          <HomeScreen
            onStartTask={handleStartTask}
            onContinueSession={session.continueLastSession}
          />
        );

      case SESSION_STATES.BREAKDOWN:
        return (
          <TaskBreakdown
            task={session.task}
            steps={session.steps}
            isLoading={session.isLoading}
            onStartFocus={handleStartFocus}
            onBack={() => session.goHome()}
            onUpdateSteps={(newSteps) => session.setBreakdownSteps(newSteps)}
          />
        );

      case SESSION_STATES.FOCUS:
      case SESSION_STATES.PAUSED:
        return (
          <FocusSession
            task={session.task}
            steps={session.steps}
            currentStepIndex={session.currentStepIndex}
            sessionDuration={session.sessionDuration}
            onCompleteStep={handleCompleteStep}
            onEndSession={handleEndSession}
            onPause={session.pauseSession}
            onResume={session.resumeSession}
            onDrift={handleDrift}
            onWhereWasI={handleWhereWasI}
            isPaused={session.view === SESSION_STATES.PAUSED}
            interruptionCount={session.interruptionCount}
          />
        );

      case SESSION_STATES.DRIFT:
        return (
          <DriftIntervention
            task={session.task}
            currentStep={session.steps[session.currentStepIndex]}
            driftData={session.lastDriftData || { duration: 0 }}
            onContinue={handleContinueFromDrift}
            onTakeBreak={() => {
              session.pauseSession();
              handleContinueFromDrift();
            }}
            onChangeTask={() => session.goHome()}
            onWhereWasI={handleWhereWasI}
          />
        );

      case SESSION_STATES.CONTEXT_RECOVERY:
        return (
          <ContextRecovery
            task={session.task}
            steps={session.steps}
            currentStepIndex={session.currentStepIndex}
            interruptionDuration={session.lastDriftData?.duration || 0}
            onContinue={handleContinueFromContext}
            onReset={handleResetFromContext}
            onGoHome={() => session.goHome()}
          />
        );

      case SESSION_STATES.COMPLETED:
        return (
          <SessionComplete
            task={session.task}
            steps={session.steps}
            currentStepIndex={session.currentStepIndex}
            completedSteps={session.completedSteps}
            elapsedSeconds={session.elapsedSeconds}
            interruptionCount={session.interruptionCount}
            onSaveReflection={session.saveReflection}
            onStartNextSession={handleStartNextSession}
            onGoHome={() => session.goHome()}
          />
        );

      case SESSION_STATES.HISTORY:
        return <SessionHistory onBack={() => session.goHome()} />;

      case SESSION_STATES.SETTINGS:
        return <Settings onBack={() => session.goHome()} />;

      default:
        return (
          <HomeScreen
            onStartTask={handleStartTask}
            onContinueSession={session.continueLastSession}
          />
        );
    }
  };

  return (
    <div className="app-container">
      <Header
        onLogoClick={handleLogoClick}
        onHistoryClick={session.showHistory}
        onSettingsClick={session.showSettings}
      />
      <main className="main-content">
        {renderView()}
      </main>
    </div>
  );
}

export default App;
