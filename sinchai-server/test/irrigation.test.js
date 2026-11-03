// irrigation log, weather, advisories, alerts, analytics
// Weather: the product never invents a reading, so tests that need a forecast store their own readings in the test
// database (putWeather) or hand the service a fake Open-Meteo reply - they never call the real service.
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const WeatherDay = require('../models/WeatherDay');
const { start, stop, call, makeUser, makePlot, nativeFetch, config, putWeather, day, HOT_WEEK, RAINY_WEEK, DEFAULT_CELL } = require('./helpers');
const { todayIST, addDays } = require('../utils/dates');

before(start);
after(stop);
afterEach(async () => {
  config.weather.offline = true;
  globalThis.fetch = nativeFetch;
  await WeatherDay.deleteMany({});
});

const near = (a, b, tol = 0.06) => Math.abs(a - b) < tol;
// 1 h at 90,000 L/hr on 2.5 acres = 90,000 / (2.5 * 4047) mm
const MM_PER_HOUR = 90000 / (2.5 * 4047);

test('logging irrigation: the server works out litres, lowers the depletion, and delete / edit put it back exactly', async () => {
  const { token } = await makeUser();
  const plot = await makePlot(token, { depletion: 20 });

  const res = await call('POST', '/api/history', { token, body: { plotId: plot.id, hours: 1, advised: true, litres: 1 } });
  assert.equal(res.status, 201);
  assert.equal(res.body.log.litres, 90000); // hours * pump, whatever the client sent
  assert.equal(res.body.log.absorbedMm, undefined);
  assert.ok(near(res.body.plot.depletion, 20 - MM_PER_HOUR), 'depletion ' + res.body.plot.depletion);

  const edit = await call('PUT', '/api/history/' + res.body.log.id, { token, body: { hours: 0.5 } });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.log.litres, 45000);
  assert.ok(near(edit.body.plot.depletion, 20 - MM_PER_HOUR / 2), 'after edit ' + edit.body.plot.depletion);

  const del = await call('DELETE', '/api/history/' + res.body.log.id, { token });
  assert.equal(del.status, 200);
  assert.ok(near(del.body.plot.depletion, 20), 'after delete ' + del.body.plot.depletion);
});

test('an over-long irrigation only removes what the soil could absorb, so deleting it does not invent dryness', async () => {
  const { token } = await makeUser();
  const plot = await makePlot(token, { depletion: 5 });
  const res = await call('POST', '/api/history', { token, body: { plotId: plot.id, hours: 6 } }); // far more than 5 mm
  assert.equal(res.body.plot.depletion, 0);
  const del = await call('DELETE', '/api/history/' + res.body.log.id, { token });
  assert.ok(near(del.body.plot.depletion, 5), 'got ' + del.body.plot.depletion);
});

test('a back-dated entry is only a record: it does not change the depletion', async () => {
  const { token } = await makeUser();
  const plot = await makePlot(token, { depletion: 20 });
  const res = await call('POST', '/api/history', { token, body: { plotId: plot.id, hours: 2, date: addDays(todayIST(), -3) } });
  assert.equal(res.status, 201);
  assert.equal(res.body.plot.depletion, 20);
});

