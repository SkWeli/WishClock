/**
 * Retirement: how much you need saved on the day you stop working.
 *
 * No pension (25× rule):   corpus = yearly spending × 25   (a 4% safe withdrawal rate)
 * With guaranteed income:  corpus = (yearly spending − guaranteed yearly income) ÷ 4%
 * Lump sums you will receive anyway (EPF, ETF, gratuity) reduce what you must save.
 *
 * All inputs are in today's rupees; they are grown with inflation to the retirement date.
 */
import { simulate } from './simulate.js';

export function retirementTarget(r, inflationPct, months) {
  const factor = Math.pow(1 + inflationPct / 100, Math.max(0, months) / 12);
  const rate = (r.withdrawalPct || 4) / 100;
  const expensesThen = (r.annualExpenses || 0) * factor;
  const incomeThen = r.hasPension ? (r.guaranteedIncome || 0) * factor : 0;
  const gap = Math.max(0, expensesThen - incomeThen);
  const corpus = gap / rate;
  const lumps = (r.lumpSums || 0) * factor;
  const needed = Math.max(0, corpus - lumps);
  return {
    method: r.hasPension ? 'income-gap' : '25x',
    factor, rate, multiple: 1 / rate,
    expensesThen, incomeThen, gap, corpus, lumps, needed,
    neededToday: needed / factor,
  };
}

/** Savings you could use for retirement at the end of month m (emergency money excluded). */
export const usableAt = (result, m) => {
  const p = result.points[Math.min(m, result.points.length - 1)];
  return p ? p.balance - p.reserve : 0;
};

/**
 * Check the plan against the retirement target.
 * @returns { months, target, projected, shortfall, extraNeeded, earliestMonth, ... }
 */
export function checkRetirement(household, goals, retirement, retireMonth, options = {}) {
  const { computeExtra, ...simOptions } = options;
  const run = (extra) => simulate({ ...household, extraMonthlySaving: extra }, goals, { ...simOptions, untilMonth: retireMonth });
  const result = run(household.extraMonthlySaving || 0);
  const at = Math.max(0, retireMonth - 1); // end of the last working month
  const target = retirementTarget(retirement, household.inflationPct, retireMonth);
  const projected = usableAt(result, at);
  const shortfall = Math.max(0, target.needed - projected);

  // Extra monthly saving (on top of today's plan) that closes the gap.
  let extraNeeded = 0;
  if (shortfall > 0 && options.computeExtra !== false) {
    const base = household.extraMonthlySaving || 0;
    let lo = 0, hi = 50_000;
    while (usableAt(run(base + hi), at) < target.needed && hi < 1e9) hi *= 2;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (usableAt(run(base + mid), at) >= target.needed) hi = mid; else lo = mid;
    }
    extraNeeded = hi >= 1e9 ? Infinity : Math.ceil(hi / 1000 - 1e-4) * 1000;
  }

  // "At this rate": keep everyone working and find the first month (after every goal is bought)
  // when usable savings already cover the target for retiring that month. Can be earlier or later than planned.
  const horizon = options.horizonMonth ?? retireMonth + 360;
  const working = simulate(
    { ...household, retirement: null, people: household.people.map((p) => ({ ...p, retireMonth: null })) },
    goals,
    { ...simOptions, untilMonth: horizon }
  );
  const lastBuy = Math.max(0, ...working.goals.filter((g) => g.reached).map((g) => g.month));
  let earliestMonth = null;
  for (let m = lastBuy; m < Math.min(horizon, working.points.length); m++) {
    if (usableAt(working, m) >= retirementTarget(retirement, household.inflationPct, m + 1).needed) { earliestMonth = m + 1; break; }
  }

  const loansAfter = result.goals.filter((g) => g.reached && g.ownedOutrightMonth > retireMonth);
  const goalsAfter = result.goals.filter((g) => g.reached && g.month >= retireMonth);
  return { result, working, horizon, target, projected, shortfall, extraNeeded, earliestMonth, loansAfter, goalsAfter, retireMonth };
}
