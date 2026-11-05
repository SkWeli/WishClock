# Wishclock

**Every wish has a countdown.** **How long until you can afford it?** Enter your take-home pay and living costs. Then add goals like a house, a car or a wedding, in any detail you want: floors, furniture down to the pillows, guest count, venue, alcohol. Wishclock simulates your finances month by month and tells you when you can buy each goal.

Prices are in Sri Lankan rupees (LKR) as of November 2026.

## Put it on GitHub

You need [Git](https://git-scm.com/downloads) installed. Node.js 18+ is only needed to run the tests and the build. The app itself is plain HTML, CSS and JavaScript.

### 1. Create an empty repository

1. Go to <https://github.com/new>.
2. **Repository name:** `wishclock`
3. Choose **Public**. GitHub Pages is free for public repositories.
4. Leave *Add a README*, *.gitignore* and *license* **unticked**. This project already has them.
5. Click **Create repository**.

### 2. Push this folder to it

Unzip the project, open a terminal inside the `wishclock` folder, and run:

```bash
git init
git add .
git commit -m "First prototype: house, car and wedding modules"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/wishclock.git
git push -u origin main
```

GitHub doesn't accept your account password when you push. Either:
- install the [GitHub CLI](https://cli.github.com/) and run `gh auth login` once, or
- create a [personal access token](https://github.com/settings/tokens) and paste it when Git asks for a password.

With the GitHub CLI you can skip step 1 entirely:

```bash
git init && git add . && git commit -m "First prototype"
gh repo create wishclock --public --source=. --push
```

### 3. Turn on the live website (GitHub Pages)

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
3. Pick branch **main** and folder **/ (root)**, then click **Save**.
4. After a minute the site is live at `https://YOUR-USERNAME.github.io/wishclock/`.

Every `git push` to `main` updates the site.

## Speech bubble

The plan banner shows a cheeky one-liner in a speech bubble under the headline, picked from five moods based on your numbers: 🔥 sinking (costs exceed income now, or no goal fits), 😬 far off (half the goals or more out of reach, retirement short by 10%+, or savings running out before 75), 🤏 so close (one goal out of reach, or retirement just short), 🙂 on track, and 🚀 crushing it (everything within 10 years and an early retirement). The lines live in `src/ui/quips.js`. One line per mood is picked each visit, so it doesn't change while you type.

## Light and dark mode

The sun / moon / screen switch in the header picks **Light**, **Dark** or **Auto**. Auto is the default and follows the device's setting. The choice is saved in the browser (`wishclock:theme`) and applied by a small script in `<head>` before the page draws, so it never flashes the wrong colours. All colours are CSS variables at the top of `css/styles.css`.

## First-visit tour

First-time visitors see a short tour of 6 centred cards: what the site does, then You, Goals, Your plan and Retirement. The page switches to each tab in the background as the card explains it.

A visitor counts as new if their browser has no `wishclock:tour-seen` flag in `localStorage`. The flag is saved when they finish or skip the tour, so the tour isn't shown again on that browser. Another browser, another device or cleared browser data count as a first visit again. The **How it works** button in the header replays the tour any time. Edit the cards in `src/ui/tour.js`.

## Visitor counter

The footer can show how many times the site has been visited, using [GoatCounter](https://www.goatcounter.com). It's free, needs no cookies or consent banner, and gives you a dashboard of visits, countries, devices and where visitors came from.

1. Sign up at <https://www.goatcounter.com/signup>. Pick a **code**, for example `wishclock`. Your dashboard will be at `https://wishclock.goatcounter.com`.
2. In GoatCounter, open **Settings** and tick **Allow adding visitor counts on your website**, then save.
3. In `src/config.js`, set `goatcounterCode: 'wishclock'` (your code).
4. Commit and push. Visits are counted on the live GitHub Pages site, and the total appears at the bottom of the page.

Leave the code empty to turn the counter off. Pages opened from your own computer (`file://`) are never counted. Visitors who use ad blockers may not be counted.

## Run it on your computer

```bash
npm install        # only installs esbuild, used by the build step
npm start          # serves the app at http://localhost:3000
npm test           # runs the engine and module tests
npm run build      # writes dist/index.html, a single file that opens without a server
```

Opening `index.html` by double-clicking won't work, because browsers block ES modules from `file://`. Use `npm start`, or `npm run build` and open `dist/index.html`.

## How it works

```
src/
  config.js             site settings (visitor counter code)
  data/prices.js        every price and rate, in one place
  engine/costTree.js    the cost tree: qty × (unit price + children), with per-item price growth
  engine/loan.js        instalment (EMI) maths
  engine/simulate.js    the month-by-month simulation
  engine/retirement.js  25× / income-gap retirement target and plan check
  modules/house.js      options → cost tree for a house
  modules/car.js        … for a car (new or used, with depreciation)
  modules/wedding.js    … for a wedding (venue rules, alcohol, homecoming)
  modules/rent.js       … for renting (estimated rent, refundable deposit)
  modules/custom.js     … for any goal the user defines
  modules/index.js      the list of goal types
  ui/                   tabs (Plan, You, Goals, Retirement, Cost breakdown), forms, chart
tests/                  node:test unit tests
```

### The cost tree

Every goal is a tree of items. Each item has a quantity, a unit price, an optional yearly price growth and a flag for whether a loan can pay for it:

```
House in Gampaha district
├── Land                  growth 8%/yr, loan-eligible
│   ├── Land  10 perches × Rs 770,000
│   └── Deed, stamp duty & legal fees (cash only)
├── Construction          growth 6%/yr, loan-eligible
│   ├── Building  1,400 sq ft × Rs 17,000 × floor factor
│   ├── Staircase, architect, approvals, connections
│   └── Boundary wall  (perimeter ft) + gate
└── Furniture & appliances  (cash only)
    ├── Master bedroom: bed, mattress, pillows × 2, linen, wardrobe…
    ├── Other bedrooms × 2  (everything inside is multiplied by 2)
    └── Living, dining, kitchen, ACs, water heaters, curtains
```

`cost = qty × (unitPrice + sum of children)`. Prices grow at each item's own rate: land faster than furniture, TVs slower than general inflation. Items with no rate of their own follow the inflation rate you set.

### The simulation

Each month:

1. If the payers' savings cover the next goal at **that month's price**, you buy it. You pay cash, or the down payment if you take a loan. Its running costs (fuel, servicing, maintenance, or rent you no longer pay) join your monthly budget.
2. Each person's pay is added. Permanent pay rises once a year; intern pay stays flat until the permanent job starts. Living costs are taken away and rise with inflation every month. Loan instalments and running costs are taken away too. Interest is added on your savings.

Loans are capped so that all your instalments together stay under the share of pay that banks allow (40% by default). If the loan you asked for is too big, you keep saving until the down payment covers the difference. You save for goals in the order you list them.

### People and pay

Add 1 to 4 people who save together, like you and a partner. Each person has:

- **Work status:** permanent, intern / trainee, or studying. Interns and students have a current allowance, the month the permanent job starts, and the expected pay from then. Pay stays flat until that month. Yearly raises then start from the permanent salary, so a low intern salary doesn't drag down the whole forecast.
- **Living costs now, and after the new job starts.** Family support often stops once an intern goes permanent, so costs can change on the same date as pay.
- **Their own savings pot**, plus **emergency money** that is never spent on a goal. A purchase only happens if everyone still has their emergency money afterwards. It grows with inflation.
- **Age and retirement age.** Pay stops at retirement.

Each goal has a **Who pays** setting: together, or only one person. A shared goal uses everyone's savings, taking from each pot in proportion to its size. Its loan instalments and running costs are split by income, and the bank's loan limit is based on the payers' combined income. A personal goal uses only that person's money.

### Renting, then buying

The **Rent a place** goal estimates monthly rent from the area, type (annex, apartment or house), bedrooms and furnishing, or you can enter the rent yourself. Before moving in you save for the refundable deposit (usually 3–6 months' rent), the first month, an optional agent's fee, and moving costs. Rent and bills then add to your monthly costs. When a later **House** goal is bought (with "Move out of my rented place" on), the rent stops and the deposit is paid back into your savings.

### Custom goals

A **Custom goal** is anything else: a trip, a degree, a motorbike, a business. You set its name, what it costs today, whether its price rises with inflation, at your own rate or not at all, any monthly cost afterwards, and cash or a loan. Presets fill in common examples.

### Loans are optional

At the top of the Goals tab, choose **Use loans where they help** or **No loans, cash only**. With no loans, every goal is paid fully from savings and the loan fields are hidden. With loans allowed, each house or car can still be set to *Cash only, no loan* on its own.

### Retirement

The Retirement tab works out how much you need saved on the day you stop working:

- **No pension (25× rule):** yearly spending in retirement × 25, which means a 4% safe withdrawal rate. Rs 600,000 a year needs Rs 15,000,000.
- **With a pension or other guaranteed income (income-gap method):** (yearly spending − guaranteed income) ÷ 4%.
- Lump sums such as EPF, ETF and gratuity are subtracted. Every amount is entered in today's rupees and grown with inflation to the retirement date.

It compares that target with the savings your plan projects for that date, after all goals are bought and with emergency money excluded. If you're short, it finds the extra monthly saving that closes the gap. For each person it shows the age they **plan** to retire at next to the age they could retire **at this rate**: the first month, after every goal is bought, when savings already cover the target for retiring then, if everyone keeps working. That age can be earlier or later than planned. It also warns about loans still running after retirement.

The main timeline runs from today to at least 2070. It stretches further when a goal, a loan or retirement comes later, showing 5 years past retirement. At retirement, pay stops, the lump sums are paid out, and spending switches to your retirement spending minus any guaranteed income. The timeline then shows savings being drawn down, and marks the month they run out if that happens.

### Realism built in

- **House:** land price by area, a structural premium for each extra floor, plot coverage limits, a bathroom count derived from bedrooms, and rent that stops once you move in.
- **Car:** used-car value from age and mileage (Sri Lankan cars hold their value), plus fuel, servicing, tyres, insurance and the revenue licence.
- **Electric cars:** charging replaces fuel. Units used = km ÷ km per unit, plus 10% charging loss, split between home charging (normal tariff above 180 units, an overnight time-of-use tariff, or rooftop solar) and public fast chargers. There's an optional home wall charger, cheaper servicing every 10,000 km, slightly faster tyre wear, faster depreciation for used EVs because batteries age, and a battery-health warning for older ones. The breakdown shows what a similar petrol car would spend on fuel.
- **Wedding:** venue capacity with an automatic upgrade to a bigger venue, minimum-plate guarantees, half-price children's plates, alcohol worked out by drinkers × drinks ÷ 16 pegs per bottle plus corkage, invitations per household, cake pieces for guests, a homecoming built with the same rules, and a 5% contingency.

## Add a new goal type

1. Create `src/modules/trip.js` exporting `{ kind, label, fields, defaults(), presets, build(options) }`.
   `build` returns `{ tree, running, financing, warnings }`.
2. Add it to `MODULES` in `src/modules/index.js`.
3. Add a button: `<button class="add-btn" data-add="trip">Trip</button>` in `index.html`.

The form, the chart and the cost breakdown all work from the module's `fields` schema and tree, so you don't write any UI code.

## Updating prices

Edit `src/data/prices.js`. Sources used for the November 2026 figures:

- Land: LankaPropertyWeb Land Price Index 2025
- Construction cost per sq ft: contractor guides and LankaPropertyWeb (2025–26)
- Cars: brand-new listings on ikman.lk, November 2026
- Fuel: Ceylon Petroleum Corporation, Petrol 92 at Rs 414 (October 2026)
- Wedding packages: published hotel offers for 2025–26
- Inflation and deposit rates: Central Bank of Sri Lanka

All figures are estimates for planning, not quotes.

## Ideas for next steps

- Save for several goals at once, splitting savings between them
- Prices for other countries and currencies
- Price data kept in a database with an admin page to update it
- More goal types: education, travel, starting a business, retirement
- Share a plan by link

## License

MIT
