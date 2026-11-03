// /api/advisories - today's advisory for every plot the caller may see
const express = require('express');
const Plot = require('../models/Plot');
const { authenticate } = require('../middleware/auth');
const { adviceForPlots } = require('../services/balance');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const filter = req.user.role === 'supervisor' ? {} : { owner: req.user._id };
  const plots = await Plot.find(filter).populate('owner', 'name').sort({ createdAt: 1 });
  const { results, unavailable } = await adviceForPlots(plots);
  // plots whose live weather could not be fetched are listed in `unavailable` instead of being guessed at
  res.json({
    advisories: results.map(({ plot, advisory, weather }) => ({
      plotId: String(plot._id),
      plotName: plot.name,
      date: weather.date,
      ...advisory,
    })),
    unavailable,
  });
});

module.exports = router;
