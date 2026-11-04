import { PRICES } from '../data/prices.js';
import { MODULES, buildGoal } from '../modules/index.js';
import { simulate, monthsUntil, addMonths } from '../engine/simulate.js';
import { checkRetirement } from '../engine/retirement.js';
import { evaluate } from '../engine/costTree.js';
import { fieldsHtml, readField, clampField, visibility } from './form.js';
import { renderTimeline, yearlyTable, renderRetirementChart } from './chart.js';
import { money, duration, monthYear, qtyLabel, esc } from './format.js';
import { startVisitCounter } from './visits.js';
import { startTour, hasSeenTour } from './tour.js';
import { goalIcon, ICONS } from './icons.js';
import { initThemeSwitch } from './theme.js';

// Bump this when the example plan changes, so everyone starts from the new example.
const STORAGE_KEY = 'wishclock:v3';
const OLD_KEY = 'wishclock:v1';
const $ = (sel, root = document) => root.querySelector(sel);
const startDate = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const TABS = ['plan', 'people', 'goals', 'retirement', 'costs'];

// ---------- Schemas ----------
const PERSON_FIELDS = [
  { key: 'status', label: 'Work status', type: 'select', group: '', options: [
    { value: 'permanent', label: 'Permanent job' },
    { value: 'intern', label: 'Intern / trainee' },
    { value: 'student', label: 'Studying, not working yet' },
  ] },
  { key: 'pay', type: 'money', min: 0, step: 5_000, group: '',
    label: (o) => (o.status === 'intern' ? 'Intern allowance a month' : o.status === 'student' ? 'Part-time pay or allowance' : 'Take-home pay a month'),
    help: 'After tax and EPF.' },
  { key: 'changeAt', type: 'month', group: '', showIf: (o) => o.status !== 'permanent',
    label: (o) => (o.status === 'intern' ? 'Permanent from' : 'Starts working from') },
  { key: 'payAfter', type: 'money', min: 0, step: 5_000, group: '', showIf: (o) => o.status !== 'permanent',
    label: 'Expected take-home pay then', help: 'Check job ads or ask seniors in the role you expect.' },
  { key: 'expenses', type: 'money', min: 0, step: 5_000, group: '',
    label: (o) => (o.status === 'permanent' ? 'Living costs a month' : 'Living costs now'),
    help: 'Their share of spending, including rent.' },
  { key: 'expensesAfter', type: 'money', min: 0, step: 5_000, group: '', showIf: (o) => o.status !== 'permanent',
    label: (o) => (o.status === 'intern' ? 'Living costs once permanent' : 'Living costs once working'),
    help: 'Family support may stop. Add rent, bills and food you will pay yourself.' },
  { key: 'savings', label: 'Savings today', type: 'money', min: 0, step: 50_000, group: '' },
  { key: 'buffer', label: 'Emergency money to always keep', type: 'money', min: 0, step: 25_000, group: '',
    help: 'Never spent on a goal. Grows with inflation. 3–6 months of living costs is common.' },
  { key: 'age', label: 'Age now', type: 'number', suffix: 'years', min: 15, max: 80, step: 1, group: '' },
  { key: 'retireAge', label: 'Retire at', type: 'number', suffix: 'years old', min: 40, max: 85, step: 1, group: '',
    help: 'Pay stops then. EPF can be withdrawn from 55 (men) or 50 (women).' },
];

const RETIRE_FIELDS = [
  { key: 'annualExpenses', label: 'Yearly spending in retirement', type: 'money', min: 0, step: 50_000, group: '',
    help: 'For the household, in today’s rupees. Many people plan for 70–80% of what they spend now.' },
  { key: 'hasPension', label: 'We expect a pension, rent or other guaranteed income', type: 'toggle', group: '' },
  { key: 'guaranteedIncome', label: 'Guaranteed income a year', type: 'money', min: 0, step: 50_000, group: '', showIf: (o) => o.hasPension,
    help: 'Government pension, rent from property, annuities. In today’s rupees.' },
  { key: 'lumpSums', label: 'Lump sums you’ll receive', type: 'money', min: 0, step: 100_000, group: '',
    help: 'EPF, ETF and gratuity you expect at retirement, in today’s rupees.' },
  { key: 'withdrawalPct', label: 'Safe withdrawal rate', type: 'number', suffix: '% a year', min: 2, max: 8, step: 0.25, group: '',
    help: '4% means you need 25× your yearly spending.' },
];
const RETIRE_DEFAULTS = { annualExpenses: 840_000, hasPension: false, guaranteedIncome: 600_000, lumpSums: 3_000_000, withdrawalPct: 4 };
const PERSON_DEFAULTS = { status: 'permanent', pay: 150_000, payAfter: 150_000, expenses: 60_000, expensesAfter: 60_000, savings: 0, buffer: 100_000, age: 28, retireAge: 60 };

