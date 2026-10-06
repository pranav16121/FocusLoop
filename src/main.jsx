import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    const registration = await navigator.serviceWorker.register('/sw.js');
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type !== 'NEW_VERSION' || document.querySelector('.sw-update-prompt')) return;
      const prompt = document.createElement('div');
      prompt.className = 'sw-update-prompt';
      prompt.innerHTML = '<span>New version available</span><button type="button">Refresh</button>';
      prompt.querySelector('button').addEventListener('click', () => {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      });
      document.body.appendChild(prompt);
    });
  });
}
