// A plot's weather is fetched for the exact spot the farmer pinned on the map (its latitude / longitude), rounded to a
// ~11 km cell because that is as fine as forecast models resolve. There is no village-name lookup and no default
// location: a plot without real coordinates cannot be saved (models/Plot.js).
const { cellKey, cellCentre } = require('../utils/geo');

// a weather location: { key, name, lat, lon } - lat / lon are the cell centre that is sent to the forecast service
function makeLocation(name, lat, lng) {
  const centre = cellCentre(lat, lng);
  return { key: cellKey(lat, lng), name, lat: centre.lat, lon: centre.lng };
}

const locationFor = (plot) => makeLocation(plot.village, plot.lat, plot.lng);

module.exports = { locationFor, makeLocation };
