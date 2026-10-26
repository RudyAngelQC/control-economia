import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App';
import { sembrarSiHaceFalta } from './db/db';
import { iniciarAutoSync } from './sync/controller';

registerSW({ immediate: true });

// Pide al navegador que no borre IndexedDB si falta espacio.
void navigator.storage?.persist?.();

void sembrarSiHaceFalta().then(iniciarAutoSync);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
