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
export function renderTimeline(container, result, goals, { payChanges = [], retirement = null } = {}) {
  const width = Math.max(320, container.clientWidth);
  const narrow = width < 560;
  const m = { left: narrow ? 52 : 70, right: 14, top: 40 };
  const plotW = width - m.left - m.right;
  const plotH = narrow ? 200 : 250;
  const laneH = 22;
  const laneGap = 10;
  const lanesTop = m.top + plotH + 34;
  const height = lanesTop + goals.length * (laneH + laneGap) + 4;
  // The whole simulated span: through retirement and on to the timeline's end year.
  const end = Math.max(24, result.endMonth);
  // After retiring, savings can't go below zero: once they run out, the line stays at zero.
  const shown = (p) => (retirement && p.month >= retirement.month ? Math.max(0, p.balance) : p.balance);
  const pts = result.points.filter((p) => p.month <= end).map((p) => ({ ...p, raw: p.balance, balance: shown(p) }));

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
  const yStep = [1, 2, 5, 10].find((s) => years / s <= (narrow ? 6 : 13)) ?? 10;
  for (let mo = (12 - startMonth) % 12; mo <= end; mo += 12) {
    const yr = addMonths(result.startDate, mo).getFullYear();
    if (yr % yStep !== 0) continue;
    parts.push(`<line class="xtick" x1="${x(mo)}" x2="${x(mo)}" y1="${m.top + plotH}" y2="${m.top + plotH + 5}"/>`);
    parts.push(`<text class="tick" x="${x(mo)}" y="${m.top + plotH + 19}" text-anchor="middle">${yr}</text>`);
  }

  // Retirement band
  if (retirement && retirement.month < end) {
    const rx = x(retirement.month);
    parts.push(`<rect class="retire-band" x="${rx}" y="${m.top}" width="${m.left + plotW - rx}" height="${plotH}"/>`);
    parts.push(`<line class="retire-line" x1="${rx}" x2="${rx}" y1="${m.top}" y2="${m.top + plotH}"/>`);
    parts.push(`<text class="retire-label" x="${rx + 6}" y="${m.top + plotH - 8}">Retired · ${monthYear(addMonths(result.startDate, retirement.month))}</text>`);
    if (retirement.runsOut != null) {
      const ox = x(retirement.runsOut);
      parts.push(`<line class="runout-line" x1="${ox}" x2="${ox}" y1="${m.top}" y2="${m.top + plotH}"/>`);
      parts.push(`<text class="runout-label" x="${ox - 6}" y="${m.top + 30}" text-anchor="end">Savings run out · ${monthYear(addMonths(result.startDate, retirement.runsOut))}</text>`);
    }
  }

  // Balance area + line
  const base = y(Math.max(yMin, 0));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.month).toFixed(1)},${y(p.balance).toFixed(1)}`).join('');
  parts.push(`<path class="balance-area" d="${line}L${x(pts[pts.length - 1].month)},${base}L${x(0)},${base}Z"/>`);
  parts.push(`<path class="balance-line" d="${line}"/>`);
  if (pts.some((p) => p.reserve > 0)) {
    const res = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.month).toFixed(1)},${y(p.reserve || 0).toFixed(1)}`).join('');
    parts.push(`<path class="reserve-line" d="${res}"/>`);
  }

  // Pay changes (an intern going permanent, a student starting work)
  payChanges.filter((c) => c.month > 0 && c.month <= end).forEach((c) => {
    const px = x(c.month), py = m.top + plotH;
    parts.push(`<path class="pay-mark" d="M${px - 6},${py} L${px + 6},${py} L${px},${py - 9} Z"><title>${esc(c.label)}</title></path>`);
  });

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
  const people = result.people || [];
  if (retirement) {
    events.set(retirement.month, [...(events.get(retirement.month) || []), 'Retire: pay stops, lump sums paid']);
    if (retirement.runsOut != null) events.set(retirement.runsOut, [...(events.get(retirement.runsOut) || []), 'Savings run out']);
  }
  payChanges.forEach((c) => events.set(c.month, [...(events.get(c.month) || []), c.label]));
  result.goals.forEach((r, i) => {
    if (!r.reached) return;
    events.set(r.month, [...(events.get(r.month) || []), `${goals[i].verb || 'Buy'} ${goals[i].name}`]);
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
        <dt>Savings${people.length > 1 ? ' together' : ''}</dt><dd>${p.raw < 0 && p.balance === 0 ? 'Run out' : money(p.balance)}</dd>
        ${people.length > 1 ? people.map((pp, i) => `<dt class="indent">${esc(pp.name)}</dt><dd class="light">${money(p.balances[i])}</dd>`).join('') : ''}
        ${p.reserve ? `<dt>Emergency money</dt><dd class="light">${money(p.reserve)}</dd>` : ''}
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

/** Retirement view: usable savings vs the target for retiring in that month. */
export function renderRetirementChart(container, check, retirement, inflationPct, people) {
  const width = Math.max(320, container.clientWidth);
  const narrow = width < 560;
  const m = { left: narrow ? 52 : 70, right: 16, top: 24, bottom: 30 };
  const plotW = width - m.left - m.right;
  const plotH = narrow ? 200 : 260;
  const height = m.top + plotH + m.bottom;
  // Savings if everyone keeps working, shown far enough to include both the planned date and "at this rate".
  const end = Math.min(check.horizon, Math.max(check.retireMonth, check.earliestMonth ?? check.horizon) + 24);
  const pts = check.working.points.filter((p) => p.month < end);
  const fac = (mo) => Math.pow(1 + inflationPct / 100, mo / 12);
  const rate = (retirement.withdrawalPct || 4) / 100;
  const needAt = (mo) => Math.max(0, (Math.max(0, retirement.annualExpenses - (retirement.hasPension ? retirement.guaranteedIncome : 0)) / rate - (retirement.lumpSums || 0)) * fac(mo));
  const usable = pts.map((p) => p.balance - p.reserve);
  let yMin = Math.min(0, ...usable);
  let yMax = Math.max(1, ...usable, needAt(end));
  const step = niceStep((yMax - yMin) / 4);
  yMin = Math.floor(yMin / step) * step;
  yMax = Math.ceil(yMax / step) * step;
  const x = (mo) => m.left + (mo / end) * plotW;
  const y = (v) => m.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const parts = [];
  for (let v = yMin; v <= yMax + 1; v += step) {
    parts.push(`<line class="grid${v === 0 ? ' zero' : ''}" x1="${m.left}" x2="${m.left + plotW}" y1="${y(v)}" y2="${y(v)}"/>`);
    parts.push(`<text class="tick" x="${m.left - 8}" y="${y(v) + 4}" text-anchor="end">${axisMoney(v)}</text>`);
  }
  const years = end / 12;
  const yStep = [1, 2, 5, 10].find((s) => years / s <= (narrow ? 5 : 9)) ?? 10;
  const startMonth = check.result.startDate.getMonth();
  for (let mo = (12 - startMonth) % 12; mo <= end; mo += 12) {
    const yr = addMonths(check.result.startDate, mo).getFullYear();
    if (yr % yStep !== 0) continue;
    parts.push(`<text class="tick" x="${x(mo)}" y="${m.top + plotH + 19}" text-anchor="middle">${yr}</text>`);
  }
  const need = [];
  for (let mo = 0; mo <= end; mo += Math.max(1, Math.floor(end / 200))) need.push(`${need.length ? 'L' : 'M'}${x(mo).toFixed(1)},${y(needAt(mo)).toFixed(1)}`);
  need.push(`L${x(end).toFixed(1)},${y(needAt(end)).toFixed(1)}`);
  parts.push(`<path class="target-line" d="${need.join('')}"/>`);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.month + 1).toFixed(1)},${y(usable[i]).toFixed(1)}`).join('');
  parts.push(`<path class="balance-line" d="${line}"/>`);
  const start = check.result.startDate;
  const px = x(check.retireMonth);
  parts.push(`<line class="marker" style="stroke:var(--muted)" x1="${px}" x2="${px}" y1="${m.top}" y2="${m.top + plotH}"/>`);
  parts.push(`<circle cx="${px}" cy="${y(needAt(check.retireMonth))}" r="5" class="target-dot"/>`);
  const early = check.earliestMonth != null && check.earliestMonth < check.retireMonth;
  // Put each label on whichever side of its line has room.
  const side = (lx) => (lx > m.left + plotW - 150 ? ['end', -6] : ['start', 6]);
  const [pa, pd] = side(px);
  parts.push(`<text class="marker-label" x="${px + pd}" y="${m.top - 8}" text-anchor="${pa}">Planned · ${monthYear(addMonths(start, check.retireMonth))}</text>`);
  if (check.earliestMonth != null && check.earliestMonth <= end) {
    const ex = x(check.earliestMonth);
    parts.push(`<line class="marker" style="stroke:var(--good)" x1="${ex}" x2="${ex}" y1="${m.top}" y2="${m.top + plotH}"/>`);
    parts.push(`<circle cx="${ex}" cy="${y(needAt(check.earliestMonth))}" r="5.5" class="end-ok"/>`);
    const [ra, rd] = early ? ['end', -6] : side(ex);
    parts.push(`<text class="marker-label rate-label" x="${ex + rd}" y="${m.top + 12}" text-anchor="${ra}">At this rate · ${monthYear(addMonths(start, check.earliestMonth))}</text>`);
  }
  container.innerHTML = `<svg xmlns="${NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Savings compared with the retirement target until ${monthYear(addMonths(check.result.startDate, end))}">${parts.join('')}</svg>`;
}
