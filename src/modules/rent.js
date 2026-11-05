import { PRICES } from '../data/prices.js';
import { item, group } from '../engine/costTree.js';

const R = PRICES.rent;
const LOC = PRICES.house.locations;

/** Estimated monthly rent from area, type, bedrooms and furnishing. */
export function estimateRent(o) {
  const base = R.perMonth2br[o.location] ?? R.perMonth2br.gampaha;
  const rent = base * (R.typeFactor[o.type] ?? 1) * (R.bedroomFactor[o.bedrooms] ?? 1) * (o.furnished ? R.furnishedFactor : 1);
  return Math.round(rent / 1000) * 1000;
}

export const rent = {
  kind: 'rent',
  label: 'Rent a place',
  defaultName: 'Rented apartment',
  verb: 'Move into',
  fields: [
    { key: 'type', label: 'Type of place', type: 'select', group: 'The place', options: [
      { value: 'annex', label: 'Annex / small unit' }, { value: 'apartment', label: 'Apartment' }, { value: 'house', label: 'House' },
    ] },
    { key: 'location', label: 'Area', type: 'select', group: 'The place', options: Object.entries(LOC).map(([value, l]) => ({ value, label: l.label })) },
    { key: 'bedrooms', label: 'Bedrooms', type: 'select', group: 'The place', options: [1, 2, 3, 4].map((n) => ({ value: n, label: `${n} bedroom${n > 1 ? 's' : ''}` })) },
    { key: 'furnished', label: 'Furnished', type: 'toggle', group: 'The place' },
    { key: 'rentOverride', label: 'Monthly rent you expect', type: 'money', min: 0, step: 5_000, group: 'The place',
      help: (o) => `Our estimate for this place: Rs ${estimateRent(o).toLocaleString('en-US')} a month. Leave at 0 to use it.` },

    { key: 'depositMonths', label: 'Refundable deposit', type: 'number', suffix: 'months of rent', min: 0, max: 24, step: 1, group: 'Moving in',
      help: 'Landlords usually ask 3–6 months. You get it back when you move out.' },
    { key: 'agent', label: 'Pay an agent (1 month’s rent)', type: 'toggle', group: 'Moving in' },
    { key: 'setup', label: 'Moving & setting up', type: 'money', min: 0, step: 10_000, group: 'Moving in',
      help: 'Transport, curtains, kitchen basics, small repairs.' },
    { key: 'bills', label: 'Extra bills a month', type: 'money', min: 0, step: 1_000, group: 'Moving in',
      help: 'Electricity, water, internet not already in your living costs.' },
  ],

  defaults() {
    return { type: 'apartment', location: 'gampaha', bedrooms: 2, furnished: false, rentOverride: 0, depositMonths: R.depositMonths, agent: false, setup: R.moving + R.setup, bills: R.billsPerMonth };
  },

  presets: {
    'Small annex': { type: 'annex', location: 'gampaha', bedrooms: 1, furnished: false, depositMonths: 3, setup: 100_000 },
    'Apartment in the suburbs': { type: 'apartment', location: 'colombo_suburbs', bedrooms: 2, furnished: false, depositMonths: 6 },
    'Family house': { type: 'house', location: 'gampaha', bedrooms: 3, furnished: false, depositMonths: 6 },
    'Furnished in Colombo': { type: 'apartment', location: 'colombo_city', bedrooms: 2, furnished: true, depositMonths: 3, agent: true },
  },

  build(o) {
    const monthly = o.rentOverride > 0 ? o.rentOverride : estimateRent(o);
    const typeLabel = { annex: 'Annex', apartment: 'Apartment', house: 'House' }[o.type] || 'Place';
    const where = (LOC[o.location] ?? LOC.gampaha).label;
    const warnings = [];
    if (o.depositMonths > 6) warnings.push(`${o.depositMonths} months’ deposit is a lot of money tied up. Many landlords accept 3–6.`);
    const deposit = monthly * o.depositMonths;
    const tree = group(`${typeLabel} in ${where}`, [
      item('Refundable deposit', o.depositMonths, monthly, { unit: 'month', note: 'Paid back when you move out' }),
      item('First month’s rent', R.advanceMonths, monthly, { unit: 'month' }),
      item('Agent’s fee', o.agent ? R.agentMonths : 0, monthly, { unit: 'month' }),
      item('Moving & setting up', o.setup ? 1 : 0, o.setup),
    ]);
    const running = group('Monthly running costs', [
      item(`Rent${o.rentOverride > 0 ? '' : ' (estimate)'}`, 1, monthly, { note: `${o.bedrooms}-bedroom ${typeLabel.toLowerCase()}${o.furnished ? ', furnished' : ''}` }),
      item('Extra bills', o.bills ? 1 : 0, o.bills),
    ]);
    return { tree, running, financing: { type: 'cash' }, warnings, refundToday: deposit };
  },
};
