import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moodOf, quipFor, QUIPS } from '../src/ui/quips.js';

const g = (reached) => ({ reached });
const base = { goals: [g(true), g(true), g(true)], monthsToAll: 200, firstYearSurplus: 50_000, runsOutAge: null, retireShortPct: 0, retireEarly: false };

test('moods follow the plan', () => {
  assert.equal(moodOf({ ...base, firstYearSurplus: -1 }), 'sinking');
  assert.equal(moodOf({ ...base, goals: [g(false), g(false)] }), 'sinking');
  assert.equal(moodOf({ ...base, runsOutAge: 68 }), 'farOff');
  assert.equal(moodOf({ ...base, goals: [g(true), g(false), g(false)] }), 'farOff');
  assert.equal(moodOf({ ...base, retireShortPct: 0.3 }), 'farOff');
  assert.equal(moodOf({ ...base, goals: [g(true), g(true), g(false)] }), 'close');
  assert.equal(moodOf({ ...base, retireShortPct: 0.05 }), 'close');
  assert.equal(moodOf(base), 'onTrack');
  assert.equal(moodOf({ ...base, monthsToAll: 100, retireEarly: true }), 'crushing');
});

test('a mood keeps the same line for the session', () => {
  const a = quipFor('close'), b = quipFor('close');
  assert.equal(a.text, b.text);
  assert.ok(QUIPS.close.lines.includes(a.text));
});
