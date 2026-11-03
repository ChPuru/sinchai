// Exp 4.2 (express.Router) - /api/auth : register, login, who am I
const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { registerUser, loginUser, signToken } = require('../services/auth');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// password guessing is the one thing worth throttling hard
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

// POST /api/auth/register  -> 201 { token, user }
router.post('/register', authLimiter, async (req, res) => {
  const user = await registerUser(req.body);
  res.status(201).json({ token: signToken(user), user });
});

// POST /api/auth/login  { mobile, password } -> 200 { token, user }
router.post('/login', authLimiter, async (req, res) => {
  const user = await loginUser(req.body);
  res.json({ token: signToken(user), user });
});

// GET /api/auth/me -> the account behind the token (the client calls this to check a stored session is still valid)
router.get('/me', authenticate, (req, res) => {
  res.json(req.user);
});

module.exports = router;
