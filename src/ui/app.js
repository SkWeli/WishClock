import { PRICES } from '../data/prices.js';
import { MODULES, buildGoal } from '../modules/index.js';
import { simulate } from '../engine/simulate.js';
import { evaluate } from '../engine/costTree.js';
import { fieldsHtml, readField, clampField, visibility } from './form.js';
import { renderTimeline, yearlyTable } from './chart.js';
import { money, duration, monthYear, qtyLabel, esc } from './format.js';

const STORAGE_KEY = 'wishclock:v1';
const $ = (sel, root = document) => root.querySelector(sel);

const PROFILE_FIELDS = [
  { key: 'monthlyIncome', label: 'Take-home pay a month', type: 'money', min: 0, step: 5_000, group: '', help: 'After tax and EPF. Add your partner’s if you plan together.' },
  { key: 'monthlyExpenses', label: 'Living costs a month', type: 'money', min: 0, step: 5_000, group: '', help: 'Everything you spend now, including rent.' },
  { key: 'startingSavings', label: 'Savings today', type: 'money', min: 0, step: 50_000, group: '' },
  { key: 'salaryGrowthPct', label: 'Pay rise each year', type: 'number', suffix: '%', min: 0, max: 30, step: 0.5, group: 'Assumptions' },
  { key: 'inflationPct', label: 'Inflation', type: 'number', suffix: '% a year', min: 0, max: 30, step: 0.5, group: 'Assumptions' },
  { key: 'savingsReturnPct', label: 'Interest on savings', type: 'number', suffix: '% a year', min: 0, max: 25, step: 0.25, group: 'Assumptions', help: 'A 12-month fixed deposit pays about 7–8%.' },
  { key: 'maxDebtToIncomePct', label: 'Loan instalments at most', type: 'number', suffix: '% of pay', min: 10, max: 80, step: 5, group: 'Assumptions', help: 'Banks rarely approve more than about 40%.' },
];

