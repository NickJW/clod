import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { init } from './story/store';
import './styles.css';

// Ask the browser not to clear this site's storage under disk pressure.
navigator.storage?.persist?.().catch(() => undefined);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}

void init();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
