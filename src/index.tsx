import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { initAnalytics } from './analytics';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';

initAnalytics();

// Production SW on localhost breaks dev (wrong cached responses → no CSS, manifest HTML).
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => void r.unregister());
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

/** Fade out static HTML splash once React is ready (see #app-boot in index.html). */
function dismissAppBoot() {
  const boot = document.getElementById('app-boot');
  if (!boot) return;
  boot.classList.add('boot-exit');
  window.setTimeout(() => boot.remove(), 520);
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary
      title="App crashed unexpectedly"
      fallback={(error, reset) => (
        <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: 720, margin: '40px auto', background: '#1e293b', border: '1px solid #ef4444', borderRadius: 8, padding: 20 }}>
            <h1 style={{ color: '#fca5a5', fontSize: 18, marginBottom: 8 }}>App crashed unexpectedly</h1>
            <p style={{ fontSize: 14, marginBottom: 12 }}>
              Aap "Reload" karke wapas aa sakte hain. Agar baar baar yahi error aaye, screenshot lekar bhejna.
            </p>
            <pre style={{ background: '#0b1220', padding: 10, borderRadius: 4, fontSize: 12, color: '#fda4af', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflow: 'auto' }}>
              {error.message || String(error)}
            </pre>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                onClick={reset}
                style={{ padding: '6px 12px', background: '#334155', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Retry
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{ padding: '6px 12px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      )}
    >
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

requestAnimationFrame(() => {
  requestAnimationFrame(dismissAppBoot);
});
