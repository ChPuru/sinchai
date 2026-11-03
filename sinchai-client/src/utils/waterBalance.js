// FAO-56 soil-water-balance (simplified) - pure functions, used inside useMemo (Exp 3.2)
// Exp 5 - this file is the browser twin of sinchai-server/utils/waterBalance.js. The server stores the daily
// balance and the supervisor alerts; the client re-runs the same maths live. test/waterBalance.test.js on the
// server fails if the two copies ever give different answers.
export const KC = { germination: 0.4, tillering: 0.75, "grand-growth": 1.25, maturity: 0.75 };
export const SOIL = { sandy: { taw: 60 }, loamy: { taw: 110 }, clay: { taw: 150 } }; // mm/m root zone (approx)
const ROOT_DEPTH = 0.6, MAD = 0.3; // management-allowed depletion for sugarcane
export const HEAT_C = 40; // tmax at or above this is a heatwave day

// ETc = ET0 * Kc ; depletion grows by ETc and shrinks by rain / irrigation
export function computeAdvisory(plot, weather) {
  const kc = KC[plot.cropStage] ?? 1;
  const etc = +(weather.et0 * kc).toFixed(1);
  const taw = SOIL[plot.soilType].taw * ROOT_DEPTH;
  const depletion = Math.max(0, plot.depletion + etc - weather.rainToday);
  const raw = taw * MAD;
  // skip only when tomorrow's rain covers a day of crop use AND leaves the root zone under the irrigation threshold,
  // so a light drizzle never cancels irrigation for a plot that is already dry
  if (weather.rainTomorrow > 0 && weather.rainTomorrow >= etc && depletion - weather.rainTomorrow < raw) {
    return { type: "skip", etc, depletion, taw, hours: 0 };
  }
  if (depletion < raw) return { type: "wait", etc, depletion, taw, hours: 0, daysLeft: etc > 0 ? Math.floor((raw - depletion) / etc) : 0 };
  // mm to hours: (mm * area m2) / (pump L/hr)
  const litres = depletion * plot.areaAcres * 4047;
  const hours = +(litres / plot.pumpLph).toFixed(1);
  return { type: weather.tmax >= HEAT_C ? "heat" : "irrigate", etc, depletion, taw, hours };
}

// root-zone moisture % shown on the ring / progress bar of a plot
export const moisturePct = (plot) => Math.max(0, Math.min(100, Math.round(100 - (plot.depletion / (SOIL[plot.soilType].taw * ROOT_DEPTH)) * 100)));
