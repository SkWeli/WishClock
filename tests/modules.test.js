import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGoal, MODULES } from '../src/modules/index.js';
import { evaluate, flatten } from '../src/engine/costTree.js';
import { chooseVenue, alcoholFor } from '../src/modules/wedding.js';
import { usedValueFactor } from '../src/modules/car.js';
import { PRICES } from '../src/data/prices.js';

const total = (goal) => evaluate(buildGoal(goal).tree).today;
const find = (goal, label) => flatten(evaluate(buildGoal(goal).tree)).find((r) => r.label.startsWith(label));

test('every module builds with its defaults and every preset', () => {
  for (const [kind, mod] of Object.entries(MODULES)) {
    assert.ok(total({ kind, options: {} }) > 0, kind);
    for (const [name, preset] of Object.entries(mod.presets)) {
      assert.ok(total({ kind, options: preset }) > 0, `${kind}: ${name}`);
    }
  }
});

test('house: more floors, bigger land and furniture all raise the price', () => {
  const base = { kind: 'house', options: { floors: 1, furnished: false } };
  assert.ok(total({ kind: 'house', options: { floors: 2, furnished: false } }) > total(base));
  assert.ok(total({ kind: 'house', options: { floors: 1, furnished: true } }) > total(base));
  assert.ok(total({ kind: 'house', options: { floors: 1, furnished: false, landPerches: 20 } }) > total(base));
});

test('house: land costs perches × price per perch', () => {
  const row = find({ kind: 'house', options: { location: 'gampaha', landPerches: 10 } }, 'Land in');
  assert.equal(row.total, 10 * PRICES.house.locations.gampaha.perPerch);
});

test('house: king bed costs more than queen; pillows scale with count', () => {
  const k = total({ kind: 'house', options: { masterBed: 'king' } });
  const q = total({ kind: 'house', options: { masterBed: 'queen' } });
  assert.ok(k > q);
  const p2 = total({ kind: 'house', options: { pillowsPerBed: 2 } });
  const p4 = total({ kind: 'house', options: { pillowsPerBed: 4 } });
  // 3 beds (master + 2 others) × 2 extra pillows × mid pillow price
  assert.equal(p4 - p2, 3 * 2 * PRICES.house.furniture.pillow[1]);
});

test('house: without land there is no land, wall or deed cost', () => {
  const rows = flatten(evaluate(buildGoal({ kind: 'house', options: { buyLand: false } }).tree)).map((r) => r.label);
  assert.ok(!rows.some((l) => l.startsWith('Land') || l.startsWith('Deed') || l.startsWith('Boundary')));
});

test('house: rent saved makes running costs negative', () => {
  const g = buildGoal({ kind: 'house', options: { currentRent: 60_000 } });
  assert.ok(evaluate(g.running).today < 0);
});

test('car: used is cheaper, older is cheaper, high mileage is cheaper', () => {
  assert.ok(total({ kind: 'car', options: { condition: 'used', ageYears: 5 } }) < total({ kind: 'car', options: { condition: 'new' } }));
  assert.ok(usedValueFactor(10, 120_000) < usedValueFactor(5, 60_000));
  assert.ok(usedValueFactor(5, 150_000) < usedValueFactor(5, 60_000));
});

test('car: fuel = km ÷ km per litre × price', () => {
  const g = buildGoal({ kind: 'car', options: { carClass: 'kei', kmPerMonth: 1000 } });
  const fuel = flatten(evaluate(g.running)).find((r) => r.label === 'Fuel');
  assert.equal(fuel.total, (1000 / PRICES.car.classes.kei.kmPerLitre) * PRICES.car.fuelPerLitre);
});

test('wedding: venue upgrades when guests exceed capacity', () => {
  const pick = chooseVenue('receptionHall', 450);
  assert.equal(pick.key, 'midHotel');
  assert.equal(pick.upgradedFrom.label, 'Reception hall');
  assert.equal(chooseVenue('receptionHall', 450, false).overCapacity, true);
});

test('wedding: minimum-guarantee plates are charged', () => {
  const row = find({ kind: 'wedding', options: { guests: 200, venue: 'largeBallroom', homecoming: false } }, 'Minimum-guarantee');
  assert.equal(row.qty, 100);
});

test('wedding: alcohol scales with drinkers and adds corkage', () => {
  const none = total({ kind: 'wedding', options: { alcohol: 'none' } });
  const some = total({ kind: 'wedding', options: { alcohol: 'beerArrack' } });
  const full = total({ kind: 'wedding', options: { alcohol: 'fullBar' } });
  assert.ok(none < some && some < full);
  const a = evaluate(alcoholFor(300, 'beerArrack', 40, 4, 1500));
  // 120 drinkers × 4 = 480 drinks; 70% arrack → 336/16 = 21 bottles
  assert.equal(a.children.find((c) => c.label === 'Arrack').qty, 21);
  assert.equal(a.children.find((c) => c.label === 'Corkage').qty, 21);
});

test('wedding: more guests cost more', () => {
  assert.ok(total({ kind: 'wedding', options: { guests: 400 } }) > total({ kind: 'wedding', options: { guests: 200 } }));
});