const ASSUMPTION_FIELDS = [
  { key: 'salaryGrowthPct', label: 'Pay rise each year', type: 'number', suffix: '%', min: 0, max: 30, step: 0.5, group: '' },
  { key: 'inflationPct', label: 'Inflation', type: 'number', suffix: '% a year', min: 0, max: 30, step: 0.5, group: '' },
  { key: 'savingsReturnPct', label: 'Interest on savings', type: 'number', suffix: '% a year', min: 0, max: 25, step: 0.25, group: '', help: 'A 12-month fixed deposit pays about 7–8%.' },
  { key: 'maxDebtToIncomePct', label: 'Loan instalments at most', type: 'number', suffix: '% of pay', min: 10, max: 80, step: 5, group: '', help: 'Banks rarely approve more than about 40%.' },
];

// ---------- State ----------
let uidCounter = 0;
const uid = (p = 'g') => `${p}${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

function newGoal(kind, slot, overrides = {}, name) {
  const mod = MODULES[kind];
  return { id: uid(), kind, name: name ?? mod.label, slot, open: false, payer: 'all', options: { ...mod.defaults(), ...overrides } };
}

function newPerson(n) {
  return { ...PERSON_DEFAULTS, id: uid('p'), name: n === 1 ? 'You' : n === 2 ? 'Partner' : `Person ${n}`, changeAt: ym(addMonths(startDate(), 12)) };
}

function defaultState() {
  const e = PRICES.economy;
  return {
    people: [
      { id: 'p1', name: 'You', status: 'intern', pay: 50_000, changeAt: ym(addMonths(startDate(), 8)), payAfter: 300_000, expenses: 30_000, expensesAfter: 110_000, savings: 300_000, buffer: 150_000, age: 24, retireAge: 55 },
    ],
    retirement: { ...RETIRE_DEFAULTS },
    allowLoans: true,
    assumptions: { salaryGrowthPct: e.salaryGrowthPct, inflationPct: e.inflationPct, savingsReturnPct: e.savingsReturnPct, maxDebtToIncomePct: e.maxDebtToIncomePct },
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
    if (s && Array.isArray(s.people) && s.people.length && Array.isArray(s.goals) && s.goals.every((g) => MODULES[g.kind])) {
      s.people = s.people.map((p) => ({ ...PERSON_DEFAULTS, expensesAfter: p.expenses, ...p }));
      s.retirement = { ...RETIRE_DEFAULTS, ...s.retirement };
      if (s.allowLoans == null) s.allowLoans = true;
      return s;
    }
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    if (old && old.profile && Array.isArray(old.goals)) {
      const { monthlyIncome, monthlyExpenses, startingSavings, ...assumptions } = old.profile;
      return {
        people: [{ ...newPerson(1), id: 'p1', pay: monthlyIncome, payAfter: monthlyIncome, expenses: monthlyExpenses, savings: startingSavings }],
        assumptions, extra: old.extra || 0, retirement: { ...RETIRE_DEFAULTS },
        goals: old.goals.filter((g) => MODULES[g.kind]).map((g) => ({ payer: 'all', ...g })),
      };
    }
  } catch { /* storage unavailable */ }
  return defaultState();
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

let state = load();

const personName = (id) => state.people.find((p) => p.id === id)?.name;
const payerLabel = (g) => (state.people.length < 2 ? '' : g.payer && g.payer !== 'all' && personName(g.payer) ? personName(g.payer) : 'Together');

// ---------- Tabs ----------
function currentTab() {
  const h = location.hash.slice(1);
  return TABS.includes(h) ? h : 'plan';
}
function showTab() {
  const tab = currentTab();
  TABS.forEach((t) => {
    const on = t === tab;
    $(`#panel-${t}`).hidden = !on;
    const el = $(`#tab-${t}`);
    el.setAttribute('aria-selected', on);
    el.classList.toggle('active', on);
  });
  $('#strip').hidden = tab === 'plan';
  if (tab === 'plan') drawChart();
  if (tab === 'retirement') schedule();
}
window.addEventListener('hashchange', () => { showTab(); window.scrollTo({ top: 0 }); });

// ---------- People ----------
function personCard(p, i) {
  const initial = (p.name || '?').trim()[0]?.toUpperCase() || '?';
  return `<article class="person card" data-pid="${p.id}">
    <header class="person-head">
      <span class="avatar" aria-hidden="true">${esc(initial)}</span>
      <input class="person-name" value="${esc(p.name)}" aria-label="Person ${i + 1} name" maxlength="20">
      <span class="person-pay" data-pay-summary></span>
    </header>
    <div class="person-form">${fieldsHtml(PERSON_FIELDS, p, p.id)}</div>
  </article>`;
}

function renderPeople() {
  $('#people-list').innerHTML = state.people.map(personCard).join('');
  document.querySelectorAll('#people-count-picker button').forEach((b) => b.setAttribute('aria-checked', Number(b.dataset.count) === state.people.length));
  $('#assumption-fields').innerHTML = fieldsHtml(ASSUMPTION_FIELDS, state.assumptions, 'a');
  $('#retire-fields').innerHTML = fieldsHtml(RETIRE_FIELDS, state.retirement, 'r');
  if (state.extra > Number($('#extra').max)) $('#extra').max = String(Math.ceil(state.extra / 50_000) * 50_000);
  $('#extra').value = state.extra;
  updateExtraLabel();
  updatePaySummaries();
}

