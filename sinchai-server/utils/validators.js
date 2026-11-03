// Exp 3.3 -> Exp 5 - the same rules as sinchai-client/src/utils/validators.js, now enforced on the server.
// Client-side validation is only a convenience; this is the copy that cannot be bypassed.

// at least 3 characters, letters and spaces only
const NAME_RE = /^[A-Za-z ]{3,}$/;
// something@something.tld - tld must be at least 2 letters
const EMAIL_RE = /^[\w.-]+@[\w.-]+\.[A-Za-z]{2,}$/;
// Indian mobile: exactly 10 digits, first digit 6 to 9
const MOBILE_RE = /^[6-9]\d{9}$/;
// one capital letter and one digit
const UPPER_DIGIT_RE = /(?=.*[A-Z])(?=.*\d)/;
const PASSWORD_MIN = 8;
// bcrypt only looks at the first 72 bytes, and an unbounded password is a cheap way to burn CPU
const PASSWORD_MAX = 72;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isBlank = (v) => !String(v ?? '').trim();
// query/body values can be objects ({ "$ne": null }); only a real string may reach a database filter
const isString = (v) => typeof v === 'string';
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = {
  NAME_RE,
  EMAIL_RE,
  MOBILE_RE,
  UPPER_DIGIT_RE,
  PASSWORD_MIN,
  PASSWORD_MAX,
  DATE_RE,
  isBlank,
  isString,
  escapeRegex,
};
