/**
 * All prices live here — never in the engine or the UI.
 *
 * Currency: Sri Lankan rupees (LKR), "today" prices as of November 2026.
 * These are planning estimates gathered from public listings and reports
 * (LankaPropertyWeb Land Price Index 2025, contractor rate guides, ikman.lk
 * brand-new car listings, hotel wedding packages, CPC fuel prices, CBSL data).
 * Update them here and every calculation picks them up.
 *
 * Tiered prices are written as [budget, mid, premium].
 * growthPct = expected yearly price change. Items without one follow the
 * general inflation rate the user sets.
 */
export const PRICES = {
  meta: {
    currency: 'LKR',
    asOf: '2026-11',
    disclaimer:
      'Estimates for planning only. Real quotes vary by seller, location and timing.',
  },

  economy: {
    inflationPct: 6, // CCPI was 8% in Sep 2026; the long-run CBSL target is ~5%
    salaryGrowthPct: 7,
    savingsReturnPct: 7.5, // typical 12-month fixed deposit
    maxDebtToIncomePct: 40, // banks rarely let total loan instalments exceed this share of income
  },

  house: {
    perchSqft: 272.25,
    locations: {
      colombo_city: { label: 'Colombo 1–15', perPerch: 12_000_000 },
      colombo_suburbs: { label: 'Colombo suburbs (Nugegoda, Maharagama…)', perPerch: 2_300_000 },
      kandy: { label: 'Kandy town', perPerch: 1_230_000 },
      galle: { label: 'Galle town', perPerch: 1_050_000 },
      gampaha: { label: 'Gampaha district', perPerch: 770_000 },
      kalutara: { label: 'Kalutara district', perPerch: 490_000 },
      outstation: { label: 'Other towns / rural', perPerch: 300_000 },
    },
    landGrowthPct: 8,
    deedCostsPct: 5, // stamp duty (~4%) + notary & legal fees
    constructionGrowthPct: 6,
    constructionPerSqft: { basic: 12_500, standard: 17_000, luxury: 25_000 },
    // Taller houses need heavier columns, foundations and slabs.
    floorFactor: { 1: 1.0, 2: 1.06, 3: 1.12, 4: 1.18 },
    staircasePerFloor: 450_000,
    architectPct: 4,
    approvals: 250_000, // plan approval, survey, COC
    utilityConnections: 350_000, // water + electricity
    boundaryWallPerFt: 9_000,
    gate: 150_000,
    maxCoveragePct: 65, // typical local-authority limit on footprint vs land area
    maintenancePctPerYear: 0.5, // of construction value
    insurancePctPerYear: 0.1,

    furnitureGrowthPct: 5,
    electronicsGrowthPct: 2,
    furniture: {
      bed: {
        king: [95_000, 180_000, 400_000],
        queen: [75_000, 140_000, 300_000],
        double: [60_000, 110_000, 220_000],
        single: [35_000, 65_000, 140_000],
      },
      mattress: {
        king: [85_000, 170_000, 350_000],
        queen: [70_000, 140_000, 280_000],
        double: [55_000, 110_000, 220_000],
        single: [30_000, 60_000, 120_000],
      },
      pillow: [2_500, 5_000, 12_000],
      linenSet: [8_000, 15_000, 35_000],
      wardrobe: [65_000, 130_000, 300_000],
      dressingTable: [30_000, 60_000, 140_000],
      sofaPerSeat: [30_000, 60_000, 140_000],
      coffeeTable: [15_000, 35_000, 90_000],
      tvStand: [15_000, 35_000, 80_000],
      diningTable: { 4: [45_000, 90_000, 200_000], 6: [65_000, 130_000, 280_000], 8: [90_000, 180_000, 400_000] },
      diningChair: [8_000, 18_000, 45_000],
      pantryPerFt: [25_000, 45_000, 90_000],
      curtainPerWindow: [8_000, 18_000, 45_000],
      ceilingFan: [12_000, 20_000, 45_000],
    },
    // Electronics: price by size, then a brand-tier multiplier.
    tvBySize: { 43: 115_000, 55: 185_000, 65: 300_000, 75: 500_000 },
    electronicsTierFactor: [0.8, 1.0, 1.5],
    appliances: {
      fridge: [130_000, 220_000, 450_000],
      washingMachine: [95_000, 160_000, 330_000],
      cooker: [35_000, 75_000, 180_000],
      microwave: [30_000, 50_000, 110_000],
      acUnit: [190_000, 250_000, 380_000], // 12,000 BTU inverter incl. installation
      waterHeater: [45_000, 75_000, 140_000],
    },
  },

  car: {
    growthPct: 4,
    fuelPerLitre: 414, // Petrol 92, CPC, Oct 2026
    classes: {
      kei: { label: 'Small hatchback (Wagon R class)', newPrice: 8_300_000, kmPerLitre: 20, servicePer5000km: 18_000, tyreSet: 60_000 },
      compactSuv: { label: 'Compact SUV (Raize / Rocky class)', newPrice: 14_400_000, kmPerLitre: 20, servicePer5000km: 25_000, tyreSet: 90_000 },
      compactHybrid: { label: 'Hybrid hatchback (Aqua class)', newPrice: 15_500_000, kmPerLitre: 26, servicePer5000km: 25_000, tyreSet: 80_000 },
      midSuv: { label: 'Hybrid crossover (Vezel class)', newPrice: 19_800_000, kmPerLitre: 20, servicePer5000km: 30_000, tyreSet: 120_000 },
      luxurySuv: { label: 'Large 4x4 (Prado class)', newPrice: 63_500_000, kmPerLitre: 9, servicePer5000km: 75_000, tyreSet: 350_000 },
      // Electric: kmPerKWh instead of km per litre; servicing is cheaper (no oil, fewer parts).
      evSmall: { label: 'Electric hatchback (BYD Dolphin class)', fuel: 'electric', newPrice: 12_500_000, kmPerKWh: 6.5, servicePer10000km: 18_000, tyreSet: 90_000 },
      evSuv: { label: 'Electric compact SUV (BYD Atto 3 class)', fuel: 'electric', newPrice: 19_500_000, kmPerKWh: 6.0, servicePer10000km: 22_000, tyreSet: 120_000 },
      evPremium: { label: 'Electric sedan / SUV (BYD Seal class)', fuel: 'electric', newPrice: 28_000_000, kmPerKWh: 6.0, servicePer10000km: 30_000, tyreSet: 160_000 },
    },
    // Electricity for charging (Rs per kWh, 2026)
    electricity: {
      home: 75,        // household block above 180 units a month; an EV usually pushes a home into it
      homeNight: 30,   // optional time-of-use tariff, charging overnight (estimate)
      solar: 20,       // rooftop solar: the value of power you'd otherwise export (estimate)
      publicFast: 110, // DC fast chargers
    },
    chargingLossPct: 10, // energy lost while charging
    homeCharger: 250_000, // wall charger + wiring
    evDepreciationFirstYearPct: 12,
    evDepreciationPerYearPct: 7, // batteries age, so used EVs lose value faster
    evTyreKm: 35_000, // instant torque wears tyres a little faster
    evBatteryWarnAge: 8,
    // Sri Lankan used cars hold value unusually well (import limits, high taxes).
    depreciationFirstYearPct: 8,
    depreciationPerYearPct: 4,
    expectedKmPerYear: 12_000,
    mileagePenaltyPer10kKmPct: 1.5,
    registrationPct: { new: 1.0, used: 0.5 }, // first registration / transfer + number plate
    insurancePctPerYear: 2.75, // comprehensive
    accessories: { new: 75_000, used: 50_000 },
    inspection: 15_000,
    revenueLicencePerYear: 8_000,
  },

  rent: {
    // Monthly rent for a 2-bedroom, unfurnished place (ikman.lk / LankaPropertyWeb listings, 2026)
    perMonth2br: {
      colombo_city: 250_000, colombo_suburbs: 110_000, kandy: 75_000, galle: 70_000,
      gampaha: 60_000, kalutara: 50_000, outstation: 35_000,
    },
    typeFactor: { annex: 0.55, apartment: 1.0, house: 1.1 },
    bedroomFactor: { 1: 0.7, 2: 1.0, 3: 1.35, 4: 1.7 },
    furnishedFactor: 1.3,
    depositMonths: 6, // refundable security deposit / "key money": usually 3–6 months
    advanceMonths: 1, // first month paid up front
    agentMonths: 1,
    moving: 40_000,
    setup: 150_000, // curtains, kitchen basics, gas cylinder, small repairs
    billsPerMonth: 12_000, // electricity & water not already in living costs
  },

  wedding: {
    // Ordered roughly by price. perPlate is a nett per-person package price.
    venues: {
      receptionHall: { label: 'Reception hall', perPlate: 3_800, hallCharge: 150_000, minGuests: 100, capacity: 350, corkagePerBottle: 0 },
      midHotel: { label: 'Mid-range hotel', perPlate: 6_500, hallCharge: 0, minGuests: 150, capacity: 500, corkagePerBottle: 1_500 },
      largeBallroom: { label: 'Large hotel ballroom', perPlate: 8_500, hallCharge: 0, minGuests: 300, capacity: 1_000, corkagePerBottle: 2_000 },
      beachResort: { label: 'Beach resort (outdoor)', perPlate: 10_900, hallCharge: 0, minGuests: 100, capacity: 300, corkagePerBottle: 2_500 },
      fiveStar: { label: '5-star Colombo ballroom', perPlate: 11_000, hallCharge: 0, minGuests: 250, capacity: 1_200, corkagePerBottle: 3_000 },
    },
    premiumMenuFactor: 1.25,
    kidsPlateFactor: 0.5,
    drinksPerBottle: 16, // 750 ml bottle ≈ 16 pegs
    drinksPerBeer: 1.5, // 625 ml bottle
    arrackBottle: 4_200,
    whiskyBottle: 14_000,
    beerBottle: 650,
    mixersPerDrinker: 350,
    bartender: 25_000,
    photography: { basic: 150_000, standard: 325_000, premium: 750_000 },
    decor: { simple: 150_000, standard: 400_000, grand: 1_200_000 },
    centrepiecePerTable: { simple: 4_000, standard: 10_000, grand: 20_000 },
    guestsPerTable: 10,
    music: { none: 0, dj: 75_000, band: 300_000 },
    poruwa: 120_000, // poruwa, ashtaka, jayamangala gatha, dancers
    attire: {
      bride: { simple: 150_000, standard: 350_000, luxury: 900_000 },
      groom: { simple: 60_000, standard: 150_000, luxury: 400_000 },
      partyPerPerson: { simple: 25_000, standard: 50_000, luxury: 100_000 },
    },
    bridalPartySize: 4,
    invitationCard: { simple: 120, printed: 250, premium: 600 },
    invitationDelivery: 50,
    guestsPerHousehold: 2.5,
    cakeStructure: 25_000,
    cakePiecePerGuest: 70, // cake pieces in boxes for guests to take home
    weddingCar: 35_000,
    honeymoon: { none: 0, local: 200_000, abroad: 900_000 },
    contingencyPct: 5,
  },
};

export const TIERS = ['budget', 'mid', 'premium'];
export const tierIndex = (tier) => Math.max(0, TIERS.indexOf(tier));
