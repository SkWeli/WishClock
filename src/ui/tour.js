/**
 * First-visit tour: a few centred cards explaining the site.
 *
 * How first-time visitors are recognised: when someone finishes or skips the tour,
 * a flag is saved in this browser's localStorage. If the flag is missing when the
 * page opens, the tour starts. Nothing is sent anywhere. Clearing browser data,
 * another browser or another device counts as a first visit again.
 * The "How it works" button replays the tour any time.
 */
const SEEN_KEY = 'wishclock:tour-seen';

const STEPS = [
  { tab: 'plan', icon: '⏱', title: 'Welcome to Wishclock',
    body: 'Tell us what you earn and what you dream of: a house, a car, a wedding. Wishclock works out <strong>when</strong> you can afford each one, month by month.' },
  { tab: 'people', icon: '👥', title: '1. Add who is saving',
    body: 'Enter take-home pay, living costs and savings for you, and your partner if you plan together. On an <strong>intern salary</strong>? Add the month you go permanent and your expected pay.' },
  { tab: 'goals', icon: '🏠', title: '2. Add your goals, in order',
    body: 'Add a house, car or wedding, then tap <strong>Edit</strong> to set details: floors, furniture, guests, venue. Start from a preset if you’re unsure. Choose loans or cash only at the top.' },
  { tab: 'plan', icon: '📈', title: '3. See your plan',
    body: 'Each goal shows <strong>how long until you can buy it</strong>. The timeline shows your savings growing and dropping as you buy. Try the <strong>“What if you saved more?”</strong> slider.' },
  { tab: 'retirement', icon: '🌴', title: '4. Check retirement',
    body: 'See how much you need saved to retire, and the age you could <strong>really</strong> retire at the rate you’re going.' },
  { tab: 'plan', icon: '✅', title: 'You’re ready',
    body: 'The example numbers are already filled in, so change them to your own. Everything stays in this browser and updates as you type. Open this tour again with <strong>How it works</strong> at the top.' },
];

export function hasSeenTour() {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}
function markSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage unavailable: tour may show again next time */ }
}

export function startTour() {
  if (document.querySelector('.tour')) return;
  let i = 0;
  const previousFocus = document.activeElement;
  const root = document.createElement('div');
  root.className = 'tour';
  root.innerHTML = `<div class="tour-backdrop"></div>
    <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      <button type="button" class="tour-skip" data-tour="skip">Skip tour</button>
      <div class="tour-icon" aria-hidden="true"></div>
      <h2 id="tour-title"></h2>
      <p id="tour-body"></p>
      <div class="tour-foot">
        <div class="tour-dots" aria-hidden="true">${STEPS.map(() => '<span></span>').join('')}</div>
        <span class="tour-count"></span>
        <div class="tour-btns">
          <button type="button" class="tour-back" data-tour="back">Back</button>
          <button type="button" class="tour-next" data-tour="next">Next</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);

  const card = root.querySelector('.tour-card');
  const render = () => {
    const s = STEPS[i];
    if (location.hash.slice(1) !== s.tab) location.hash = s.tab;
    root.querySelector('.tour-icon').textContent = s.icon;
    root.querySelector('#tour-title').textContent = s.title;
    root.querySelector('#tour-body').innerHTML = s.body;
    root.querySelector('.tour-count').textContent = `${i + 1} of ${STEPS.length}`;
    root.querySelectorAll('.tour-dots span').forEach((d, k) => d.classList.toggle('on', k === i));
    root.querySelector('.tour-back').hidden = i === 0;
    root.querySelector('.tour-next').textContent = i === 0 ? 'Show me' : i === STEPS.length - 1 ? 'Start planning' : 'Next';
    card.classList.remove('enter'); void card.offsetWidth; card.classList.add('enter');
    root.querySelector('.tour-next').focus();
  };
  const close = () => {
    markSeen();
    root.remove();
    document.removeEventListener('keydown', onKey);
    if (location.hash.slice(1) !== 'plan') location.hash = 'plan';
    previousFocus?.focus?.();
  };
  const go = (d) => { i = Math.max(0, Math.min(STEPS.length - 1, i + d)); render(); };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') { if (i === STEPS.length - 1) close(); else go(1); }
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'Tab') { // keep focus inside the card
      const f = [...card.querySelectorAll('button:not([hidden])')];
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-tour]')?.dataset.tour;
    if (a === 'skip') close();
    else if (a === 'back') go(-1);
    else if (a === 'next') { if (i === STEPS.length - 1) close(); else go(1); }
  });
  document.addEventListener('keydown', onKey);
  render();
}
