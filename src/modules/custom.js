import { item, group } from '../engine/costTree.js';

/** A goal the user defines: what it costs today, how the price changes, and how it's paid. */
export const custom = {
  kind: 'custom',
  label: 'Custom goal',
  defaultName: 'My goal',
  verb: 'Reach',
  fields: [
    { key: 'price', label: 'Cost today', type: 'money', min: 0, step: 50_000, group: 'Your goal',
      help: 'What it would cost if you paid for it now.' },
    { key: 'growth', label: 'Price over time', type: 'select', group: 'Your goal', options: [
      { value: 'inflation', label: 'Rises with inflation' },
      { value: 'custom', label: 'Rises by a rate I choose' },
      { value: 'none', label: 'Stays the same' },
    ] },
    { key: 'growthPct', label: 'Price rise each year', type: 'number', suffix: '%', min: -20, max: 50, step: 0.5, group: 'Your goal', showIf: (o) => o.growth === 'custom',
      help: 'Electronics often get cheaper (0–2%); education and land rise faster (8–12%).' },
    { key: 'monthly', label: 'Ongoing cost a month after', type: 'money', min: 0, step: 1_000, group: 'Your goal',
      help: 'Fees, fuel, upkeep, subscriptions… Leave 0 if none.' },

    { key: 'financing', label: 'Pay with', type: 'select', group: 'Paying for it', options: [
      { value: 'cash', label: 'Cash only, no loan' }, { value: 'loan', label: 'A loan' },
    ] },
    { key: 'downPct', label: 'Down payment', type: 'number', suffix: '%', min: 0, max: 90, step: 5, group: 'Paying for it', showIf: (o) => o.financing === 'loan' },
    { key: 'ratePct', label: 'Loan interest', type: 'number', suffix: '% a year', min: 0, max: 35, step: 0.25, group: 'Paying for it', showIf: (o) => o.financing === 'loan' },
    { key: 'years', label: 'Loan term', type: 'number', suffix: 'years', min: 1, max: 30, step: 1, group: 'Paying for it', showIf: (o) => o.financing === 'loan' },
  ],

  defaults() {
    return { price: 1_000_000, growth: 'inflation', growthPct: 5, monthly: 0, financing: 'cash', downPct: 20, ratePct: 14, years: 5 };
  },

  // _name sets the goal's name when a preset is picked.
  presets: {
    'Trip abroad': { _name: 'Trip abroad', price: 900_000, growth: 'inflation', monthly: 0, financing: 'cash' },
    'Higher studies': { _name: 'Master’s degree', price: 3_500_000, growth: 'custom', growthPct: 9, monthly: 0, financing: 'loan', downPct: 20, ratePct: 13, years: 5 },
    'Motorbike': { _name: 'Motorbike', price: 1_200_000, growth: 'custom', growthPct: 4, monthly: 9_000, financing: 'cash' },
    'Start a business': { _name: 'My business', price: 5_000_000, growth: 'inflation', monthly: 0, financing: 'cash' },
  },

  build(o, goal = {}) {
    const name = goal.name || 'Your goal';
    const growthPct = o.growth === 'none' ? 0 : o.growth === 'custom' ? o.growthPct : undefined; // undefined → inflation
    const tree = group(name, [item(name, 1, o.price, { financeable: true, growthPct, note: o.growth === 'custom' ? `Rises ${o.growthPct}% a year` : o.growth === 'none' ? 'Price stays the same' : 'Rises with inflation' })]);
    const running = o.monthly ? group('Monthly running costs', [item('Ongoing cost', 1, o.monthly)]) : null;
    return {
      tree,
      running,
      financing: o.financing === 'loan' ? { type: 'loan', label: 'Loan', downPct: o.downPct, ratePct: o.ratePct, years: o.years } : { type: 'cash' },
      warnings: o.price <= 0 ? ['Set what this goal costs today.'] : [],
    };
  },
};
