import { test } from 'node:test';
import assert from 'node:assert/strict';
import { item } from '../src/engine/costTree.js';
import { simulate, incomeAt, monthsUntil } from '../src/engine/simulate.js';

const start = new Date(2026, 10, 1);
const base = { salaryGrowthPct: 0, inflationPct: 0, savingsReturnPct: 0, maxDebtToIncomePct: 40 };
const cash = (id, price, extra = {}) => ({ id, name: id, tree: item(id, 1, price), financing: { type: 'cash' }, ...extra });

test('intern pay stays flat, then switches to permanent pay with raises from that date', () => {
  const p = { status: 'intern', pay: 40_000, payAfter: 150_000, changeMonth: 8 };
  assert.equal(incomeAt(p, 0, 10), 40_000);
  assert.equal(incomeAt(p, 7, 10), 40_000);
  assert.equal(incomeAt(p, 8, 10), 150_000);
  assert.equal(incomeAt(p, 19, 10), 150_000);
  assert.equal(incomeAt(p, 20, 10), 165_000);
});

test('monthsUntil counts calendar months from the start month', () => {
  assert.equal(monthsUntil(start, '2027-06'), 7);
  assert.equal(monthsUntil(start, '2026-01'), -10);
});

test('an intern reaches a goal far later than the first-month pay suggests, but sooner than never', () => {
  const intern = { ...base, people: [{ id: 'a', status: 'intern', pay: 40_000, payAfter: 140_000, changeMonth: 12, expenses: 40_000, savings: 0 }] };
  const r = simulate(intern, [cash('car', 1_000_000)], { startDate: start });
  // Saves nothing for 12 months, then 100k a month → 10 more months.
  assert.equal(r.goals[0].month, 22);
});

test('two people pool savings for a shared goal', () => {
  const hh = { ...base, people: [
    { id: 'a', pay: 100_000, expenses: 50_000, savings: 0 },
    { id: 'b', pay: 100_000, expenses: 50_000, savings: 0 },
  ] };
  const r = simulate(hh, [cash('house', 1_000_000)], { startDate: start });
  assert.equal(r.goals[0].month, 10); // 100k a month together
  const solo = simulate(hh, [cash('house', 1_000_000, { payer: 'a' })], { startDate: start });
  assert.equal(solo.goals[0].month, 20); // only a's 50k a month
});

test('cash is taken from each payer in proportion to their savings; instalments split by income', () => {
  const hh = { ...base, maxDebtToIncomePct: 100, people: [
    { id: 'a', pay: 300_000, expenses: 0, savings: 300_000 },
    { id: 'b', pay: 100_000, expenses: 0, savings: 100_000 },
  ] };
  const goal = { id: 'h', name: 'h', tree: item('h', 1, 2_000_000, { financeable: true }), financing: { type: 'loan', downPct: 20, ratePct: 0, years: 1 } };
  const r = simulate(hh, [goal], { startDate: start });
  assert.equal(r.goals[0].month, 0); // 400k down payment available now
  const p0 = r.points[0];
  assert.equal(p0.balances[0], 300_000 - 300_000 + 300_000 - 1_600_000 / 12 * 0.75);
  assert.ok(Math.abs(p0.loanPayments - 1_600_000 / 12) < 1e-6);
  assert.equal(r.goals[0].shares.a, 0.75);
});

test('a personal goal for someone who removed from the household falls back to everyone', () => {
  const hh = { ...base, people: [{ id: 'a', pay: 100_000, expenses: 50_000, savings: 0 }] };
  const r = simulate(hh, [cash('x', 500_000, { payer: 'ghost' })], { startDate: start });
  assert.equal(r.goals[0].month, 10);
});