let uidCounter = 0;
const uid = () => `g${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

function newGoal(kind, slot, overrides = {}, name) {
  const mod = MODULES[kind];
  return { id: uid(), kind, name: name ?? mod.label, slot, open: false, options: { ...mod.defaults(), ...overrides } };
}

function defaultState() {
  const e = PRICES.economy;
  return {
    profile: {
      monthlyIncome: 400_000, monthlyExpenses: 170_000, startingSavings: 1_000_000,
      salaryGrowthPct: e.salaryGrowthPct, inflationPct: e.inflationPct, savingsReturnPct: e.savingsReturnPct, maxDebtToIncomePct: e.maxDebtToIncomePct,
    },
    extra: 0,
    goals: [
      newGoal('wedding', 2),
      { ...newGoal('house', 0), open: true },
      newGoal('car', 1, { carClass: 'compactHybrid', condition: 'used', ageYears: 5, mileageKm: 60_000 }),
    ],
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && s.profile && Array.isArray(s.goals) && s.goals.every((g) => MODULES[g.kind])) return s;
  } catch { /* storage unavailable */ }
  return defaultState();
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

let state = load();

// ---------- Profile ----------
function renderProfile() {
  $('#profile-fields').innerHTML = fieldsHtml(PROFILE_FIELDS, state.profile, 'p');
  $('#extra').value = state.extra;
  updateExtraLabel();
}

$('#profile-fields').addEventListener('input', (e) => {
  const f = PROFILE_FIELDS.find((x) => x.key === e.target.dataset.key);
  if (!f) return;
  state.profile[f.key] = readField(f, e.target);
  schedule();
});
$('#profile-fields').addEventListener('change', (e) => {
  const f = PROFILE_FIELDS.find((x) => x.key === e.target.dataset.key);
  if (!f) return;
  state.profile[f.key] = clampField(f, readField(f, e.target));
  e.target.value = state.profile[f.key];
  schedule();
});

// ---------- What-if ----------
function updateExtraLabel() {
  const v = state.extra;
  $('#extra-label').textContent = v === 0 ? 'No change' : v > 0 ? `Save ${money(v)} more a month` : `Save ${money(-v)} less a month`;
}
$('#extra').addEventListener('input', (e) => {
  state.extra = Number(e.target.value);
  updateExtraLabel();
  schedule();
});

// ---------- Goals ----------
function goalCard(g, i, n) {
  const mod = MODULES[g.kind];
  const presets = Object.keys(mod.presets).map((p) => `<button type="button" class="chip-btn" data-preset="${esc(p)}">${esc(p)}</button>`).join('');
  return `<article class="goal" data-id="${g.id}" style="--goal: var(--series-${g.slot + 1})">
    <header class="goal-head">
      <span class="swatch" aria-hidden="true"></span>
      <div class="goal-title">
        <input class="goal-name" value="${esc(g.name)}" aria-label="Goal name" maxlength="24">
        <span class="goal-sub"><span class="order">${i + 1}</span> ${esc(mod.label)} · <span class="goal-cost"></span></span>
      </div>
      <div class="goal-actions">
        <button type="button" class="icon-btn" data-act="up" aria-label="Move ${esc(g.name)} earlier" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="icon-btn" data-act="down" aria-label="Move ${esc(g.name)} later" ${i === n - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="icon-btn" data-act="remove" aria-label="Remove ${esc(g.name)}">✕</button>
        <button type="button" class="edit-btn" data-act="toggle" aria-expanded="${g.open}">${g.open ? 'Done' : 'Edit'}</button>
      </div>
    </header>
    <div class="goal-body" ${g.open ? '' : 'hidden'}>
      <div class="presets"><span>Start from</span>${presets}</div>
      <div class="goal-form">${g.open ? fieldsHtml(mod.fields, g.options, g.id) : ''}</div>
    </div>
  </article>`;
}

function renderGoals() {
  const n = state.goals.length;
  $('#goal-list').innerHTML = n
    ? state.goals.map((g, i) => goalCard(g, i, n)).join('')
    : '<p class="empty">Add a goal to see how long it takes.</p>';
}

function rerenderGoalForm(card, g) {
  const active = document.activeElement?.id;
  $('.goal-form', card).innerHTML = fieldsHtml(MODULES[g.kind].fields, g.options, g.id);
  if (active) document.getElementById(active)?.focus();
}

const goalOf = (el) => {
  const card = el.closest('.goal');
  return card ? [card, state.goals.find((g) => g.id === card.dataset.id)] : [null, null];
};

$('#goal-list').addEventListener('input', (e) => {
  const [, g] = goalOf(e.target);
  if (!g) return;
  if (e.target.classList.contains('goal-name')) {
    g.name = e.target.value.trim() || MODULES[g.kind].label;
    schedule();
    return;
  }
  const f = MODULES[g.kind].fields.find((x) => x.key === e.target.dataset.key);
  if (!f || f.type === 'select' || f.type === 'toggle') return;
  g.options[f.key] = readField(f, e.target);
  schedule();
});

$('#goal-list').addEventListener('change', (e) => {
  const [card, g] = goalOf(e.target);
  if (!g || !e.target.dataset.key) return;
  const fields = MODULES[g.kind].fields;
  const f = fields.find((x) => x.key === e.target.dataset.key);
  if (!f) return;
  const before = visibility(fields, g.options);
  g.options[f.key] = clampField(f, readField(f, e.target));
  if (f.type === 'number' || f.type === 'money') e.target.value = g.options[f.key];
  if (visibility(fields, g.options) !== before) rerenderGoalForm(card, g);
  schedule();
});

$('#goal-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const [card, g] = goalOf(btn);
  if (!g) return;
  const i = state.goals.indexOf(g);
  if (btn.dataset.preset) {
    g.options = { ...MODULES[g.kind].defaults(), ...MODULES[g.kind].presets[btn.dataset.preset] };
    rerenderGoalForm(card, g);
    schedule();
    return;
  }
  switch (btn.dataset.act) {
    case 'toggle':
      g.open = !g.open;
      break;
    case 'up':
      if (i > 0) [state.goals[i - 1], state.goals[i]] = [state.goals[i], state.goals[i - 1]];
      break;
    case 'down':
      if (i < state.goals.length - 1) [state.goals[i + 1], state.goals[i]] = [state.goals[i], state.goals[i + 1]];
      break;
    case 'remove':
      state.goals.splice(i, 1);
      break;
    default:
      return;
  }
  renderGoals();
  schedule();
});

document.querySelectorAll('[data-add]').forEach((btn) =>
  btn.addEventListener('click', () => {
    const used = new Set(state.goals.map((g) => g.slot));
    const slot = [0, 1, 2, 3, 4, 5, 6, 7].find((s) => !used.has(s)) ?? state.goals.length % 8;
    const kind = btn.dataset.add;
    const count = state.goals.filter((g) => g.kind === kind).length;
    state.goals.push({ ...newGoal(kind, slot, {}, count ? `${MODULES[kind].label} ${count + 1}` : undefined), open: true });
    renderGoals();
    schedule();
    document.querySelector('.goal:last-child .goal-name')?.focus();
  })
);

$('#reset').addEventListener('click', () => {
  state = defaultState();
  renderProfile();
  renderGoals();
  schedule();
});

// ---------- Results ----------
let pending = false;
function schedule() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    renderResults();
    save();
  });
}

let lastRun = null;
function renderResults() {
  const built = state.goals.map(buildGoal);
  const profile = { ...state.profile, extraMonthlySaving: state.extra };
  const result = simulate(profile, built);
  const baseline = state.extra ? simulate({ ...state.profile, extraMonthlySaving: 0 }, built) : null;
  lastRun = { built, result };

  // Costs in the goal headers
  built.forEach((g) => {
    const el = document.querySelector(`.goal[data-id="${g.id}"] .goal-cost`);
    if (el) el.textContent = `${money(evaluate(g.tree).today)} today`;
  });

  $('#headline').innerHTML = headline(result);
  $('#summary').innerHTML = built.map((g, i) => tile(g, result.goals[i], baseline?.goals[i])).join('') || '';
  $('#whatif-result').innerHTML = whatIfText(built, result, baseline);
  drawChart();
  $('#yearly').innerHTML = built.length ? yearlyTable(result) : '';
  $('#breakdowns').innerHTML = built.map((g, i) => breakdown(g, result.goals[i])).join('');
}

function drawChart() {
  if (!lastRun) return;
  const el = $('#chart');
  if (!lastRun.built.length) {
    el.innerHTML = '<p class="empty">Your timeline appears here once you add a goal.</p>';
    return;
  }
  renderTimeline(el, lastRun.result, lastRun.built);
}
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawChart, 120);
});

function headline(result) {
  const goals = result.goals;
  if (!goals.length) return '<h2>Add a goal to start</h2>';
  const missing = goals.filter((g) => !g.reached);
  if (missing.length === goals.length) return `<h2>None of these goals fit your budget yet</h2><p>${esc(missing[0].reason)}</p>`;
  const lastBuy = Math.max(...goals.filter((g) => g.reached).map((g) => g.month));
  const debtFree = Math.max(...goals.filter((g) => g.reached).map((g) => g.ownedOutrightMonth));
  const when = monthYear(result.goals.find((g) => g.month === lastBuy).date);
  const free = debtFree > lastBuy ? ` You finish paying off loans in <strong>${duration(debtFree)}</strong>.` : '';
  if (missing.length) {
    return `<h2>${goals.length - missing.length} of ${goals.length} goals are within reach</h2><p>${esc(missing.map((g) => g.name).join(', '))} ${missing.length > 1 ? 'are' : 'is'} out of reach with these numbers.${free}</p>`;
  }
  return `<h2>You can have ${goals.length > 1 ? 'all of it' : 'it'} in <span class="hl">${duration(lastBuy)}</span></h2><p>That’s ${when}.${free}</p>`;
}

function tile(g, r, base) {
  const style = `style="--goal: var(--series-${g.slot + 1})"`;
  if (!r.reached) {
    return `<article class="tile out" ${style}>
      <div class="tile-head"><span class="swatch"></span><span class="tile-name">${esc(g.name)}</span><span class="pill pill-bad">Out of reach</span></div>
      <p class="tile-reason">${esc(r.reason)}</p>
      <dl><dt>Price today</dt><dd>${money(evaluate(g.tree).today)}</dd></dl>
    </article>`;
  }
  const p = r.plan;
  let delta = '';
  if (base) {
    if (!base.reached) delta = '<span class="pill pill-good">Now reachable</span>';
    else if (base.month !== r.month) {
      const d = base.month - r.month;
      delta = `<span class="pill ${d > 0 ? 'pill-good' : 'pill-bad'}">${duration(Math.abs(d))} ${d > 0 ? 'sooner' : 'later'}</span>`;
    }
  }
  const loan = p.principal > 0
    ? `<dt>${esc(g.financing.label)}</dt><dd>${money(p.principal)}<span class="sub">${money(p.emi, { short: true })} a month for ${duration(p.months)}</span></dd>
       <dt>Fully yours</dt><dd>${monthYear(addMonthsLocal(r.date, p.months))}</dd>`
    : '';
  const running = Math.abs(r.runningAtPurchase) > 1
    ? `<dt>${r.runningAtPurchase < 0 ? 'Monthly change' : 'Running costs'}</dt><dd>${r.runningAtPurchase < 0 ? '' : '+'}${money(r.runningAtPurchase, { short: true })} a month</dd>`
    : '';
  const capped = p.limitedByIncome
    ? `<p class="tile-note">The loan is capped by your pay (instalments ≤ ${state.profile.maxDebtToIncomePct}%), so you save a bigger down payment first.</p>`
    : '';
  return `<article class="tile" ${style}>
    <div class="tile-head"><span class="swatch"></span><span class="tile-name">${esc(g.name)}</span>${delta}</div>
    <div class="tile-big">${r.month === 0 ? 'Now' : `in ${duration(r.month)}`}</div>
    <div class="tile-date">${monthYear(r.date)}${r.savingMonths && r.savingFrom ? ` · after ${duration(r.savingMonths)} saving for it` : ''}</div>
    <dl>
      <dt>Price then</dt><dd>${money(p.total)}<span class="sub">${money(r.priced.today)} today</span></dd>
      <dt>${p.principal > 0 ? 'Cash you pay' : 'You pay'}</dt><dd>${money(r.cashPaid)}</dd>
      ${loan}${running}
    </dl>${capped}
  </article>`;
}

function addMonthsLocal(d, n) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function whatIfText(built, result, base) {
  if (!base) return 'Move the slider to see how saving more, or less, changes every goal.';
  const parts = built.map((g, i) => {
    const a = base.goals[i], b = result.goals[i];
    if (!b.reached) return `${esc(g.name)}: still out of reach`;
    if (!a.reached) return `${esc(g.name)}: now reachable, ${monthYear(b.date)}`;
    const d = a.month - b.month;
    return `${esc(g.name)}: ${d === 0 ? 'no change' : `${duration(Math.abs(d))} ${d > 0 ? 'sooner' : 'later'}`}`;
  });
  return parts.join(' · ');
}

function treeHtml(n, depth = 0) {
  const qty = qtyLabel(n.qty, n.unit);
  const meta = [qty && `<span class="qty">${esc(qty)}</span>`, n.note && `<span class="note">${esc(n.note)}</span>`].filter(Boolean).join('');
  const row = `<span class="name">${esc(n.label)}${meta ? `<span class="meta">${meta}</span>` : ''}</span><span class="num">${money(n.today)}</span><span class="num then">${money(n.total)}</span>`;
  if (!n.children.length) return `<div class="row d${depth}">${row}</div>`;
  return `<details class="branch d${depth}" ${depth < 1 ? 'open' : ''}><summary class="row d${depth}">${row}</summary>${n.children.map((c) => treeHtml(c, depth + 1)).join('')}</details>`;
}

function breakdown(g, r) {
  const priced = r.priced;
  const when = r.reached ? monthYear(r.date) : 'at end of plan';
  const running = g.running ? evaluate(g.running) : null;
  const warnings = [...g.warnings];
  return `<section class="card breakdown" style="--goal: var(--series-${g.slot + 1})">
    <h3><span class="swatch"></span>${esc(g.name)}: what it costs</h3>
    ${warnings.length ? `<ul class="warnings">${warnings.map((w) => `<li><span class="warn-icon" aria-hidden="true">!</span>${esc(w)}</li>`).join('')}</ul>` : ''}
    <div class="tree">
      <div class="row head"><span class="name">Item</span><span class="num">Today</span><span class="num then">${esc(r.reached ? `In ${when}` : 'At end of plan')}</span></div>
      ${treeHtml(priced)}
    </div>
    ${running ? `<h4>Every month after you buy it</h4><div class="tree small">
      <div class="row head"><span class="name">Item</span><span class="num">Today</span><span class="num then"></span></div>
      ${running.children.map((c) => treeHtml(c, 1)).join('')}
      <div class="row total"><span class="name">Net change to your monthly budget</span><span class="num">${money(running.today)}</span><span class="num then"></span></div>
    </div>` : ''}
  </section>`;
}

// ---------- Start ----------
const [asY, asM] = PRICES.meta.asOf.split('-').map(Number);
$('#asof').textContent = `Prices in Sri Lankan rupees, as of ${monthYear(new Date(asY, asM - 1, 1))}. ${PRICES.meta.disclaimer}`;
renderProfile();
renderGoals();
renderResults();
