import { useState, useEffect, useRef, useCallback } from 'react';

export function useTimer(initialSeconds = 0, onComplete) {
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);
  
  const start = useCallback((duration) => {
    clearTimer();
    const dur = duration !== undefined ? duration : totalSeconds;
    setTotalSeconds(dur);
    setSeconds(dur);
    setIsRunning(true);
    setIsPaused(false);
  }, [clearTimer, totalSeconds]);
  
  const pause = useCallback(() => {
    clearTimer();
    setIsPaused(true);
    setIsRunning(false);
  }, [clearTimer]);
  
  const resume = useCallback(() => {
    setIsPaused(false);
    setIsRunning(true);
  }, []);
  
  const reset = useCallback((duration) => {
    clearTimer();
    const dur = duration !== undefined ? duration : initialSeconds;
    setTotalSeconds(dur);
    setSeconds(dur);
    setIsRunning(false);
    setIsPaused(false);
  }, [clearTimer, initialSeconds]);
  
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev <= 1) {
            clearTimer();
            setIsRunning(false);
            onCompleteRef.current?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return clearTimer;
  }, [isRunning, isPaused, clearTimer]);
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const display = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  const progress = totalSeconds > 0 ? Math.min(100, Math.max(0, ((totalSeconds - seconds) / totalSeconds) * 100)) : 0;
  
  return {
    seconds,
    totalSeconds,
    minutes,
    remainingSeconds,
    display,
    progress,
    isRunning,
    isPaused,
    start,
    pause,
    resume,
    reset,
  };
}
