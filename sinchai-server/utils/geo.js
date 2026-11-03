// Weather is requested per "cell": coordinates rounded to 0.1 degree (about 11 km). Forecast models do not resolve
// anything finer than that, so plots in the same cell share one stored forecast instead of each one calling Open-Meteo.
const round1 = (n) => Math.round(n * 10) / 10;

const cellKey = (lat, lng) => round1(lat).toFixed(1) + ',' + round1(lng).toFixed(1);

// the cell's centre point - what is actually sent to the weather service
const cellCentre = (lat, lng) => ({ lat: round1(lat), lng: round1(lng) });

module.exports = { cellKey, cellCentre };
