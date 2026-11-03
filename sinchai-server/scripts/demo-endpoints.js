// Exp 5 step 3 - "Demonstrate the Endpoints": calls every endpoint of the running API, including the error cases,
// and prints a table of method, URL, expected and actual status. Use it instead of (or next to) Postman.
//   1. npm start            (in one terminal, MongoDB service running)
//   2. npm run demo         (in another)
// It registers its own throw-away farmer and supervisor (nothing is pre-loaded or hardcoded), talks to the real
// weather service, and deletes the data it created.
const config = require('../config');

const BASE = process.env.API_URL || 'http://localhost:' + config.port;
const rows = [];
let failed = 0;

async function call(label, method, path, { token, body, expect }) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  const ok = res.status === expect;
  if (!ok) failed += 1;
  rows.push({ ok, label, line: method.padEnd(7) + path, expect, status: res.status });
  return { status: res.status, data };
}

(async () => {
  const stamp = Date.now();
  const mobile = '9' + String(stamp).slice(-9);
  const farmer = { name: 'Demo Farmer', email: 'demo' + stamp + '@example.com', mobile, village: 'Karad', password: 'Demo@1234' };
  const supMobile = '8' + String(stamp).slice(-9);

  console.log('SinchAI API demo against ' + BASE + '\n');
  const health = await call('Health check', 'GET', '/api/health', { expect: 200 });
  if (health.data.database !== 'connected') throw new Error('The API is up but MongoDB is not connected');

  // ---- auth ----
  await call('Register - missing/invalid fields', 'POST', '/api/auth/register', { body: { name: 'x' }, expect: 400 });
  const reg = await call('Register a farmer', 'POST', '/api/auth/register', { body: farmer, expect: 201 });
  await call('Register the same email again', 'POST', '/api/auth/register', { body: { ...farmer, mobile: '9' + String(stamp + 1).slice(-9) }, expect: 409 });
  await call('Register as supervisor without the code', 'POST', '/api/auth/register', { body: { ...farmer, email: 's' + stamp + '@example.com', mobile: supMobile, role: 'supervisor' }, expect: 403 });
  await call('Login - wrong password', 'POST', '/api/auth/login', { body: { mobile, password: 'Wrong@1234' }, expect: 401 });
  const login = await call('Login', 'POST', '/api/auth/login', { body: { mobile, password: farmer.password }, expect: 200 });
  const token = login.data.token || reg.data.token;
  await call('Who am I (token)', 'GET', '/api/auth/me', { token, expect: 200 });
  await call('Who am I (no token)', 'GET', '/api/auth/me', { expect: 401 });

  // ---- plots: the five CRUD endpoints of Exp 5 ----
  // a sandy plot with a weak pump that is already dry: any real weather produces a long irrigation, i.e. a supervisor alert
  const plot = {
    name: 'Demo plot', village: 'Karad', soilType: 'sandy', cropStage: 'grand-growth', areaAcres: 3, pumpLph: 30000,
    habitHours: 6, pumpKw: 3.7, lat: 17.2905, lng: 74.179, depletion: 30,
  };
  await call('CREATE plot - missing fields', 'POST', '/api/plots', { token, body: { name: 'Only a name' }, expect: 400 });
  await call('CREATE plot - pin outside India', 'POST', '/api/plots', { token, body: { ...plot, name: 'Abroad', lat: 51.5, lng: -0.12 }, expect: 400 });
  const created = await call('CREATE plot', 'POST', '/api/plots', { token, body: plot, expect: 201 });
  const id = created.data.id;
  await call('CREATE plot - same name again', 'POST', '/api/plots', { token, body: plot, expect: 409 });
  await call('READ all plots', 'GET', '/api/plots', { token, expect: 200 });
  await call('READ all plots - filter ?village=karad', 'GET', '/api/plots?village=karad', { token, expect: 200 });
  await call('READ one plot', 'GET', '/api/plots/' + id, { token, expect: 200 });
  await call('READ one - malformed id', 'GET', '/api/plots/not-an-id', { token, expect: 400 });
  await call('READ one - unknown id', 'GET', '/api/plots/64b64b64b64b64b64b64b64b', { token, expect: 404 });
  await call('UPDATE plot (crop stage)', 'PUT', '/api/plots/' + id, { token, body: { cropStage: 'maturity' }, expect: 200 });
  await call('UPDATE plot - invalid pump', 'PUT', '/api/plots/' + id, { token, body: { pumpLph: 5 }, expect: 400 });
  await call('UPDATE plot - back to grand-growth', 'PATCH', '/api/plots/' + id, { token, body: { cropStage: 'grand-growth' }, expect: 200 });

  // ---- the science: live weather, advisory, irrigation, analytics ----
  await call('Live weather at a point (query string)', 'GET', '/api/weather/point?lat=17.2905&lng=74.179', { token, expect: 200 });
  await call('Live weather for my plots', 'GET', '/api/weather', { token, expect: 200 });
  const advice = await call('FAO-56 advisory for the plot', 'GET', '/api/plots/' + id + '/advisory', { token, expect: 200 });
  await call('Advisories for all my plots', 'GET', '/api/advisories', { token, expect: 200 });
  const hours = advice.data.advisory && advice.data.advisory.hours > 0 ? advice.data.advisory.hours : 2;
  await call('Log an irrigation - invalid hours', 'POST', '/api/history', { token, body: { plotId: id, hours: 99 }, expect: 400 });
  const log = await call('Log an irrigation (follows advisory)', 'POST', '/api/history', { token, body: { plotId: id, hours, advised: true }, expect: 201 });
  await call('Irrigation history', 'GET', '/api/history?plot=' + id, { token, expect: 200 });
  await call('Edit an irrigation log', 'PUT', '/api/history/' + log.data.log.id, { token, body: { hours: 1 }, expect: 200 });
  await call('Water-saving analytics', 'GET', '/api/analytics/summary', { token, expect: 200 });
  await call('Delete the irrigation log', 'DELETE', '/api/history/' + log.data.log.id, { token, expect: 200 });
  await call('Save my language', 'PATCH', '/api/users/me', { token, body: { language: 'mr' }, expect: 200 });

  // ---- roles: a supervisor (registered with the access code) reads everything and acknowledges alerts ----
  await call('Supervisor-only alerts as a farmer', 'GET', '/api/alerts', { token, expect: 403 });
  const sup = await call('Register a supervisor (with the access code)', 'POST', '/api/auth/register', {
    body: { name: 'Demo Supervisor', email: 'sup' + stamp + '@example.com', mobile: supMobile, village: 'Karad', password: 'Demo@1234', role: 'supervisor', supervisorCode: config.supervisorCode },
    expect: 201,
  });
  const supToken = sup.data.token;
  const alerts = await call('Alerts as a supervisor', 'GET', '/api/alerts', { token: supToken, expect: 200 });
  const mine = Array.isArray(alerts.data) ? alerts.data.find((a) => a.plotId === id) : null;
  if (mine) await call('Acknowledge the alert', 'POST', '/api/alerts/' + mine.id + '/ack', { token: supToken, expect: 200 });
  await call('Supervisor reads every plot', 'GET', '/api/plots', { token: supToken, expect: 200 });
  await call('Supervisor may not create a plot', 'POST', '/api/plots', { token: supToken, body: { ...plot, name: 'Not allowed' }, expect: 403 });
  await call('Supervisor may not delete a farmer\'s plot', 'DELETE', '/api/plots/' + id, { token: supToken, expect: 403 });
  await call('Unknown API route', 'GET', '/api/nothing', { expect: 404 });

  // ---- clean up ----
  await call('DELETE plot', 'DELETE', '/api/plots/' + id, { token, expect: 200 });
  await call('READ deleted plot', 'GET', '/api/plots/' + id, { token, expect: 404 });

  // ---- print ----
  console.log('Result  Status  Endpoint');
  for (const r of rows) {
    console.log((r.ok ? ' PASS  ' : ' FAIL  ') + '  ' + String(r.status).padEnd(5) + '  ' + r.line.padEnd(58) + ' ' + r.label + (r.ok ? '' : '   (expected ' + r.expect + ')'));
  }
  console.log('\n' + (rows.length - failed) + '/' + rows.length + ' endpoints behaved as expected' + (mine ? '' : '  (no alert existed for the demo plot today, so "Acknowledge" was not exercised)'));
  console.log('(the two throw-away accounts stay in MongoDB: mobile ' + mobile + ' and ' + supMobile + ')');
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('\nDemo stopped: ' + err.message);
  console.error('Is the API running?  cd sinchai-server && npm start');
  process.exit(1);
});