function updatePaySummaries() {
  const start = startDate();
  state.people.forEach((p) => {
    const el = document.querySelector(`.person[data-pid="${p.id}"] [data-pay-summary]`);
    if (!el) return;
    if (p.status === 'permanent') { el.textContent = `${money(p.pay, { short: true })} a month`; return; }
    const months = monthsUntil(start, p.changeAt);
    const when = months <= 0 ? 'already' : `in ${duration(months)}`;
    el.textContent = `${money(p.pay, { short: true })} → ${money(p.payAfter, { short: true })} ${when}`;
  });
}

$('#people-count-picker').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const want = Number(b.dataset.count);
  while (state.people.length < want) state.people.push(newPerson(state.people.length + 1));
  if (state.people.length > want) state.people.length = want;
  state.goals.forEach((g) => { if (g.payer !== 'all' && !personName(g.payer)) g.payer = 'all'; });
  renderPeople();
  renderGoals();
  schedule();
});

$('#people-list').addEventListener('input', (e) => {
  const card = e.target.closest('.person');
  if (!card) return;
  const p = state.people.find((x) => x.id === card.dataset.pid);
  if (e.target.classList.contains('person-name')) {
    p.name = e.target.value.trim() || 'Someone';
    card.querySelector('.avatar').textContent = p.name[0].toUpperCase();
    renderGoals();
    schedule();
    return;
  }
  const f = PERSON_FIELDS.find((x) => x.key === e.target.dataset.key);
  if (!f || f.type === 'select') return;
  p[f.key] = readField(f, e.target);
  updatePaySummaries();
  schedule();
});

$('#people-list').addEventListener('change', (e) => {
  const card = e.target.closest('.person');
  const f = PERSON_FIELDS.find((x) => x.key === e.target.dataset.key);
  if (!card || !f) return;
  const p = state.people.find((x) => x.id === card.dataset.pid);
  p[f.key] = clampField(f, readField(f, e.target));
  if (f.key === 'status') {
    if (p.status !== 'permanent' && (!p.changeAt || monthsUntil(startDate(), p.changeAt) <= 0)) p.changeAt = ym(addMonths(startDate(), 12));
    if (p.status !== 'permanent' && !(p.payAfter > p.pay)) p.payAfter = Math.max(p.pay * 3, 120_000);
    if (p.status !== 'permanent' && p.expensesAfter == null) p.expensesAfter = p.expenses;
    const active = document.activeElement?.id;
    card.querySelector('.person-form').innerHTML = fieldsHtml(PERSON_FIELDS, p, p.id);
    if (active) document.getElementById(active)?.focus();
  } else if (f.type === 'money') e.target.value = p[f.key];
  updatePaySummaries();
  schedule();
});

$('#assumption-fields').addEventListener('input', (e) => {
  const f = ASSUMPTION_FIELDS.find((x) => x.key === e.target.dataset.key);
  if (!f) return;
  state.assumptions[f.key] = readField(f, e.target);
  schedule();
});
$('#assumption-fields').addEventListener('change', (e) => {
  const f = ASSUMPTION_FIELDS.find((x) => x.key === e.target.dataset.key);
  if (!f) return;
  state.assumptions[f.key] = clampField(f, readField(f, e.target));
  e.target.value = state.assumptions[f.key];
  schedule();
});

// ---------- Retirement inputs ----------
$('#retire-fields').addEventListener('input', (e) => {
  const f = RETIRE_FIELDS.find((x) => x.key === e.target.dataset.key);
  if (!f || f.type === 'toggle') return;
  state.retirement[f.key] = readField(f, e.target);
  schedule();
});
$('#retire-fields').addEventListener('change', (e) => {
  const f = RETIRE_FIELDS.find((x) => x.key === e.target.dataset.key);
  if (!f) return;
  const before = visibility(RETIRE_FIELDS, state.retirement);
  state.retirement[f.key] = clampField(f, readField(f, e.target));
  if (visibility(RETIRE_FIELDS, state.retirement) !== before) $('#retire-fields').innerHTML = fieldsHtml(RETIRE_FIELDS, state.retirement, 'r');
  else if (f.type !== 'toggle') e.target.value = state.retirement[f.key];
  schedule();
});
$('#retire-result').addEventListener('click', (e) => {
  const b = e.target.closest('[data-apply-extra]');
  if (!b) return;
  const v = Number(b.dataset.applyExtra);
  const slider = $('#extra');
  if (v > Number(slider.max)) slider.max = String(Math.ceil(v / 50_000) * 50_000);
  state.extra = v;
  slider.value = v;
  updateExtraLabel();
  location.hash = 'plan';
  schedule();
});

// ---------- What-if ----------
function updateExtraLabel() {
  const v = state.extra;
  const who = state.people.length > 1 ? ' together' : '';
  $('#extra-label').textContent = v === 0 ? 'No change' : v > 0 ? `Save ${money(v)} more a month${who}` : `Save ${money(-v)} less a month${who}`;
}
$('#extra').addEventListener('input', (e) => {
  state.extra = Number(e.target.value);
  updateExtraLabel();
  schedule();
});

