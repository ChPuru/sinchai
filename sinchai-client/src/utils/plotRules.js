// Exp 3.3 / Exp 5 - the plot-field rules used by BOTH the Add Plot form and the Edit Plot form, so they cannot drift apart
import { isBlank } from "./validators";
import { errorKey } from "../api/client";

// returns an errors object ({} means the fields are valid); `t` supplies the message in the chosen language
export function validatePlotFields(v, t) {
  const errors = {};
  if (isBlank(v.name)) errors.name = t("errPlotNameReq");
  if (isBlank(v.village)) errors.village = t("errVillageReq");
  if (isBlank(v.cropStage)) errors.cropStage = t("errCropStageReq");
  const area = Number(v.areaAcres);
  if (isBlank(v.areaAcres) || !Number.isFinite(area) || area < 0.1) errors.areaAcres = t("errAreaReq");
  const pump = Number(v.pumpLph);
  if (isBlank(v.pumpLph) || !Number.isFinite(pump) || pump < 1000) errors.pumpLph = t("errPumpReq");
  // the next two are optional facts only the farmer knows: empty is fine, a value must make sense
  if (!isBlank(v.habitHours)) {
    const h = Number(v.habitHours);
    if (!Number.isFinite(h) || h < 0.1 || h > 24) errors.habitHours = t("errHabitHours");
  }
  if (!isBlank(v.pumpKw)) {
    const k = Number(v.pumpKw);
    if (!Number.isFinite(k) || k < 0.1 || k > 200) errors.pumpKw = t("errPumpKw");
  }
  return errors;
}

// "" -> null (not entered), "3.5" -> 3.5; this is what is sent to the API
export const optionalNumber = (v) => (isBlank(v) ? null : Number(v));

// Exp 5 - the server validates the same fields again; this turns its reply into messages for the right inputs
export function serverPlotErrors(err, t) {
  if (err.status === 409) return { name: t("errPlotNameTaken") }; // the unique (owner, name) index
  if (err.status === 400 && Object.keys(err.fields).length) {
    const { lat, lng, ...rest } = err.fields; // the pin is two numbers on the server, one marker on the map
    const pin = lat || lng;
    return { ...rest, ...(pin ? { marker: /India/.test(pin) ? t("errOutsideIndia") : t("errMarkerReq") } : {}) };
  }
  return { form: t(errorKey(err)) };
}
