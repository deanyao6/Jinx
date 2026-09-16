// The catalogue of screens and states the parity harness compares.
//
// Each entry names one screen of design/reference.html and, where the screen has
// interactive states, one state of it. `nth` picks the reference's phone frame by
// order in the rail; `prepare` is run inside the page to drive that frame into the
// state before the shot is taken, using the reference's own event handlers rather
// than reaching into its internals, so a state can only be reached the way a user
// would reach it.
//
// `route` names the screen and state the app should show, written as a URL because that
// is the clearest way to express it. The harness delivers it over the loopback control
// channel rather than as a deep link; see scripts/parity/control.mjs for why. Screens
// the app has not been rebuilt to yet still get a reference shot, so this catalogue
// doubles as the M0.5 to-do list.
//
// `prepare(page)` receives the Playwright page. Every other phone frame is hidden by
// then, so a selector only ever resolves inside the screen being shot.

export const THEMES = ['light', 'dark'];

export const SCREENS = [
  {
    id: 'passport-all',
    nth: 0,
    label: 'Passport, All teams',
    route: 'jinx://parity/passport?team=all',
  },
  {
    id: 'passport-phi',
    nth: 0,
    label: 'Passport, Phillies pill',
    route: 'jinx://parity/passport?team=phi',
    async prepare(page) {
      await page.click('#passport .fx-pill[data-team="phi"]');
    },
  },
  {
    id: 'passport-phl',
    nth: 0,
    label: 'Passport, Eagles pill',
    route: 'jinx://parity/passport?team=phl',
    async prepare(page) {
      await page.click('#passport .fx-pill[data-team="phl"]');
    },
  },
  {
    id: 'passport-log-phillies',
    nth: 0,
    label: 'Record game log, Phillies',
    route: 'jinx://parity/passport?team=all&log=phi',
    async prepare(page) {
      await page.click('#tiles button[data-log="phi"]');
      // The panel slides in over 320ms; wait for it to settle, not for a fixed delay.
      await page.waitForFunction(() => {
        const p = document.querySelector('#logPanel');
        return p && p.classList.contains('open') && p.getBoundingClientRect().left <= 1;
      });
    },
  },
  {
    id: 'passport-log-neutral',
    nth: 0,
    label: 'Record game log, As a neutral',
    route: 'jinx://parity/passport?team=all&log=neutral',
    async prepare(page) {
      await page.click('#tiles button[data-log="neutral"]');
      await page.waitForFunction(() => {
        const p = document.querySelector('#logPanel');
        return p && p.classList.contains('open') && p.getBoundingClientRect().left <= 1;
      });
    },
  },
  {
    id: 'pick-a-side',
    nth: 1,
    label: 'Pick a side, nothing picked',
    route: 'jinx://parity/pick-a-side',
  },
  {
    id: 'pick-a-side-picked',
    nth: 1,
    label: 'Pick a side, Phillies picked',
    route: 'jinx://parity/pick-a-side?picked=phi',
    async prepare(page) {
      await page.locator('.fx-root').first().click();
    },
  },
  {
    id: 'games',
    nth: 2,
    label: 'Games, History',
    route: 'jinx://parity/games',
  },
  {
    id: 'relive-start',
    nth: 3,
    label: 'Relive, pregame',
    route: 'jinx://parity/relive?step=0',
  },
  {
    id: 'relive-mid',
    nth: 3,
    label: 'Relive, mid story',
    route: 'jinx://parity/relive?step=5',
    // Story step 5. Clicking play advances one step immediately, then the harness
    // steps the frozen 1.7s timer four more times.
    async prepare(page) {
      await page.click('#rvPlay');
      await page.evaluate(() => window.__parityTick(4 * 1700));
    },
  },
  {
    id: 'game-day',
    nth: 4,
    label: 'Game day plan',
    route: 'jinx://parity/plan',
  },
  {
    id: 'guide-food',
    nth: 5,
    label: 'Stadium guide, Food',
    route: 'jinx://parity/guide?tab=food',
  },
  {
    id: 'guide-bathrooms',
    nth: 5,
    label: 'Stadium guide, Bathrooms',
    route: 'jinx://parity/guide?tab=bath',
    async prepare(page) {
      await page.click('[data-tab="bath"]');
    },
  },
  {
    id: 'guide-seats',
    nth: 5,
    label: 'Stadium guide, Seats',
    route: 'jinx://parity/guide?tab=seats',
    async prepare(page) {
      await page.click('[data-tab="seats"]');
    },
  },
  {
    id: 'profile',
    nth: 6,
    label: 'Profile',
    route: 'jinx://parity/profile',
  },
  {
    id: 'friends',
    nth: 6,
    label: 'Friends panel',
    route: 'jinx://parity/profile?panel=friends',
    async prepare(page) {
      await page.click('#openFriends');
      await page.waitForFunction(() => {
        const p = document.querySelector('#friends');
        return p && p.classList.contains('open') && p.getBoundingClientRect().left <= 1;
      });
    },
  },
];

export function screenById(id) {
  const s = SCREENS.find((x) => x.id === id);
  if (!s)
    throw new Error(
      `No parity screen named "${id}". Known: ${SCREENS.map((x) => x.id).join(', ')}`,
    );
  return s;
}
