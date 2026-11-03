/**
 * Month-by-month simulation.
 *
 * Each month:
 *   1. If enough cash is saved for the next goal (its price inflated to that
 *      month), buy it: pay cash or the down payment, start any loan, and add
 *      its running costs (fuel, maintenance…) to the monthly budget.
 *   2. Add income (raised once a year), subtract expenses (inflated monthly),
 *      loan instalments and running costs, then add interest on savings.
 *
 * Goals are bought in the order given. Loans are capped so total instalments
 * stay within the debt-to-income limit banks apply; if the loan would be too
 * big, the simulation keeps saving until the down payment covers the gap.
 */
import { evaluate } from './costTree.js';
import { emi, maxPrincipal } from './loan.js';

export const DEFAULT_OPTIONS = { maxYears: 50 };

/** Work out what buying a goal right now would take. */
export function purchasePlan(evaluated, financing, { income, existingEmi, maxDebtToIncomePct }) {
  const total = evaluated.total;
  const financeable = Math.min(evaluated.financeableTotal, total);
  if (!financing || financing.type !== 'loan') {
    return { total, cashNeeded: total, principal: 0, emi: 0, months: 0, limitedByIncome: false };
  }
  const months = Math.round(financing.years * 12);
  const wanted = financeable * (1 - financing.downPct / 100);
  const room = (maxDebtToIncomePct / 100) * income - existingEmi;
  const cap = Math.max(0, maxPrincipal(room, financing.ratePct, months));
  const principal = Math.max(0, Math.min(wanted, cap));
  return {
    total,
    cashNeeded: total - principal,
    principal,
    wantedPrincipal: wanted,
    emi: emi(principal, financing.ratePct, months),
    months,
    ratePct: financing.ratePct,
    limitedByIncome: principal < wanted - 1,
  };
}

/**
 * @param {object} profile
 *   monthlyIncome, monthlyExpenses, startingSavings, salaryGrowthPct,
 *   inflationPct, savingsReturnPct, maxDebtToIncomePct, extraMonthlySaving
 * @param {Array} goals  [{ id, name, tree, running, financing }]
 * @param {object} options { maxYears, startDate }
 */
export function simulate(profile, goals, options = {}) {
  const { maxYears } = { ...DEFAULT_OPTIONS, ...options };
  const startDate = options.startDate ? new Date(options.startDate) : new Date();
  const maxMonths = maxYears * 12;
  const inf = profile.inflationPct / 100;
  const salaryGrowth = profile.salaryGrowthPct / 100;
  const monthlyReturn = profile.savingsReturnPct / 1200;
  const extra = profile.extraMonthlySaving || 0;
  const dti = profile.maxDebtToIncomePct ?? 40;

  let balance = profile.startingSavings || 0;
  const loans = []; // { goalId, emi, start, end }
  const running = []; // { goalId, monthlyToday }
  const points = [];
  const results = goals.map((g) => ({
    id: g.id,
    name: g.name,
    reached: false,
    savingFrom: null,
  }));

  let next = 0;
  let savingFrom = 0;
  let lastEvent = 0;
  let m = 0;

  for (; m <= maxMonths; m++) {
    const income = profile.monthlyIncome * Math.pow(1 + salaryGrowth, Math.floor(m / 12));
    const inflation = Math.pow(1 + inf, m / 12);
    const expenses = profile.monthlyExpenses * inflation;
    const emiNow = () => loans.filter((l) => m >= l.start && m < l.end).reduce((s, l) => s + l.emi, 0);

    // 1. Buy whatever is affordable at the start of this month.
    while (next < goals.length) {
      const g = goals[next];
      const priced = evaluate(g.tree, { months: m, growthPct: profile.inflationPct });
      const plan = purchasePlan(priced, g.financing, { income, existingEmi: emiNow(), maxDebtToIncomePct: dti });
      if (balance < plan.cashNeeded) break;

      balance -= plan.cashNeeded;
      if (plan.principal > 0) loans.push({ goalId: g.id, emi: plan.emi, start: m, end: m + plan.months });
      const runningToday = g.running ? evaluate(g.running).today : 0;
      running.push({ goalId: g.id, monthlyToday: runningToday });

      Object.assign(results[next], {
        reached: true,
        month: m,
        date: addMonths(startDate, m),
        savingFrom,
        savingMonths: m - savingFrom,
        priced,
        plan,
        cashPaid: plan.cashNeeded,
        runningAtPurchase: runningToday * inflation,
        ownedOutrightMonth: m + (plan.principal > 0 ? plan.months : 0),
      });
      lastEvent = Math.max(lastEvent, m + (plan.principal > 0 ? plan.months : 0));
      savingFrom = m;
      next++;
    }

    // 2. This month's cash flow.
    const loanPayments = emiNow();
    const runningCosts = running.reduce((s, r) => s + r.monthlyToday, 0) * inflation;
    const surplus = income - expenses - loanPayments - runningCosts + extra;
    const interest = balance > 0 ? balance * monthlyReturn : 0;
    balance += interest + surplus;

    points.push({ month: m, balance, income, expenses, loanPayments, runningCosts, surplus, interest });

    const allDone = next >= goals.length;
    if (allDone && m >= Math.max(lastEvent, 0) + 12) break;
  }

  // Explain any goal that was never reached.
  const last = points[points.length - 1];
  for (let i = next; i < goals.length; i++) {
    const g = goals[i];
    const priced = evaluate(g.tree, { months: last.month, growthPct: profile.inflationPct });
    Object.assign(results[i], {
      reached: false,
      savingFrom,
      priced,
      reason:
        i > next
          ? `Waits for “${goals[next].name}”, which is out of reach.`
          : last.surplus <= 0
          ? 'Your monthly costs exceed your income, so savings never grow enough.'
          : `Prices grow faster than your savings — not reachable within ${maxYears} years.`,
    });
  }

  return { startDate, points, goals: results, endMonth: last.month };
}

export function addMonths(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setMonth(d.getMonth() + n);
  return d;
}
