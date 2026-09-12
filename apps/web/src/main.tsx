import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App.js';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * Service worker registration.
 *
 * The prompt is a plain banner rather than a silent reload: a teacher halfway
 * through writing up an activity must not have the page swapped underneath
 * them. The banner is DOM rather than React so that it works even if the
 * application bundle itself is the thing that failed.
 */
const updateServiceWorker = registerSW({
  onNeedRefresh() {
    showUpdateBanner(() => updateServiceWorker(true));
  },
});

function showUpdateBanner(onUpdate: () => void): void {
  if (document.getElementById('sw-update')) return;

  const banner = document.createElement('div');
  banner.id = 'sw-update';
  banner.setAttribute('role', 'status');
  banner.className = 'offline-banner';
  banner.style.position = 'fixed';
  banner.style.insetInline = '0';
  banner.style.bottom = '0';
  banner.style.zIndex = '50';

  const text = document.createElement('span');
  text.textContent = 'नया संस्करण उपलब्ध है / A new version is available. ';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'topbar__action';
  button.textContent = 'अपडेट करें / Update';
  button.addEventListener('click', onUpdate);

  banner.append(text, button);
  document.body.append(banner);
}