test('irrigation log validation and ownership', async () => {
  const a = await makeUser();
  const b = await makeUser();
  const sup = await makeUser('supervisor');
  const plot = await makePlot(a.token);
  const post = (body, token = a.token) => call('POST', '/api/history', { token, body });
  assert.equal((await post({ plotId: plot.id, hours: 0 })).status, 400);
  assert.equal((await post({ plotId: plot.id, hours: 25 })).status, 400);
  assert.equal((await post({ plotId: plot.id, hours: 'abc' })).status, 400);
  assert.equal((await post({ plotId: plot.id })).status, 400);
  assert.equal((await post({ hours: 1 })).status, 400);
  assert.equal((await post({ plotId: plot.id, hours: 1, date: addDays(todayIST(), 2) })).status, 400);
  assert.equal((await post({ plotId: plot.id, hours: 1, date: '2026-02-31' })).status, 400);
  assert.equal((await post({ plotId: plot.id, hours: 1, date: addDays(todayIST(), -400) })).status, 400);
  assert.equal((await post({ plotId: 'zzz', hours: 1 })).status, 400);
  assert.equal((await post({ plotId: plot.id, hours: 1 }, b.token)).status, 404); // not b's plot
  assert.equal((await post({ plotId: plot.id, hours: 1 }, sup.token)).status, 403); // supervisors read only
  const ok = await post({ plotId: plot.id, hours: 1 });
  assert.equal(ok.status, 201);
  assert.equal((await call('GET', '/api/history/' + ok.body.log.id, { token: b.token })).status, 404);
  assert.equal((await call('PUT', '/api/history/' + ok.body.log.id, { token: b.token, body: { hours: 2 } })).status, 404);
  assert.equal((await call('PUT', '/api/history/' + ok.body.log.id, { token: a.token, body: { hours: 99 } })).status, 400);
  assert.equal((await call('DELETE', '/api/history/' + ok.body.log.id, { token: b.token })).status, 404);
  assert.equal((await call('GET', '/api/history/' + ok.body.log.id, { token: sup.token })).status, 200);
});

test('history list is scoped and can be filtered by ?plot=', async () => {
  const a = await makeUser();
  const b = await makeUser();
  const p1 = await makePlot(a.token, { name: 'P1' });
  const p2 = await makePlot(a.token, { name: 'P2' });
  const pb = await makePlot(b.token, { name: 'PB' });
  await call('POST', '/api/history', { token: a.token, body: { plotId: p1.id, hours: 1 } });
  await call('POST', '/api/history', { token: a.token, body: { plotId: p2.id, hours: 2 } });
  await call('POST', '/api/history', { token: b.token, body: { plotId: pb.id, hours: 3 } });
  assert.equal((await call('GET', '/api/history', { token: a.token })).body.length, 2);
  const only = await call('GET', '/api/history?plot=' + p2.id, { token: a.token });
  assert.deepEqual(only.body.map((l) => l.hours), [2]);
});

// ---- weather: real readings only ------------------------------------------------------------------------------
test('no real weather -> 503 "unavailable"; the API never makes a number up', async () => {
  const { token } = await makeUser();
  const res = await call('GET', '/api/weather/point?lat=17.2905&lng=74.179', { token });
  assert.equal(res.status, 503);
  assert.equal(res.body.code, 'WEATHER_UNAVAILABLE');
  assert.equal(res.body.tmax, undefined);
});

test('stored real readings are served in the shape the client expects', async () => {
  const { token } = await makeUser();
  await putWeather(DEFAULT_CELL, [day({ tmax: 34.2, et0: 5.4 }), day({ rain: 3.1 }), day(), day(), day()]);
  const res = await call('GET', '/api/weather/point?lat=17.2905&lng=74.179', { token });
  assert.equal(res.status, 200);
  assert.equal(res.body.source, 'open-meteo');
  assert.equal(res.body.date, todayIST());
  assert.equal(res.body.tmax, 34.2);
  assert.equal(res.body.et0, 5.4);
  assert.equal(res.body.rainTomorrow, 3.1);
  assert.equal(res.body.forecast.length, 5);
  assert.ok(res.body.fetchedAt);
  assert.equal((await call('GET', '/api/weather/point?lat=17.2905&lng=74.179')).status, 401);
});

test('weather/point validates its query string', async () => {
  const { token } = await makeUser();
  assert.equal((await call('GET', '/api/weather/point', { token })).status, 400);
  assert.equal((await call('GET', '/api/weather/point?lat=abc&lng=74', { token })).status, 400);
  assert.equal((await call('GET', '/api/weather/point?lat=51.5&lng=-0.12', { token })).status, 400); // London is not India
});

