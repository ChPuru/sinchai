// /api/analytics/summary - water used, estimated water saved, pump energy and an 8-week trend
const express = require('express');
const Plot = require('../models/Plot');
const IrrigationLog = require('../models/IrrigationLog');
const { authenticate } = require('../middleware/auth');
const { summarise } = require('../services/analytics');

const router = express.Router();
router.use(authenticate);

router.get('/summary', async (req, res) => {
  const filter = req.user.role === 'supervisor' ? {} : { owner: req.user._id };
  const [plots, logs] = await Promise.all([Plot.find(filter), IrrigationLog.find(filter)]);
  res.json(summarise(logs, plots));
});

module.exports = router;
