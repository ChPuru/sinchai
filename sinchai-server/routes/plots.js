// Exp 5 - RESTful CRUD for the Plot resource (the same five endpoints as /api/students in the writeup)
//
//   POST   /api/plots        Create    Plot.create()               201 Created
//   GET    /api/plots        Read all  Plot.find()                 200 OK    (?village= &soilType= &cropStage=)
//   GET    /api/plots/:id    Read one  Plot.findOne()              200 OK
//   PUT    /api/plots/:id    Update    Plot.findOneAndUpdate()     200 OK    (PATCH works too)
//   DELETE /api/plots/:id    Delete    Plot.findOneAndDelete()     200 OK
//   GET    /api/plots/:id/advisory   today's FAO-56 advisory for the plot
//
// Errors come from middleware/errors.js: 400 invalid data or id, 401 no/invalid token, 403 wrong role, 404 not found, 409 duplicate name.
// Exp 4.2 - route parameter (:id), query string (?village=) and req.body are all used below.
const express = require('express');
const Plot = require('../models/Plot');
const IrrigationLog = require('../models/IrrigationLog');
const Advisory = require('../models/Advisory');
const HttpError = require('../utils/httpError');
const { authenticate, requireRole } = require('../middleware/auth');
const { rollForward, adviceForPlot } = require('../services/balance');
const { isString, escapeRegex } = require('../utils/validators');
const { todayIST } = require('../utils/dates');

const router = express.Router();
router.use(authenticate);

const EDITABLE = ['name', 'village', 'soilType', 'cropStage', 'areaAcres', 'pumpLph', 'habitHours', 'pumpKw', 'lat', 'lng', 'notes'];
// mass-assignment guard: only these keys are ever copied from the request body (never owner, depletion on update, ...)
const pick = (body, keys) => Object.fromEntries(keys.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

// a farmer sees only their own plots; a field supervisor sees every plot (read-only)
const scope = (req) => (req.user.role === 'supervisor' ? {} : { owner: req.user._id });

async function findScoped(req) {
  const plot = await Plot.findOne({ _id: req.params.id, ...scope(req) }).populate('owner', 'name');
  // 404 (not 403) for somebody else's plot, so ids of other farmers' plots cannot be probed
  if (!plot) throw new HttpError(404, 'Plot not found');
  return plot;
}

// CREATE
router.post('/', requireRole('farmer'), async (req, res) => {
  const body = req.body ?? {};
  const data = pick(body, EDITABLE);
  if (body.depletion !== undefined) data.depletion = body.depletion; // a farmer may declare how dry the plot already is
  const plot = await Plot.create({ ...data, owner: req.user._id, balanceDate: todayIST() });
  await plot.populate('owner', 'name');
  res.status(201).json(plot);
});

// READ (all)
router.get('/', async (req, res) => {
  const filter = scope(req);
  const { village, soilType, cropStage } = req.query;
  if (isString(village) && village.trim()) filter.village = new RegExp('^' + escapeRegex(village.trim()) + '$', 'i');
  if (isString(soilType) && soilType) filter.soilType = soilType;
  if (isString(cropStage) && cropStage) filter.cropStage = cropStage;

  const plots = await Plot.find(filter).populate('owner', 'name').sort({ createdAt: 1 });
  for (const plot of plots) await rollForward(plot); // depletion is always as of today
  res.json(plots);
});

// READ (one)
router.get('/:id', async (req, res) => {
  const plot = await findScoped(req);
  await rollForward(plot);
  res.json(plot);
});

// today's advisory for one plot: { advisory, weather }
router.get('/:id/advisory', async (req, res) => {
  const plot = await findScoped(req);
  const { advisory, weather } = await adviceForPlot(plot);
  res.json({ plotId: String(plot._id), date: todayIST(), advisory, weather });
});

// UPDATE (partial, like PUT {"year": 4} in the writeup)
async function update(req, res) {
  const plot = await Plot.findOne({ _id: req.params.id, owner: req.user._id });
  if (!plot) throw new HttpError(404, 'Plot not found');
  const updates = pick(req.body ?? {}, EDITABLE);
  if (!Object.keys(updates).length) throw new HttpError(400, 'Nothing to update');

  await rollForward(plot); // settle the balance with the OLD crop stage before the stage changes
  const updated = await Plot.findOneAndUpdate({ _id: plot._id }, updates, {
    returnDocument: 'after', // return the updated document
    runValidators: true, // apply schema validation to the update
  }).populate('owner', 'name');
  res.json(updated);
}
router.put('/:id', requireRole('farmer'), update);
router.patch('/:id', requireRole('farmer'), update);

// DELETE - the plot's irrigation log and stored advisories go with it
router.delete('/:id', requireRole('farmer'), async (req, res) => {
  const plot = await Plot.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!plot) throw new HttpError(404, 'Plot not found');
  await Promise.all([IrrigationLog.deleteMany({ plot: plot._id }), Advisory.deleteMany({ plot: plot._id })]);
  res.json({ message: 'Plot deleted', plot });
});

module.exports = router;
