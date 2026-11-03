// Exp 5 - Schema + Model for one day of weather / ET0 at one location cell (cache of the free Open-Meteo data)
const mongoose = require('mongoose');

const weatherDaySchema = new mongoose.Schema(
  {
    location: { type: String, required: true }, // weather cell key, e.g. "17.3,74.2" (see utils/geo.js)
    date: { type: String, required: true }, // YYYY-MM-DD, India time
    tmax: { type: Number, required: true },
    tmin: { type: Number, required: true },
    humidity: { type: Number, required: true }, // mean relative humidity, %
    et0: { type: Number, required: true }, // FAO-56 reference evapotranspiration, mm/day
    rain: { type: Number, required: true, min: 0 }, // mm
    source: { type: String, enum: ['open-meteo'], default: 'open-meteo' }, // only real readings are ever stored
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// one reading per location per day; re-fetching the same day updates it instead of adding a second row
weatherDaySchema.index({ location: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('WeatherDay', weatherDaySchema);