// ---------- Goals ----------
function payerSelect(g) {
  if (state.people.length < 2) return '';
  const opts = [`<option value="all" ${g.payer === 'all' ? 'selected' : ''}>Together (all ${state.people.length})</option>`]
    .concat(state.people.map((p) => `<option value="${p.id}" ${g.payer === p.id ? 'selected' : ''}>Only ${esc(p.name)}</option>`));
  return `<div class="payer-row"><label for="${g.id}-payer">Who pays</label><select id="${g.id}-payer" data-payer>${opts.join('')}</select></div>`;
}

function goalCard(g, i, n) {
  const mod = MODULES[g.kind];
  const presets = Object.keys(mod.presets).map((p) => `<button type="button" class="chip-btn" data-preset="${esc(p)}">${esc(p)}</button>`).join('');
  const who = payerLabel(g);
  return `<article class="goal" data-id="${g.id}" style="--goal: var(--series-${g.slot + 1})">
    <header class="goal-head">
      <span class="goal-icon">${goalIcon(g.kind)}</span>
      <div class="goal-title">
        <input class="goal-name" value="${esc(g.name)}" aria-label="Goal name" maxlength="24">
        <span class="goal-sub"><span class="order">${i + 1}</span> ${esc(mod.label)} · <span class="goal-cost"></span>${who ? ` · paid by ${esc(who.toLowerCase() === 'together' ? 'everyone' : who)}` : ''}</span>
      </div>
      <div class="goal-actions">
        <button type="button" class="icon-btn" data-act="up" aria-label="Move ${esc(g.name)} earlier" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="icon-btn" data-act="down" aria-label="Move ${esc(g.name)} later" ${i === n - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="icon-btn" data-act="remove" aria-label="Remove ${esc(g.name)}">✕</button>
        <button type="button" class="edit-btn" data-act="toggle" aria-expanded="${g.open}">${g.open ? 'Done' : 'Edit'}</button>
      </div>
    </header>
    <div class="goal-body" ${g.open ? '' : 'hidden'}>
      ${payerSelect(g)}
      <div class="presets"><span>Start from</span>${presets}</div>
      <div class="goal-form">${g.open ? fieldsHtml(goalFields(g), g.options, g.id) : ''}</div>
    </div>
  </article>`;
}

// Loan-related fields are hidden when the household doesn't want loans.
const LOAN_KEYS = new Set(['financing', 'downPct', 'ratePct', 'years']);
const goalFields = (g) => (state.allowLoans ? MODULES[g.kind].fields : MODULES[g.kind].fields.filter((f) => !LOAN_KEYS.has(f.key)));
const buildForPlan = (g) => {
  const b = buildGoal(g);
  return state.allowLoans ? b : { ...b, financing: { type: 'cash' } };
};

function renderLoanChoice() {
  document.querySelectorAll('#loan-picker button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.loans === String(state.allowLoans))));
  $('#loan-note').textContent = state.allowLoans
    ? 'Each house or car can use a loan or be paid in cash. Set it under “Paying for it” in the goal.'
    : 'Every goal is paid fully from savings. You wait longer, but pay no interest.';
}
$('#loan-picker').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.allowLoans = b.dataset.loans === 'true';
  renderLoanChoice();
  renderGoals();
  schedule();
});

function renderGoals() {
  const n = state.goals.length;
  $('#goal-list').innerHTML = n ? state.goals.map((g, i) => goalCard(g, i, n)).join('') : '<p class="empty">Add a goal to see how long it takes.</p>';
}

