import { test } from 'node:test';
import assert from 'node:assert/strict';
import { item } from '../src/engine/costTree.js';
import { simulate } from '../src/engine/simulate.js';
import { retirementTarget, checkRetirement } from '../src/engine/retirement.js';

const start = new Date(2026, 10, 1);
const base = { salaryGrowthPct: 0, inflationPct: 0, savingsReturnPct: 0, maxDebtToIncomePct: 40 };

test('25× rule: 600,000 a year needs 15,000,000', () => {
  const t = retirementTarget({ annualExpenses: 600_000, withdrawalPct: 4 }, 0, 120);
  assert.equal(t.needed, 15_000_000);
  assert.equal(t.method, '25x');
});

test('income-gap method subtracts guaranteed income, then lump sums', () => {
  const t = retirementTarget({ annualExpenses: 600_000, hasPension: true, guaranteedIncome: 200_000, lumpSums: 2_000_000, withdrawalPct: 4 }, 0, 0);
  assert.equal(t.gap, 400_000);
  assert.equal(t.corpus, 10_000_000);
  assert.equal(t.needed, 8_000_000);
});

test('targets grow with inflation to the retirement date', () => {
  const t = retirementTarget({ annualExpenses: 100_000, withdrawalPct: 4 }, 10, 24);
  assert.ok(Math.abs(t.needed - 100_000 * 1.21 * 25) < 1e-6);
});

test('emergency money blocks a purchase that would dip into it', () => {
  const hh = { ...base, people: [{ id: 'a', pay: 100_000, expenses: 50_000, savings: 0, buffer: 200_000 }] };
  const r = simulate(hh, [{ id: 'x', name: 'x', tree: item('x', 1, 500_000), financing: { type: 'cash' } }], { startDate: start });
  assert.equal(r.goals[0].month, 14); // needs 700k saved, not 500k
  assert.equal(r.points[14].balance - 50_000, 200_000);
});

test('living costs switch when the intern goes permanent', () => {
  const hh = { ...base, people: [{ id: 'a', status: 'intern', pay: 50_000, payAfter: 150_000, changeMonth: 2, expenses: 20_000, expensesAfter: 80_000, savings: 0 }] };
  const r = simulate(hh, [], { startDate: start, untilMonth: 4 });
  assert.equal(r.points[1].expenses, 20_000);
  assert.equal(r.points[2].expenses, 80_000);
});

test('pay stops at retirement', () => {
  const hh = { ...base, people: [{ id: 'a', pay: 100_000, expenses: 0, savings: 0, retireMonth: 3 }] };
  const r = simulate(hh, [], { startDate: start, untilMonth: 5 });
  assert.equal(r.points[2].income, 100_000);
  assert.equal(r.points[3].income, 0);
});

test('retirement check finds the shortfall and the extra saving that closes it', () => {
  const hh = { ...base, people: [{ id: 'a', pay: 100_000, expenses: 60_000, savings: 0, retireMonth: 120 }] };
  const c = checkRetirement(hh, [], { annualExpenses: 240_000, withdrawalPct: 4 }, 120, { startDate: start });
  // needs 6,000,000; saves 40k × 120 = 4,800,000 → short 1,200,000 → 10,000 more a month
  assert.equal(Math.round(c.projected), 4_800_000);
  assert.equal(Math.round(c.shortfall), 1_200_000);
  assert.equal(c.extraNeeded, 10_000);
});

test('after retirement: pay stops, retirement spending and pension apply, lump sum arrives', () => {
  const hh = { ...base, retirement: { month: 2, monthlySpending: 30_000, monthlyIncome: 10_000, lumpSum: 500_000 },
    people: [{ id: 'a', pay: 100_000, expenses: 50_000, savings: 0, retireMonth: 2 }] };
  const r = simulate(hh, [], { startDate: start, untilMonth: 4 });
  assert.equal(r.points[1].balance, 100_000);
  assert.equal(r.points[2].income, 10_000);
  assert.equal(r.points[2].expenses, 30_000);
  assert.equal(r.points[2].balance, 100_000 + 500_000 - 20_000);
});

test('"at this rate" retirement can be later than planned', () => {
  const hh = { ...base, people: [{ id: 'a', pay: 100_000, expenses: 60_000, savings: 0, retireMonth: 120 }] };
  const c = checkRetirement(hh, [], { annualExpenses: 240_000, withdrawalPct: 4 }, 120, { startDate: start, computeExtra: false });
  // needs 6,000,000 at 40k a month → 150 months of saving
  assert.equal(c.earliestMonth, 150);
});

test('"at this rate" retirement can be earlier than planned', () => {
  const hh = { ...base, people: [{ id: 'a', pay: 100_000, expenses: 60_000, savings: 0, retireMonth: 240 }] };
  const c = checkRetirement(hh, [], { annualExpenses: 240_000, withdrawalPct: 4 }, 240, { startDate: start, computeExtra: false });
  assert.equal(c.earliestMonth, 150);
});
