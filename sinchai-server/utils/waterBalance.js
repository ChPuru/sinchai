// Exp 4.1 (custom modules) -> production: the FAO-56 soil-water-balance maths as a CommonJS module.
// Pure functions only - no database, no network - so the API, the daily job and the tests all share one copy.
// sinchai-client/src/utils/waterBalance.js is the browser twin; test/waterBalance.test.js fails if they ever disagree.

// crop coefficient per sugarcane growth stage
const KC = { germination: 0.4, tillering: 0.75, 'grand-growth': 1.25, maturity: 0.75 };
// total available water, mm of water per metre of root zone
const SOIL = { sandy: { taw: 60 }, loamy: { taw: 110 }, clay: { taw: 150 } };
const ROOT_DEPTH = 0.6; // m
const MAD = 0.3; // management-allowed depletion for sugarcane
const LITRES_PER_MM_ACRE = 4047; // 1 mm of water over 1 acre (4047 m2) = 4047 litres
const HEAT_C = 40; // tmax at or above this is a heatwave day

// root-zone TAW in mm for a soil type
const tawMm = (soilType) => SOIL[soilType].taw * ROOT_DEPTH;

// ETc = ET0 * Kc
const etc = (et0, cropStage) => +(et0 * (KC[cropStage] ?? 1)).toFixed(1);

// litres delivered -> mm over the plot, and the reverse
const mmFromLitres = (litres, areaAcres) => litres / (areaAcres * LITRES_PER_MM_ACRE);
const litresFromMm = (mm, areaAcres) => mm * areaAcres * LITRES_PER_MM_ACRE;

// depletion grows by ETc and shrinks by rain / irrigation
function computeAdvisory(plot, weather) {
  const crop = etc(weather.et0, plot.cropStage);
  const taw = tawMm(plot.soilType);
  const depletion = Math.max(0, plot.depletion + crop - weather.rainToday);
  const raw = taw * MAD; // readily available water: irrigate once depletion passes this
  // Skip only when tomorrow's rain covers a day of crop use AND leaves the root zone below the
  // irrigation threshold. (A 1 mm drizzle must not cancel irrigation for a plot that is already dry.)
  const rainTomorrow = weather.rainTomorrow;
  if (rainTomorrow > 0 && rainTomorrow >= crop && depletion - rainTomorrow < raw) {
    return { type: 'skip', etc: crop, depletion, taw, hours: 0 };
  }
  if (depletion < raw) {
    return { type: 'wait', etc: crop, depletion, taw, hours: 0, daysLeft: crop > 0 ? Math.floor((raw - depletion) / crop) : 0 };
  }
  // mm to hours: (mm * acres * 4047) / (pump L/hr)
  const hours = +(litresFromMm(depletion, plot.areaAcres) / plot.pumpLph).toFixed(1);
  return { type: weather.tmax >= HEAT_C ? 'heat' : 'irrigate', etc: crop, depletion, taw, hours };
}

// heatwave risk: a hot day today, or any of the next three forecast days
function heatwave(weather) {
  const next = (weather.forecast || []).slice(1, 4).map((d) => d.tmax);
  const peak = Math.max(weather.tmax, ...next);
  return { active: weather.tmax >= HEAT_C, upcoming: next.some((t) => t >= HEAT_C), peak };
}

// what a supervisor must act on: heat stress, or a long (> 3 h) pumping demand
const isAlert = (advisory) => advisory.type === 'heat' || (advisory.type === 'irrigate' && advisory.hours > 3);

module.exports = {
  KC,
  SOIL,
  ROOT_DEPTH,
  MAD,
  LITRES_PER_MM_ACRE,
  HEAT_C,
  tawMm,
  etc,
  mmFromLitres,
  litresFromMm,
  computeAdvisory,
  heatwave,
  isAlert,
};
