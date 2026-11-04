// Free weather + FAO-56 reference evapotranspiration (ET0) from Open-Meteo - no API key needed.
// Every day that is fetched is stored in MongoDB (WeatherDay), which is what lets a plot's daily water balance be
// replayed later. This service only ever returns REAL readings: when Open-Meteo cannot be reached it falls back to
// readings it fetched earlier (still real), and when there are none it says "unavailable" (HTTP 503).
// It never estimates or invents a number.
const config = require('../config');
const WeatherDay = require('../models/WeatherDay');
const HttpError = require('../utils/httpError');
const { heatwave } = require('../utils/waterBalance');
const { todayIST, addDays, weekday } = require('../utils/dates');

const unavailable = (what) => new HttpError(503, what, { code: 'WEATHER_UNAVAILABLE' });

// ---- Open-Meteo ----------------------------------------------------------------------------------------------
async function fetchOpenMeteo(loc, pastDays) {
  const url = new URL('/v1/forecast', config.weather.baseUrl);
  url.search = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,relative_humidity_2m_mean',
    past_days: String(Math.min(92, pastDays)),
    forecast_days: '6',
    timezone: 'Asia/Kolkata',
  });
  const res = await fetch(url, { signal: AbortSignal.timeout(config.weather.timeoutMs) });
  if (!res.ok) {
    // Open-Meteo says why in the body, e.g. {"error":true,"reason":"Daily API request limit exceeded. Please try again tomorrow."}
    const why = await res.json().then((body) => body?.reason, () => undefined);
    throw new Error('Open-Meteo answered ' + res.status + (typeof why === 'string' ? ': ' + why.slice(0, 160) : ''));
  }
  const d = (await res.json()).daily;
  if (!d || !Array.isArray(d.time)) throw new Error('Open-Meteo sent an unexpected reply');

  const days = [];
  d.time.forEach((date, i) => {
    const tmax = d.temperature_2m_max[i];
    const tmin = d.temperature_2m_min[i];
    const et0 = d.et0_fao_evapotranspiration[i];
    const humidity = d.relative_humidity_2m_mean[i];
    const rain = d.precipitation_sum[i];
    // a day the model has no complete data for is skipped - it is never filled in with a guess
    if ([tmax, tmin, et0, humidity, rain].some((v) => typeof v !== 'number')) return;
    days.push({ location: loc.key, date, tmax, tmin, humidity: Math.round(humidity), et0, rain: Math.max(0, rain), source: 'open-meteo' });
  });
  return days;
}

// per location cell: when we last asked Open-Meteo, how many past days that reply covered, and whether it worked
const lastFetch = new Map();
const inflight = new Map(); // two requests for the same cell share one network call

async function ensureFresh(loc, pastDays = 7) {
  if (config.weather.offline) return;
  const prev = lastFetch.get(loc.key);
  if (prev && Date.now() - prev.at < config.weather.ttlMs && prev.pastDays >= pastDays) return;

  if (!prev && pastDays <= 7) {
    // after a server restart the database may already hold a fresh reading
    const doc = await WeatherDay.findOne({ location: loc.key, date: todayIST() }).lean();
    if (doc && Date.now() - doc.fetchedAt.getTime() < config.weather.ttlMs) {
      lastFetch.set(loc.key, { at: doc.fetchedAt.getTime(), pastDays: 7, ok: true });
      return;
    }
  }
  if (inflight.has(loc.key)) return inflight.get(loc.key);

  const job = (async () => {
    try {
      const days = await fetchOpenMeteo(loc, Math.max(7, pastDays));
      const now = new Date();
      await WeatherDay.bulkWrite(
        days.map((day) => ({
          updateOne: { filter: { location: day.location, date: day.date }, update: { $set: { ...day, fetchedAt: now } }, upsert: true },
        }))
      );
      lastFetch.set(loc.key, { at: now.getTime(), pastDays: Math.max(7, pastDays), ok: true });
    } catch (err) {
      console.warn('[weather] Open-Meteo unavailable for ' + loc.name + ' (' + err.message + ') - only readings fetched earlier can be used');
      // negative cache: do not hammer a dead network, try again in about five minutes
      lastFetch.set(loc.key, { at: Date.now() - config.weather.ttlMs + 5 * 60 * 1000, pastDays: Infinity, ok: false });
    } finally {
      inflight.delete(loc.key);
    }
  })();
  inflight.set(loc.key, job);
  return job;
}

// the stored REAL readings for a location between two dates, oldest first. A day with no reading is simply absent.
async function getDays(loc, from, to, pastDays = 7) {
  await ensureFresh(loc, pastDays);
  const find = () => WeatherDay.find({ location: loc.key, date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean();
  let stored = await find();
  // "fetched recently" is only a note in memory: if the database was wiped or restored underneath a running server
  // the rows are gone while the note still says fresh. Forget the note and fetch again - once, and never after a failed fetch.
  if (stored.length === 0 && lastFetch.get(loc.key)?.ok) {
    lastFetch.delete(loc.key);
    await ensureFresh(loc, pastDays);
    stored = await find();
  }
  return stored;
}

// today + the next four days in the shape the React client uses, plus heatwave risk and when the data was fetched.
// Needs a real reading for today AND tomorrow (the rain forecast decides "skip irrigation"); otherwise 503.
async function getWeatherAt(loc, today = todayIST()) {
  const days = await getDays(loc, today, addDays(today, 5));
  if (days.length < 2 || days[0].date !== today || days[1].date !== addDays(today, 1)) {
    throw unavailable('Live weather data for ' + loc.name + ' is not available right now. Please try again shortly.');
  }
  const [t, tomorrow] = days;
  const weather = {
    village: loc.name,
    weatherKey: loc.key,
    date: today,
    tmax: t.tmax,
    tmin: t.tmin,
    humidity: t.humidity,
    et0: t.et0,
    rainToday: t.rain,
    rainTomorrow: tomorrow.rain,
    forecast: days.slice(0, 5).map((d) => ({ day: weekday(d.date), date: d.date, tmax: d.tmax, rain: d.rain })),
    source: 'open-meteo',
    fetchedAt: t.fetchedAt,
  };
  weather.heatwave = heatwave(weather);
  return weather;
}

module.exports = { getWeatherAt, getDays, ensureFresh, fetchOpenMeteo };
