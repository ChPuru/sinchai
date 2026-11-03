// /api/alerts - the field supervisor's worklist: heat-stress plots and plots that need a long (> 3 h) pumping run
const express = require('express');
const Plot = require('../models/Plot');
const Advisory = require('../models/Advisory');
const HttpError = require('../utils/httpError');
const { authenticate, requireRole } = require('../middleware/auth');
const { adviceForPlots, alertsFrom, toAlert } = require('../services/balance');
const { isAlert } = require('../utils/waterBalance');

const router = express.Router();
router.use(authenticate, requireRole('supervisor'));

router.get('/', async (req, res) => {
  const plots = await Plot.find().populate('owner', 'name').sort({ createdAt: 1 });
  const { results } = await adviceForPlots(plots); // a plot without live weather cannot be assessed, so it raises no alert
  res.json(alertsFrom(results));
});

// POST /api/alerts/:id/ack - remembered in MongoDB, so the acknowledgement survives a refresh and is shared by all supervisors
router.post('/:id/ack', async (req, res) => {
  const advisory = await Advisory.findById(req.params.id);
  if (!advisory) throw new HttpError(404, 'Alert not found');
  const plot = await Plot.findById(advisory.plot).populate('owner', 'name');
  if (!plot) throw new HttpError(404, 'Alert not found');
  if (!isAlert(advisory)) throw new HttpError(400, 'This advisory is not an alert');
  if (!advisory.acknowledgedAt) {
    advisory.acknowledgedBy = req.user._id;
    advisory.acknowledgedAt = new Date();
    await advisory.save();
  }
  res.json(toAlert({ plot, advisory, stored: advisory }));
});

module.exports = router;
