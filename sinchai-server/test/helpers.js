// Shared test plumbing. Every test file starts its own server on a random port against the throw-away
// "sinchai_test" database (config.js refuses to run tests against any database whose name lacks "test").
process.env.NODE_ENV = 'test';

const http = require('http');
const config = require('../config');
const app = require('../app');
const db = require('../db');
const mongoose = require('mongoose');
require('../models/User');
require('../models/Plot');
require('../models/IrrigationLog');
require('../models/WeatherDay');
require('../models/Advisory');

// tests install a fake fetch to stand in for Open-Meteo, so the helper keeps the real one for its own calls
const nativeFetch = globalThis.fetch;

let server;
let base;
let counter = 0;

async function start() {
  config.weather.offline = true; // the tests never call the real weather service; they store their own readings (putWeather)
  await db.connect();
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // unique indexes must exist before the first insert
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  base = 'http://127.0.0.1:' + server.address().port;
}

async function stop() {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await db.disconnect();
}

// call('POST', '/api/plots', { token, body }) -> { status, body, headers, text }
async function call(method, path, { token, body, form, headers: extraHeaders } = {}) {
  const headers = { ...extraHeaders };
  if (token) headers.Authorization = 'Bearer ' + token;
  let payload;
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await nativeFetch(base + path, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, body: json, text, headers: res.headers };
}

// a request made with the plain http module. Node's fetch silently adds "Cache-Control: no-cache" to conditional
// requests, which makes a server answer 200 instead of 304, so a 304 can only be tested without fetch.
function raw(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(base + path, { method, headers }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

// a registered account with a unique mobile number + email; returns { token, user, mobile, password }
async function makeUser(role = 'farmer', extra = {}) {
  counter += 1;
  const mobile = '9' + String(100000000 + counter);
  const password = 'Password1';
  const body = {
    name: 'Test Person',
    email: 'person' + counter + '@example.com',
    mobile,
    village: 'Karad',
    password,
    role,
    ...(role === 'supervisor' ? { supervisorCode: config.supervisorCode } : {}),
    ...extra,
  };
  const res = await call('POST', '/api/auth/register', { body });
  if (res.status !== 201) throw new Error('makeUser failed: ' + res.status + ' ' + res.text);
  return { token: res.body.token, user: res.body.user, mobile, password };
}

// ---- weather test data -----------------------------------------------------------------------------------------
// The product never invents weather, so tests that need a forecast write readings straight into the (throw-away) test
// database, in exactly the shape services/weather.js stores. One entry per day, starting at `from` (default: today).
const WeatherDay = require('../models/WeatherDay');
const { todayIST, addDays } = require('../utils/dates');

const DEFAULT_CELL = '17.3,74.2'; // the weather cell of PLOT below (Karad)
const day = (o = {}) => ({ tmax: 33, tmin: 21, humidity: 55, et0: 5, rain: 0, ...o });
// a heatwave week and a rainy week, as readings
const HOT_WEEK = [41, 42, 43, 41, 40, 39].map((tmax) => day({ tmax, tmin: 28, humidity: 30, et0: 7.8 }));
const RAINY_WEEK = [0, 18, 12, 6, 2, 0].map((rain, i) => day({ tmax: i === 0 ? 31 : 29, humidity: 80, et0: i === 0 ? 4.2 : 3, rain }));

async function putWeather(location, days, from = todayIST()) {
  const dates = days.map((_, i) => addDays(from, i));
  await WeatherDay.deleteMany({ location, date: { $in: dates } });
  await WeatherDay.insertMany(days.map((d, i) => ({ location, date: dates[i], source: 'open-meteo', fetchedAt: new Date(), ...d })));
}

const PLOT = { name: 'North field', village: 'Karad', soilType: 'clay', cropStage: 'grand-growth', areaAcres: 2.5, pumpLph: 90000, lat: 17.2905, lng: 74.179 };
const SATARA = { village: 'Satara', lat: 17.6742, lng: 74.0247 }; // a second weather cell, ~45 km from the default plot

async function makePlot(token, overrides = {}) {
  const res = await call('POST', '/api/plots', { token, body: { ...PLOT, ...overrides } });
  if (res.status !== 201) throw new Error('makePlot failed: ' + res.status + ' ' + res.text);
  return res.body;
}

module.exports = { start, stop, call, raw, makeUser, makePlot, nativeFetch, config, PLOT, SATARA, putWeather, day, HOT_WEEK, RAINY_WEEK, DEFAULT_CELL };
