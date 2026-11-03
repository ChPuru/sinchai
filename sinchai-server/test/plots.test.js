// Exp 5 - the CRUD endpoints, the error codes (400 / 404 / 409) and who may see or change what
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Plot = require('../models/Plot');
const WeatherDay = require('../models/WeatherDay');
const { start, stop, call, makeUser, makePlot, PLOT, SATARA, putWeather, day, DEFAULT_CELL } = require('./helpers');
const { etc, tawMm } = require('../utils/waterBalance');
const { todayIST, addDays } = require('../utils/dates');

before(start);
after(stop);
afterEach(() => WeatherDay.deleteMany({})); // a stored reading from one test must not fill a gap in the next

test('CREATE 201 - the owner comes from the token, the client cannot choose it or the depletion bookkeeping', async () => {
  const a = await makeUser();
  const b = await makeUser();
  const res = await call('POST', '/api/plots', { token: a.token, body: { ...PLOT, owner: b.user.id, balanceDate: '2000-01-01', _id: '64b64b64b64b64b64b64b64b' } });
  assert.equal(res.status, 201);
  assert.equal(res.body.ownerId, a.user.id);
  assert.equal(res.body.balanceDate, todayIST());
  assert.equal(res.body.depletion, 0);
  assert.notEqual(res.body.id, '64b64b64b64b64b64b64b64b');
  assert.equal(res.body.weatherKey, '17.3,74.2'); // the ~11 km weather cell of the pin
  assert.equal(res.body.lat, 17.2905);
});

test('CREATE 400 with a message per invalid field; 409 for a repeated plot name', async () => {
  const { token } = await makeUser();
  const bad = await call('POST', '/api/plots', { token, body: { ...PLOT, soilType: 'rock', areaAcres: 0.01, pumpLph: 10, lat: 51.5, lng: -0.12 } });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.fields.soilType && bad.body.fields.areaAcres && bad.body.fields.pumpLph);
  assert.match(bad.body.fields.lat, /located in India/); // a pin outside India is refused
  assert.match(bad.body.fields.lng, /located in India/);
  const noPin = await call('POST', '/api/plots', { token, body: { ...PLOT, lat: undefined, lng: undefined } });
  assert.equal(noPin.status, 400);
  assert.match(noPin.body.fields.lat, /Click the map/);
  assert.equal((await call('POST', '/api/plots', { token, body: { name: 'only a name' } })).status, 400);
  assert.equal((await call('POST', '/api/plots', { token, body: { ...PLOT, areaAcres: 'lots' } })).status, 400);

  assert.equal((await call('POST', '/api/plots', { token, body: PLOT })).status, 201);
  const dup = await call('POST', '/api/plots', { token, body: PLOT });
  assert.equal(dup.status, 409);
  // another farmer may reuse the name
  const other = await makeUser();
  assert.equal((await call('POST', '/api/plots', { token: other.token, body: PLOT })).status, 201);
});

test('READ all is scoped: a farmer sees only their plots, a supervisor sees everybody\'s', async () => {
  const a = await makeUser();
  const b = await makeUser();
  const sup = await makeUser('supervisor');
  const pa = await makePlot(a.token, { name: 'A1' });
  await makePlot(b.token, { name: 'B1' });
  const mine = await call('GET', '/api/plots', { token: a.token });
  assert.deepEqual(mine.body.map((p) => p.name), ['A1']);
  assert.equal(mine.body[0].owner, 'Test Person');
  const all = await call('GET', '/api/plots', { token: sup.token });
  assert.ok(all.body.length >= 2);
  assert.ok(all.body.some((p) => p.id === pa.id));
});

test('READ all supports query-string filters (case-insensitive village, soilType, cropStage)', async () => {
  const { token } = await makeUser();
  await makePlot(token, { name: 'K', village: 'Karad', soilType: 'clay' });
  await makePlot(token, { name: 'S', ...SATARA, soilType: 'sandy', cropStage: 'maturity' });
  assert.deepEqual((await call('GET', '/api/plots?village=satara', { token })).body.map((p) => p.name), ['S']);
  assert.deepEqual((await call('GET', '/api/plots?soilType=clay', { token })).body.map((p) => p.name), ['K']);
  assert.deepEqual((await call('GET', '/api/plots?cropStage=maturity', { token })).body.map((p) => p.name), ['S']);
  // an operator object in the query string is just a harmless unknown string
  assert.equal((await call('GET', '/api/plots?village[$ne]=x', { token })).status, 200);
});

test('READ one / UPDATE / DELETE of somebody else\'s plot is 404; a supervisor may read but not change', async () => {
  const a = await makeUser();
  const b = await makeUser();
  const sup = await makeUser('supervisor');
  const plot = await makePlot(a.token, { name: 'Private' });
  assert.equal((await call('GET', '/api/plots/' + plot.id, { token: b.token })).status, 404);
  assert.equal((await call('PUT', '/api/plots/' + plot.id, { token: b.token, body: { name: 'Hacked' } })).status, 404);
  assert.equal((await call('DELETE', '/api/plots/' + plot.id, { token: b.token })).status, 404);
  assert.equal((await call('GET', '/api/plots/' + plot.id, { token: sup.token })).status, 200);
  assert.equal((await call('PUT', '/api/plots/' + plot.id, { token: sup.token, body: { name: 'x' } })).status, 403);
  assert.equal((await call('DELETE', '/api/plots/' + plot.id, { token: sup.token })).status, 403);
  assert.equal((await call('POST', '/api/plots', { token: sup.token, body: PLOT })).status, 403);
  assert.equal((await call('GET', '/api/plots/' + plot.id, { token: a.token })).body.name, 'Private');
});

