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
  data/prices.js        every price and rate, in one place
  engine/costTree.js    the cost tree: qty × (unit price + children), with per-item price growth
  engine/loan.js        instalment (EMI) maths
  engine/simulate.js    the month-by-month simulation
  modules/house.js      options → cost tree for a house
  modules/car.js        … for a car (new or used, with depreciation)
  modules/wedding.js    … for a wedding (venue rules, alcohol, homecoming)
  modules/index.js      the list of goal types
  ui/                   form rendering, timeline chart, app wiring
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

1. If your savings cover the next goal at **that month's price**, you buy it. You pay cash, or the down payment if you take a loan. Its running costs (fuel, servicing, maintenance, or rent you no longer pay) join your monthly budget.
2. Your pay is added. It rises once a year. Living costs are taken away and rise with inflation every month. Loan instalments and running costs are taken away too. Interest is added on your savings.

Loans are capped so that all your instalments together stay under the share of pay that banks allow (40% by default). If the loan you asked for is too big, you keep saving until the down payment covers the difference. You save for goals in the order you list them.

### Realism built in

- **House:** land price by area, a structural premium for each extra floor, plot coverage limits, a bathroom count derived from bedrooms, and rent that stops once you move in.
- **Car:** used-car value from age and mileage (Sri Lankan cars hold their value), plus fuel, servicing, tyres, insurance and the revenue licence.
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
