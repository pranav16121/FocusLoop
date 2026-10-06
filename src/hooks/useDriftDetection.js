import { useState, useEffect, useRef, useCallback } from 'react';
import { getSettings } from '../services/storageService';

export function useDriftDetection(isSessionActive, { referenceMode = false } = {}) {
  const [isDrifting, setIsDrifting] = useState(false);
  const [driftData, setDriftData] = useState(null);
  const [interruptions, setInterruptions] = useState([]);
  const inactivityTimerRef = useRef(null);
  const lastActivityRef = useRef(0);
  const awayStartedRef = useRef(null);
  const processedReturnRef = useRef(null);
  
  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (isSessionActive) {
      const currentSettings = getSettings();
      if (currentSettings.gentleInterventions === false || referenceMode) return;

      inactivityTimerRef.current = setTimeout(() => {
        const elapsed = Math.round((Date.now() - lastActivityRef.current) / 1000);
        const data = {
          type: 'inactivity',
          duration: elapsed,
          leftAt: new Date(lastActivityRef.current).toISOString(),
          returnedAt: new Date().toISOString(),
        };
        setDriftData(data);
        setIsDrifting(true);
        setInterruptions(prev => [...prev, data]);
      }, (currentSettings.inactivityThreshold || 180) * 1000);
    }
  }, [isSessionActive, referenceMode]);
  
  // Tab visibility detection
  useEffect(() => {
    if (!isSessionActive) return;
    
    const handleAwayStart = () => {
      if (!referenceMode && !awayStartedRef.current) awayStartedRef.current = Date.now();
    };

    const handleReturn = () => {
      const currentSettings = getSettings();
      const awayAt = awayStartedRef.current;
      if (currentSettings.gentleInterventions === false || referenceMode || !awayAt) {
        if (referenceMode) awayStartedRef.current = null;
        return;
      }
      const elapsed = Math.max(1, Math.round((Date.now() - awayAt) / 1000));
      if (processedReturnRef.current === awayAt) return;
      processedReturnRef.current = awayAt;
      if (elapsed < 5) {
        awayStartedRef.current = null;
        return;
      }
      const threshold = 30;
      const interruption = {
        type: 'return',
        duration: elapsed,
        leftAt: new Date(awayAt).toISOString(),
        returnedAt: new Date().toISOString(),
      };
      if (elapsed >= threshold) {
        setDriftData(interruption);
        setIsDrifting(true);
      }
      setInterruptions(prev => [...prev, interruption]);
      awayStartedRef.current = null;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleAwayStart();
      else handleReturn();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleAwayStart);
    window.addEventListener('focus', handleReturn);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleAwayStart);
      window.removeEventListener('focus', handleReturn);
    };
  }, [isSessionActive, referenceMode]);
  
  // Mouse/keyboard activity detection
  useEffect(() => {
    if (!isSessionActive) return;
    
    const handleActivity = () => resetInactivityTimer();
    
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    
    resetInactivityTimer();
    
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [isSessionActive, resetInactivityTimer]);
  
  const dismissDrift = useCallback(() => {
    setIsDrifting(false);
    setDriftData(null);
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const simulateDrift = useCallback((seconds = 180) => {
    const data = {
      type: 'tab-switch',
      duration: seconds,
      leftAt: new Date(Date.now() - seconds * 1000).toISOString(),
      returnedAt: new Date().toISOString(),
    };
    setDriftData(data);
    setIsDrifting(true);
    setInterruptions(prev => [...prev, data]);
  }, []);
  
  const resetInterruptions = useCallback(() => {
    setInterruptions([]);
  }, []);
  
  return {
    isDrifting,
    driftData,
    interruptions,
    interruptionCount: interruptions.length,
    dismissDrift,
    simulateDrift,
    resetInterruptions,
  };
}
