/**
 * Cheeky one-liners for the plan banner, chosen by how the plan is going.
 * One line is picked per mood and kept for the session, so it doesn't change while
 * you type, only when your situation moves to another mood.
 */
export const QUIPS = {
  sinking: { emoji: '🔥', lines: [
    'Man, please just try to survive!!',
    'Your wallet called. It’s filing a missing persons report.',
    'Step one: stop the bleeding. Step two: we’ll talk about the house.',
    'At this rate, your piggy bank needs a piggy bank.',
  ] },
  farOff: { emoji: '😬', lines: [
    'Go work, you have a lot to catch up on!!',
    'Dreams: big. Savings: buffering…',
    'Rome wasn’t built in a day. Neither is a house in Colombo.',
    'Your goals are on the way. Slowly. Very slowly.',
  ] },
  close: { emoji: '🤏', lines: [
    'Like your crush: so close, yet so far.',
    'So close you can smell the new-car scent.',
    'Almost there. One more promotion and we’re talking.',
    'Like a last-ball six that lands on the boundary rope. So close.',
  ] },
  onTrack: { emoji: '🙂', lines: [
    'Look at you, being a responsible adult!',
    'Your future self just sent a thank-you note.',
    'Steady wins the race. You’re the tortoise, and that’s a compliment.',
  ] },
  crushing: { emoji: '🚀', lines: [
    'Okay, money manager. Teach us your ways.',
    'Your savings account is flexing on everyone.',
    'Early retirement? Beach chair already reserved.',
  ] },
};

/**
 * Work out the mood from the plan.
 * @param {object} p { goals, monthsToAll, firstYearSurplus, runsOutAge, retireShortPct, retireEarly }
 */
export function moodOf(p) {
  const total = p.goals.length;
  const missing = p.goals.filter((g) => !g.reached).length;
  // Sinking: you can't cover your monthly costs right now, or nothing on the list fits.
  if (p.firstYearSurplus < 0 || (total && missing === total)) return 'sinking';
  if (total && missing * 2 >= total) return 'farOff';
  if (p.runsOutAge != null && p.runsOutAge < 75) return 'farOff';
  if (missing >= 2 || (p.retireShortPct != null && p.retireShortPct >= 0.1)) return 'farOff';
  if (missing === 1 || (p.retireShortPct != null && p.retireShortPct > 0)) return 'close';
  if (p.monthsToAll != null && p.monthsToAll <= 120 && p.retireEarly) return 'crushing';
  return 'onTrack';
}

const picked = {};
export function quipFor(mood) {
  const q = QUIPS[mood];
  if (picked[mood] == null) picked[mood] = Math.floor(Math.random() * q.lines.length);
  return { emoji: q.emoji, text: q.lines[picked[mood]] };
}
