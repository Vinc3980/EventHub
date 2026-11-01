import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './theme/global.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import { seedIfEmpty } from './services/seedService';
import { applyCssVariables } from './theme/cssVars';

applyCssVariables();

// Local-first: seed demo data once, then render. The UI is fully usable offline.
void seedIfEmpty();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        function showRefreshToast() {
          if (document.getElementById('sw-refresh-banner')) return;
          const banner = document.createElement('div');
          banner.id = 'sw-refresh-banner';
          banner.setAttribute('role', 'alert');
          banner.style.cssText =
            'position:fixed;bottom:24px;right:24px;z-index:9999;background:var(--eh-surface,#fff);color:var(--eh-text-primary,#16171A);padding:12px 18px;border-radius:12px;box-shadow:0 8px 24px rgba(43,95,255,0.18);display:flex;align-items:center;gap:12px;font-family:inherit;font-size:14px;border:1px solid var(--eh-border,#E5E7EB);';
          banner.innerHTML = `
            <span>New version available</span>
            <button id="sw-refresh-btn" style="background:var(--eh-primary,#2B5FFF);color:#fff;border:none;border-radius:8px;padding:6px 14px;font-weight:600;cursor:pointer;">Refresh</button>
          `;
          document.body.appendChild(banner);
          banner.querySelector('#sw-refresh-btn')?.addEventListener('click', () => {
            window.location.reload();
          });
        }

        if (reg.waiting) {
          showRefreshToast();
        }

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showRefreshToast();
            }
          });
        });
      })
      .catch(() => undefined);
  });
}
