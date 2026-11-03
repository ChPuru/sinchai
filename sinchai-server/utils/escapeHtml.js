// Exp 4.2 - anything a user typed (a name, an email) must be escaped before it is written into an HTML response
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

module.exports = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
