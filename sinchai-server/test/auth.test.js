const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { start, stop, call, makeUser, config } = require('./helpers');

before(start);
after(stop);

const valid = { name: 'Asha Jadhav', email: 'asha@example.com', mobile: '9000000001', village: 'Karad', password: 'Strong123' };

test('register rejects bad data with 400 and a message per field', async () => {
  const res = await call('POST', '/api/auth/register', { body: { name: 'A1', email: 'nope', mobile: '12345', village: ' ', password: 'short' } });
  assert.equal(res.status, 400);
  assert.deepEqual(Object.keys(res.body.fields).sort(), ['email', 'mobile', 'name', 'password', 'village']);
});

test('register: password needs a capital letter and a digit', async () => {
  const res = await call('POST', '/api/auth/register', { body: { ...valid, password: 'alllowercase' } });
  assert.equal(res.status, 400);
  assert.match(res.body.fields.password, /uppercase letter and one digit/);
});

test('register creates a farmer (201), never returns the password hash, and signs a token', async () => {
  const res = await call('POST', '/api/auth/register', { body: valid });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.role, 'farmer');
  assert.equal(res.body.user.passwordHash, undefined);
  assert.ok(!res.text.includes('Strong123'));
  const payload = jwt.verify(res.body.token, config.jwtSecret);
  assert.equal(payload.sub, res.body.user.id);
});

test('duplicate email and duplicate mobile give 409 with the offending field', async () => {
  const dupEmail = await call('POST', '/api/auth/register', { body: { ...valid, mobile: '9000000002' } });
  assert.equal(dupEmail.status, 409);
  assert.ok(dupEmail.body.fields.email);
  const dupMobile = await call('POST', '/api/auth/register', { body: { ...valid, email: 'other@example.com' } });
  assert.equal(dupMobile.status, 409);
  assert.ok(dupMobile.body.fields.mobile);
});

test('a client cannot make itself a supervisor without the access code', async () => {
  const body = { ...valid, email: 's1@example.com', mobile: '9000000003', role: 'supervisor' };
  const none = await call('POST', '/api/auth/register', { body });
  assert.equal(none.status, 403);
  const wrong = await call('POST', '/api/auth/register', { body: { ...body, supervisorCode: 'guess' } });
  assert.equal(wrong.status, 403);
  const right = await call('POST', '/api/auth/register', { body: { ...body, supervisorCode: config.supervisorCode } });
  assert.equal(right.status, 201);
  assert.equal(right.body.user.role, 'supervisor');
});

test('unknown role value is rejected', async () => {
  const res = await call('POST', '/api/auth/register', { body: { ...valid, email: 'r@example.com', mobile: '9000000004', role: 'admin' } });
  assert.equal(res.status, 400);
  assert.ok(res.body.fields.role);
});

test('login: right password 200, wrong password and unknown mobile both 401 with the same message', async () => {
  const ok = await call('POST', '/api/auth/login', { body: { mobile: valid.mobile, password: valid.password } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  const wrong = await call('POST', '/api/auth/login', { body: { mobile: valid.mobile, password: 'Wrong1234' } });
  const unknown = await call('POST', '/api/auth/login', { body: { mobile: '9999999999', password: 'Wrong1234' } });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.body.error, unknown.body.error);
});

test('login ignores NoSQL operator injection ({"$ne": null}) with a 400', async () => {
  const res = await call('POST', '/api/auth/login', { body: { mobile: { $ne: null }, password: { $ne: null } } });
  assert.equal(res.status, 400);
});

test('malformed JSON is a 400, not a crash', async () => {
  const res = await call('POST', '/api/auth/login', { body: '{"mobile": ' });
  assert.equal(res.status, 400);
});

test('/me needs a valid token: missing, garbage, wrong-secret, expired and deleted-user tokens are all 401', async () => {
  const { token, user } = await makeUser();
  assert.equal((await call('GET', '/api/auth/me', { token })).body.id, user.id);
  assert.equal((await call('GET', '/api/auth/me')).status, 401);
  assert.equal((await call('GET', '/api/auth/me', { token: 'abc.def.ghi' })).status, 401);
  const forged = jwt.sign({ role: 'supervisor' }, 'not-the-secret', { subject: user.id });
  assert.equal((await call('GET', '/api/auth/me', { token: forged })).status, 401);
  const expired = jwt.sign({}, config.jwtSecret, { subject: user.id, expiresIn: -10 });
  assert.equal((await call('GET', '/api/auth/me', { token: expired })).status, 401);
  const ghost = jwt.sign({}, config.jwtSecret, { subject: '64b64b64b64b64b64b64b64b' });
  assert.equal((await call('GET', '/api/auth/me', { token: ghost })).status, 401);
});

test('PATCH /api/users/me saves the language; role cannot be changed this way', async () => {
  const { token } = await makeUser();
  const res = await call('PATCH', '/api/users/me', { token, body: { language: 'hi' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.language, 'hi');
  assert.equal((await call('GET', '/api/users/me', { token })).body.language, 'hi');
  assert.equal((await call('PATCH', '/api/users/me', { token, body: { language: 'fr' } })).status, 400);
  const escalate = await call('PATCH', '/api/users/me', { token, body: { role: 'supervisor' } });
  assert.equal(escalate.status, 400); // role is not an editable field, so there is nothing to update
  assert.equal((await call('GET', '/api/auth/me', { token })).body.role, 'farmer');
});
