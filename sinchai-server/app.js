const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const config = require('./config');

const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const plotsRouter = require('./routes/plots');
const historyRouter = require('./routes/history');
const weatherRouter = require('./routes/weather');
const advisoriesRouter = require('./routes/advisories');
const alertsRouter = require('./routes/alerts');
const analyticsRouter = require('./routes/analytics');
const errorHandler = require('./middleware/errors');

const app = express();

// ---------- Application-level (built-in + third-party) middleware ----------
if (!config.isTest) app.use(logger('dev')); // logs every request (Exp 4.2)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // security headers; images stay usable by the React app
app.use(express.json()); // parses JSON bodies (100 kb limit by default)
app.use(express.urlencoded({ extended: false })); // parses HTML form bodies
app.use(cookieParser());

// ---------- Serving static files with the built-in express.static() (Exp 4.2) ----------
// index: false -> the root URL "/" is answered by the Sign up route below, not by a stray public/index.html
const staticOptions = { index: false };
app.use(express.static(path.join(__dirname, 'public'), staticOptions)); // http://localhost:3000/<file>
app.use('/static', express.static(path.join(__dirname, 'public'), staticOptions)); // http://localhost:3000/static/<file>

// ---------- Routes ----------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', time: new Date().toISOString() });
});

app.use(
  '/api',
  cors({ origin: config.clientOrigin }),
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => config.isTest })
);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/plots', plotsRouter);
app.use('/api/history', historyRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/advisories', advisoriesRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/', indexRouter); // Sign up page (root / homepage), login

// ---------- 404 handler (runs when no route / static file matched) ----------
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'No such API route: ' + req.method + ' ' + req.originalUrl.split('?')[0] });
});
app.use((req, res) => {
  res.status(404).sendFile('404.html', { root: path.join(__dirname, 'pages') });
});

// ---------- Central error handler (Exp 5): must be the last app.use ----------
app.use(errorHandler);

module.exports = app;
