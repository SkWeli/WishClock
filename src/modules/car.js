import { PRICES } from '../data/prices.js';
import { item, group } from '../engine/costTree.js';

const C = PRICES.car;

/** Value of a used car as a share of today's brand-new price. */
export function usedValueFactor(ageYears, mileageKm) {
  const age = Math.max(0, ageYears);
  let f = age === 0 ? 1 : (1 - C.depreciationFirstYearPct / 100) * Math.pow(1 - C.depreciationPerYearPct / 100, age - 1);
  const expectedKm = age * C.expectedKmPerYear;
  const extraKm = mileageKm - expectedKm;
  // High mileage costs value; low mileage earns back up to 5%.
  const adj = (-extraKm / 10_000) * (C.mileagePenaltyPer10kKmPct / 100);
  f *= 1 + Math.max(-0.3, Math.min(0.05, adj));
  return f;
}

export const car = {
  kind: 'car',
  label: 'Car',
  verb: 'Buy',
  fields: [
    { key: 'carClass', label: 'Type of car', type: 'select', group: 'The car', options: Object.entries(C.classes).map(([value, c]) => ({ value, label: c.label })) },
    { key: 'condition', label: 'Condition', type: 'select', group: 'The car', options: [
      { value: 'new', label: 'Brand new' }, { value: 'used', label: 'Used (registered)' },
    ] },
    { key: 'ageYears', label: 'Age', type: 'number', suffix: 'years', min: 1, max: 25, step: 1, group: 'The car', showIf: (o) => o.condition === 'used' },
    { key: 'mileageKm', label: 'Mileage', type: 'number', suffix: 'km', min: 0, max: 400_000, step: 5_000, group: 'The car', showIf: (o) => o.condition === 'used' },
    { key: 'kmPerMonth', label: 'You drive', type: 'number', suffix: 'km a month', min: 100, max: 8_000, step: 100, group: 'The car' },

    { key: 'financing', label: 'Pay with', type: 'select', group: 'Paying for it', options: [
      { value: 'loan', label: 'Leasing' }, { value: 'cash', label: 'Cash only, no loan' },
    ] },
    { key: 'downPct', label: 'Down payment', type: 'number', suffix: '%', min: 10, max: 90, step: 5, group: 'Paying for it', showIf: (o) => o.financing === 'loan', help: 'Leasing limits mean you often pay 40–50% upfront' },
    { key: 'ratePct', label: 'Leasing interest', type: 'number', suffix: '% a year', min: 5, max: 30, step: 0.25, group: 'Paying for it', showIf: (o) => o.financing === 'loan' },
    { key: 'years', label: 'Lease term', type: 'number', suffix: 'years', min: 1, max: 7, step: 1, group: 'Paying for it', showIf: (o) => o.financing === 'loan' },
  ],

  defaults() {
    return { carClass: 'compactSuv', condition: 'new', ageYears: 6, mileageKm: 70_000, kmPerMonth: 1_200, financing: 'loan', downPct: 50, ratePct: 14, years: 5 };
  },

  presets: {
    'First car (used)': { carClass: 'kei', condition: 'used', ageYears: 8, mileageKm: 90_000, financing: 'cash' },
    'New compact SUV': { carClass: 'compactSuv', condition: 'new', financing: 'loan', downPct: 50 },
    'Hybrid for long drives': { carClass: 'compactHybrid', condition: 'used', ageYears: 4, mileageKm: 50_000, kmPerMonth: 2_500 },
    'Big 4x4': { carClass: 'luxurySuv', condition: 'new', financing: 'loan', downPct: 50 },
  },

  build(o) {
    const cls = C.classes[o.carClass] ?? C.classes.compactSuv;
    const used = o.condition === 'used';
    const warnings = [];
    const factor = used ? usedValueFactor(o.ageYears, o.mileageKm) : 1;
    const price = cls.newPrice * factor;

    if (used && o.ageYears > 15) warnings.push('Cars over 15 years old are hard to lease and cost more to keep running.');
    if (used && o.mileageKm > o.ageYears * 25_000) warnings.push('That mileage is very high for the age. Get an inspection before buying.');

    const tree = group(`${used ? 'Used' : 'New'} ${cls.label}`, [
      item(used ? `${o.ageYears}-year-old car, ${Math.round(o.mileageKm / 1000)}k km` : 'Brand-new car', 1, price, {
        financeable: true,
        note: used ? `${Math.round(factor * 100)}% of the new price` : undefined,
      }),
      item(used ? 'Transfer & registration' : 'Registration & number plate', 1, price * (C.registrationPct[o.condition] / 100)),
      item('First-year comprehensive insurance', 1, price * (C.insurancePctPerYear / 100)),
      item('Accessories (tint, mats, alarm)', 1, C.accessories[o.condition]),
      used ? item('Pre-purchase inspection', 1, C.inspection) : null,
    ], { growthPct: C.growthPct });

    // Running costs per month. Older cars need more upkeep.
    const ageFactor = used ? 1 + Math.min(1, o.ageYears * 0.05) : 1;
    const running = group('Monthly running costs', [
      item('Fuel', o.kmPerMonth / cls.kmPerLitre, C.fuelPerLitre, { unit: 'litre', note: `${cls.kmPerLitre} km per litre, Petrol 92` }),
      item('Servicing', (o.kmPerMonth / 5_000) * ageFactor, cls.servicePer5000km, { unit: 'service', note: 'One service every 5,000 km' }),
      item('Tyres', o.kmPerMonth / 40_000, cls.tyreSet, { unit: 'set', note: 'A set every 40,000 km' }),
      item('Insurance', 1, (price * C.insurancePctPerYear) / 100 / 12),
      item('Revenue licence', 1, C.revenueLicencePerYear / 12),
    ]);

    return {
      tree,
      running,
      financing: o.financing === 'loan'
        ? { type: 'loan', label: 'Leasing', downPct: o.downPct, ratePct: o.ratePct, years: o.years }
        : { type: 'cash' },
      warnings,
    };
  },
};