function rerenderGoalForm(card, g) {
  const active = document.activeElement?.id;
  $('.goal-form', card).innerHTML = fieldsHtml(goalFields(g), g.options, g.id);
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
  if (!g) return;
  if (e.target.matches('[data-payer]')) {
    g.payer = e.target.value;
    renderGoals();
    document.getElementById(`${g.id}-payer`)?.focus();
    schedule();
    return;
  }
  if (!e.target.dataset.key) return;
  const fields = goalFields(g);
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
    case 'toggle': g.open = !g.open; break;
    case 'up': if (i > 0) [state.goals[i - 1], state.goals[i]] = [state.goals[i], state.goals[i - 1]]; break;
    case 'down': if (i < state.goals.length - 1) [state.goals[i + 1], state.goals[i]] = [state.goals[i], state.goals[i + 1]]; break;
    case 'remove': state.goals.splice(i, 1); break;
    default: return;
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
  renderLoanChoice();
  renderPeople();
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

function household(extra) {
  const start = startDate();
  return {
    ...state.assumptions,
    extraMonthlySaving: extra,
    retirement: {
      month: householdRetireMonth(),
      monthlySpending: (state.retirement.annualExpenses || 0) / 12,
      monthlyIncome: state.retirement.hasPension ? (state.retirement.guaranteedIncome || 0) / 12 : 0,
      lumpSum: state.retirement.lumpSums || 0,
    },
    people: state.people.map((p) => ({
      ...p,
      changeMonth: p.status === 'permanent' ? null : monthsUntil(start, p.changeAt),
      retireMonth: retireMonthOf(p),
    })),
  };
}

const retireMonthOf = (p) => Math.max(0, Math.round(((p.retireAge || 60) - (p.age || 30)) * 12));
const householdRetireMonth = () => Math.max(...state.people.map(retireMonthOf));

function payChanges() {
  const start = startDate();
  return state.people
    .filter((p) => p.status !== 'permanent')
    .map((p) => ({ month: monthsUntil(start, p.changeAt), label: `${p.name} ${p.status === 'intern' ? 'goes permanent' : 'starts working'}` }));
}

let lastRun = null;
function renderResults() {
  const built = state.goals.map(buildForPlan);
  // Show at least to 2070. Stretch further when something happens later: a purchase or loan
  // (the simulation keeps going until those finish) or retirement (plus 5 years of retired life).
  const TIMELINE_MIN_END = '2070-12';
  const opts = { startDate: startDate(), untilMonth: Math.max(monthsUntil(startDate(), TIMELINE_MIN_END), householdRetireMonth() + 60) };
  const result = simulate(household(state.extra), built, opts);
  const baseline = state.extra ? simulate(household(0), built, opts) : null;
  lastRun = { built, result };

  built.forEach((g) => {
    const el = document.querySelector(`.goal[data-id="${g.id}"] .goal-cost`);
    if (el) el.textContent = `${money(evaluate(g.tree).today)} today`;
  });
  $('#people-count').textContent = state.people.length;
  $('#goal-count').textContent = state.goals.length;

  renderRetirement(built);
  $('#headline').innerHTML = headline(result);
  $('#summary').innerHTML = built.map((g, i) => tile(g, result.goals[i], baseline?.goals[i])).join('');
  $('#strip').innerHTML = strip(built, result);
  $('#whatif-result').innerHTML = whatIfText(built, result, baseline);
  if (currentTab() === 'plan') drawChart();
  $('#yearly').innerHTML = built.length ? yearlyTable(result) : '';
  $('#breakdowns').innerHTML = built.length ? built.map((g, i) => breakdown(g, result.goals[i])).join('') : '<p class="empty">No goals yet. Add one in the Goals tab.</p>';
}

let lastRetire = null;
function renderRetirement(built) {
  const rm = householdRetireMonth();
  const onTab = currentTab() === 'retirement';
  if (rm <= 0) {
    lastRetire = null;
    $('#retire-card').innerHTML = '';
    $('#retire-result').innerHTML = '<p class="empty">Everyone is already at retirement age. Change ages in People &amp; income.</p>';
    return;
  }
  const horizonMonth = Math.max(rm + 60, ...state.people.map((p) => Math.round((85 - (p.age || 30)) * 12)));
  const check = checkRetirement(household(state.extra), built, state.retirement, rm, { startDate: startDate(), computeExtra: onTab, horizonMonth });
  lastRetire = check;
  const date = monthYear(addMonths(startDate(), rm));
  const ok = check.shortfall <= 0;
  $('#retire-card').innerHTML = `<a class="retire-card ${ok ? 'ok' : 'short'}" href="#retirement">
    <span class="rc-label">Retirement · ${date}</span>
    <span class="pill ${ok ? 'pill-good' : 'pill-bad'}">${ok ? 'On track' : `Short by ${money(check.shortfall)}`}</span>
    <span class="rc-sub">Need ${money(check.target.needed)} saved · plan reaches ${money(check.projected)}</span>
    <span class="rc-ages">${state.people.map((p) => `${esc(p.name)}: plans ${p.retireAge}, at this rate <strong>${rateAge(p, check)}</strong>`).join(' · ')}</span>
    <span class="rc-more">Details →</span></a>`;
  $('#retire-ages').innerHTML = state.people.map((p) => {
    const m = retireMonthOf(p);
    return `<li><strong>${esc(p.name)}</strong> is ${p.age} now and plans to retire at ${p.retireAge}${m > 0 ? `, in ${monthYear(addMonths(startDate(), m))}` : ' (already)'}</li>`;
  }).join('') + (state.people.length > 1 ? `<li class="muted">The target is for ${date}, when the last person stops working.</li>` : '');
  if (onTab) {
    const marks = lastRun ? retirementMarks(lastRun.result) : null;
    const lasts = !marks ? '' : marks.runsOut
      ? `<p class="retire-advice bad">After retiring, savings run out in <strong>${monthYear(addMonths(startDate(), marks.runsOut))}</strong> (${ageLine(marks.runsOut)}).</p>`
      : `<p class="retire-advice good">Savings still last at the end of the timeline, <strong>${monthYear(addMonths(startDate(), lastRun.result.endMonth))}</strong> (${ageLine(lastRun.result.endMonth)}).</p>`;
    $('#retire-result').innerHTML = retirementHtml(check, rm) + lasts;
  }
  if (onTab) drawRetireChart();
}

/** Age a person would be when savings cover the target ("at this rate"). */
function rateAge(p, c) {
  if (c.earliestMonth == null) return `not before ${Math.floor((p.age || 0) + c.horizon / 12)}`;
  return String(Math.floor((p.age || 0) + c.earliestMonth / 12));
}

function agesTable(c) {
  const when = c.earliestMonth == null ? null : monthYear(addMonths(startDate(), c.earliestMonth));
  const rows = state.people.map((p) => {
    const planned = p.retireAge;
    const real = c.earliestMonth == null ? null : Math.floor((p.age || 0) + c.earliestMonth / 12);
    const diff = real == null ? null : real - planned;
    const pill = real == null ? '<span class="pill pill-bad">Not reached</span>'
      : diff < 0 ? `<span class="pill pill-good">${-diff} yr${diff === -1 ? '' : 's'} early</span>`
      : diff > 0 ? `<span class="pill pill-bad">${diff} yr${diff === 1 ? '' : 's'} late</span>`
      : '<span class="pill pill-good">On time</span>';
    return `<tr><th scope="row">${esc(p.name)}</th><td>${planned}</td><td><strong>${real == null ? `${Math.floor((p.age || 0) + c.horizon / 12)}+` : real}</strong></td><td>${pill}</td></tr>`;
  }).join('');
  return `<table class="ages-table"><thead><tr><th></th><th>Plans to retire at</th><th>At this rate</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    <p class="ages-note">${when ? `“At this rate” is ${when}: the first month, after every goal is bought, when your savings already cover what you’d need to retire then, if you keep working and saving as planned.` : 'At this rate your savings don’t catch up with the target, even if you keep working. Spend less in retirement, save more, or cut a goal.'}</p>`;
}

function retirementHtml(c, rm) {
  const t = c.target;
  const r = state.retirement;
  const date = monthYear(addMonths(startDate(), rm));
  const years = (rm / 12).toFixed(rm % 12 ? 1 : 0);
  const ok = c.shortfall <= 0;
  const steps = [
    `<li><span>Yearly spending</span><b>${money(r.annualExpenses)} today → ${money(t.expensesThen)} a year in ${date}</b><small>Prices grow ${state.assumptions.inflationPct}% a year for ${years} years (× ${t.factor.toFixed(2)})</small></li>`,
    r.hasPension ? `<li><span>− Guaranteed income</span><b>${money(t.incomeThen)} a year</b><small>Pension, rent or other income you can count on</small></li>
      <li><span>= Yearly gap to cover from savings</span><b>${money(t.gap)}</b></li>` : '',
    `<li><span>${r.hasPension ? '÷' : '×'} ${r.hasPension ? `${r.withdrawalPct}%` : t.multiple.toFixed(t.multiple % 1 ? 1 : 0)}</span><b>${money(t.corpus)}</b><small>${r.hasPension ? `Same as × ${t.multiple.toFixed(t.multiple % 1 ? 1 : 0)}. ` : ''}Withdrawing ${r.withdrawalPct}% a year should last 30+ years</small></li>`,
    t.lumps > 0 ? `<li><span>− Lump sums</span><b>${money(t.lumps)}</b><small>EPF, ETF, gratuity</small></li>` : '',
    `<li class="total"><span>You need saved</span><b>${money(t.needed)}</b><small>${money(t.neededToday)} in today’s money</small></li>`,
  ].join('');
  let advice = '';
  if (ok) {
    advice = `<p class="retire-advice good">Your plan reaches <strong>${money(c.projected)}</strong> by ${date}, ${money(c.projected - t.needed)} more than you need.</p>`;
  } else {
    const extra = c.extraNeeded;
    advice = `<p class="retire-advice bad">Your plan reaches <strong>${money(c.projected)}</strong> by ${date}, so you are <strong>${money(c.shortfall)} short</strong>.</p>
      ${isFinite(extra) && extra > 0 ? `<p class="retire-advice">Saving <strong>${money(extra)} more a month${state.people.length > 1 ? ' together' : ''}</strong>, starting now, closes the gap.</p>
      <button type="button" class="next-btn as-btn" data-apply-extra="${extra + state.extra}">See this in your plan →</button>` : ''}`;
  }
  const warn = [
    ...c.loansAfter.map((g) => `${esc(g.name)} loan is still being repaid after you retire (until ${monthYear(addMonths(startDate(), g.ownedOutrightMonth))}).`),
    ...c.goalsAfter.map((g) => `${esc(g.name)} happens after you retire.`),
  ];
  return `<div class="retire-status"><span class="pill ${ok ? 'pill-good' : 'pill-bad'}">${ok ? 'On track' : 'Short'}</span>
      <h3>${ok ? `Ready to retire in ${date}` : `${money(c.shortfall)} short by ${date}`}</h3></div>
    ${agesTable(c)}
    <h4 class="calc-h">How the target is worked out</h4>
    <p class="method">${r.hasPension ? 'Income-gap method: (spending − guaranteed income) ÷ withdrawal rate' : `25× rule: yearly spending × ${t.multiple.toFixed(t.multiple % 1 ? 1 : 0)} (a ${r.withdrawalPct}% safe withdrawal rate)`}</p>
    <ol class="calc">${steps}</ol>
    ${advice}
    ${warn.length ? `<ul class="warnings">${warn.map((w) => `<li><span class="warn-icon" aria-hidden="true">!</span>${w}</li>`).join('')}</ul>` : ''}`;
}

function drawRetireChart() {
  const el = $('#retire-chart');
  if (!lastRetire || !el.clientWidth) return;
  renderRetirementChart(el, lastRetire, state.retirement, state.assumptions.inflationPct, state.people);
}

/** Retirement date and, if it happens, the month savings run out (for the main timeline). */
function retirementMarks(result) {
  const rm = householdRetireMonth();
  if (rm <= 0) return null;
  const out = result.points.find((p) => p.month >= rm && p.balance < 0);
  return { month: rm, runsOut: out ? out.month : null };
}
const ageLine = (m) => state.people.map((p) => `${esc(p.name)} ${Math.floor((p.age || 0) + m / 12)}`).join(', ');

function drawChart() {
  if (!lastRun) return;
  const el = $('#chart');
  if (!lastRun.built.length) {
    el.innerHTML = '<p class="empty">Your timeline appears here once you add a goal.</p>';
    return;
  }
  if (!el.clientWidth) return; // hidden tab; drawn when shown
  renderTimeline(el, lastRun.result, lastRun.built, { payChanges: payChanges(), retirement: retirementMarks(lastRun.result) });
}
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { drawChart(); drawRetireChart(); }, 120); });