test('invalid or unknown ids: 400 for a malformed id, 404 for a well-formed id that does not exist', async () => {
  const { token } = await makeUser();
  const bad = await call('GET', '/api/plots/not-an-id', { token });
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /Invalid _id/);
  assert.equal((await call('GET', '/api/plots/64b64b64b64b64b64b64b64b', { token })).status, 404);
});

test('UPDATE is partial (PUT and PATCH), runs the validators, and ignores fields a client must not set', async () => {
  const { token, user } = await makeUser();
  const plot = await makePlot(token);
  const put = await call('PUT', '/api/plots/' + plot.id, { token, body: { cropStage: 'maturity', owner: '64b64b64b64b64b64b64b64b', depletion: 999 } });
  assert.equal(put.status, 200);
  assert.equal(put.body.cropStage, 'maturity');
  assert.equal(put.body.name, plot.name); // untouched fields survive
  assert.equal(put.body.ownerId, user.id);
  assert.equal(put.body.depletion, 0);
  assert.equal((await call('PATCH', '/api/plots/' + plot.id, { token, body: { notes: 'drip line fixed' } })).body.notes, 'drip line fixed');
  const invalid = await call('PUT', '/api/plots/' + plot.id, { token, body: { pumpLph: 5 } });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.body.fields.pumpLph);
  assert.equal((await call('PUT', '/api/plots/' + plot.id, { token, body: {} })).status, 400);
  // renaming onto another of my plots collides with the unique (owner, name) index
  await makePlot(token, { name: 'Second' });
  assert.equal((await call('PUT', '/api/plots/' + plot.id, { token, body: { name: 'Second' } })).status, 409);
});

test('DELETE 200 removes the plot together with its irrigation log', async () => {
  const { token } = await makeUser();
  const plot = await makePlot(token);
  await call('POST', '/api/history', { token, body: { plotId: plot.id, hours: 1 } });
  const del = await call('DELETE', '/api/plots/' + plot.id, { token });
  assert.equal(del.status, 200);
  assert.equal(del.body.message, 'Plot deleted');
  assert.equal((await call('GET', '/api/plots/' + plot.id, { token })).status, 404);
  assert.deepEqual((await call('GET', '/api/history', { token })).body, []);
});

test('the daily balance rolls forward: every missed day adds ETc minus rain, clamped to 0..TAW', async () => {
  const { token } = await makeUser();
  const plot = await makePlot(token, { name: 'Roll', cropStage: 'tillering', soilType: 'loamy' });
  const today = todayIST();
  await Plot.updateOne({ _id: plot.id }, { depletion: 10, balanceDate: addDays(today, -4) });
  // the four past days, as the weather service would have stored them
  const past = [day({ et0: 5.2, rain: 0 }), day({ et0: 4.8, rain: 6 }), day({ et0: 6.1, rain: 0 }), day({ et0: 3.9, rain: 2.5 })];
  await putWeather(DEFAULT_CELL, past, addDays(today, -4));

  let expected = 10;
  for (const d of past) expected = Math.min(tawMm('loamy'), Math.max(0, expected + etc(d.et0, 'tillering') - d.rain));
  const res = await call('GET', '/api/plots/' + plot.id, { token });
  assert.equal(res.body.balanceDate, today);
  assert.ok(Math.abs(res.body.depletion - expected) < 0.06, 'got ' + res.body.depletion + ' expected ' + expected.toFixed(2));
  // asking again the same day must not add the days a second time
  const again = await call('GET', '/api/plots/' + plot.id, { token });
  assert.equal(again.body.depletion, res.body.depletion);
});

test('a past day with no real reading stops the roll-forward there - it is never estimated - and blocks the advisory', async () => {
  const { token } = await makeUser();
  const plot = await makePlot(token, { name: 'Gap', cropStage: 'tillering', soilType: 'loamy' });
  const today = todayIST();
  await Plot.updateOne({ _id: plot.id }, { depletion: 10, balanceDate: addDays(today, -4) });
  // real readings exist for only the two oldest of the four missed days, plus today and tomorrow
  const known = [day({ et0: 5.2 }), day({ et0: 4.8, rain: 6 })];
  await putWeather(DEFAULT_CELL, known, addDays(today, -4));
  await putWeather(DEFAULT_CELL, [day(), day()], today);

  let expected = 10;
  for (const d of known) expected = Math.min(tawMm('loamy'), Math.max(0, expected + etc(d.et0, 'tillering') - d.rain));
  const res = await call('GET', '/api/plots/' + plot.id, { token });
  assert.equal(res.body.balanceDate, addDays(today, -2)); // first day without data: nothing after it was applied
  assert.ok(Math.abs(res.body.depletion - expected) < 0.06, 'got ' + res.body.depletion + ' expected ' + expected.toFixed(2));
  const advisory = await call('GET', '/api/plots/' + plot.id + '/advisory', { token });
  assert.equal(advisory.status, 503);
});