test('GET /api/weather returns one reading per weather cell, lists a cell with no data as unavailable, and shares cells', async () => {
  const { token } = await makeUser();
  await makePlot(token, { name: 'K', village: 'Karad' });
  await makePlot(token, { name: 'K2', village: 'Karad', lat: 17.2862, lng: 74.1881 }); // same ~11 km cell as the first plot
  await makePlot(token, { name: 'S', village: 'Satara', lat: 17.6742, lng: 74.0247 }); // a second cell
  await putWeather(DEFAULT_CELL, Array.from({ length: 6 }, () => day()));
  const res = await call('GET', '/api/weather', { token });
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body.villages), ['17.3,74.2']); // two plots, one cell
  assert.equal(res.body.primary, '17.3,74.2'); // the cell of the account's own village (Karad)
  assert.deepEqual(res.body.unavailable, [{ key: '17.7,74.0', village: 'Satara' }]); // no reading stored: reported, not invented
});

test('heatwave and rain readings are recognised', async () => {
  const { token } = await makeUser();
  await putWeather(DEFAULT_CELL, HOT_WEEK);
  const hot = (await call('GET', '/api/weather/point?lat=17.2905&lng=74.179', { token })).body;
  assert.ok(hot.tmax >= 40);
  assert.equal(hot.heatwave.active, true);
  assert.equal(hot.heatwave.upcoming, true);
  await putWeather(DEFAULT_CELL, RAINY_WEEK);
  const wet = (await call('GET', '/api/weather/point?lat=17.2905&lng=74.179', { token })).body;
  assert.ok(wet.rainTomorrow >= 10);
  assert.equal(wet.heatwave.active, false);
});

// a reply in the shape the real Open-Meteo API sends (what the client of fetchOpenMeteo sees)
const OPEN_METEO_REPLY = (today) => ({
  daily: {
    time: [0, 1, 2, 3, 4, 5].map((i) => addDays(today, i)),
    temperature_2m_max: [33, 34, 35, 36, 37, 38],
    temperature_2m_min: [20, 21, 22, 23, 24, 25],
    precipitation_sum: [0, 4.5, 0, 0, 12, 0],
    et0_fao_evapotranspiration: [5.1, 5.2, 5.3, 5.4, 4, 5],
    relative_humidity_2m_mean: [55, 56, 57, 58, 70, 60],
  },
});

test('an Open-Meteo reply is parsed, stored in MongoDB and cached (one network call, then the stored copy)', async () => {
  const { token } = await makeUser();
  let calls = 0;
  config.weather.offline = false;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /api\.open-meteo\.com/);
    assert.match(String(url), /latitude=16\.9/); // the cell centre of the point asked for
    calls += 1;
    return { ok: true, status: 200, json: async () => OPEN_METEO_REPLY(todayIST()) };
  };
  const first = (await call('GET', '/api/weather/point?lat=16.8524&lng=74.5815', { token })).body;
  assert.equal(first.source, 'open-meteo');
  assert.equal(first.tmax, 33);
  assert.equal(first.rainTomorrow, 4.5);
  assert.equal(first.et0, 5.1);
  assert.equal(await WeatherDay.countDocuments({ location: '16.9,74.6', source: 'open-meteo' }), 6);
  await call('GET', '/api/weather/point?lat=16.8524&lng=74.5815', { token });
  assert.equal(calls, 1);
});

test('a day Open-Meteo has no complete data for is skipped, never filled in', async () => {
  const { token } = await makeUser();
  config.weather.offline = false;
  globalThis.fetch = async () => {
    const reply = OPEN_METEO_REPLY(todayIST());
    reply.daily.et0_fao_evapotranspiration[3] = null; // the model has no ET0 for day 3
    return { ok: true, status: 200, json: async () => reply };
  };
  await call('GET', '/api/weather/point?lat=17.0485&lng=74.2679', { token });
  assert.equal(await WeatherDay.countDocuments({ location: '17.0,74.3' }), 5);
});

test('if the stored weather disappears while the server runs (database wiped / restored) it is fetched again', async () => {
  const { token } = await makeUser();
  let calls = 0;
  config.weather.offline = false;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => OPEN_METEO_REPLY(todayIST()) };
  };
  const url = '/api/weather/point?lat=18.1514&lng=74.5776';
  assert.equal((await call('GET', url, { token })).status, 200);
  await WeatherDay.deleteMany({ location: '18.2,74.6' }); // the in-memory "fresh" note now lies
  assert.equal((await call('GET', url, { token })).body.source, 'open-meteo');
  assert.equal(calls, 2);
});