function strip(built, result) {
  if (!built.length) return '<span class="strip-empty">No goals yet</span>';
  return `<a class="strip-link" href="#plan">Your plan</a>` + built.map((g, i) => {
    const r = result.goals[i];
    return `<a class="strip-chip" href="#plan" style="--goal: var(--series-${g.slot + 1})"><span class="swatch"></span>${esc(g.name)} <strong>${r.reached ? monthYear(r.date) : 'out of reach'}</strong></a>`;
  }).join('') + (lastRetire ? `<a class="strip-chip" href="#retirement">Retirement <strong>${lastRetire.shortfall <= 0 ? 'on track' : `short ${money(lastRetire.shortfall)}`}</strong></a>` : '');
}

function headline(result) {
  const goals = result.goals;
  const many = state.people.length > 1;
  const eyebrow = `<span class="eyebrow">${ICONS.clock} Your plan${many ? ` · ${state.people.length} people` : ''}</span>`;
  if (!goals.length) return `<div class="hero">${eyebrow}<h2>Add a goal to start</h2><p><a class="hero-link" href="#goals">Go to Goals →</a></p></div>`;
  const missing = goals.filter((g) => !g.reached);
  if (missing.length === goals.length) return `<div class="hero">${eyebrow}<h2>None of these goals fit the budget yet</h2><p>${esc(missing[0].reason)}</p></div>`;
  const reached = goals.filter((g) => g.reached);
  const lastBuy = Math.max(...reached.map((g) => g.month));
  const debtFree = Math.max(...reached.map((g) => g.ownedOutrightMonth));
  const when = monthYear(result.goals.find((g) => g.month === lastBuy).date);
  const interns = state.people.filter((p) => p.status !== 'permanent' && monthsUntil(startDate(), p.changeAt) > 0);
  const poss = (n) => (n.toLowerCase() === 'you' ? 'your' : `${n}’s`);
  const note = interns.length ? `Includes ${esc(interns.map((p) => poss(p.name)).join(' and '))} pay rise when the new job starts.` : '';
  const title = missing.length
    ? `${goals.length - missing.length} of ${goals.length} goals are within reach`
    : `${many ? 'Together you can have' : 'You can have'} ${goals.length > 1 ? 'all of it' : 'it'} in <span class="hl">${duration(lastBuy)}</span>`;
  const sub = missing.length
    ? `${esc(missing.map((g) => g.name).join(', '))} ${missing.length > 1 ? 'are' : 'is'} out of reach with these numbers.`
    : note;
  const stats = [
    { label: missing.length ? 'Reachable goals by' : 'Every goal by', value: when, sub: `in ${duration(lastBuy)}` },
    debtFree > lastBuy ? { label: 'Loan-free', value: monthYear(addMonths(startDate(), debtFree)), sub: `in ${duration(debtFree)}` } : { label: 'Loans', value: 'None', sub: 'Paid in cash' },
    lastRetire ? {
      label: 'Retirement',
      value: lastRetire.shortfall <= 0 ? 'On track' : 'Short',
      sub: lastRetire.earliestMonth != null
        ? `at this rate, age ${Math.floor((state.people[0].age || 0) + lastRetire.earliestMonth / 12)}${many ? ` (${esc(state.people[0].name)})` : ''}`
        : 'not reached yet',
      tone: lastRetire.shortfall <= 0 ? 'good' : 'bad', href: '#retirement',
    } : null,
  ].filter(Boolean);
  return `<div class="hero">
    <div class="hero-main">${eyebrow}<h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
    <div class="hero-stats">${stats.map((st) => `<${st.href ? `a href="${st.href}"` : 'div'} class="stat${st.tone ? ` stat-${st.tone}` : ''}">
      <span class="stat-label">${st.label}</span><b class="stat-value">${st.value}</b><span class="stat-sub">${st.sub}</span></${st.href ? 'a' : 'div'}>`).join('')}</div>
  </div>`;
}

