// /api/weather - today's weather + ET0 + 5-day forecast + heatwave risk, all from Open-Meteo (real data only)
const express = require('express');
const Plot = require('../models/Plot');
const HttpError = require('../utils/httpError');
const { authenticate } = require('../middleware/auth');
const { getWeatherAt } = require('../services/weather');
const { locationFor, makeLocation } = require('../services/geo');

const router = express.Router();
router.use(authenticate); // this endpoint fans out to a free external API, so it is not left open

// GET /api/weather -> { primary, villages: { '17.3,74.2': {...} }, unavailable: [{ key, village }] }
// one entry per weather cell (~11 km) the caller has plots in (a supervisor: every plot), so each plot is advised on the
// weather at ITS pin. Plots in the same cell share one reading; each plot carries its cell as plot.weatherKey.
// A cell whose live weather cannot be fetched is listed under "unavailable" - it is never estimated.
router.get('/', async (req, res) => {
  const filter = req.user.role === 'supervisor' ? {} : { owner: req.user._id };
  const plots = await Plot.find(filter).select('village lat lng').sort({ createdAt: 1 });

  const cells = new Map(); // key -> location of the first plot in that cell
  for (const plot of plots) {
    const loc = locationFor(plot);
    if (!cells.has(loc.key)) cells.set(loc.key, loc);
  }
  const villages = {};
  const unavailable = [];
  for (const [key, loc] of cells) {
    try {
      villages[key] = await getWeatherAt(loc);
    } catch (err) {
      if (err.code !== 'WEATHER_UNAVAILABLE') throw err;
      unavailable.push({ key, village: loc.name });
    }
  }

  // "primary" is the cell of the account's own village when there is one, otherwise the first cell that has weather
  const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  const own = [...cells.values()].find((loc) => villages[loc.key] && sameName(loc.name, req.user.village));
  res.json({ primary: own ? own.key : (Object.keys(villages)[0] ?? null), villages, unavailable });
});

// GET /api/weather/point?lat=17.29&lng=74.18 -> the weather at any point in India (query string)
router.get('/point', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 6 || lat > 38 || lng < 68 || lng > 98) {
    throw new HttpError(400, 'lat and lng are required and must be inside India');
  }
  res.json(await getWeatherAt(makeLocation(lat.toFixed(3) + ', ' + lng.toFixed(3), lat, lng)));
});

module.exports = router;
