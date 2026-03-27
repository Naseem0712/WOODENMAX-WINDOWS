import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { initAnalytics } from './analytics';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';

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

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
