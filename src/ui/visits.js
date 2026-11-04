/**
 * Visitor counter using GoatCounter (https://www.goatcounter.com), free and cookie-free.
 *
 * Set your code in src/config.js. Each page view is counted by GoatCounter's script,
 * then the total is fetched and shown in the footer.
 * In GoatCounter: Settings → tick "Allow adding visitor counts on your website".
 */
import { CONFIG } from '../config.js';

export function startVisitCounter(el) {
  const code = (CONFIG.goatcounterCode || '').trim();
  if (!code || !/^https?:$/.test(location.protocol)) return; // off, or opened from disk

  const base = `https://${code}.goatcounter.com`;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = `${base}/count`;
  s.onload = () => setTimeout(() => showTotal(base, el), 1500); // give the new visit time to register
  s.onerror = () => showTotal(base, el);
  document.head.appendChild(s);
}

async function showTotal(base, el) {
  try {
    const res = await fetch(`${base}/counter/TOTAL.json`);
    if (!res.ok) return;
    const data = await res.json();
    el.innerHTML = `<span class="visit-dot" aria-hidden="true"></span>${data.count} visits`;
    el.hidden = false;
  } catch {
    // Counter unavailable (offline, blocked by an ad blocker, or the setting is off): show nothing.
  }
}
