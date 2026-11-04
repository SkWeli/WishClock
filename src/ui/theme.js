/**
 * Light / Dark / Auto theme switch.
 * "Auto" follows the device setting. The choice is saved in localStorage and
 * applied by a tiny script in <head> before the page draws (no flash).
 */
const KEY = 'wishclock:theme';
const MODES = ['light', 'dark', 'auto'];

export function getTheme() {
  try { const t = localStorage.getItem(KEY); return MODES.includes(t) ? t : 'auto'; } catch { return 'auto'; }
}

export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
}

export function initThemeSwitch(container, onChange) {
  const render = () => {
    const mode = getTheme();
    container.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.theme === mode)));
  };
  container.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-theme]');
    if (!b) return;
    try { localStorage.setItem(KEY, b.dataset.theme); } catch { /* not saved, still applied */ }
    applyTheme(b.dataset.theme);
    render();
    onChange?.();
  });
  applyTheme(getTheme());
  render();
}