test('when Open-Meteo is down and nothing was fetched before: 503, and the dead service is not hammered', async () => {
  const { token } = await makeUser();
  let calls = 0;
  config.weather.offline = false;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('network down');
  };
  const url = '/api/weather/point?lat=16.5785&lng=74.3156';
  assert.equal((await call('GET', url, { token })).status, 503);
  assert.equal((await call('GET', url, { token })).status, 503);
  assert.equal(calls, 1);
});

test('when Open-Meteo is down, readings fetched earlier are still real and still served', async () => {
  const { token } = await makeUser();
  await putWeather('19.1,74.7', [day({ tmax: 36 }), day(), day(), day(), day()]);
  config.weather.offline = false;
  globalThis.fetch = async () => {
    throw new Error('network down');
  };
  const res = await call('GET', '/api/weather/point?lat=19.0952&lng=74.7496', { token });
  assert.equal(res.status, 200);
  assert.equal(res.body.tmax, 36);
});

// ---- advisories and alerts -------------------------------------------------------------------------------------
test('advisories: heatwave readings -> heat advice for a dry plot; rain readings -> skip; one stored row per plot per day', async () => {
  const { token } = await makeUser();
  const plot = await makePlot(token, { depletion: 20 });
  await putWeather(DEFAULT_CELL, HOT_WEEK);
  let adv = (await call('GET', '/api/advisories', { token })).body;
  assert.equal(adv.advisories.length, 1);
  assert.deepEqual(adv.unavailable, []);
  assert.equal(adv.advisories[0].type, 'heat');
  assert.ok(adv.advisories[0].hours > 3);
  await putWeather(DEFAULT_CELL, RAINY_WEEK);
  adv = (await call('GET', '/api/advisories', { token })).body;
  assert.equal(adv.advisories[0].type, 'skip');
  assert.equal(adv.advisories[0].hours, 0);
  const single = await call('GET', '/api/plots/' + plot.id + '/advisory', { token });
  assert.equal(single.body.advisory.type, 'skip');
  assert.equal(single.body.weather.source, 'open-meteo');
});

test('a plot with no live weather gets no advisory (listed as unavailable, single advisory is 503) - nothing is guessed', async () => {
  const { token } = await makeUser();
  const plot = await makePlot(token);
  const list = await call('GET', '/api/advisories', { token });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.advisories, []);
  assert.deepEqual(list.body.unavailable, [plot.id]);
  const single = await call('GET', '/api/plots/' + plot.id + '/advisory', { token });
  assert.equal(single.status, 503);
  assert.equal(single.body.code, 'WEATHER_UNAVAILABLE');
});

test('alerts: supervisors only; acknowledgement is stored and survives a re-fetch; non-alerts cannot be acknowledged', async () => {
  const farmer = await makeUser();
  const sup = await makeUser('supervisor');
  const plot = await makePlot(farmer.token, { name: 'Hot plot', depletion: 20 });
  await putWeather(DEFAULT_CELL, HOT_WEEK);

  assert.equal((await call('GET', '/api/alerts', { token: farmer.token })).status, 403);
  assert.equal((await call('GET', '/api/alerts')).status, 401);

  const list = (await call('GET', '/api/alerts', { token: sup.token })).body;
  const alert = list.find((a) => a.plotId === plot.id);
  assert.ok(alert, 'the heat-stress plot is in the supervisor list');
  assert.equal(alert.kind, 'heat');
  assert.equal(alert.acknowledged, false);
  assert.equal(alert.owner, 'Test Person');

  assert.equal((await call('POST', '/api/alerts/' + alert.id + '/ack', { token: farmer.token })).status, 403);
  const ack = await call('POST', '/api/alerts/' + alert.id + '/ack', { token: sup.token });
  assert.equal(ack.status, 200);
  assert.equal(ack.body.acknowledged, true);
  const after = (await call('GET', '/api/alerts', { token: sup.token })).body.find((a) => a.plotId === plot.id);
  assert.equal(after.acknowledged, true);
  assert.equal((await call('POST', '/api/alerts/64b64b64b64b64b64b64b64b/ack', { token: sup.token })).status, 404);
  assert.equal((await call('POST', '/api/alerts/xyz/ack', { token: sup.token })).status, 400);

  // the same advisory row is re-used when the weather turns rainy: it is no longer an alert, so it cannot be acknowledged
  await putWeather(DEFAULT_CELL, RAINY_WEEK);
  await call('GET', '/api/advisories', { token: farmer.token });
  assert.equal((await call('POST', '/api/alerts/' + alert.id + '/ack', { token: sup.token })).status, 400);
  assert.equal((await call('GET', '/api/alerts', { token: sup.token })).body.some((a) => a.plotId === plot.id), false);
});

