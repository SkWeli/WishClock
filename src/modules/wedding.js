import { PRICES } from '../data/prices.js';
import { item, group } from '../engine/costTree.js';

const W = PRICES.wedding;

/**
 * Pick the venue. If the guest list is bigger than the chosen venue holds,
 * move to the cheapest venue of the same or higher class that fits.
 */
export function chooseVenue(key, guests, autoUpgrade = true) {
  const chosen = W.venues[key] ?? W.venues.midHotel;
  if (guests <= chosen.capacity || !autoUpgrade) {
    return { key, venue: chosen, upgradedFrom: null, overCapacity: guests > chosen.capacity };
  }
  const fits = Object.entries(W.venues)
    .filter(([, v]) => v.capacity >= guests && v.perPlate >= chosen.perPlate)
    .sort((a, b) => a[1].perPlate - b[1].perPlate);
  if (!fits.length) return { key, venue: chosen, upgradedFrom: null, overCapacity: true };
  const [newKey, venue] = fits[0];
  return { key: newKey, venue, upgradedFrom: chosen, overCapacity: false };
}

/** Alcohol for one event: bottles of spirits and beer, corkage, mixers. */
export function alcoholFor(guests, kind, drinkersPct, drinksPerDrinker, corkagePerBottle) {
  if (kind === 'none' || guests <= 0) return null;
  const drinkers = Math.round(guests * (drinkersPct / 100));
  const drinks = drinkers * drinksPerDrinker;
  // Share of drinks by type.
  const mix = kind === 'fullBar' ? { whisky: 0.6, arrack: 0.2, beer: 0.2 } : { whisky: 0, arrack: 0.7, beer: 0.3 };
  const whiskyBottles = Math.ceil((drinks * mix.whisky) / W.drinksPerBottle);
  const arrackBottles = Math.ceil((drinks * mix.arrack) / W.drinksPerBottle);
  const beerBottles = Math.ceil((drinks * mix.beer) / W.drinksPerBeer);
  const spiritBottles = whiskyBottles + arrackBottles;
  return group(kind === 'fullBar' ? 'Full bar' : 'Beer & arrack', [
    item('Whisky', whiskyBottles, W.whiskyBottle, { unit: 'bottle' }),
    item('Arrack', arrackBottles, W.arrackBottle, { unit: 'bottle' }),
    item('Beer', beerBottles, W.beerBottle, { unit: 'bottle' }),
    item('Corkage', corkagePerBottle ? spiritBottles : 0, corkagePerBottle, { unit: 'bottle', note: 'Hotels charge per bottle you bring in' }),
    item('Mixers, ice & glasses', drinkers, W.mixersPerDrinker, { unit: 'drinker' }),
    item('Bartender', 1, W.bartender),
  ], { note: `${drinkers} drinkers × ${drinksPerDrinker} drinks; ${W.drinksPerBottle} drinks per bottle` });
}

/** One event (wedding day or homecoming). Reused so both follow the same rules. */
export function buildEvent(name, o, warnings) {
  const pick = chooseVenue(o.venue, o.guests, o.autoUpgrade);
  const v = pick.venue;
  if (pick.upgradedFrom) {
    warnings.push(`${name}: ${o.guests} guests is more than a ${pick.upgradedFrom.label.toLowerCase()} holds (${pick.upgradedFrom.capacity}), so this uses a ${v.label.toLowerCase()} instead.`);
  } else if (pick.overCapacity) {
    warnings.push(`${name}: ${o.guests} guests is over the ${v.label.toLowerCase()} limit of ${v.capacity}. Cut the list or turn on venue upgrades.`);
  }
  const kids = Math.round(o.guests * (o.kidsPct / 100));
  const adults = o.guests - kids;
  const plate = v.perPlate * (o.menuTier === 'premium' ? W.premiumMenuFactor : 1);
  const unusedPlates = Math.max(0, v.minGuests - o.guests);
  if (unusedPlates > 0) warnings.push(`${name}: the ${v.label.toLowerCase()} charges for at least ${v.minGuests} plates, so you pay for ${unusedPlates} empty seats.`);

  const tables = Math.ceil(o.guests / W.guestsPerTable);
  return group(name, [
    group(v.label, [
      item('Hall charge', v.hallCharge ? 1 : 0, v.hallCharge),
      item(`Adult plates (${o.menuTier} menu)`, adults, plate, { unit: 'plate' }),
      item('Children’s plates', kids, plate * W.kidsPlateFactor, { unit: 'plate', note: 'Half price' }),
      item('Minimum-guarantee plates', unusedPlates, plate, { unit: 'plate', warn: unusedPlates ? 'Below minimum guests' : undefined }),
    ], { note: `Holds up to ${v.capacity}; minimum ${v.minGuests}` }),
    alcoholFor(o.guests, o.alcohol, o.drinkersPct, o.drinksPerDrinker, v.corkagePerBottle),
    group('Decor & flowers', [
      item(`${o.decor[0].toUpperCase() + o.decor.slice(1)} decor package`, 1, W.decor[o.decor]),
      item('Table centrepieces', tables, W.centrepiecePerTable[o.decor], { unit: 'table', note: `${W.guestsPerTable} guests per table` }),
    ]),
    item(o.music === 'band' ? 'Live band' : 'DJ', o.music === 'none' ? 0 : 1, W.music[o.music]),
  ]);
}

