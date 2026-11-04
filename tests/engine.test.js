import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, item, group, prune, flatten } from '../src/engine/costTree.js';
import { emi, maxPrincipal, loanSummary } from '../src/engine/loan.js';
import { simulate, purchasePlan } from '../src/engine/simulate.js';

const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

test('cost tree: qty multiplies everything below', () => {
  const bedroom = group('Bedroom', [item('Bed', 1, 100), item('Pillow', 2, 10)], { qty: 3 });
  const t = evaluate(group('House', [bedroom, item('Sofa', 5, 20)]));
  assert.equal(t.total, 3 * (100 + 20) + 100);
});

test('cost tree: growth compounds and is inherited, children can override', () => {
  const tree = group('Root', [item('A', 1, 1000), item('B', 1, 1000, { growthPct: 0 })], { growthPct: 10 });
  const t = evaluate(tree, { months: 24 });
  near(t.children[0].total, 1210, 0.001);
  assert.equal(t.children[1].total, 1000);
  assert.equal(t.today, 2000);
});

test('cost tree: nodes without growth follow the context rate (inflation)', () => {
  const t = evaluate(item('X', 1, 1000), { months: 12, growthPct: 5 });
  near(t.total, 1050, 0.001);
});

test('cost tree: financeable share is tracked and inherited', () => {
  const tree = group('Car', [item('Car', 1, 900, { financeable: true }), item('Insurance', 1, 100)]);
  const t = evaluate(tree);
  assert.equal(t.financeableTotal, 900);
  const g = evaluate(group('Build', [item('a', 2, 50)], { financeable: true }));
  assert.equal(g.financeableTotal, 100);
});

test('prune drops zero-quantity and empty nodes', () => {
  const p = prune(group('R', [item('zero', 0, 100), item('free', 3, 0), item('kept', 1, 5), group('empty', [item('z', 0, 1)])]));
  assert.deepEqual(flatten(evaluate(p)).map((r) => r.label), ['R', 'kept']);
});

test('loan: EMI matches the standard formula and round-trips', () => {
  // 10,000,000 at 12% for 10 years ≈ 143,471
  near(emi(10_000_000, 12, 120), 143_470.94, 0.1);
  near(maxPrincipal(emi(5_000_000, 13.5, 240), 13.5, 240), 5_000_000, 0.01);
  assert.equal(emi(1200, 0, 12), 100);
  const s = loanSummary(1_000_000, 12, 12);
  near(s.totalInterest, s.emi * 12 - 1_000_000, 0.001);
});

const profile = {
  monthlyIncome: 100_000, monthlyExpenses: 50_000, startingSavings: 0,
  salaryGrowthPct: 0, inflationPct: 0, savingsReturnPct: 0, maxDebtToIncomePct: 40,
};
const start = new Date(2026, 10, 1);

test('simulation: flat numbers give an exact month', () => {
  const r = simulate(profile, [{ id: 'a', name: 'TV', tree: item('TV', 1, 500_000), financing: { type: 'cash' } }], { startDate: start });
  assert.equal(r.goals[0].reached, true);
  assert.equal(r.goals[0].month, 10); // 50k saved per month, bought at the start of month 10
});

test('simulation: goals are sequential and running costs slow the next one', () => {
  const goals = [
    { id: 'car', name: 'Car', tree: item('Car', 1, 500_000), running: item('Fuel', 1, 25_000), financing: { type: 'cash' } },
    { id: 'tv', name: 'TV', tree: item('TV', 1, 250_000), financing: { type: 'cash' } },
  ];
  const r = simulate(profile, goals, { startDate: start });
  assert.equal(r.goals[0].month, 10);
  assert.equal(r.goals[1].month, 20); // 25k/month left after fuel → 10 more months
});

test('simulation: loan down payment, instalments, payoff month', () => {
  const goal = { id: 'h', name: 'House', tree: item('House', 1, 1_000_000, { financeable: true }), financing: { type: 'loan', downPct: 20, ratePct: 12, years: 1 } };
  const r = simulate({ ...profile, maxDebtToIncomePct: 100 }, [goal], { startDate: start });
  const g = r.goals[0];
  assert.equal(g.month, 4); // needs 200k down
  near(g.plan.principal, 800_000);
  assert.equal(g.ownedOutrightMonth, 16);
  near(r.points[5].loanPayments, emi(800_000, 12, 12), 0.01);
});

test('simulation: debt-to-income cap forces a bigger down payment', () => {
  const plan = purchasePlan(evaluate(item('H', 1, 10_000_000, { financeable: true })), { type: 'loan', downPct: 20, ratePct: 12, years: 10 }, { income: 100_000, existingEmi: 0, maxDebtToIncomePct: 40 });
  near(plan.emi, 40_000, 0.5);
  assert.ok(plan.limitedByIncome);
  assert.ok(plan.cashNeeded > 2_000_000);
});

test('simulation: unreachable goals are explained', () => {
  const r = simulate({ ...profile, monthlyExpenses: 120_000 }, [{ id: 'x', name: 'X', tree: item('X', 1, 1_000_000), financing: { type: 'cash' } }], { startDate: start, maxYears: 5 });
  assert.equal(r.goals[0].reached, false);
  assert.match(r.goals[0].reason, /exceed income/);
});
