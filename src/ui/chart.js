import { axisMoney, money, monthYear, esc } from './format.js';
import { addMonths } from '../engine/simulate.js';

const NS = 'http://www.w3.org/2000/svg';

function niceStep(raw) {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

/**
 * Timeline: savings balance over time (top), and one lane per goal showing
 * the saving phase, the purchase, and any loan repayment (bottom).
 */
export function renderTimeline(container, result, goals) {
  const width = Math.max(320, container.clientWidth);
  const narrow = width < 560;
  const m = { left: narrow ? 52 : 70, right: 14, top: 40 };
  const plotW = width - m.left - m.right;
  const plotH = narrow ? 200 : 250;
  const laneH = 22;
  const laneGap = 10;
  const lanesTop = m.top + plotH + 34;
  const height = lanesTop + goals.length * (laneH + laneGap) + 4;
  // Show up to 3 years past the last purchase; loans that run longer are clipped with a label.
  const buys = result.goals.filter((g) => g.reached).map((g) => g.month);
  const lastBuy = buys.length ? Math.max(...buys) : result.endMonth;
  const end = Math.max(24, Math.min(result.endMonth, lastBuy + 36));
  const pts = result.points.filter((p) => p.month <= end);

  // Scales
  const values = pts.map((p) => p.balance);
  let yMin = Math.min(0, ...values);
  let yMax = Math.max(1, ...values);
  const step = niceStep((yMax - yMin) / 4);
  yMin = Math.floor(yMin / step) * step;
  yMax = Math.ceil(yMax / step) * step;
  const x = (mo) => m.left + (mo / end) * plotW;
  const y = (v) => m.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const parts = [];
  // Grid + y axis
  for (let v = yMin; v <= yMax + 1; v += step) {
    parts.push(`<line class="grid${v === 0 ? ' zero' : ''}" x1="${m.left}" x2="${m.left + plotW}" y1="${y(v)}" y2="${y(v)}"/>`);
    parts.push(`<text class="tick" x="${m.left - 8}" y="${y(v) + 4}" text-anchor="end">${axisMoney(v)}</text>`);
  }
  // X ticks: Januaries
  const startMonth = result.startDate.getMonth();
  const years = end / 12;
  const yStep = [1, 2, 5, 10].find((s) => years / s <= (narrow ? 5 : 9)) ?? 10;
  for (let mo = (12 - startMonth) % 12; mo <= end; mo += 12) {
    const yr = addMonths(result.startDate, mo).getFullYear();
    if (yr % yStep !== 0) continue;
    parts.push(`<line class="xtick" x1="${x(mo)}" x2="${x(mo)}" y1="${m.top + plotH}" y2="${m.top + plotH + 5}"/>`);
    parts.push(`<text class="tick" x="${x(mo)}" y="${m.top + plotH + 19}" text-anchor="middle">${yr}</text>`);
  }

  // Balance area + line
  const base = y(Math.max(yMin, 0));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.month).toFixed(1)},${y(p.balance).toFixed(1)}`).join('');
  parts.push(`<path class="balance-area" d="${line}L${x(pts[pts.length - 1].month)},${base}L${x(0)},${base}Z"/>`);
  parts.push(`<path class="balance-line" d="${line}"/>`);

  // Purchase markers
  const reached = goals.map((g, i) => ({ g, r: result.goals[i] })).filter((d) => d.r.reached);
  reached.forEach(({ g, r }, i) => {
    const px = x(r.month);
    const anchor = px > m.left + plotW - 90 ? 'end' : 'start';
    const dx = anchor === 'end' ? -5 : 5;
    const ly = m.top - 24 + (i % 2) * 13;
    parts.push(`<line class="marker" style="stroke:var(--series-${g.slot + 1})" x1="${px}" x2="${px}" y1="${ly + 3}" y2="${lanesTop + goals.length * (laneH + laneGap) - laneGap}"/>`);
    parts.push(`<text class="marker-label" x="${px + dx}" y="${ly}" text-anchor="${anchor}">${esc(g.name)}${narrow ? '' : ` · ${monthYear(r.date)}`}</text>`);
  });

  // Lanes
  goals.forEach((g, i) => {
    const r = result.goals[i];
    const ly = lanesTop + i * (laneH + laneGap);
    const color = `var(--series-${g.slot + 1})`;
    const name = g.name.length > 9 ? g.name.slice(0, 8) + '…' : g.name;
    parts.push(`<text class="lane-label" x="${m.left - 8}" y="${ly + laneH / 2 + 4}" text-anchor="end">${esc(name)}</text>`);
    parts.push(`<rect class="lane-bg" x="${m.left}" y="${ly}" width="${plotW}" height="${laneH}" rx="4"/>`);
    const s0 = x(r.savingFrom ?? 0);
    const s1 = r.reached ? x(r.month) : m.left + plotW;
    if (s1 - s0 > 0.5) parts.push(`<rect class="lane-saving" style="fill:${color}" x="${s0}" y="${ly + 4}" width="${s1 - s0}" height="${laneH - 8}" rx="3"/>`);
    if (!r.reached) {
      parts.push(`<text class="lane-note" x="${m.left + plotW - 6}" y="${ly + laneH / 2 + 4}" text-anchor="end">Out of reach</text>`);
      return;
    }
    if (r.ownedOutrightMonth > r.month) {
      const l1 = x(Math.min(end, r.ownedOutrightMonth));
      parts.push(`<rect class="lane-loan" style="fill:${color}" x="${s1}" y="${ly + 2}" width="${l1 - s1}" height="${laneH - 4}" rx="4"/>`);
      if (r.ownedOutrightMonth > end && l1 - s1 > 110) {
        parts.push(`<text class="lane-clip" x="${l1 - 8}" y="${ly + laneH / 2 + 4}" text-anchor="end">paid off ${monthYear(addMonths(result.startDate, r.ownedOutrightMonth))} →</text>`);
      }
    }
    parts.push(`<circle class="lane-dot" style="fill:${color}" cx="${s1}" cy="${ly + laneH / 2}" r="6"/>`);
  });

  // Hover layer
  parts.push(`<line class="crosshair" x1="0" x2="0" y1="${m.top}" y2="${m.top + plotH}" visibility="hidden"/>`);
  parts.push(`<circle class="crosshair-dot" r="4.5" visibility="hidden"/>`);
  parts.push(`<rect class="hit" x="${m.left}" y="${m.top}" width="${plotW}" height="${height - m.top}"/>`);

  container.innerHTML = `
    <svg xmlns="${NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"
      aria-label="Savings balance over ${Math.round(years)} years with ${goals.length} goals">${parts.join('')}</svg>
    <div class="tooltip" hidden></div>`;

  const svg = container.querySelector('svg');
  const tip = container.querySelector('.tooltip');
  const cross = svg.querySelector('.crosshair');
  const dot = svg.querySelector('.crosshair-dot');
  const events = new Map();
  result.goals.forEach((r, i) => {
    if (!r.reached) return;
    events.set(r.month, [...(events.get(r.month) || []), `Buy ${goals[i].name}`]);
    if (r.ownedOutrightMonth > r.month) events.set(r.ownedOutrightMonth, [...(events.get(r.ownedOutrightMonth) || []), `${goals[i].name} loan paid off`]);
  });

  const show = (evt) => {
    const rect = svg.getBoundingClientRect();
    const px = evt.clientX - rect.left;
    const mo = Math.max(0, Math.min(pts.length - 1, Math.round(((px - m.left) / plotW) * end)));
    const p = pts[mo];
    if (!p) return;
    const cx = x(p.month);
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', cx); dot.setAttribute('cy', y(p.balance)); dot.setAttribute('visibility', 'visible');
    const ev = events.get(p.month);
    tip.innerHTML = `
      <strong>${monthYear(addMonths(result.startDate, p.month))}</strong>
      ${ev ? `<div class="tip-event">${ev.map(esc).join('<br>')}</div>` : ''}
      <dl>
        <dt>Savings</dt><dd>${money(p.balance)}</dd>
        <dt>Take-home pay</dt><dd>${money(p.income, { short: true })}</dd>
        <dt>Living costs</dt><dd>${money(p.expenses, { short: true })}</dd>
        ${p.loanPayments ? `<dt>Loan instalments</dt><dd>${money(p.loanPayments, { short: true })}</dd>` : ''}
        ${Math.abs(p.runningCosts) > 1 ? `<dt>Running costs</dt><dd>${money(p.runningCosts, { short: true })}</dd>` : ''}
        <dt>Saved this month</dt><dd>${money(p.surplus, { short: true })}</dd>
      </dl>`;
    tip.hidden = false;
    const tw = tip.offsetWidth;
    const left = cx + 14 + tw > width ? cx - tw - 14 : cx + 14;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${m.top}px`;
  };
  const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); };
  const hit = svg.querySelector('.hit');
  hit.addEventListener('pointermove', show);
  hit.addEventListener('pointerdown', show);
  hit.addEventListener('pointerleave', hide);
}

/** Year-by-year table (the accessible view of the chart). */
export function yearlyTable(result) {
  const rows = result.points.filter((p) => p.month % 12 === 0 || p.month === result.endMonth);
  return `<table class="yearly"><thead><tr><th>Date</th><th>Savings</th><th>Pay / month</th><th>Living costs</th><th>Loans / month</th><th>Saved / month</th></tr></thead><tbody>
    ${rows.map((p) => `<tr><td>${monthYear(addMonths(result.startDate, p.month))}</td><td>${money(p.balance)}</td><td>${money(p.income, { short: true })}</td><td>${money(p.expenses, { short: true })}</td><td>${p.loanPayments ? money(p.loanPayments, { short: true }) : '—'}</td><td>${money(p.surplus, { short: true })}</td></tr>`).join('')}
  </tbody></table>`;
}
