/** Loan maths (reducing-balance, monthly instalments). */

/** Monthly instalment (EMI) for a principal at an annual rate over n months. */
export function emi(principal, annualRatePct, months) {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 1200;
  if (r === 0) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

/** The largest principal a given monthly instalment can repay. */
export function maxPrincipal(monthlyPayment, annualRatePct, months) {
  if (monthlyPayment <= 0 || months <= 0) return 0;
  const r = annualRatePct / 1200;
  if (r === 0) return monthlyPayment * months;
  return (monthlyPayment * (1 - Math.pow(1 + r, -months))) / r;
}

export function loanSummary(principal, annualRatePct, months) {
  const payment = emi(principal, annualRatePct, months);
  const totalPaid = payment * months;
  return { principal, ratePct: annualRatePct, months, emi: payment, totalPaid, totalInterest: totalPaid - principal };
}
