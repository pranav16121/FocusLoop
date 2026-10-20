import { cp, mkdir } from 'node:fs/promises';
await mkdir('extension/vendor', { recursive: true });
await cp('node_modules/@mediapipe/tasks-vision/vision_bundle.mjs', 'extension/vendor/tasks-vision.js');
await cp('node_modules/@mediapipe/tasks-vision/wasm', 'extension/vendor/wasm', { recursive: true });
console.log('Download face_landmarker.task from the MediaPipe Tasks Vision release into extension/models/.');
