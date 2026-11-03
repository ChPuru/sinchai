// Water-saving analytics from the irrigation logs - using ONLY what the farmer recorded:
//
//   litres, hours, events     what the logs say was pumped
//   savedLitres               for every irrigation that followed the advisory on a plot whose farmer entered their
//                             "usual irrigation hours": (usual hours - hours actually pumped) x pump L/hr, never below 0
//   kwh                       hours x the pump power (kW) the farmer entered for that plot
//
// A plot with no usual hours has no baseline, so no saving is claimed for it; a plot with no pump power adds nothing
// to the energy figure. Both totals are null until at least one plot has the input, and `coverage` says how many
// plots they are based on. Nothing is assumed.
const { addDays, todayIST } = require('../utils/dates');

const WEEKS = 8;

function mondayOf(date) {
  const dow = new Date(date + 'T00:00:00Z').getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

function summarise(logs, plots, today = todayIST()) {
  const plotById = new Map(plots.map((p) => [String(p._id), p]));
  const totals = { litres: 0, hours: 0, events: 0, advisedEvents: 0, baselineLitres: 0, savedLitres: 0, kwh: 0 };
  const perPlot = new Map();
  const habitPlots = plots.filter((p) => p.habitHours != null).length;
  const kwPlots = plots.filter((p) => p.pumpKw != null).length;

  // week buckets, oldest first, ending with the current week
  const thisMonday = mondayOf(today);
  const weekly = Array.from({ length: WEEKS }, (_, i) => ({ weekStart: addDays(thisMonday, -7 * (WEEKS - 1 - i)), litres: 0, baselineLitres: 0 }));

  for (const log of logs) {
    const plot = plotById.get(String(log.plot));
    if (!plot) continue;
    const habitLitres = plot.habitHours != null ? plot.habitHours * plot.pumpLph : null;
    // what this irrigation would have used by habit; without the farmer's own figure the log is its own baseline
    const baseline = log.advised && habitLitres != null ? habitLitres : log.litres;

    totals.litres += log.litres;
    totals.hours += log.hours;
    totals.events += 1;
    totals.baselineLitres += baseline;
    if (plot.pumpKw != null) totals.kwh += log.hours * plot.pumpKw;
    if (log.advised) {
      totals.advisedEvents += 1;
      if (habitLitres != null) totals.savedLitres += Math.max(0, habitLitres - log.litres);
    }

    const row = perPlot.get(String(plot._id)) || { plotId: String(plot._id), name: plot.name, litres: 0, hours: 0, events: 0 };
    row.litres += log.litres;
    row.hours += log.hours;
    row.events += 1;
    perPlot.set(String(plot._id), row);

    const bucket = weekly.find((w) => log.date >= w.weekStart && log.date < addDays(w.weekStart, 7));
    if (bucket) {
      bucket.litres += log.litres;
      bucket.baselineLitres += baseline;
    }
  }

  const round = (n) => Math.round(n);
  return {
    litres: round(totals.litres),
    hours: +totals.hours.toFixed(1),
    events: totals.events,
    advisedEvents: totals.advisedEvents,
    baselineLitres: round(totals.baselineLitres),
    savedLitres: habitPlots > 0 ? round(totals.savedLitres) : null,
    kwh: kwPlots > 0 ? round(totals.kwh) : null,
    coverage: { plots: plots.length, habit: habitPlots, pumpKw: kwPlots },
    perPlot: [...perPlot.values()].map((r) => ({ ...r, litres: round(r.litres), hours: +r.hours.toFixed(1) })),
    weekly: weekly.map((w) => ({ weekStart: w.weekStart, litres: round(w.litres), baselineLitres: round(w.baselineLitres) })),
  };
}

module.exports = { summarise };
