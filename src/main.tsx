import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { init } from './story/store';
import './styles.css';

// Ask the browser not to clear this site's storage under disk pressure.
navigator.storage?.persist?.().catch(() => undefined);

void init();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
