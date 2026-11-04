/**
 * Month-by-month simulation for a household of one or more people.
 *
 * Each person has their own pay, living costs and savings pot. Pay can change
 * once: an intern on a low allowance becomes permanent, or a student starts
 * working. Yearly raises start counting from the permanent salary.
 *
 * Each month:
 *   1. If the people paying for the next goal have enough saved between them
 *      (at that month's price), buy it. Cash comes out of their pots; any loan
 *      instalments and running costs are split between them by income.
 *   2. Every person adds their pay, subtracts their living costs (rising with
 *      inflation), their share of loan instalments and running costs, and
 *      earns interest on their savings.
 *
 * Goals are bought in the order given. Loans are capped so the payers' total
 * instalments stay within the debt-to-income limit banks apply.
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
 * A person's take-home pay in month m.
 * person: { status: 'permanent' | 'intern' | 'student', pay, payAfter, changeMonth }
 *   pay        — what they earn now (allowance for interns/students)
 *   payAfter   — expected pay once permanent / working
 *   changeMonth — months from now when that happens
 */
export function incomeAt(person, m, salaryGrowthPct) {
  const g = salaryGrowthPct / 100;
  if (person.retireMonth != null && m >= person.retireMonth) return 0;
  if (person.status === 'permanent' || person.status == null || person.changeMonth == null) {
    return (person.pay || 0) * Math.pow(1 + g, Math.floor(m / 12));
  }
  const change = Math.max(0, person.changeMonth);
  if (m < change) return person.pay || 0; // allowances rarely get raises
  return (person.payAfter || 0) * Math.pow(1 + g, Math.floor((m - change) / 12));
}

/** Living costs in month m, in today's rupees (before inflation). */
export function expensesAt(person, m) {
  const changes = person.status && person.status !== 'permanent' && person.changeMonth != null;
  if (changes && m >= Math.max(0, person.changeMonth) && person.expensesAfter != null) return person.expensesAfter;
  return person.expenses || 0;
}

/** Accept the old single-person profile shape too. */
export function normalizeHousehold(h) {
  if (Array.isArray(h.people) && h.people.length) return h;
  return {
    ...h,
    people: [{ id: 'p1', name: 'You', status: 'permanent', pay: h.monthlyIncome || 0, expenses: h.monthlyExpenses || 0, savings: h.startingSavings || 0 }],
  };
}

/**
 * @param {object} household
 *   people: [{ id, name, status, pay, payAfter, changeMonth, expenses, savings }]
 *   salaryGrowthPct, inflationPct, savingsReturnPct, maxDebtToIncomePct, extraMonthlySaving
 * @param {Array} goals [{ id, name, tree, running, financing, payer: 'all' | personId }]
 * @param {object} options { maxYears, startDate }
 */
