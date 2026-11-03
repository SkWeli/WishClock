/**
 * The cost tree: one structure for every goal.
 *
 * A node looks like:
 *   {
 *     label: 'Bedroom',
 *     qty: 3,              // multiplies everything below (default 1)
 *     unit: 'room',        // shown next to qty
 *     unitPrice: 0,        // today's price of one unit of this node itself
 *     growthPct: 5,        // yearly price change; inherited by children if unset
 *     financeable: true,   // can this part be paid with a loan? (inherited)
 *     note: 'why this number',
 *     children: [ ...nodes ]
 *   }
 *
 *   cost(node) = qty × (unitPrice + Σ cost(child))
 *
 * Combining goals is just putting trees under a new root.
 */

/** Small helper to build nodes without repeating key names. */
export function item(label, qty, unitPrice, extra = {}) {
  return { label, qty, unitPrice, ...extra };
}

export function group(label, children, extra = {}) {
  return { label, children: children.filter(Boolean), ...extra };
}

/**
 * Evaluate a tree at a point in the future.
 * @param {object} node
 * @param {{months?: number, growthPct?: number, financeable?: boolean}} ctx
 *   months: how far from today; growthPct: the rate used where a node sets none
 *   (normally general inflation).
 * @returns evaluated node with `total`, `today` and `financeableTotal`.
 */
export function evaluate(node, ctx = {}) {
  const months = ctx.months ?? 0;
  const growthPct = node.growthPct ?? ctx.growthPct ?? 0;
  const financeable = node.financeable ?? ctx.financeable ?? false;
  const factor = Math.pow(1 + growthPct / 100, months / 12);
  const qty = node.qty ?? 1;

  const children = (node.children || []).map((c) =>
    evaluate(c, { months, growthPct, financeable })
  );
  const ownUnit = (node.unitPrice || 0) * factor;
  const childSum = children.reduce((s, c) => s + c.total, 0);
  const childToday = children.reduce((s, c) => s + c.today, 0);
  const childFinanceable = children.reduce((s, c) => s + c.financeableTotal, 0);

  const total = qty * (ownUnit + childSum);
  const today = qty * ((node.unitPrice || 0) + childToday);
  const ownFinanceable = financeable ? ownUnit : 0;

  return {
    label: node.label,
    unit: node.unit,
    note: node.note,
    warn: node.warn,
    qty,
    unitPrice: ownUnit,
    growthPct,
    total,
    today,
    financeableTotal: qty * (ownFinanceable + childFinanceable),
    children,
  };
}

/** Total today's price of a tree (no growth). */
export const costToday = (node) => evaluate(node).today;

/** Flatten an evaluated tree into rows (for tables, CSV export, tests). */
export function flatten(evaluated, depth = 0, out = []) {
  out.push({ depth, ...evaluated, children: undefined, hasChildren: evaluated.children.length > 0 });
  evaluated.children.forEach((c) => flatten(c, depth + 1, out));
  return out;
}

/** Collect every `warn` message in a tree. */
export function collectWarnings(node, out = []) {
  if (node.warn) out.push(node.warn);
  (node.children || []).forEach((c) => collectWarnings(c, out));
  return out;
}

/** Drop nodes whose quantity is zero or that cost nothing, so breakdowns stay readable. */
export function prune(node) {
  if ((node.qty ?? 1) === 0) return null;
  const children = (node.children || []).map(prune).filter(Boolean);
  if (!node.unitPrice && node.children && children.length === 0) return null;
  if (!node.unitPrice && !node.children) return null;
  return { ...node, children: node.children ? children : undefined };
}
