// /api/history - the irrigation log (CRUD). Logging an irrigation also lowers the plot's soil-water depletion.
const express = require('express');
const IrrigationLog = require('../models/IrrigationLog');
const Plot = require('../models/Plot');
const HttpError = require('../utils/httpError');
const { authenticate, requireRole } = require('../middleware/auth');
const { rollForward, adjustDepletion } = require('../services/balance');
const { mmFromLitres, tawMm } = require('../utils/waterBalance');
const { isString } = require('../utils/validators');
const { todayIST, addDays, isRealDate } = require('../utils/dates');

const router = express.Router();
router.use(authenticate);

const scope = (req) => (req.user.role === 'supervisor' ? {} : { owner: req.user._id });

function parseHours(value) {
  const hours = Number(value);
  if (value === undefined || value === '' || !Number.isFinite(hours)) throw new HttpError(400, 'Hours must be a number', { fields: { hours: 'Hours must be a number' } });
  return hours;
}

// GET /api/history?plot=<plotId> - newest first, capped at 500 rows
router.get('/', async (req, res) => {
  const filter = scope(req);
  if (isString(req.query.plot) && req.query.plot) filter.plot = req.query.plot;
  res.json(await IrrigationLog.find(filter).sort({ date: -1, createdAt: -1 }).limit(500));
});

router.get('/:id', async (req, res) => {
  const log = await IrrigationLog.findOne({ _id: req.params.id, ...scope(req) });
  if (!log) throw new HttpError(404, 'Irrigation log not found');
  res.json(log);
});

// POST /api/history { plotId, hours, advised?, date?, note? } -> 201 { log, plot }
router.post('/', requireRole('farmer'), async (req, res) => {
  const body = req.body ?? {};
  if (!isString(body.plotId)) throw new HttpError(400, 'plotId is required', { fields: { plotId: 'plotId is required' } });
  const plot = await Plot.findOne({ _id: body.plotId, owner: req.user._id });
  if (!plot) throw new HttpError(404, 'Plot not found');

  const today = todayIST();
  const date = body.date === undefined ? today : body.date;
  if (!isString(date) || !isRealDate(date)) throw new HttpError(400, 'Date must look like 2026-09-02', { fields: { date: 'Date must look like 2026-09-02' } });
  if (date > today) throw new HttpError(400, 'Date cannot be in the future', { fields: { date: 'Date cannot be in the future' } });
  if (date < addDays(today, -365)) throw new HttpError(400, 'Date is more than a year ago', { fields: { date: 'Date is more than a year ago' } });

  const hours = parseHours(body.hours);
  const litres = Math.round(hours * plot.pumpLph);

  // only an irrigation done today changes today's balance; a back-dated entry is just a record.
  // The soil can only take up as much water as it is short of, so absorbed = min(applied, depletion).
  let absorbedMm = 0;
  if (date === today) {
    await rollForward(plot, today);
    absorbedMm = Math.min(mmFromLitres(litres, plot.areaAcres), plot.depletion);
  }
  const log = await IrrigationLog.create({ plot: plot._id, owner: req.user._id, date, hours, litres, absorbedMm, advised: body.advised === true, note: body.note });
  if (absorbedMm > 0) await adjustDepletion(plot, -absorbedMm);
  res.status(201).json({ log, plot: await Plot.findById(plot._id).populate('owner', 'name') });
});

// PUT /api/history/:id { hours?, note?, advised? } - fix a wrongly typed duration
async function update(req, res) {
  const log = await IrrigationLog.findOne({ _id: req.params.id, owner: req.user._id });
  if (!log) throw new HttpError(404, 'Irrigation log not found');
  const plot = await Plot.findById(log.plot);
  const body = req.body ?? {};
  if (body.hours === undefined && body.note === undefined && body.advised === undefined) throw new HttpError(400, 'Nothing to update');

  const oldLitres = log.litres;
  if (body.hours !== undefined) {
    log.hours = parseHours(body.hours);
    log.litres = Math.round(log.hours * plot.pumpLph);
  }
  if (body.note !== undefined) log.note = body.note;
  if (body.advised !== undefined) log.advised = body.advised === true;

  let delta = 0;
  if (plot && log.date === todayIST() && log.litres !== oldLitres) {
    // give back what the old figure removed, then take what the new figure can absorb
    await rollForward(plot);
    const restored = Math.min(tawMm(plot.soilType), plot.depletion + log.absorbedMm);
    const absorbed = Math.min(mmFromLitres(log.litres, plot.areaAcres), restored);
    delta = log.absorbedMm - absorbed;
    log.absorbedMm = absorbed;
  }
  await log.save(); // runs the schema validators (hours 0.1-24 ...) before the plot is touched
  if (delta !== 0) await adjustDepletion(plot, delta);
  res.json({ log, plot: plot && (await Plot.findById(plot._id).populate('owner', 'name')) });
}
router.put('/:id', requireRole('farmer'), update);
router.patch('/:id', requireRole('farmer'), update);

router.delete('/:id', requireRole('farmer'), async (req, res) => {
  const log = await IrrigationLog.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!log) throw new HttpError(404, 'Irrigation log not found');
  const plot = await Plot.findById(log.plot);
  if (plot && log.absorbedMm > 0) await adjustDepletion(plot, log.absorbedMm); // the water is no longer counted as applied
  res.json({ message: 'Irrigation log deleted', log, plot: plot && (await Plot.findById(plot._id).populate('owner', 'name')) });
});

module.exports = router;
