/** Small inline SVG icons (stroke = currentColor). */
const svg = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ICONS = {
  house: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5.5h4V20"/>'),
  car: svg('<path d="M5 16.5h14"/><path d="M3.5 16.5v-3.2l2-4.6A2 2 0 0 1 7.3 7.5h9.4a2 2 0 0 1 1.8 1.2l2 4.6v3.2"/><path d="M3.5 13.3h17"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>'),
  wedding: svg('<circle cx="9" cy="14" r="5.5"/><circle cx="15" cy="14" r="5.5"/><path d="m10.5 4 1.5 2.5L13.5 4"/>'),
  retire: svg('<path d="M12 21V11"/><path d="M12 11C9 7 5 7 3 9c3 0 6 .5 9 2Z"/><path d="M12 11c3-4 7-4 9-2-3 0-6 .5-9 2Z"/><path d="M12 11c0-4-2-7-5-8 1 3 3 5 5 8Z"/><path d="M7 21h10"/>'),
  people: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2A4.6 4.6 0 0 1 21 18.6"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
};

export const goalIcon = (kind) => ICONS[kind] || ICONS.clock;
