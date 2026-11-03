import { useReducer, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useData } from "../context/DataContext";
import PlotMap from "../components/PlotMap";
import Icon from "../components/Icon";
import { validatePlotFields, serverPlotErrors, optionalNumber } from "../utils/plotRules";

// Exp 3.2 - useReducer for a multi-field form; all update rules live in one reducer
// Exp 3.3 - the single error string became a per-field errors object
// Exp 5 - marker is the { lat, lng } of the pin on the real map; habitHours and pumpKw are optional facts the farmer
// may give so that "water saved" and "electricity used" can be worked out from their own figures instead of assumptions
const initial = { name: "", village: "", soilType: "loamy", cropStage: "", areaAcres: "", pumpLph: "", habitHours: "", pumpKw: "", marker: null, errors: {} };

function reducer(state, action) {
  switch (action.type) {
    case "field":
      // typing in a field clears only that field's error, so the rest of the summary stays
      return { ...state, [action.name]: action.value, errors: { ...state.errors, [action.name]: "" } };
    case "marker":
      return { ...state, marker: action.value, errors: { ...state.errors, marker: "" } };
    case "errors":
      return { ...state, errors: action.value };
    case "reset":
      return initial;
    default:
      return state;
  }
}

// Exp 3.3 - validate() takes the whole form state and returns an errors object ({} means valid).
// The field rules are shared with the Edit Plot form (utils/plotRules.js); only the map marker is specific to this page.
function validate(s, t) {
  const errors = validatePlotFields(s, t);
  if (!s.marker) errors.marker = t("errMarkerReq");
  return errors;
}

