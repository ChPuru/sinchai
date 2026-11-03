// Registration, login and JWT signing - shared by the JSON API (/api/auth) and the HTML forms (/signup, /login)
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const { NAME_RE, EMAIL_RE, MOBILE_RE, UPPER_DIGIT_RE, PASSWORD_MIN, PASSWORD_MAX, isBlank, isString } = require('../utils/validators');

const ROUNDS = config.isTest ? 4 : 10; // bcrypt cost; kept low in tests so the suite stays fast
// login compares against this when the mobile number is unknown, so "no such user" takes as long as "wrong password"
const DUMMY_HASH = bcrypt.hashSync('sinchai-dummy-password', ROUNDS);

const sha = (s) => crypto.createHash('sha256').update(s).digest();
const sameSecret = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

// returns a { field: message } object; empty means valid (same shape as the React forms' validate())
function validateRegistration(b) {
  const fields = {};
  for (const key of ['name', 'email', 'mobile', 'village', 'password']) {
    if (b[key] !== undefined && !isString(b[key])) fields[key] = key + ' must be text';
  }
  if (Object.keys(fields).length) return fields;

  if (isBlank(b.name)) fields.name = 'Name is required';
  else if (!NAME_RE.test(b.name.trim())) fields.name = 'Name must be at least 3 letters, alphabets only';
  if (isBlank(b.email)) fields.email = 'Email is required';
  else if (!EMAIL_RE.test(b.email.trim())) fields.email = 'Enter a valid email address';
  if (!MOBILE_RE.test(b.mobile ?? '')) fields.mobile = 'Enter a valid 10 digit mobile number starting with 6-9';
  if (isBlank(b.village)) fields.village = 'Village is required';
  const pw = b.password ?? '';
  if (pw.length < PASSWORD_MIN) fields.password = 'Password must be at least ' + PASSWORD_MIN + ' characters';
  else if (pw.length > PASSWORD_MAX) fields.password = 'Password can be at most ' + PASSWORD_MAX + ' characters';
  else if (!UPPER_DIGIT_RE.test(pw)) fields.password = 'Use at least one uppercase letter and one digit';
  if (b.role !== undefined && !['farmer', 'supervisor'].includes(b.role)) fields.role = 'Role must be farmer or supervisor';
  return fields;
}

async function registerUser(body = {}) {
  const fields = validateRegistration(body);
  if (Object.keys(fields).length) throw new HttpError(400, 'Validation failed', { fields, details: Object.values(fields) });

  const role = body.role === 'supervisor' ? 'supervisor' : 'farmer';
  if (role === 'supervisor') {
    const code = isString(body.supervisorCode) ? body.supervisorCode : '';
    if (!config.supervisorCode || !sameSecret(code, config.supervisorCode)) {
      const msg = 'Invalid supervisor access code';
      throw new HttpError(403, msg, { fields: { supervisorCode: msg }, details: [msg] });
    }
  }

  return User.create({
    name: body.name.trim(),
    email: body.email.trim(),
    mobile: body.mobile,
    village: body.village.trim(),
    role,
    language: ['en', 'hi', 'mr'].includes(body.language) ? body.language : 'en',
    passwordHash: await bcrypt.hash(body.password, ROUNDS),
  });
}

async function loginUser({ mobile, password } = {}) {
  // a JSON body can hold { "$ne": null } instead of a string - never let that reach the query
  if (!isString(mobile) || !isString(password)) throw new HttpError(400, 'Mobile number and password are required');
  const user = await User.findOne({ mobile }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Invalid mobile number or password');
  return user;
}

const signToken = (user) =>
  jwt.sign({ role: user.role }, config.jwtSecret, { subject: String(user._id), expiresIn: config.jwtExpiresIn, algorithm: 'HS256' });

module.exports = { registerUser, loginUser, signToken, validateRegistration };
