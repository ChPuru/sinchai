// The "daily" job: refresh the weather of every village that has plots, roll every plot's water balance forward
// and store today's advisory. The API also does all of this lazily when it is asked, so the job just keeps the
// alerts warm and means a farmer's first request of the day is not the one that waits for Open-Meteo.
const Plot = require('../models/Plot');
const { adviceForPlots } = require('../services/balance');
const config = require('../config');

async function runOnce() {
  const plots = await Plot.find().populate('owner', 'name');
  const { results, unavailable } = await adviceForPlots(plots);
  console.log('[daily] advisories refreshed for ' + results.length + ' plot(s)' + (unavailable.length ? ', ' + unavailable.length + ' waiting for live weather' : ''));
  return results.length;
}

function start() {
  const run = () => runOnce().catch((err) => console.error('[daily] failed:', err.message));
  run();
  const timer = setInterval(run, config.jobIntervalMs);
  timer.unref(); // never keeps the process alive on its own
  return timer;
}

module.exports = { runOnce, start };