export function simulate(household, goals, options = {}) {
  const untilMonth = options.untilMonth ?? 0;
  const h = normalizeHousehold(household);
  const untilYears = Math.ceil((options.untilMonth ?? 0) / 12) + 1;
  const maxYears = Math.max(options.maxYears ?? DEFAULT_OPTIONS.maxYears, untilYears);
  // Optional retirement phase: { month, monthlySpending, monthlyIncome, lumpSum } in today's rupees.
  const R = household.retirement && household.retirement.month > 0 ? household.retirement : null;
  const startDate = options.startDate ? new Date(options.startDate) : new Date();
  const maxMonths = maxYears * 12;
  const people = h.people;
  const n = people.length;
  const inf = h.inflationPct / 100;
  const monthlyReturn = h.savingsReturnPct / 1200;
  const extra = h.extraMonthlySaving || 0;
  const dti = h.maxDebtToIncomePct ?? 40;
  const index = new Map(people.map((p, i) => [p.id, i]));
  const everyone = people.map((_, i) => i);
  const payersOf = (g) => (g.payer && g.payer !== 'all' && index.has(g.payer) ? [index.get(g.payer)] : everyone);

  const bal = people.map((p) => p.savings || 0);
  const loans = []; // { goalId, emi, shares[], start, end }
  const running = []; // { goalId, shares[] } in today's rupees
  const points = [];
  const results = goals.map((g) => ({ id: g.id, name: g.name, reached: false, savingFrom: null, payers: payersOf(g).map((i) => people[i].id) }));

  let next = 0;
  let savingFrom = 0;
  let lastEvent = 0;
  let lastSurplus = people.map(() => 0);
  let m = 0;

  for (; m <= maxMonths; m++) {
    const incomes = people.map((p) => incomeAt(p, m, h.salaryGrowthPct));
    const inflation = Math.pow(1 + inf, m / 12);
    const retired = R && m >= R.month;
    if (R && m === R.month) people.forEach((_, i) => { bal[i] += ((R.lumpSum || 0) * inflation) / n; });
    const reserve = people.map((p) => (p.buffer || 0) * inflation);
    const emiOf = (i) => loans.reduce((s, l) => s + (m >= l.start && m < l.end ? l.shares[i] : 0), 0);

    // 1. Buy whatever is affordable at the start of this month.
    while (next < goals.length) {
      const g = goals[next];
      const ps = payersOf(g);
      const priced = evaluate(g.tree, { months: m, growthPct: h.inflationPct });
      const payIncome = ps.reduce((s, i) => s + incomes[i], 0);
      const existing = ps.reduce((s, i) => s + emiOf(i), 0);
      const plan = purchasePlan(priced, g.financing, { income: payIncome, existingEmi: existing, maxDebtToIncomePct: dti });
      // Emergency money is never spent: only savings above each person's buffer count.
      const available = ps.map((i) => Math.max(0, bal[i] - reserve[i]));
      const pot = available.reduce((a, b) => a + b, 0);
      if (pot < plan.cashNeeded || plan.cashNeeded < 0) break;

      // Cash comes out of each payer's spare savings in proportion to how much they have.
      ps.forEach((i, k) => { bal[i] -= plan.cashNeeded * (pot > 0 ? available[k] / pot : 1 / ps.length); });

      // Ongoing costs are split by income.
      const weights = ps.map((i) => (payIncome > 0 ? incomes[i] / payIncome : 1 / ps.length));
      const split = (amount) => { const a = new Array(n).fill(0); ps.forEach((i, k) => { a[i] = amount * weights[k]; }); return a; };
      if (plan.principal > 0) loans.push({ goalId: g.id, emi: plan.emi, shares: split(plan.emi), start: m, end: m + plan.months });
      const runningToday = g.running ? evaluate(g.running).today : 0;
      running.push({ goalId: g.id, shares: split(runningToday) });

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
        shares: Object.fromEntries(ps.map((i, k) => [people[i].id, weights[k]])),
      });
      lastEvent = Math.max(lastEvent, m + (plan.principal > 0 ? plan.months : 0));
      savingFrom = m;
      next++;
    }

    // 2. This month's cash flow, person by person.
    let tIncome = 0, tExpenses = 0, tLoans = 0, tRunning = 0, tSurplus = 0, tInterest = 0;
    people.forEach((p, i) => {
      const expenses = retired ? ((R.monthlySpending || 0) * inflation) / n : expensesAt(p, m) * inflation;
      if (retired) incomes[i] += ((R.monthlyIncome || 0) * inflation) / n;
      const loanPay = emiOf(i);
      const run = running.reduce((s, r) => s + r.shares[i], 0) * inflation;
      const surplus = incomes[i] - expenses - loanPay - run + extra / n;
      const interest = bal[i] > 0 ? bal[i] * monthlyReturn : 0;
      bal[i] += interest + surplus;
      lastSurplus[i] = surplus;
      tIncome += incomes[i]; tExpenses += expenses; tLoans += loanPay; tRunning += run; tSurplus += surplus; tInterest += interest;
    });
    points.push({
      month: m,
      balance: bal.reduce((a, b) => a + b, 0),
      balances: [...bal],
      reserve: reserve.reduce((a, b) => a + b, 0),
      incomes,
      income: tIncome,
      expenses: tExpenses,
      loanPayments: tLoans,
      runningCosts: tRunning,
      surplus: tSurplus,
      interest: tInterest,
    });

    if (next >= goals.length && m >= lastEvent + 12 && m >= untilMonth) break;
  }

  // Explain any goal that was never reached.
  const last = points[points.length - 1];
  for (let i = next; i < goals.length; i++) {
    const g = goals[i];
    const ps = payersOf(g);
    const priced = evaluate(g.tree, { months: last.month, growthPct: h.inflationPct });
    const payerSurplus = ps.reduce((s, k) => s + lastSurplus[k], 0);
    Object.assign(results[i], {
      reached: false,
      savingFrom,
      priced,
      reason:
        i > next
          ? `Waits for “${goals[next].name}”, which is out of reach.`
          : payerSurplus <= 0
          ? `${ps.length > 1 ? 'Together, monthly costs' : 'Monthly costs'} exceed income, so savings never grow enough.`
          : `Prices grow faster than savings — not reachable within ${maxYears} years.`,
    });
  }

  return { startDate, points, goals: results, endMonth: last.month, people };
}

export function addMonths(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setMonth(d.getMonth() + n);
  return d;
}

/** Months from startDate's month to a 'YYYY-MM' string (negative if in the past). */
export function monthsUntil(startDate, ym) {
  if (!ym) return 0;
  const [y, mo] = String(ym).split('-').map(Number);
  return (y - startDate.getFullYear()) * 12 + (mo - 1 - startDate.getMonth());
}
