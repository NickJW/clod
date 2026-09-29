import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { init, toast } from './story/store';
import { consumeSetupLink } from './ai/provider';
import './styles.css';

// Ask the browser not to clear this site's storage under disk pressure.
navigator.storage?.persist?.().catch(() => undefined);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}

const connected = consumeSetupLink();
void init().then(() => connected && toast('Your AI editor is connected and ready.'));
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
