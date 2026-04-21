/** Google Analytics 4 — only in production so localhost Network tab stays clean and dev never hits gtag. */
const GA_MEASUREMENT_ID = 'G-XZVZ5PCLXY';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function initAnalytics(): void {
  if (!import.meta.env.PROD) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
  script.onload = () => {
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID);
  };
}
