// Exp 4.2 / Exp 5 - the only file that reads process.env; every other module requires this one.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envFile = path.join(__dirname, '.env');
// Node >= 20.12 has a built-in .env loader, so no dotenv package is needed.
// Variables that are already set (for example by `node --env-file=...`) are kept.
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isTest = env === 'test';

// Nothing secret is hardcoded. The first time the server starts on a machine it generates a random JWT secret and a
// random supervisor sign-up code and writes them to .env (which git ignores); every later start reads them back.
// `npm run supervisor-code` prints the code. In production the operator must provide the secret; leaving
// SUPERVISOR_CODE empty switches supervisor sign-up off.
function generated(name, make) {
  if (process.env[name] !== undefined) return process.env[name];
  const value = make();
  if (!isTest) {
    try {
      fs.appendFileSync(envFile, (fs.existsSync(envFile) && !fs.readFileSync(envFile, 'utf8').endsWith('\n') ? '\n' : '') + name + '=' + value + '\n');
    } catch (err) {
      console.warn('Could not save ' + name + ' to .env (' + err.message + '); it will change on the next start.');
    }
  }
  process.env[name] = value;
  return value;
}

if (isProd && !process.env.JWT_SECRET) throw new Error('JWT_SECRET must be set when NODE_ENV=production');
const jwtSecret = isProd ? process.env.JWT_SECRET : generated('JWT_SECRET', () => crypto.randomBytes(48).toString('hex'));
const supervisorCode = isProd
  ? process.env.SUPERVISOR_CODE ?? ''
  : generated('SUPERVISOR_CODE', () => 'SUP-' + crypto.randomBytes(4).toString('hex').toUpperCase());

const mongoUri =
  process.env.MONGO_URI || (isTest ? 'mongodb://127.0.0.1:27017/sinchai_test' : 'mongodb://127.0.0.1:27017/sinchai');
// The test-suite drops the database it connects to, so it must never point at a real one.
if (isTest && !/test/i.test(new URL(mongoUri).pathname)) {
  throw new Error('Refusing to run tests against "' + mongoUri + '": the database name must contain "test"');
}

module.exports = {
  env,
  isProd,
  isTest,
  port: Number(process.env.PORT) || 3000,
  mongoUri,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // origin of the React app, allowed by CORS (in development Vite proxies /api so CORS is not even needed)
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // a supervisor account can read every farmer's plots, so signing up as one needs this code
  supervisorCode,
  weather: {
    // only the test-suite switches this on: it must never call the real service, and feeds the database its own fixtures
    offline: isTest,
    ttlMs: 3 * 60 * 60 * 1000,
    timeoutMs: 8000,
  },
  jobIntervalMs: Number(process.env.JOB_INTERVAL_MS) || 6 * 60 * 60 * 1000,
};
