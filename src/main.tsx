import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress the 'Cannot redefine property: ethereum' error which is a common
// conflict between browser wallet extensions and iframe environments.
window.addEventListener('error', (event) => {
  if (event.message?.includes('Cannot redefine property: ethereum') || 
      event.error?.message?.includes('Cannot redefine property: ethereum')) {
    event.stopImmediatePropagation();
    console.warn('Suppressed ethereum provider conflict error.');
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
