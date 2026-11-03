import { PRICES, tierIndex } from '../data/prices.js';
import { item, group } from '../engine/costTree.js';

const P = PRICES.house;
const F = P.furniture;
const A = P.appliances;

const sizeOptions = (sizes) => sizes.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }));

export const house = {
  kind: 'house',
  label: 'House',
  fields: [
    { key: 'location', label: 'Location', type: 'select', group: 'The house', options: Object.entries(P.locations).map(([value, l]) => ({ value, label: l.label })) },
    { key: 'buyLand', label: 'I need to buy land', type: 'toggle', group: 'The house' },
    { key: 'landPerches', label: 'Land size', type: 'number', suffix: 'perches', min: 4, max: 80, step: 1, group: 'The house', showIf: (o) => o.buyLand },
    { key: 'floors', label: 'Floors', type: 'select', group: 'The house', options: [1, 2, 3, 4].map((n) => ({ value: n, label: n === 1 ? 'Single storey' : n === 4 ? '4 floors' : `${n} floors` })) },
    { key: 'sqftPerFloor', label: 'Floor area per floor', type: 'number', suffix: 'sq ft', min: 400, max: 6000, step: 50, group: 'The house' },
    { key: 'finish', label: 'Finish quality', type: 'select', group: 'The house', options: [
      { value: 'basic', label: 'Basic (plain concrete, standard tiles)' },
      { value: 'standard', label: 'Standard (good tiles, better fittings)' },
      { value: 'luxury', label: 'Luxury (imported finishes)' },
    ] },
    { key: 'boundaryWall', label: 'Boundary wall and gate', type: 'toggle', group: 'The house', showIf: (o) => o.buyLand },

    { key: 'furnished', label: 'Furnish it', type: 'toggle', group: 'Furniture & appliances' },
    { key: 'furnitureTier', label: 'Furniture quality', type: 'select', group: 'Furniture & appliances', showIf: (o) => o.furnished, options: [
      { value: 'budget', label: 'Budget' }, { value: 'mid', label: 'Mid-range' }, { value: 'premium', label: 'Premium' },
    ] },
    { key: 'masterBed', label: 'Master bed', type: 'select', group: 'Furniture & appliances', showIf: (o) => o.furnished, options: sizeOptions(['king', 'queen']) },
    { key: 'otherBedrooms', label: 'Other bedrooms', type: 'number', min: 0, max: 8, step: 1, group: 'Furniture & appliances', showIf: (o) => o.furnished },
    { key: 'otherBedSize', label: 'Their bed size', type: 'select', group: 'Furniture & appliances', showIf: (o) => o.furnished && o.otherBedrooms > 0, options: sizeOptions(['queen', 'double', 'single']) },
    { key: 'pillowsPerBed', label: 'Pillows per bed', type: 'number', min: 0, max: 8, step: 1, group: 'Furniture & appliances', showIf: (o) => o.furnished },
    { key: 'sofaSeats', label: 'Sofa seats', type: 'number', min: 0, max: 14, step: 1, group: 'Furniture & appliances', showIf: (o) => o.furnished, help: 'A 3+2 set is 5 seats' },
    { key: 'tvCount', label: 'TVs', type: 'number', min: 0, max: 6, step: 1, group: 'Furniture & appliances', showIf: (o) => o.furnished },
    { key: 'tvSize', label: 'TV size', type: 'select', group: 'Furniture & appliances', showIf: (o) => o.furnished && o.tvCount > 0, options: Object.keys(P.tvBySize).map((s) => ({ value: Number(s), label: `${s}″` })) },
    { key: 'diningSeats', label: 'Dining table', type: 'select', group: 'Furniture & appliances', showIf: (o) => o.furnished, options: [4, 6, 8].map((n) => ({ value: n, label: `${n}-seater` })) },
    { key: 'acUnits', label: 'Air conditioners', type: 'number', min: 0, max: 10, step: 1, group: 'Furniture & appliances', showIf: (o) => o.furnished },
    { key: 'pantryFt', label: 'Pantry cupboards', type: 'number', suffix: 'running ft', min: 0, max: 60, step: 1, group: 'Furniture & appliances', showIf: (o) => o.furnished },
    { key: 'appliances', label: 'Fridge, washing machine, cooker, microwave', type: 'toggle', group: 'Furniture & appliances', showIf: (o) => o.furnished },

    { key: 'financing', label: 'Pay with', type: 'select', group: 'Paying for it', options: [
      { value: 'loan', label: 'Housing loan' }, { value: 'cash', label: 'Cash only' },
    ] },
    { key: 'downPct', label: 'Down payment', type: 'number', suffix: '%', min: 10, max: 90, step: 5, group: 'Paying for it', showIf: (o) => o.financing === 'loan', help: 'Banks usually lend up to 70–80% of land + building' },
    { key: 'ratePct', label: 'Loan interest', type: 'number', suffix: '% a year', min: 5, max: 25, step: 0.25, group: 'Paying for it', showIf: (o) => o.financing === 'loan' },
    { key: 'years', label: 'Loan term', type: 'number', suffix: 'years', min: 5, max: 30, step: 1, group: 'Paying for it', showIf: (o) => o.financing === 'loan' },
    { key: 'currentRent', label: 'Rent you stop paying', type: 'money', min: 0, max: 1_000_000, step: 5_000, group: 'Paying for it', help: 'Part of your expenses today; it ends when you move in' },
  ],

  defaults() {
    return {
      location: 'gampaha', buyLand: true, landPerches: 10, floors: 1, sqftPerFloor: 1400,
      finish: 'standard', boundaryWall: true,
      furnished: true, furnitureTier: 'mid', masterBed: 'queen', otherBedrooms: 2, otherBedSize: 'double',
      pillowsPerBed: 2, sofaSeats: 5, tvCount: 1, tvSize: 55, diningSeats: 6, acUnits: 2, pantryFt: 12, appliances: true,
      financing: 'loan', downPct: 30, ratePct: 13.5, years: 20, currentRent: 45_000,
    };
  },

  presets: {
    'Starter home': { location: 'outstation', landPerches: 8, floors: 1, sqftPerFloor: 1000, finish: 'basic', furnitureTier: 'budget', otherBedrooms: 1, sofaSeats: 3, acUnits: 1, tvSize: 43 },
    'Family home': { location: 'gampaha', landPerches: 10, floors: 1, sqftPerFloor: 1400, finish: 'standard', furnitureTier: 'mid', otherBedrooms: 2, sofaSeats: 5, acUnits: 2, tvSize: 55 },
    'Two-storey in the suburbs': { location: 'colombo_suburbs', landPerches: 10, floors: 2, sqftPerFloor: 1300, finish: 'standard', furnitureTier: 'mid', otherBedrooms: 3, sofaSeats: 6, acUnits: 4, tvCount: 2, tvSize: 55 },
    'Luxury in Colombo': { location: 'colombo_city', landPerches: 12, floors: 3, sqftPerFloor: 1500, finish: 'luxury', furnitureTier: 'premium', masterBed: 'king', otherBedrooms: 4, otherBedSize: 'queen', sofaSeats: 8, acUnits: 6, tvCount: 3, tvSize: 75, diningSeats: 8 },
  },

  build(o) {
    const loc = P.locations[o.location] ?? P.locations.gampaha;
    const floors = Number(o.floors);
    const totalSqft = floors * o.sqftPerFloor;
    const t = tierIndex(o.furnitureTier);
    const warnings = [];

    // ---- Land
    let land = null;
    if (o.buyLand) {
      const landPrice = o.landPerches * loc.perPerch;
      const landSqft = o.landPerches * P.perchSqft;
      const coverage = (o.sqftPerFloor / landSqft) * 100;
      if (coverage > P.maxCoveragePct) {
        warnings.push(`The ground floor covers ${Math.round(coverage)}% of the land. Councils usually allow about ${P.maxCoveragePct}%. Add perches, or build up instead of out.`);
      }
      land = group('Land', [
        item(`Land in ${loc.label}`, o.landPerches, loc.perPerch, { unit: 'perch', financeable: true }),
        item('Deed, stamp duty & legal fees', 1, landPrice * (P.deedCostsPct / 100), { note: `≈${P.deedCostsPct}% of the land price`, financeable: false }),
      ], { growthPct: P.landGrowthPct });
    }

    // ---- Construction
    const rate = P.constructionPerSqft[o.finish] * (P.floorFactor[floors] ?? 1);
    const structure = totalSqft * rate;
    const perimeterFt = o.buyLand ? 4 * Math.sqrt(o.landPerches * P.perchSqft) : 0;
    const construction = group('Construction', [
      item(`Building, ${o.finish} finish`, totalSqft, rate, {
        unit: 'sq ft',
        note: floors > 1 ? `Includes a ${Math.round((P.floorFactor[floors] - 1) * 100)}% structural premium for ${floors} floors` : undefined,
      }),
      floors > 1 ? item('Staircase', floors - 1, P.staircasePerFloor, { unit: 'flight' }) : null,
      item('Architect & engineer', 1, structure * (P.architectPct / 100), { note: `≈${P.architectPct}% of building cost` }),
      item('Plan approval, survey & certificates', 1, P.approvals),
      item('Water & electricity connections', 1, P.utilityConnections),
      o.buyLand && o.boundaryWall ? group('Boundary wall & gate', [
        item('Wall', Math.round(perimeterFt), P.boundaryWallPerFt, { unit: 'ft', note: 'Perimeter of a square plot' }),
        item('Gate', 1, P.gate),
      ]) : null,
    ], { growthPct: P.constructionGrowthPct, financeable: true });

    // ---- Furniture
    let furniture = null;
    const bedrooms = 1 + (o.otherBedrooms || 0);
    const bathrooms = Math.max(1, Math.round(bedrooms * 0.67));
    if (o.furnished) {
      const bedroom = (label, size, qty, master) => group(label, [
        item(`${cap(size)} bed`, 1, F.bed[size][t]),
        item(`${cap(size)} mattress`, 1, F.mattress[size][t]),
        item('Pillows', o.pillowsPerBed, F.pillow[t], { unit: 'pillow' }),
        item('Bed linen set', 2, F.linenSet[t], { unit: 'set' }),
        item('Wardrobe', 1, F.wardrobe[t]),
        master ? item('Dressing table', 1, F.dressingTable[t]) : null,
        item('Ceiling fan', 1, F.ceilingFan[t]),
      ], { qty, unit: 'room' });

      const elec = P.electronicsTierFactor[t];
      const windows = Math.max(4, Math.round(totalSqft / 120));
      furniture = group('Furniture & appliances', [
        bedroom('Master bedroom', o.masterBed, 1, true),
        o.otherBedrooms > 0 ? bedroom('Other bedrooms', o.otherBedSize, o.otherBedrooms, false) : null,
        group('Living room', [
          item('Sofa', o.sofaSeats, F.sofaPerSeat[t], { unit: 'seat' }),
          item('Coffee table', o.sofaSeats > 0 ? 1 : 0, F.coffeeTable[t]),
          item(`${o.tvSize}″ TV`, o.tvCount, P.tvBySize[o.tvSize] * elec, { unit: 'TV', growthPct: P.electronicsGrowthPct }),
          item('TV stand', o.tvCount, F.tvStand[t]),
          item('Ceiling fans', 2, F.ceilingFan[t], { unit: 'fan' }),
        ]),
        group('Dining', [
          item(`${o.diningSeats}-seater table`, 1, F.diningTable[o.diningSeats][t]),
          item('Chairs', Number(o.diningSeats), F.diningChair[t], { unit: 'chair' }),
        ]),
        group('Kitchen & laundry', [
          item('Pantry cupboards', o.pantryFt, F.pantryPerFt[t], { unit: 'ft' }),
          o.appliances ? item('Refrigerator', 1, A.fridge[t], { growthPct: P.electronicsGrowthPct }) : null,
          o.appliances ? item('Gas cooker', 1, A.cooker[t]) : null,
          o.appliances ? item('Microwave', 1, A.microwave[t], { growthPct: P.electronicsGrowthPct }) : null,
          o.appliances ? item('Washing machine', 1, A.washingMachine[t], { growthPct: P.electronicsGrowthPct }) : null,
        ]),
        item('Air conditioners (installed)', o.acUnits, A.acUnit[t], { unit: 'unit', growthPct: P.electronicsGrowthPct }),
        item('Water heaters', bathrooms, A.waterHeater[t], { unit: 'bathroom', note: `${bathrooms} bathroom${bathrooms > 1 ? 's' : ''} for ${bedrooms} bedrooms` }),
        item('Curtains', windows, F.curtainPerWindow[t], { unit: 'window', note: 'About one window per 120 sq ft' }),
      ], { growthPct: P.furnitureGrowthPct, financeable: false });

      if (totalSqft < bedrooms * 300) {
        warnings.push(`${bedrooms} bedrooms in ${totalSqft.toLocaleString()} sq ft is tight. Most plans need about 300 sq ft per bedroom plus living space.`);
      }
    }

    const tree = group(`House in ${loc.label}`, [land, construction, furniture]);

    // ---- Running costs after moving in (today's rupees per month)
    const running = group('Monthly running costs', [
      item('Maintenance & repairs', 1, (structure * P.maintenancePctPerYear) / 100 / 12),
      item('Home insurance', 1, (structure * P.insurancePctPerYear) / 100 / 12),
      o.currentRent ? item('Rent you no longer pay', 1, -o.currentRent) : null,
    ]);

    return {
      tree,
      running,
      financing: o.financing === 'loan'
        ? { type: 'loan', label: 'Housing loan', downPct: o.downPct, ratePct: o.ratePct, years: o.years }
        : { type: 'cash' },
      warnings,
    };
  },
};

function cap(s) {
  return String(s)[0].toUpperCase() + String(s).slice(1);
}
