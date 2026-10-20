// The model is intentionally loaded from the unpacked extension, never a CDN.
let stream, timer, landmarker, lastTime = -1;
const video = document.querySelector('#camera');
const send = payload => chrome.runtime.sendMessage({ type: 'CAMERA_SIGNAL', payload });
async function start(settings) {
  if (stream) return;
  try {
    send({ camera: 'model-loading' });
    const vision = await import('./vendor/tasks-vision.js');
    const files = await vision.FilesetResolver.forVisionTasks('./vendor/wasm');
    landmarker = await vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: './models/face_landmarker.task' }, runningMode: 'VIDEO', numFaces: 1 });
    send({ camera: 'permission-required' });
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 10, max: 15 } }, audio: false });
    video.srcObject = stream; await video.play(); const every = 1000 / Math.max(2, Math.min(5, settings.inferenceFps || 3));
    timer = setInterval(() => { if (!video.videoWidth || video.currentTime === lastTime) return; lastTime = video.currentTime; const r = landmarker.detectForVideo(video, performance.now()); const face = r.faceLandmarks?.[0]; if (!face) return send({ faceMissingMs: every }); const nose = face[1], left = face[234], right = face[454]; const yaw = Math.abs(nose.x - ((left.x + right.x) / 2)) / Math.max(.001, Math.abs(right.x - left.x)); send({ faceMissingMs: 0, headAwayMs: yaw > .16 ? every : 0, headYawRatio: yaw }); }, every);
    send({ camera: 'active' });
  } catch (error) { const message = String(error?.message || ''); const camera = error?.name === 'NotAllowedError' ? 'permission-denied' : (message.includes('face_landmarker.task') || message.includes('404') ? 'model-missing' : 'unavailable'); send({ camera, cameraError: error.name || 'model-load-failed' }); stop(false); }
}
function stop(report = true) { clearInterval(timer); timer = null; stream?.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null; landmarker?.close?.(); landmarker = null; lastTime = -1; if (report) send({ camera: 'stopped' }); }
chrome.runtime.onMessage.addListener(m => { if (m?.type === 'CAMERA_START') start(m.settings || {}); if (m?.type === 'CAMERA_STOP') stop(); });