export default function AddPlot() {
  const { t } = useApp();
  const { plots, addPlot } = useData();
  const navigate = useNavigate(); // Exp 3.3 - useNavigate redirects after a successful submit
  const [s, dispatch] = useReducer(reducer, initial);
  const [submitting, setSubmitting] = useState(false); // Exp 5 - true while the POST is in flight
  const notesRef = useRef(null);
  const field = (e) => dispatch({ type: "field", name: e.target.name, value: e.target.value });

  // any truthy entry in the errors object counts as invalid
  const bad = Object.keys(s.errors).filter((k) => s.errors[k]);
  const summary = s.errors.form || s.errors.marker || (bad.length ? t("errFixFields") : "");

  const submit = async (e) => {
    e.preventDefault(); // Exp 3.3 - stop the browser's default page reload so React keeps control
    const errors = validate(s, t);
    dispatch({ type: "errors", value: errors });
    if (Object.keys(errors).length) return;
    setSubmitting(true);
    try {
      // Exp 5 - POST /api/plots: the owner comes from the login token, so the form no longer sends one
      await addPlot({
        name: s.name.trim(),
        village: s.village.trim(),
        soilType: s.soilType,
        cropStage: s.cropStage,
        areaAcres: +s.areaAcres,
        pumpLph: +s.pumpLph,
        habitHours: optionalNumber(s.habitHours),
        pumpKw: optionalNumber(s.pumpKw),
        notes: notesRef.current.value.trim(),
        lat: s.marker.lat,
        lng: s.marker.lng,
      });
      dispatch({ type: "reset" });
      notesRef.current.value = ""; // the DOM node keeps the text, so it is cleared by hand
      // Exp 3.3 - the form now finishes by routing to /plots instead of flipping a page state variable
      navigate("/plots");
    } catch (err) {
      dispatch({ type: "errors", value: serverPlotErrors(err, t) });
      setSubmitting(false);
    }
  };

  return (
    <div className="split">
      <PlotMap plots={plots} marker={s.marker} onPick={(m) => dispatch({ type: "marker", value: m })} height={520}>
        <div className="map-title">{t("addPlot")}</div>
        {!s.marker && !s.errors.marker && (
          <div className="map-banner">
            <div className="banner banner-warn" style={{ padding: "12px 16px", alignItems: "center", display: "inline-flex" }}>
              <Icon name="warning" fill style={{ color: "var(--secondary)" }} />
              <span className="label-bold">{t("mapHint")}</span>
            </div>
          </div>
        )}
      </PlotMap>

      <form className="card stack" onSubmit={submit} noValidate>
        <div>
          <h2 className="headline-md">{t("plotDetails")}</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>{t("plotDetailsSub")}</p>
        </div>
        {/* Exp 3.3 - controlled components: every value below lives in the reducer state */}
        <div className="field">
          <label htmlFor="plot-name">{t("plotName")}</label>
          <input
            id="plot-name"
            name="name"
            className={"input" + (s.errors.name ? " invalid" : "")}
            placeholder={t("plotNamePh")}
            value={s.name}
            onChange={field}
            aria-invalid={!!s.errors.name}
            aria-describedby={s.errors.name ? "err-plot-name" : undefined}
          />
          {s.errors.name && <span className="error" id="err-plot-name">{s.errors.name}</span>}
        </div>
        <div className="field">
          <label htmlFor="plot-village">{t("village")}</label>
          <input
            id="plot-village"
            name="village"
            className={"input" + (s.errors.village ? " invalid" : "")}
            placeholder={t("villagePh")}
            value={s.village}
            onChange={field}
            aria-invalid={!!s.errors.village}
            aria-describedby={s.errors.village ? "err-plot-village" : undefined}
          />
          {s.errors.village && <span className="error" id="err-plot-village">{s.errors.village}</span>}
        </div>
        <div className="field">
          {/* the three choices are buttons, not one control, so the group is labelled with
              aria-labelledby instead of a <label htmlFor> that would point at nothing */}
          <span className="field-label" id="soil-label">{t("soilType")}</span>
          <div className="segmented" role="group" aria-labelledby="soil-label">
            {["sandy", "loamy", "clay"].map((v) => (
              <button type="button" key={v} className={s.soilType === v ? "active" : ""} aria-pressed={s.soilType === v} onClick={() => dispatch({ type: "field", name: "soilType", value: v })}>
                {t("soil_" + v)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="plot-stage">{t("cropStage")}</label>
          <select
            id="plot-stage"
            name="cropStage"
            className={"select" + (s.errors.cropStage ? " invalid" : "")}
            value={s.cropStage}
            onChange={field}
            aria-invalid={!!s.errors.cropStage}
            aria-describedby={s.errors.cropStage ? "err-plot-stage" : undefined}
          >
            <option value="" disabled>{t("selectCropStage")}</option>
            {["germination", "tillering", "grand-growth", "maturity"].map((v) => (
              <option key={v} value={v}>{t("stageOpt_" + v)}</option>
            ))}
          </select>
          {s.errors.cropStage && <span className="error" id="err-plot-stage">{s.errors.cropStage}</span>}
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="plot-area">{t("area")}</label>
            <div className="input-icon">
              <Icon name="square_foot" />
              <input
                id="plot-area"
                name="areaAcres"
                type="number"
                step="0.1"
                min="0.1"
                className={"input" + (s.errors.areaAcres ? " invalid" : "")}
                placeholder="0.0"
                value={s.areaAcres}
                onChange={field}
                aria-invalid={!!s.errors.areaAcres}
                aria-describedby={s.errors.areaAcres ? "err-plot-area" : undefined}
              />
            </div>
            {s.errors.areaAcres && <span className="error" id="err-plot-area">{s.errors.areaAcres}</span>}
          </div>
          <div className="field">
            <label htmlFor="plot-pump">{t("pump")}</label>
            <div className="input-icon">
              <Icon name="water_drop" />
              <input
                id="plot-pump"
                name="pumpLph"
                type="number"
                step="1000"
                min="1000"
                className={"input" + (s.errors.pumpLph ? " invalid" : "")}
                placeholder="0"
                value={s.pumpLph}
                onChange={field}
                aria-invalid={!!s.errors.pumpLph}
                aria-describedby={s.errors.pumpLph ? "err-plot-pump" : undefined}
              />
            </div>
            {s.errors.pumpLph && <span className="error" id="err-plot-pump">{s.errors.pumpLph}</span>}
          </div>
        </div>
        {/* Exp 5 - optional: the farmer's own figures replace any assumption in "water saved" and "electricity used" */}
        <div className="grid-2">
          <div className="field">
            <label htmlFor="plot-habit">{t("habitHours")}</label>
            <div className="input-icon">
              <Icon name="schedule" />
              <input
                id="plot-habit"
                name="habitHours"
                type="number"
                step="0.5"
                min="0.1"
                max="24"
                className={"input" + (s.errors.habitHours ? " invalid" : "")}
                value={s.habitHours}
                onChange={field}
                aria-invalid={!!s.errors.habitHours}
                aria-describedby={s.errors.habitHours ? "err-plot-habit" : "hint-plot-habit"}
              />
            </div>
            {s.errors.habitHours ? <span className="error" id="err-plot-habit">{s.errors.habitHours}</span> : <span className="notes-hint" id="hint-plot-habit">{t("habitHoursHint")}</span>}
          </div>
          <div className="field">
            <label htmlFor="plot-kw">{t("pumpKw")}</label>
            <div className="input-icon">
              <Icon name="bolt" />
              <input
                id="plot-kw"
                name="pumpKw"
                type="number"
                step="0.1"
                min="0.1"
                max="200"
                className={"input" + (s.errors.pumpKw ? " invalid" : "")}
                value={s.pumpKw}
                onChange={field}
                aria-invalid={!!s.errors.pumpKw}
                aria-describedby={s.errors.pumpKw ? "err-plot-kw" : "hint-plot-kw"}
              />
            </div>
            {s.errors.pumpKw ? <span className="error" id="err-plot-kw">{s.errors.pumpKw}</span> : <span className="notes-hint" id="hint-plot-kw">{t("pumpKwHint")}</span>}
          </div>
        </div>
        <div className="field">
          <label htmlFor="plot-notes">{t("notes")}</label>
          {/* Exp 3.3 - uncontrolled component: the value lives in the DOM and is read with a ref only on submit,
              because these notes never need live validation. Every other field above is controlled. */}
          <textarea id="plot-notes" name="notes" className="input" rows={3} ref={notesRef} />
          <span className="notes-hint">{t("notesHint")}</span>
        </div>
        {summary && (
          <div className="error-box" role="alert">
            <Icon name="error" fill /> {summary}
          </div>
        )}
        <button className="btn btn-primary btn-block" style={{ padding: 16 }} disabled={submitting}>
          <Icon name="add" /> {submitting ? t("saving") : t("addPlot")}
        </button>
      </form>
    </div>
  );
}
