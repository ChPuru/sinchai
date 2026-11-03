// Exp 4.2 - the server-rendered pages of the scaffold: Sign up is the root / homepage (as in the writeup's FreshCart app).
// The same Mongoose User model and services/auth.js back these HTML forms and the JSON API the React client uses.
const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const escapeHtml = require('../utils/escapeHtml');
const { registerUser, loginUser } = require('../services/auth');

const router = express.Router();
const PAGES = path.join(__dirname, '..', 'pages');

const formLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => config.isTest });

const card = (html) => '<link rel="stylesheet" href="/stylesheets/style.css"><div class="card">' + html + '</div>';

/* GET Sign up page - Root / Homepage */
router.get('/', (req, res) => {
  res.sendFile('signup.html', { root: PAGES });
});

/* POST /signup - handles the sign up form (express.urlencoded fills req.body) */
router.post('/signup', formLimiter, async (req, res) => {
  const user = await registerUser({ ...req.body, role: 'farmer' }); // the public form can only create farmers
  res
    .status(201)
    .type('html')
    .send(
      card(
        '<h1>Welcome, ' + escapeHtml(user.name) + '!</h1>' +
          '<p>Your SinchAI farmer account has been created with ' + escapeHtml(user.email) + '.</p>' +
          '<p><a class="btn" href="' + escapeHtml(config.clientOrigin) + '/login">Open the SinchAI app</a> <a class="btn" href="/login">Login</a></p>'
      )
    );
});

/* GET Login page */
router.get('/login', (req, res) => {
  res.sendFile('login.html', { root: PAGES });
});

/* POST /login - checks mobile number + password (the React app uses POST /api/auth/login for the same check and gets a JWT) */
router.post('/login', formLimiter, async (req, res) => {
  const user = await loginUser(req.body);
  res
    .type('html')
    .send(
      card(
        '<h2>Welcome back, ' + escapeHtml(user.name) + '!</h2>' +
          '<p>Signed in as ' + escapeHtml(user.role) + '.</p>' +
          '<a class="btn" href="' + escapeHtml(config.clientOrigin) + '/login">Open the SinchAI app</a>'
      )
    );
});

module.exports = router;
