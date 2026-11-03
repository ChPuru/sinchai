// The daily FAO-56 soil-water balance for a plot, kept up to date on the server.
//
//   plot.depletion is the root-zone depletion (mm) at the START of plot.balanceDate.
//   Each elapsed day adds that day's crop water use (ETc = ET0 * Kc) and subtracts its rain, clamped to 0..TAW.
//   Irrigation is applied to plot.depletion at the moment it is logged (routes/history.js), so it is already in there.
//   The advisory for today then projects today's ETc / rain on top (utils/waterBalance.computeAdvisory).
//
// Only REAL weather readings are used. If a day has none (Open-Meteo unreachable and nothing stored for it) the roll
// stops there, balanceDate stays on that day, and no advisory is given until the data is back - a missing day is never
// replaced with an estimate.
const Plot = require('../models/Plot');
const Advisory = require('../models/Advisory');
const HttpError = require('../utils/httpError');
const { computeAdvisory, etc, tawMm, isAlert } = require('../utils/waterBalance');
const { locationFor } = require('./geo');
const { getDays, getWeatherAt } = require('./weather');
const { todayIST, addDays, daysBetween } = require('../utils/dates');

const MAX_ROLL_DAYS = 45; // a plot untouched for longer than this is dried out / re-wetted many times over anyway
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const idOf = (ref) => ref._id ?? ref; // an owner field is a populated document or a bare ObjectId

// bring plot.depletion up to the start of `today`. Mutates the passed document (for the response) and persists with a
// compare-and-set on balanceDate, so two simultaneous requests cannot add the same day twice.
// Resolves true when the plot is up to date, false when real weather for some past day is missing.
async function rollForward(plot, today = todayIST()) {
  if (!plot.balanceDate) plot.balanceDate = today;
  if (plot.balanceDate >= today) return true;

  const gap = daysBetween(plot.balanceDate, today);
  const from = gap > MAX_ROLL_DAYS ? addDays(today, -MAX_ROLL_DAYS) : plot.balanceDate;
  const yesterday = addDays(today, -1);
  const days = await getDays(locationFor(plot), from, yesterday, Math.min(gap, 92));
  const byDate = new Map(days.map((d) => [d.date, d]));

  const taw = tawMm(plot.soilType);
  let depletion = plot.depletion;
  let next = from; // the first day that has NOT been applied yet
  for (let date = from; date <= yesterday; date = addDays(date, 1)) {
    const day = byDate.get(date);
    if (!day) break; // no real reading for this day: stop here rather than guess
    depletion = clamp(depletion + etc(day.et0, plot.cropStage) - day.rain, 0, taw);
    next = addDays(date, 1);
  }
  depletion = +depletion.toFixed(2);

  if (next !== plot.balanceDate) {
    const res = await Plot.updateOne({ _id: plot._id, balanceDate: plot.balanceDate }, { $set: { depletion, balanceDate: next } });
    if (res.modifiedCount === 1) {
      plot.depletion = depletion;
      plot.balanceDate = next;
    } else {
      const fresh = await Plot.findById(plot._id).lean(); // someone else rolled it first - use their result
      if (fresh) {
        plot.depletion = fresh.depletion;
        plot.balanceDate = fresh.balanceDate;
      }
    }
  }
  return plot.balanceDate >= today;
}

// advisory for one plot today, stored (one row per plot per day) so alerts and their acknowledgement persist.
// Throws 503 when live weather for the plot is not available.
async function adviceForPlot(plot, today = todayIST(), weatherCache = new Map()) {
  if (!(await rollForward(plot, today))) {
    throw new HttpError(503, 'The weather history needed for ' + plot.name + ' is not available right now. Please try again shortly.', { code: 'WEATHER_UNAVAILABLE' });
  }
  const loc = locationFor(plot);
  if (!weatherCache.has(loc.key)) weatherCache.set(loc.key, await getWeatherAt(loc, today));
  const weather = weatherCache.get(loc.key);
  const advisory = computeAdvisory(plot, weather);

  const fields = { owner: idOf(plot.owner), type: advisory.type, etc: advisory.etc, depletion: advisory.depletion, taw: advisory.taw, hours: advisory.hours };
  if (advisory.daysLeft !== undefined) fields.daysLeft = advisory.daysLeft;
  // $set never touches acknowledgedBy / acknowledgedAt, so a recomputed advisory keeps its acknowledgement
  const stored = await Advisory.findOneAndUpdate({ plot: plot._id, date: today }, { $set: fields }, { upsert: true, returnDocument: 'after' });
  return { plot, advisory, weather, stored };
}

// advisories for many plots. A plot whose live weather is missing is reported in `unavailable`, not guessed at,
// and does not stop the other plots from being advised.
async function adviceForPlots(plots, today = todayIST()) {
  const weatherCache = new Map(); // one weather look-up per location cell, not per plot
  const results = [];
  const unavailable = [];
  for (const plot of plots) {
    try {
      results.push(await adviceForPlot(plot, today, weatherCache));
    } catch (err) {
      if (err.code !== 'WEATHER_UNAVAILABLE') throw err;
      unavailable.push(String(plot._id));
    }
  }
  return { results, unavailable };
}

// JSON for the supervisor alert list
function toAlert({ plot, advisory, stored }) {
  return {
    id: String(stored._id),
    plotId: String(plot._id),
    plotName: plot.name,
    owner: plot.owner && plot.owner.name,
    village: plot.village,
    kind: advisory.type === 'heat' ? 'heat' : 'demand',
    type: advisory.type,
    hours: advisory.hours,
    date: stored.date,
    acknowledged: !!stored.acknowledgedAt,
    acknowledgedAt: stored.acknowledgedAt || null,
  };
}

const alertsFrom = (results) => results.filter((r) => isAlert(r.advisory)).map(toAlert);

// Logging irrigation lowers a plot's depletion; deleting or shortening a log puts it back. One atomic update,
// clamped to 0..TAW, written as an aggregation-pipeline update so two requests cannot overwrite each other.
// deltaMm < 0 = water added to the plot, deltaMm > 0 = water taken away again
async function adjustDepletion(plot, deltaMm) {
  const taw = tawMm(plot.soilType);
  await Plot.updateOne(
    { _id: plot._id },
    [{ $set: { depletion: { $min: [taw, { $max: [0, { $add: ['$depletion', deltaMm] }] }] } } }],
    { updatePipeline: true } // Mongoose 9 only accepts an array of stages when this is switched on explicitly
  );
}

module.exports = { rollForward, adjustDepletion, adviceForPlot, adviceForPlots, alertsFrom, toAlert, MAX_ROLL_DAYS };
