/**
 * Production PWA: register service worker and pull updates onto every installed device.
 * With vite-plugin-pwa `registerType: 'autoUpdate'`, a new deploy activates and reloads clients.
 */
export function registerPwaAutoUpdate(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  void import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
          if (!registration) return;

          const check = () => {
            void registration.update().catch(() => {
              /* offline / blocked */
            });
          };

          // When user returns to the app (phone unlock / tab focus), look for a new build.
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') check();
          });
          window.addEventListener('focus', check);

          // Periodic check while the app stays open (~30 min).
          window.setInterval(check, 30 * 60 * 1000);

          // One early check shortly after launch (CDN / Pages deploy lag).
          window.setTimeout(check, 15_000);
        },
        onNeedRefresh() {
          // autoUpdate already skipWaiting; force reload so all open tabs get the new build.
          void updateSW(true);
        },
      });
    })
    .catch(() => {
      /* virtual module missing in unexpected builds */
    });
}
