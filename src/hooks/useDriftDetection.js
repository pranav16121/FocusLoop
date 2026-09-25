import { useState, useEffect, useRef, useCallback } from 'react';
import { getSettings } from '../services/storageService';

export function useDriftDetection(isSessionActive) {
  const [isDrifting, setIsDrifting] = useState(false);
  const [driftData, setDriftData] = useState(null);
  const [interruptions, setInterruptions] = useState([]);
  const leftAtRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const lastActivityRef = useRef(0);
  
  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (isSessionActive) {
      const currentSettings = getSettings();
      if (currentSettings.gentleInterventions === false) return;

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
  }, [isSessionActive]);
  
  // Tab visibility detection
  useEffect(() => {
    if (!isSessionActive) return;
    
    const handleVisibilityChange = () => {
      const currentSettings = getSettings();
      if (currentSettings.gentleInterventions === false) return;

      if (document.hidden) {
        leftAtRef.current = Date.now();
      } else if (leftAtRef.current) {
        const elapsed = Math.max(1, Math.round((Date.now() - leftAtRef.current) / 1000));
        const threshold = currentSettings.tabAwayThreshold !== undefined ? currentSettings.tabAwayThreshold : 10;
        
        if (elapsed >= threshold) {
          const interruption = {
            type: 'tab-switch',
            duration: elapsed,
            leftAt: new Date(leftAtRef.current).toISOString(),
            returnedAt: new Date().toISOString(),
          };
          setDriftData(interruption);
          setIsDrifting(true);
          setInterruptions(prev => [...prev, interruption]);
        }
        leftAtRef.current = null;
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isSessionActive]);
  
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
