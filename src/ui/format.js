const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Rs 4.52 Mn, Rs 125,000, −Rs 33,100 */
export function money(v, { short = false } = {}) {
  if (!isFinite(v)) return '—';
  const sign = v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a >= 1e9) return `${sign}Rs ${(a / 1e9).toFixed(2)} Bn`;
  if (a >= 1e6) return `${sign}Rs ${(a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2)} Mn`;
  if (short && a >= 1e4) return `${sign}Rs ${Math.round(a / 1000)}k`;
  return `${sign}Rs ${Math.round(a).toLocaleString('en-US')}`;
}

/** Axis labels: 0, 20 Mn, 1.5 Bn */
export function axisMoney(v) {
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (a === 0) return '0';
  if (a >= 1e9) return `${sign}${+(a / 1e9).toFixed(1)} Bn`;
  if (a >= 1e6) return `${sign}${+(a / 1e6).toFixed(1)} Mn`;
  return `${sign}${Math.round(a / 1000)}k`;
}

export function duration(months) {
  if (months <= 0) return 'Now';
  const y = Math.floor(months / 12);
  const m = months % 12;
  const ys = y ? `${y} yr${y > 1 ? 's' : ''}` : '';
  const ms = m ? `${m} mo${m > 1 ? 's' : ''}` : '';
  return [ys, ms].filter(Boolean).join(' ');
}

export const monthYear = (d) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

export function qtyLabel(qty, unit) {
  if ((qty === 1 && !unit) || (!Number.isInteger(qty) && qty < 1)) return '';
  const n = Number.isInteger(qty) ? qty.toLocaleString('en-US') : qty.toFixed(qty < 10 ? 1 : 0);
  if (!unit) return `× ${n}`;
  if (qty === 1 || unit.endsWith('ft')) return `${n} ${unit}`;
  return `${n} ${/(ch|sh|s)$/.test(unit) ? unit + 'es' : unit + 's'}`;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
