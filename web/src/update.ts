declare const __BUILD_ID__: string;

/**
 * Keep a home-screen copy current: look for a newer deploy every few minutes and whenever the
 * app comes back from the background, and reload once nobody has touched the screen for a bit.
 * The saved car is in localStorage, so it survives the reload.
 */
export function autoUpdate(lastTouch: () => number) {
  if (import.meta.env.DEV) return;
  let pending = false;
  const check = async () => {
    try {
      const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      const { build } = await r.json();
      if (build && build !== __BUILD_ID__) pending = true;
    } catch { /* offline: try again later */ }
  };
  setInterval(check, 3 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  setInterval(() => {
    if (pending && performance.now() - lastTouch() > 8000) location.reload();
  }, 1000);
  check();
}
