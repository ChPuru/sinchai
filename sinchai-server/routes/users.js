// /api/users/me - the signed-in account; used to remember the preferred language across devices
const express = require('express');
const User = require('../models/User');
const HttpError = require('../utils/httpError');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/me', (req, res) => {
  res.json(req.user);
});

// PATCH /api/users/me  { language?, village?, name? } - role, mobile, email and password are deliberately not editable here
router.patch('/me', async (req, res) => {
  const body = req.body ?? {};
  const updates = {};
  for (const key of ['language', 'village', 'name']) if (body[key] !== undefined) updates[key] = body[key];
  if (!Object.keys(updates).length) throw new HttpError(400, 'Nothing to update');
  const user = await User.findByIdAndUpdate(req.user._id, updates, { returnDocument: 'after', runValidators: true });
  res.json(user);
});

module.exports = router;