const lowerTier = { grand: 'standard', standard: 'simple', simple: 'simple' };

export const wedding = {
  kind: 'wedding',
  label: 'Wedding',
  fields: [
    { key: 'guests', label: 'Guests', type: 'number', min: 10, max: 2000, step: 10, group: 'Wedding day' },
    { key: 'venue', label: 'Venue', type: 'select', group: 'Wedding day', options: Object.entries(W.venues).map(([value, v]) => ({ value, label: `${v.label} (up to ${v.capacity})` })) },
    { key: 'autoUpgrade', label: 'Move to a bigger venue if guests don’t fit', type: 'toggle', group: 'Wedding day' },
    { key: 'menuTier', label: 'Menu', type: 'select', group: 'Wedding day', options: [{ value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium (+25%)' }] },
    { key: 'kidsPct', label: 'Children among guests', type: 'number', suffix: '%', min: 0, max: 50, step: 5, group: 'Wedding day' },
    { key: 'alcohol', label: 'Alcohol', type: 'select', group: 'Wedding day', options: [
      { value: 'none', label: 'No alcohol' }, { value: 'beerArrack', label: 'Beer & arrack' }, { value: 'fullBar', label: 'Full bar (whisky too)' },
    ] },
    { key: 'drinkersPct', label: 'Guests who drink', type: 'number', suffix: '%', min: 0, max: 100, step: 5, group: 'Wedding day', showIf: (o) => o.alcohol !== 'none' },
    { key: 'drinksPerDrinker', label: 'Drinks each', type: 'number', min: 1, max: 12, step: 1, group: 'Wedding day', showIf: (o) => o.alcohol !== 'none' },
    { key: 'decor', label: 'Decor', type: 'select', group: 'Wedding day', options: [{ value: 'simple', label: 'Simple' }, { value: 'standard', label: 'Standard' }, { value: 'grand', label: 'Grand' }] },
    { key: 'music', label: 'Music', type: 'select', group: 'Wedding day', options: [{ value: 'none', label: 'None' }, { value: 'dj', label: 'DJ' }, { value: 'band', label: 'Live band' }] },
    { key: 'poruwa', label: 'Poruwa ceremony with dancers', type: 'toggle', group: 'Wedding day' },

    { key: 'photography', label: 'Photo & video', type: 'select', group: 'Everything else', options: [{ value: 'basic', label: 'Basic photos' }, { value: 'standard', label: 'Photos + video' }, { value: 'premium', label: 'Premium (pre-shoot, drone, album)' }] },
    { key: 'attire', label: 'Clothes & dressing', type: 'select', group: 'Everything else', options: [{ value: 'simple', label: 'Simple' }, { value: 'standard', label: 'Standard' }, { value: 'luxury', label: 'Luxury' }] },
    { key: 'invitations', label: 'Invitation cards', type: 'select', group: 'Everything else', options: [{ value: 'simple', label: 'Simple' }, { value: 'printed', label: 'Printed' }, { value: 'premium', label: 'Premium boxed' }] },
    { key: 'rings', label: 'Rings', type: 'money', min: 0, max: 5_000_000, step: 25_000, group: 'Everything else' },
    { key: 'weddingCars', label: 'Decorated cars', type: 'number', min: 0, max: 6, step: 1, group: 'Everything else' },
    { key: 'honeymoon', label: 'Honeymoon', type: 'select', group: 'Everything else', options: [{ value: 'none', label: 'None' }, { value: 'local', label: 'In Sri Lanka' }, { value: 'abroad', label: 'Abroad' }] },

    { key: 'homecoming', label: 'Homecoming party', type: 'toggle', group: 'Homecoming' },
    { key: 'homecomingGuests', label: 'Homecoming guests', type: 'number', min: 10, max: 2000, step: 10, group: 'Homecoming', showIf: (o) => o.homecoming },
    { key: 'homecomingVenue', label: 'Homecoming venue', type: 'select', group: 'Homecoming', showIf: (o) => o.homecoming, options: Object.entries(W.venues).map(([value, v]) => ({ value, label: `${v.label} (up to ${v.capacity})` })) },
  ],

  defaults() {
    return {
      guests: 300, venue: 'midHotel', autoUpgrade: true, menuTier: 'standard', kidsPct: 10,
      alcohol: 'beerArrack', drinkersPct: 40, drinksPerDrinker: 4, decor: 'standard', music: 'dj', poruwa: true,
      photography: 'standard', attire: 'standard', invitations: 'printed', rings: 250_000, weddingCars: 2, honeymoon: 'local',
      homecoming: true, homecomingGuests: 200, homecomingVenue: 'receptionHall',
    };
  },

  presets: {
    'Small & simple': { guests: 100, venue: 'receptionHall', alcohol: 'none', decor: 'simple', music: 'none', photography: 'basic', attire: 'simple', homecoming: false, honeymoon: 'local' },
    'Typical hotel wedding': { guests: 300, venue: 'midHotel', alcohol: 'beerArrack', decor: 'standard', music: 'dj', photography: 'standard', attire: 'standard', homecoming: true, homecomingGuests: 200 },
    'Big Colombo wedding': { guests: 600, venue: 'fiveStar', alcohol: 'fullBar', drinkersPct: 50, decor: 'grand', music: 'band', photography: 'premium', attire: 'luxury', menuTier: 'premium', homecoming: true, homecomingGuests: 400, homecomingVenue: 'largeBallroom', honeymoon: 'abroad' },
    'Beach wedding': { guests: 150, venue: 'beachResort', alcohol: 'fullBar', decor: 'grand', music: 'band', photography: 'premium', homecoming: false, honeymoon: 'local' },
  },

  build(o) {
    const warnings = [];
    const day = buildEvent('Wedding day', o, warnings);
    if (o.poruwa) day.children.push(item('Poruwa, ashtaka & dancers', 1, W.poruwa));

    const homecoming = o.homecoming
      ? buildEvent('Homecoming', { ...o, guests: o.homecomingGuests, venue: o.homecomingVenue, decor: lowerTier[o.decor] }, warnings)
      : null;

    const households = Math.ceil((o.guests + (o.homecoming ? o.homecomingGuests * 0.3 : 0)) / W.guestsPerHousehold);
    const a = W.attire;
    const parts = [
      day,
      homecoming,
      item(`Photo & video (${o.photography})`, 1, W.photography[o.photography]),
      group('Clothes & dressing', [
        item('Bride: outfit, dressing & make-up', 1, a.bride[o.attire]),
        item('Groom: outfit', 1, a.groom[o.attire]),
        item('Bridal party', W.bridalPartySize, a.partyPerPerson[o.attire], { unit: 'person' }),
      ]),
      group('Invitations', [
        item(`${o.invitations[0].toUpperCase() + o.invitations.slice(1)} cards`, households, W.invitationCard[o.invitations], { unit: 'card', note: `${W.guestsPerHousehold} guests per household` }),
        item('Delivery & postage', households, W.invitationDelivery, { unit: 'card' }),
      ]),
      group('Cake', [
        item('Cake structure', 1, W.cakeStructure),
        item('Cake pieces for guests', o.guests, W.cakePiecePerGuest, { unit: 'piece' }),
      ]),
      item('Decorated cars', o.weddingCars, W.weddingCar, { unit: 'car' }),
      item('Rings', o.rings ? 1 : 0, o.rings),
      item(`Honeymoon (${o.honeymoon === 'abroad' ? 'abroad' : 'in Sri Lanka'})`, o.honeymoon === 'none' ? 0 : 1, W.honeymoon[o.honeymoon]),
    ];
    const subtotal = sumToday(parts);
    parts.push(item('Contingency', 1, subtotal * (W.contingencyPct / 100), { note: `${W.contingencyPct}% for the things nobody plans for` }));

    return {
      tree: group(`Wedding for ${o.guests} guests`, parts),
      running: null,
      financing: { type: 'cash' },
      warnings,
    };
  },
};

function sumToday(nodes) {
  const cost = (n) => (n.qty ?? 1) * ((n.unitPrice || 0) + (n.children || []).reduce((s, c) => s + cost(c), 0));
  return nodes.filter(Boolean).reduce((s, n) => s + cost(n), 0);
}
