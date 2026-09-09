import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initZoomPrevention } from './utils/zoom-prevention.ts';

// Enforce non-scalable viewport and disable zoom gestures
initZoomPrevention();

// Register PWA Service Worker for offline capability in production only
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[SW] New version available. Refresh to apply updates.');
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('[SW] Registration note:', err);
        });
    });
  } else {
    // In development mode, unregister any active service worker to prevent stale Vite module caching
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key);
        }
      });
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