// ---- analytics: only the farmer's own inputs ------------------------------------------------------------------
test('analytics: saving and energy come from the farmer\'s own usual hours and pump power', async () => {
  const { token } = await makeUser();
  // the farmer says: "I usually water this plot for 3 hours" and "the pump is 5 kW"
  const plot = await makePlot(token, { name: 'Stats', areaAcres: 2, pumpLph: 60000, depletion: 30, habitHours: 3, pumpKw: 5 });
  assert.equal(plot.habitHours, 3);
  assert.equal(plot.pumpKw, 5);
  await call('POST', '/api/history', { token, body: { plotId: plot.id, hours: 2, advised: true } }); // 120,000 L, followed the advice
  await call('POST', '/api/history', { token, body: { plotId: plot.id, hours: 1, advised: false } }); // 60,000 L, by habit

  const res = await call('GET', '/api/analytics/summary', { token });
  assert.equal(res.status, 200);
  assert.equal(res.body.litres, 180000);
  assert.equal(res.body.hours, 3);
  assert.equal(res.body.events, 2);
  assert.equal(res.body.advisedEvents, 1);
  assert.equal(res.body.savedLitres, 3 * 60000 - 120000); // usual 3 h vs the 2 h actually pumped, advised event only
  assert.equal(res.body.baselineLitres, 3 * 60000 + 60000); // an advised event's baseline is the usual 3 h; a manual one is itself
  assert.equal(res.body.kwh, 15); // 3 pump hours x 5 kW
  assert.deepEqual(res.body.coverage, { plots: 1, habit: 1, pumpKw: 1 });
  assert.equal(res.body.weekly.length, 8);
  assert.equal(res.body.weekly.reduce((s, w) => s + w.litres, 0), 180000);
  assert.equal(res.body.perPlot[0].name, 'Stats');
});

test('analytics: with no usual hours / pump power entered, no saving or energy figure is claimed (null, not an assumption)', async () => {
  const { token } = await makeUser();
  const plot = await makePlot(token, { name: 'Plain' });
  assert.equal(plot.habitHours, null);
  assert.equal(plot.pumpKw, null);
  await call('POST', '/api/history', { token, body: { plotId: plot.id, hours: 2, advised: true } });
  const res = await call('GET', '/api/analytics/summary', { token });
  assert.equal(res.body.litres, 180000);
  assert.equal(res.body.savedLitres, null);
  assert.equal(res.body.kwh, null);
  assert.deepEqual(res.body.coverage, { plots: 1, habit: 0, pumpKw: 0 });
});

test('the optional inputs are validated and can be cleared again', async () => {
  const { token } = await makeUser();
  assert.equal((await call('POST', '/api/plots', { token, body: { ...require('./helpers').PLOT, habitHours: 30 } })).status, 400);
  assert.equal((await call('POST', '/api/plots', { token, body: { ...require('./helpers').PLOT, pumpKw: 0 } })).status, 400);
  const plot = await makePlot(token, { habitHours: 2.5, pumpKw: 3.7 });
  const cleared = await call('PUT', '/api/plots/' + plot.id, { token, body: { habitHours: null, pumpKw: null } });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.habitHours, null);
  assert.equal(cleared.body.pumpKw, null);
});
