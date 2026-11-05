import { PRICES } from '../data/prices.js';
import { item, group } from '../engine/costTree.js';

const C = PRICES.car;
const isEV = (o) => (C.classes[o.carClass] ?? {}).fuel === 'electric';

/** Value of a used car as a share of today's brand-new price. EVs lose value faster (battery ageing). */
export function usedValueFactor(ageYears, mileageKm, electric = false) {
  const age = Math.max(0, ageYears);
  const first = electric ? C.evDepreciationFirstYearPct : C.depreciationFirstYearPct;
  const yearly = electric ? C.evDepreciationPerYearPct : C.depreciationPerYearPct;
  let f = age === 0 ? 1 : (1 - first / 100) * Math.pow(1 - yearly / 100, age - 1);
  const extraKm = mileageKm - age * C.expectedKmPerYear;
  // High mileage costs value; low mileage earns back up to 5%.
  const adj = (-extraKm / 10_000) * (C.mileagePenaltyPer10kKmPct / 100);
  f *= 1 + Math.max(-0.3, Math.min(0.05, adj));
  return f;
}

/** Monthly electricity cost for an EV: blend of home and public charging, plus charging losses. */
export function chargingCost(o, cls) {
  const kwh = (o.kmPerMonth / cls.kmPerKWh) * (1 + C.chargingLossPct / 100);
  const e = C.electricity;
  const homeRate = o.homeCharging === 'night' ? e.homeNight : o.homeCharging === 'solar' ? e.solar : e.home;
  const pub = Math.max(0, Math.min(100, o.publicPct)) / 100;
  return { kwh, homeKwh: kwh * (1 - pub), publicKwh: kwh * pub, homeRate, publicRate: e.publicFast };
}

const classOptions = () => {
  const entries = Object.entries(C.classes);
  return [
    ...entries.filter(([, c]) => c.fuel !== 'electric').map(([value, c]) => ({ value, label: `⛽ ${c.label}` })),
    ...entries.filter(([, c]) => c.fuel === 'electric').map(([value, c]) => ({ value, label: `⚡ ${c.label}` })),
  ];
};