function shareText(r) {
  const ids = Object.keys(r.shares || {});
  if (state.people.length < 2) return '';
  if (ids.length === 1) return `Only ${esc(personName(ids[0]) ?? '')}`;
  return ids.map((id) => `${esc(personName(id) ?? '')} ${Math.round(r.shares[id] * 100)}%`).join(' · ');
}

function tile(g, r, base) {
  const style = `style="--goal: var(--series-${g.slot + 1})"`;
  if (!r.reached) {
    return `<article class="tile out" ${style}>
      <div class="tile-head"><span class="goal-icon">${goalIcon(g.kind)}</span><span class="tile-name">${esc(g.name)}</span><span class="pill pill-bad">Out of reach</span></div>
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
       <dt>Fully yours</dt><dd>${monthYear(addMonths(r.date, p.months))}</dd>`
    : '';
  const running = Math.abs(r.runningAtPurchase) > 1
    ? `<dt>${r.runningAtPurchase < 0 ? 'Monthly change' : 'Running costs'}</dt><dd>${r.runningAtPurchase < 0 ? '' : '+'}${money(r.runningAtPurchase, { short: true })} a month</dd>`
    : '';
  const ongoing = p.principal > 0 || Math.abs(r.runningAtPurchase) > 1;
  const share = Object.keys(r.shares || {}).length > 1 && !ongoing ? 'Together, from savings' : shareText(r);
  const who = share ? `<dt>${Object.keys(r.shares).length > 1 && ongoing ? 'Monthly split' : 'Paid by'}</dt><dd>${share}</dd>` : '';
  const capped = p.limitedByIncome
    ? `<p class="tile-note">The loan is capped by pay (instalments ≤ ${state.assumptions.maxDebtToIncomePct}%), so a bigger down payment is saved first.</p>`
    : '';
  return `<article class="tile" ${style}>
    <div class="tile-head"><span class="goal-icon">${goalIcon(g.kind)}</span><span class="tile-name">${esc(g.name)}</span>${delta}</div>
    <div class="tile-big">${r.month === 0 ? 'Now' : `in ${duration(r.month)}`}</div>
    <div class="tile-date">${monthYear(r.date)}${r.savingMonths && r.savingFrom ? ` · after ${duration(r.savingMonths)} saving for it` : ''}</div>
    <dl>
      <dt>Price then</dt><dd>${money(p.total)}<span class="sub">${money(r.priced.today)} today</span></dd>
      <dt>${p.principal > 0 ? 'Cash paid' : 'Paid'}</dt><dd>${money(r.cashPaid)}</dd>
      ${loan}${running}${who}
    </dl>${capped}
  </article>`;
}

function whatIfText(built, result, base) {
  if (!base) return 'Move the slider to see how saving more, or less, changes every goal.';
  return built.map((g, i) => {
    const a = base.goals[i], b = result.goals[i];
    if (!b.reached) return `${esc(g.name)}: still out of reach`;
    if (!a.reached) return `${esc(g.name)}: now reachable, ${monthYear(b.date)}`;
    const d = a.month - b.month;
    return `${esc(g.name)}: ${d === 0 ? 'no change' : `${duration(Math.abs(d))} ${d > 0 ? 'sooner' : 'later'}`}`;
  }).join(' · ');
}

function treeHtml(n, depth = 0) {
  const qty = qtyLabel(n.qty, n.unit);
  const meta = [qty && `<span class="qty">${esc(qty)}</span>`, n.note && `<span class="note">${esc(n.note)}</span>`].filter(Boolean).join('');
  const row = `<span class="name">${esc(n.label)}${meta ? `<span class="meta">${meta}</span>` : ''}</span><span class="num">${money(n.today)}</span><span class="num then">${money(n.total)}</span>`;
  if (!n.children.length) return `<div class="row d${depth}">${row}</div>`;
  return `<details class="branch d${depth}" ${depth < 1 ? 'open' : ''}><summary class="row d${depth}">${row}</summary>${n.children.map((c) => treeHtml(c, depth + 1)).join('')}</details>`;
}

function breakdown(g, r) {
  const when = r.reached ? monthYear(r.date) : 'at end of plan';
  const running = g.running ? evaluate(g.running) : null;
  return `<section class="card breakdown" style="--goal: var(--series-${g.slot + 1})">
    <h3><span class="goal-icon">${goalIcon(g.kind)}</span>${esc(g.name)}: what it costs</h3>
    ${g.warnings.length ? `<ul class="warnings">${g.warnings.map((w) => `<li><span class="warn-icon" aria-hidden="true">!</span>${esc(w)}</li>`).join('')}</ul>` : ''}
    <div class="tree">
      <div class="row head"><span class="name">Item</span><span class="num">Today</span><span class="num then">${esc(r.reached ? `In ${when}` : 'At end of plan')}</span></div>
      ${treeHtml(r.priced)}
    </div>
    ${running ? `<h4>Every month after you get it</h4><div class="tree small">
      <div class="row head"><span class="name">Item</span><span class="num">Today</span></div>
      ${running.children.map((c) => treeHtml(c, 1)).join('')}
      <div class="row total"><span class="name">Net change to the monthly budget</span><span class="num">${money(running.today)}</span></div>
    </div>` : ''}
  </section>`;
}

// ---------- Start ----------
const [asY, asM] = PRICES.meta.asOf.split('-').map(Number);
$('#asof').textContent = `Prices in Sri Lankan rupees, as of ${monthYear(new Date(asY, asM - 1, 1))}. ${PRICES.meta.disclaimer}`;
renderLoanChoice();
renderPeople();
renderGoals();
renderResults();
showTab();
startVisitCounter($('#visits'));
$('#tour-btn').addEventListener('click', startTour);
if (!hasSeenTour()) setTimeout(startTour, 300);
initThemeSwitch($('#theme-switch'));
