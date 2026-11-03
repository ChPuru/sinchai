// Exp 3.3 - shared validation rules, used by the validate() functions in Register / Login / AddPlot

// at least 3 characters, letters and spaces only - no digits or symbols in a farmer name
export const NAME_RE = /^[A-Za-z ]{3,}$/;
// something@something.tld - tld must be at least 2 letters
export const EMAIL_RE = /^[\w.-]+@[\w.-]+\.[A-Za-z]{2,}$/;
// Indian mobile: exactly 10 digits, first digit 6 to 9
export const MOBILE_RE = /^[6-9]\d{9}$/;
// lookaheads only - password must contain at least one capital letter and one digit
export const UPPER_DIGIT_RE = /(?=.*[A-Z])(?=.*\d)/;
// shortest password we accept
export const PASSWORD_MIN = 8;
// true when a field is empty, undefined or only spaces
export const isBlank = (v) => !String(v ?? "").trim();