export const car = {
  kind: 'car',
  label: 'Car',
  verb: 'Buy',
  fields: [
    { key: 'carClass', label: 'Type of car', type: 'select', group: 'The car', options: classOptions() },
    { key: 'condition', label: 'Condition', type: 'select', group: 'The car', options: [
      { value: 'new', label: 'Brand new' }, { value: 'used', label: 'Used (registered)' },
    ] },
    { key: 'ageYears', label: 'Age', type: 'number', suffix: 'years', min: 1, max: 25, step: 1, group: 'The car', showIf: (o) => o.condition === 'used' },
    { key: 'mileageKm', label: 'Mileage', type: 'number', suffix: 'km', min: 0, max: 400_000, step: 5_000, group: 'The car', showIf: (o) => o.condition === 'used' },
    { key: 'kmPerMonth', label: 'You drive', type: 'number', suffix: 'km a month', min: 100, max: 8_000, step: 100, group: 'The car' },

    { key: 'homeCharging', label: 'Charging at home', type: 'select', group: 'Charging', showIf: isEV, options: [
      { value: 'normal', label: 'Normal home tariff' },
      { value: 'night', label: 'Overnight, time-of-use tariff' },
      { value: 'solar', label: 'Rooftop solar' },
    ], help: 'An EV usually pushes a home past 180 units a month, where electricity costs most.' },
    { key: 'publicPct', label: 'Charged at public fast chargers', type: 'number', suffix: '% of charging', min: 0, max: 100, step: 5, group: 'Charging', showIf: isEV,
      help: 'Fast chargers cost more per unit. Use 100% if you can’t charge at home.' },
    { key: 'homeCharger', label: 'Install a home wall charger', type: 'toggle', group: 'Charging', showIf: (o) => isEV(o) && o.publicPct < 100 },

    { key: 'financing', label: 'Pay with', type: 'select', group: 'Paying for it', options: [
      { value: 'loan', label: 'Leasing' }, { value: 'cash', label: 'Cash only, no loan' },
    ] },
    { key: 'downPct', label: 'Down payment', type: 'number', suffix: '%', min: 10, max: 90, step: 5, group: 'Paying for it', showIf: (o) => o.financing === 'loan', help: 'Leasing limits mean you often pay 40–50% upfront' },
    { key: 'ratePct', label: 'Leasing interest', type: 'number', suffix: '% a year', min: 5, max: 30, step: 0.25, group: 'Paying for it', showIf: (o) => o.financing === 'loan' },
    { key: 'years', label: 'Lease term', type: 'number', suffix: 'years', min: 1, max: 7, step: 1, group: 'Paying for it', showIf: (o) => o.financing === 'loan' },
  ],

  defaults() {
    return {
      carClass: 'compactSuv', condition: 'new', ageYears: 6, mileageKm: 70_000, kmPerMonth: 1_200,
      homeCharging: 'normal', publicPct: 10, homeCharger: true,
      financing: 'loan', downPct: 50, ratePct: 14, years: 5,
    };
  },

  presets: {
    'First car (used)': { carClass: 'kei', condition: 'used', ageYears: 8, mileageKm: 90_000, financing: 'cash' },
    'New compact SUV': { carClass: 'compactSuv', condition: 'new', financing: 'loan', downPct: 50 },
    'Hybrid for long drives': { carClass: 'compactHybrid', condition: 'used', ageYears: 4, mileageKm: 50_000, kmPerMonth: 2_500 },
    'Electric with solar': { carClass: 'evSmall', condition: 'new', homeCharging: 'solar', publicPct: 5, homeCharger: true, financing: 'loan', downPct: 50 },
    'Electric SUV': { carClass: 'evSuv', condition: 'new', homeCharging: 'normal', publicPct: 15, homeCharger: true, financing: 'loan', downPct: 50 },
    'Big 4x4': { carClass: 'luxurySuv', condition: 'new', financing: 'loan', downPct: 50 },
  },

  build(o) {
    const cls = C.classes[o.carClass] ?? C.classes.compactSuv;
    const ev = cls.fuel === 'electric';
    const used = o.condition === 'used';
    const warnings = [];
    const factor = used ? usedValueFactor(o.ageYears, o.mileageKm, ev) : 1;
    const price = cls.newPrice * factor;

    if (used && !ev && o.ageYears > 15) warnings.push('Cars over 15 years old are hard to lease and cost more to keep running.');
    if (used && o.mileageKm > o.ageYears * 25_000) warnings.push('That mileage is very high for the age. Get an inspection before buying.');
    if (ev && used && o.ageYears >= C.evBatteryWarnAge) warnings.push(`At ${o.ageYears} years old the battery may hold noticeably less charge. Check its health report: a replacement can cost a large part of the car’s value.`);
    if (ev && o.publicPct >= 100) warnings.push('Charging only at public fast chargers is the most expensive way to run an EV, and adds waiting time.');

    const tree = group(`${used ? 'Used' : 'New'} ${cls.label}`, [
      item(used ? `${o.ageYears}-year-old car, ${Math.round(o.mileageKm / 1000)}k km` : 'Brand-new car', 1, price, {
        financeable: true,
        note: used ? `${Math.round(factor * 100)}% of the new price${ev ? ' (EVs lose value faster as batteries age)' : ''}` : undefined,
      }),
      item(used ? 'Transfer & registration' : 'Registration & number plate', 1, price * (C.registrationPct[o.condition] / 100)),
      item('First-year comprehensive insurance', 1, price * (C.insurancePctPerYear / 100)),
      item('Accessories (tint, mats, alarm)', 1, C.accessories[o.condition]),
      ev && o.homeCharger && o.publicPct < 100 ? item('Home wall charger & wiring', 1, C.homeCharger, { growthPct: 2 }) : null,
      used ? item(ev ? 'Inspection & battery health check' : 'Pre-purchase inspection', 1, C.inspection * (ev ? 2 : 1)) : null,
    ], { growthPct: C.growthPct });

    // Running costs per month. Older cars need more upkeep.
    const ageFactor = used ? 1 + Math.min(1, o.ageYears * 0.05) : 1;
    let energy;
    if (ev) {
      const c = chargingCost(o, cls);
      const petrolEquivalent = (o.kmPerMonth / 20) * C.fuelPerLitre;
      energy = group('Charging', [
        item(`Electricity at home (${o.homeCharging === 'solar' ? 'solar' : o.homeCharging === 'night' ? 'night tariff' : 'normal tariff'})`, Math.round(c.homeKwh), c.homeRate, { unit: 'unit', note: `${cls.kmPerKWh} km per unit, incl. ${C.chargingLossPct}% charging loss` }),
        item('Public fast charging', Math.round(c.publicKwh), c.publicRate, { unit: 'unit' }),
      ], { note: `A similar petrol car would use about Rs ${Math.round(petrolEquivalent / 1000)}k of fuel` });
    } else {
      energy = item('Fuel', o.kmPerMonth / cls.kmPerLitre, C.fuelPerLitre, { unit: 'litre', note: `${cls.kmPerLitre} km per litre, Petrol 92` });
    }
    const running = group('Monthly running costs', [
      energy,
      ev
        ? item('Servicing', (o.kmPerMonth / 10_000) * ageFactor, cls.servicePer10000km, { unit: 'service', note: 'One service every 10,000 km (no oil changes)' })
        : item('Servicing', (o.kmPerMonth / 5_000) * ageFactor, cls.servicePer5000km, { unit: 'service', note: 'One service every 5,000 km' }),
      item('Tyres', o.kmPerMonth / (ev ? C.evTyreKm : 40_000), cls.tyreSet, { unit: 'set', note: `A set every ${((ev ? C.evTyreKm : 40_000) / 1000)},000 km` }),
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
