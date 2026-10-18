import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { createFocusEngine, FOCUS_STATES } from '../../shared/focusEngine.js';

// Page-local alternative to the extension pipeline. It is deliberately limited
// to this visible page: browsers do not guarantee camera work in background tabs.
export function useVisualFocus({ active, paused, referenceMode, onRecovery }) {
  const [status, setStatus] = useState('disabled');
  const [telemetry, setTelemetry] = useState({ camera: 'stopped', companion: 'not used', error: '' });
  const [stream, setStream] = useState(null);
  const [live, setLive] = useState(null);
  const sens = JSON.parse(localStorage.getItem('focusloop_settings') || '{}').visualSensitivity;
  const engine = useRef(createFocusEngine({ sustainedMs: { gentle: 45000, balanced: 20000, responsive: 8000 }[sens] || 20000 }));
  const recoveryCallback = useRef(onRecovery);
  const signal = useRef({ camera: 'stopped' });
  const resources = useRef({ stream: null, landmarker: null, video: null, timer: null, lastFrame: -1, faceAwayAt: null, headAwayAt: null });
  useEffect(() => { recoveryCallback.current = onRecovery; }, [onRecovery]);

  useEffect(() => {
    const settings = JSON.parse(localStorage.getItem('focusloop_settings') || '{}');
    const enabled = Boolean(active && settings.visualFocusEnabled && !paused);
    let cancelled = false;
    const stop = (preserveStatus = false) => {
      const r = resources.current; clearInterval(r.timer); r.timer = null; r.stream?.getTracks().forEach(track => track.stop()); r.stream = null; setStream(null); setLive(null); r.video?.remove(); r.video = null; r.landmarker?.close?.(); r.landmarker = null; r.lastFrame = -1;
      if (!cancelled && !preserveStatus) { signal.current = { ...signal.current, camera: 'stopped' }; setTelemetry({ camera: 'stopped', companion: 'not used' }); }
    };
    const start = async () => {
      if (!enabled || resources.current.stream) return;
      try {
        signal.current = { ...signal.current, camera: 'model-loading' }; setTelemetry({ camera: 'model-loading', companion: 'not used' });
        const vision = await FilesetResolver.forVisionTasks('/vision/wasm');
        const landmarker = await FaceLandmarker.createFromModelPath(vision, '/vision/face_landmarker.task');
        await landmarker.setOptions({ runningMode: 'VIDEO', numFaces: 1 });
        if (cancelled) { landmarker.close(); return; }
        signal.current = { ...signal.current, camera: 'permission-required' }; setTelemetry({ camera: 'permission-required', companion: 'not used' });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 10, max: 15 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); landmarker.close(); return; }
        const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.srcObject = stream; await video.play();
        Object.assign(resources.current, { stream, landmarker, video }); setStream(stream);
        signal.current = { ...signal.current, camera: 'active' }; setTelemetry({ camera: 'active', companion: 'not used' });
        const every = 1000 / Math.max(2, Math.min(5, settings.visualInferenceFps || 3));
        resources.current.timer = setInterval(() => {
          const r = resources.current; if (!r.video?.videoWidth || r.video.currentTime === r.lastFrame) return; r.lastFrame = r.video.currentTime;
          const face = r.landmarker.detectForVideo(r.video, performance.now()).faceLandmarks?.[0]; const now = Date.now();
          if (!face) r.faceAwayAt ||= now; else r.faceAwayAt = null;
          let yaw = 0; if (face) { const nose = face[1], left = face[234], right = face[454]; yaw = Math.abs(nose.x - ((left.x + right.x) / 2)) / Math.max(.001, Math.abs(right.x - left.x)); if (yaw > .16) r.headAwayAt ||= now; else r.headAwayAt = null; }
          signal.current = { ...signal.current, faceMissingMs: r.faceAwayAt ? now - r.faceAwayAt : 0, headAwayMs: r.headAwayAt ? now - r.headAwayAt : 0, camera: 'active', faceFound: Boolean(face), yaw };
        }, every);
      } catch (error) {
        const camera = error?.name === 'NotAllowedError' ? 'permission-denied' : (String(error?.message || '').includes('face_landmarker.task') ? 'model-missing' : 'unavailable');
        const detail = String(error?.message || error?.name || (error?.type ? `Failed to load vision files (${error.type})` : error) || 'Unknown camera setup error').slice(0, 180);
        signal.current = { ...signal.current, camera, cameraError: detail }; setTelemetry({ camera, companion: 'not used', error: detail }); stop(true);
      }
    };
    if (enabled) start(); else stop();
    const tick = () => {
      const camera = signal.current.camera;
      const availability = !enabled ? undefined : (['model-missing', 'permission-denied', 'unavailable', 'stopped'].includes(camera) ? 'unavailable' : (camera === 'permission-required' ? 'permission' : undefined));
      const result = engine.current.update({ ...signal.current, enabled, paused, referenceMode, availability }); setStatus(result.state);
      if (signal.current.camera === 'active') setLive({ face: signal.current.faceFound, turned: (signal.current.yaw || 0) > .16, away: Math.round(Math.max(signal.current.headAwayMs || 0, signal.current.faceMissingMs || 0) / 1000) });
      if (result.changed && result.state === FOCUS_STATES.RECOVERY) recoveryCallback.current?.({ type: 'visual-signals', duration: Math.round(Math.max(signal.current.headAwayMs || 0, signal.current.faceMissingMs || 0) / 1000) });
    };
    tick(); const id = setInterval(tick, 1000);
    return () => { cancelled = true; clearInterval(id); stop(); };
  }, [active, paused, referenceMode]);
  return { status, stream, live, ...telemetry };
}
