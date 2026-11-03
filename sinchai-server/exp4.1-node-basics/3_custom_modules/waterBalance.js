// waterBalance.js - custom module with the mathematical functions of the FAO-56 soil-water-balance
// (the SinchAI "marks.js": every function is small, pure and exported with module.exports)

// crop coefficient per sugarcane growth stage
const KC = { germination: 0.4, tillering: 0.75, 'grand-growth': 1.25, maturity: 0.75 };
// total available water, mm per metre of root zone
const SOIL = { sandy: 60, loamy: 110, clay: 150 };
const ROOT_DEPTH = 0.6; // metres
const MAD = 0.3; // management-allowed depletion for sugarcane

// ETc = ET0 * Kc : water the crop uses in one day (mm)
function etc(et0, cropStage) {
  return +(et0 * (KC[cropStage] ?? 1)).toFixed(1);
}

// total available water in the root zone (mm)
function taw(soilType) {
  return SOIL[soilType] * ROOT_DEPTH;
}

// readily available water: irrigate once the depletion passes this (mm)
function raw(soilType) {
  return taw(soilType) * MAD;
}

// depletion grows by ETc and shrinks by rain
function depletion(plot, etcMm, rainMm) {
  return Math.max(0, plot.depletion + etcMm - rainMm);
}

// mm of water -> hours of pumping: (mm * acres * 4047 L) / (pump L/hr)
function hours(mm, areaAcres, pumpLph) {
  return +((mm * areaAcres * 4047) / pumpLph).toFixed(1);
}

// combines the functions above into the advice the farmer sees
function advisory(plot, weather) {
  const crop = etc(weather.et0, plot.cropStage);
  const available = taw(plot.soilType);
  const dep = depletion(plot, crop, weather.rainToday);
  const threshold = raw(plot.soilType);

  // rain tomorrow that covers a day of crop use AND brings the root zone back under the threshold: skip
  if (weather.rainTomorrow > 0 && weather.rainTomorrow >= crop && dep - weather.rainTomorrow < threshold) {
    return { type: 'skip', etc: crop, depletion: dep, taw: available, hours: 0 };
  }
  if (dep < threshold) {
    return { type: 'wait', etc: crop, depletion: dep, taw: available, hours: 0, daysLeft: crop > 0 ? Math.floor((threshold - dep) / crop) : 0 };
  }
  return { type: weather.tmax >= 40 ? 'heat' : 'irrigate', etc: crop, depletion: dep, taw: available, hours: hours(dep, plot.areaAcres, plot.pumpLph) };
}

module.exports = { etc, taw, raw, depletion, hours, advisory };
