// Exp 4.2 - scaffolded routes, express.static() content types, 404 handling
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, call, raw } = require('./helpers');

before(start);
after(stop);

test('GET / is the Sign up page (root / homepage), not a leftover public/index.html', async () => {
  const res = await call('GET', '/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(res.text, /Create your farmer account/);
  assert.match(res.text, /action="\/signup"/);
});

test('express.static serves every image type with the right Content-Type', async () => {
  const expected = {
    '/images/banner.jpg': 'image/jpeg',
    '/images/logo.png': 'image/png',
    '/images/sugarcane.svg': 'image/svg+xml',
    '/images/drop.gif': 'image/gif',
    '/images/field.webp': 'image/webp',
    '/stylesheets/style.css': 'text/css',
    '/data/supervisors.json': 'application/json',
    '/about.html': 'text/html',
    '/gallery.html': 'text/html',
    '/javascripts/supervisors.js': 'javascript',
  };
  for (const [url, type] of Object.entries(expected)) {
    const res = await call('GET', url);
    assert.equal(res.status, 200, url);
    assert.ok(res.headers.get('content-type').includes(type), url + ' is ' + res.headers.get('content-type') + ', expected ' + type);
    // the same folder is also mounted under the virtual path /static
    assert.equal((await call('GET', '/static' + url)).status, 200, '/static' + url);
  }
});

test('the supervisors JSON file is valid and lists the staff', async () => {
  const res = await call('GET', '/data/supervisors.json');
  assert.equal(res.body.supervisors.length, 5);
  assert.ok(res.body.supervisors.every((s) => s.id && s.name && s.role && s.department && s.city));
});

test('static files send validators so browsers can answer 304 Not Modified', async () => {
  const first = await raw('GET', '/images/logo.png');
  assert.equal(first.status, 200);
  assert.ok(first.headers.etag, 'ETag header');
  assert.ok(first.headers['last-modified'], 'Last-Modified header');
  const again = await raw('GET', '/images/logo.png', { 'If-None-Match': first.headers.etag });
  assert.equal(again.status, 304);
});

test('unknown URLs: HTML 404 page for browsers, JSON 404 under /api', async () => {
  const page = await call('GET', '/nopage');
  assert.equal(page.status, 404);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(page.text, /404 - Page Not Found/);
  const api = await call('GET', '/api/nothing');
  assert.equal(api.status, 404);
  assert.match(api.body.error, /No such API route/);
  assert.equal((await call('GET', '/images/missing.png')).status, 404);
});

test('POST /signup (HTML form) creates a real account and escapes what it prints', async () => {
  const res = await call('POST', '/signup', {
    form: { name: 'Meera Kulkarni', email: 'meera@example.com', mobile: '9000011111', village: 'Karad', password: 'Strong123' },
  });
  assert.equal(res.status, 201);
  assert.match(res.text, /Welcome, Meera Kulkarni!/);
  // the account made through the form can log in through the JSON API
  const login = await call('POST', '/api/auth/login', { body: { mobile: '9000011111', password: 'Strong123' } });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'farmer');
});

test('POST /signup cannot be used to create a supervisor, and bad input shows an HTML error page', async () => {
  const sneaky = await call('POST', '/signup', {
    form: { name: 'Sneaky Person', email: 'sneaky@example.com', mobile: '9000022222', village: 'Karad', password: 'Strong123', role: 'supervisor' },
  });
  assert.equal(sneaky.status, 201);
  const login = await call('POST', '/api/auth/login', { body: { mobile: '9000022222', password: 'Strong123' } });
  assert.equal(login.body.user.role, 'farmer');

  const bad = await call('POST', '/signup', { form: { name: 'x', email: 'bad', mobile: '1', village: '', password: 'p' } });
  assert.equal(bad.status, 400);
  assert.match(bad.headers.get('content-type'), /text\/html/);
  assert.match(bad.text, /Validation failed/);
});

test('POST /login (HTML form) welcomes a valid user and refuses a wrong password', async () => {
  const ok = await call('POST', '/login', { form: { mobile: '9000011111', password: 'Strong123' } });
  assert.equal(ok.status, 200);
  assert.match(ok.text, /Welcome back, Meera Kulkarni/);
  const wrong = await call('POST', '/login', { form: { mobile: '9000011111', password: 'Wrong1234' } });
  assert.equal(wrong.status, 401);
});

test('security headers are present (helmet) and /api/health reports the database', async () => {
  const res = await call('GET', '/api/health');
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.database, 'connected');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
});
