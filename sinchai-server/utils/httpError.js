// Exp 5 - an error that carries its own HTTP status; the central error handler in middleware/errors.js turns it into JSON
class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra); // e.g. { fields: { email: 'Email is required' } }
  }
}

module.exports = HttpError;
