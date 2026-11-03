// Exp 4.2 (middleware pipeline) - functions that receive req, res and next. These two guard the protected API routes.
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const HttpError = require('../utils/httpError');

// reads "Authorization: Bearer <token>", verifies it and puts the account on req.user
async function authenticate(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, 'This account no longer exists');
  req.user = user;
  next();
}

// requireRole('farmer') -> middleware that lets only farmers through
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw new HttpError(403, 'Your role (' + req.user.role + ') cannot do this');
  next();
};

module.exports = { authenticate, requireRole };
