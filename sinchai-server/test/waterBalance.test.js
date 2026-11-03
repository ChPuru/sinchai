// The FAO-56 maths. Pure functions, so no database is needed.
// The last test makes the three copies of the maths (server, React client, Exp 4.1 lab module) prove they agree.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const wb = require('../utils/waterBalance');

const plot = { soilType: 'clay', cropStage: 'grand-growth', depletion: 20, areaAcres: 2.5, pumpLph: 90000 };
const hotDry = { et0: 6.2, rainToday: 0, rainTomorrow: 1, tmax: 41 };

test('the demo plot on a hot dry day needs a heat-adjusted irrigation of about 3 hours', () => {
  const a = wb.computeAdvisory(plot, hotDry);
  assert.equal(a.type, 'heat');
  assert.equal(a.etc, 7.8); // 6.2 * 1.25
  assert.equal(a.taw, 90); // clay 150 mm/m * 0.6 m
  assert.ok(Math.abs(a.depletion - 27.8) < 1e-9);
  assert.equal(a.hours, 3.1); // 27.8 mm * 2.5 ac * 4047 L / 90,000 L/hr
});

test('same plot, mild weather: plain irrigate instead of heat', () => {
  assert.equal(wb.computeAdvisory(plot, { ...hotDry, tmax: 35 }).type, 'irrigate');
});

test('a plot above its threshold waits, and says how many days are left', () => {
  const a = wb.computeAdvisory({ ...plot, depletion: 0 }, { et0: 4, rainToday: 0, rainTomorrow: 0, tmax: 30 });
  assert.equal(a.type, 'wait');
  assert.equal(a.hours, 0);
  assert.equal(a.daysLeft, 4); // threshold 27 mm, 5 mm per day -> 5 days to go, floor((27-5)/5) = 4
});

test('real rain tomorrow that brings the root zone back under the threshold means skip', () => {
  const a = wb.computeAdvisory(plot, { et0: 6.2, rainToday: 0, rainTomorrow: 18, tmax: 33 });
  assert.equal(a.type, 'skip');
  assert.equal(a.hours, 0);
});

test('a light drizzle does NOT cancel irrigation for a plot that is already dry', () => {
  const dry = { ...plot, depletion: 40 };
  const a = wb.computeAdvisory(dry, { et0: 1, rainToday: 0, rainTomorrow: 2, tmax: 30 }); // 2 mm >= ETc 1.3 mm, but 41 - 2 is still far over 27
  assert.equal(a.type, 'irrigate');
  assert.ok(a.hours > 0);
});

test('zero forecast rain is never "rain expected"', () => {
  assert.notEqual(wb.computeAdvisory(plot, { et0: 0, rainToday: 0, rainTomorrow: 0, tmax: 30 }).type, 'skip');
});

test('the soil model: sand holds less water than clay, so the same depletion needs irrigating sooner', () => {
  const w = { et0: 5, rainToday: 0, rainTomorrow: 0, tmax: 30 };
  const sandy = wb.computeAdvisory({ ...plot, soilType: 'sandy', depletion: 12 }, w);
  const clay = wb.computeAdvisory({ ...plot, soilType: 'clay', depletion: 12 }, w);
  assert.equal(sandy.type, 'irrigate');
  assert.equal(clay.type, 'wait');
});

test('litres <-> mm conversions are inverses', () => {
  assert.equal(wb.litresFromMm(1, 1), 4047);
  assert.ok(Math.abs(wb.mmFromLitres(wb.litresFromMm(12.5, 3.2), 3.2) - 12.5) < 1e-9);
});

test('heatwave risk looks at today and the next three days; alerts are heat or > 3 h of pumping', () => {
  const calm = { tmax: 33, forecast: [{ tmax: 33 }, { tmax: 34 }, { tmax: 35 }, { tmax: 36 }, { tmax: 41 }] };
  assert.deepEqual(wb.heatwave(calm), { active: false, upcoming: false, peak: 36 }); // day 5 is outside the 3-day window
  const coming = { ...calm, forecast: [{ tmax: 33 }, { tmax: 34 }, { tmax: 42 }, { tmax: 36 }, { tmax: 30 }] };
  assert.equal(wb.heatwave(coming).upcoming, true);
  assert.equal(wb.heatwave({ ...calm, tmax: 41 }).active, true);
  assert.equal(wb.isAlert({ type: 'heat', hours: 0.5 }), true);
  assert.equal(wb.isAlert({ type: 'irrigate', hours: 3.5 }), true);
  assert.equal(wb.isAlert({ type: 'irrigate', hours: 2 }), false);
  assert.equal(wb.isAlert({ type: 'skip', hours: 0 }), false);
});

test('server, React client and the Exp 4.1 lab module give identical advisories on a grid of inputs', async () => {
  const client = await import(pathToFileURL(path.join(__dirname, '..', '..', 'sinchai-client', 'src', 'utils', 'waterBalance.js')).href);
  const lab = require('../exp4.1-node-basics/3_custom_modules/waterBalance');

  let compared = 0;
  for (const soilType of ['sandy', 'loamy', 'clay']) {
    for (const cropStage of ['germination', 'tillering', 'grand-growth', 'maturity']) {
      for (const depletion of [0, 5, 12, 20, 33, 60]) {
        for (const weather of [
          { et0: 6.2, rainToday: 0, rainTomorrow: 1, tmax: 41 },
          { et0: 3, rainToday: 4, rainTomorrow: 12, tmax: 30 },
          { et0: 1, rainToday: 0, rainTomorrow: 2, tmax: 28 },
          { et0: 5.4, rainToday: 0, rainTomorrow: 0, tmax: 31 },
        ]) {
          const p = { soilType, cropStage, depletion, areaAcres: 2.5, pumpLph: 90000 };
          const expected = wb.computeAdvisory(p, weather);
          assert.deepEqual(client.computeAdvisory(p, weather), expected, 'client: ' + JSON.stringify({ p, weather }));
          assert.deepEqual(lab.advisory(p, weather), expected, 'exp4.1: ' + JSON.stringify({ p, weather }));
          compared += 1;
        }
      }
    }
  }
  assert.equal(compared, 3 * 4 * 6 * 4);
  assert.ok(fs.existsSync(path.join(__dirname, '..', '..', 'sinchai-client', 'src', 'utils', 'waterBalance.js')));
});
