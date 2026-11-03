// Exp 5 - the central error handler: every Mongoose / MongoDB / auth error becomes a clean HTTP response.
//   ValidationError -> 400, CastError (bad id) -> 400, duplicate key (11000) -> 409, bad token -> 401, anything else -> 500
// Express 5 forwards errors thrown inside async route handlers here by itself, so the routes need no try/catch.
const escapeHtml = require('../utils/escapeHtml');

const FIELD_LABEL = { email: 'Email', mobile: 'Mobile number', name: 'Plot name' };

function describe(err) {
  if (err.name === 'ValidationError') {
    const fields = {};
    for (const [path, e] of Object.entries(err.errors)) fields[path] = e.message;
    return { status: 400, body: { error: 'Validation failed', details: Object.values(fields), fields } };
  }
  if (err.name === 'CastError') {
    return { status: 400, body: { error: 'Invalid ' + err.path + ': ' + String(err.value).slice(0, 80) } };
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {}).find((k) => k !== 'owner') || 'value';
    const msg = (FIELD_LABEL[field] || field) + ' is already registered';
    return { status: 409, body: { error: 'Duplicate value', details: err.keyValue, fields: { [field]: msg } } };
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return { status: 401, body: { error: 'Invalid or expired token' } };
  }
  if (err.type === 'entity.parse.failed') return { status: 400, body: { error: 'Request body is not valid JSON' } };
  if (err.type === 'entity.too.large') return { status: 413, body: { error: 'Request body is too large' } };
  // 4xx, and 503 "service unavailable" (live weather could not be fetched), carry a message meant for the caller
  if (err.status && (err.status < 500 || err.status === 503)) {
    const body = { error: err.message };
    if (err.code === 'WEATHER_UNAVAILABLE') body.code = err.code;
    if (err.fields) body.fields = err.fields;
    if (err.details) body.details = err.details;
    return { status: err.status, body };
  }
  return { status: 500, body: { error: 'Internal server error' } };
}

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const { status, body } = describe(err);
  if (status === 500) console.error(err); // an unexpected failure is always logged - including in tests, where it must never go unnoticed

  // JSON for the API, a small HTML page for the browser pages (Exp 4.2)
  if (req.path.startsWith('/api') || !req.accepts('html')) return res.status(status).json(body);
  res
    .status(status)
    .type('html')
    .send(
      '<link rel="stylesheet" href="/stylesheets/style.css"><div class="card"><h2>' +
        escapeHtml(body.error) +
        '</h2>' +
        (body.details ? '<ul>' + Object.values(body.fields || body.details).map((d) => '<li>' + escapeHtml(d) + '</li>').join('') + '</ul>' : '') +
        '<a class="btn" href="/">Back</a></div>'
    );
};
