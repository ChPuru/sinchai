// SinchAI is an India-only product, so "today" always means today in India - not the server's time zone.
const DAY_MS = 24 * 60 * 60 * 1000;

// 'YYYY-MM-DD' for the given instant in Asia/Kolkata (en-CA formats dates as year-month-day)
const todayIST = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

const toUTC = (date) => new Date(date + 'T00:00:00Z');
const addDays = (date, n) => new Date(toUTC(date).getTime() + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (from, to) => Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
const weekday = (date) => toUTC(date).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
const isRealDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && toUTC(s).toISOString().slice(0, 10) === s;

module.exports = { todayIST, addDays, daysBetween, weekday, isRealDate };
