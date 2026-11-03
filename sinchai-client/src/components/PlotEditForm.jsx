import { useState } from "react";
import { useApp } from "../context/AppContext";
import { validatePlotFields, serverPlotErrors, optionalNumber } from "../utils/plotRules";
import PlotMap from "./PlotMap";
import Icon from "./Icon";

// Exp 5 - the "U" of CRUD in the UI: a crop moves from tillering to grand growth during the season, so a plot
// must be editable (and a mis-placed pin must be movable). Controlled components (Exp 3.3);
// onSave(data) is DataContext.updatePlot -> PUT /api/plots/:id.
export default function PlotEditForm({ plot, onSave, onCancel }) {
  const { t } = useApp();
  const [v, setV] = useState({
    name: plot.name,
    village: plot.village,
    soilType: plot.soilType,
    cropStage: plot.cropStage,
    areaAcres: String(plot.areaAcres),
    pumpLph: String(plot.pumpLph),
    habitHours: plot.habitHours == null ? "" : String(plot.habitHours),
    pumpKw: plot.pumpKw == null ? "" : String(plot.pumpKw),
    notes: plot.notes ?? "",
  });
  const [marker, setMarker] = useState({ lat: plot.lat, lng: plot.lng });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const change = (e) => {
    setV((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: "", form: "" }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validatePlotFields(v, t);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await onSave({
        name: v.name.trim(),
        village: v.village.trim(),
        soilType: v.soilType,
        cropStage: v.cropStage,
        areaAcres: +v.areaAcres,
        pumpLph: +v.pumpLph,
        habitHours: optionalNumber(v.habitHours),
        pumpKw: optionalNumber(v.pumpKw),
        notes: v.notes.trim(),
        lat: marker.lat,
        lng: marker.lng,
      });
    } catch (err) {
      setErrors(serverPlotErrors(err, t));
      setSaving(false);
    }
  };

  const fieldProps = (name) => ({
    id: "edit-" + name,
    name,
    value: v[name],
    onChange: change,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? "edit-err-" + name : undefined,
  });
  const err = (name) => errors[name] && <span className="error" id={"edit-err-" + name}>{errors[name]}</span>;
  const bad = Object.keys(errors).some((k) => errors[k]);

  return (
    <form className="card stack" onSubmit={submit} noValidate>
      <h2 className="headline-md">{t("editPlot")}</h2>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="edit-name">{t("plotName")}</label>
          <input className={"input" + (errors.name ? " invalid" : "")} {...fieldProps("name")} />
          {err("name")}
        </div>
        <div className="field">
          <label htmlFor="edit-village">{t("village")}</label>
          <input className={"input" + (errors.village ? " invalid" : "")} {...fieldProps("village")} />
          {err("village")}
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <span className="field-label" id="edit-soil-label">{t("soilType")}</span>
          <div className="segmented" role="group" aria-labelledby="edit-soil-label">
            {["sandy", "loamy", "clay"].map((val) => (
              <button type="button" key={val} className={v.soilType === val ? "active" : ""} aria-pressed={v.soilType === val} onClick={() => setV((prev) => ({ ...prev, soilType: val }))}>
                {t("soil_" + val)}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="edit-cropStage">{t("cropStage")}</label>
          <select className={"select" + (errors.cropStage ? " invalid" : "")} {...fieldProps("cropStage")}>
            {["germination", "tillering", "grand-growth", "maturity"].map((val) => (
              <option key={val} value={val}>{t("stageOpt_" + val)}</option>
            ))}
          </select>
          {err("cropStage")}
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="edit-areaAcres">{t("area")}</label>
          <input type="number" step="0.1" min="0.1" className={"input" + (errors.areaAcres ? " invalid" : "")} {...fieldProps("areaAcres")} />
          {err("areaAcres")}
        </div>
        <div className="field">
          <label htmlFor="edit-pumpLph">{t("pump")}</label>
          <input type="number" step="1000" min="1000" className={"input" + (errors.pumpLph ? " invalid" : "")} {...fieldProps("pumpLph")} />
          {err("pumpLph")}
        </div>
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="edit-habitHours">{t("habitHours")}</label>
          <input type="number" step="0.5" min="0.1" max="24" className={"input" + (errors.habitHours ? " invalid" : "")} {...fieldProps("habitHours")} />
          {err("habitHours") || <span className="notes-hint">{t("habitHoursHint")}</span>}
        </div>
        <div className="field">
          <label htmlFor="edit-pumpKw">{t("pumpKw")}</label>
          <input type="number" step="0.1" min="0.1" max="200" className={"input" + (errors.pumpKw ? " invalid" : "")} {...fieldProps("pumpKw")} />
          {err("pumpKw") || <span className="notes-hint">{t("pumpKwHint")}</span>}
        </div>
      </div>
      <div className="field">
        <span className="field-label">{t("plotLocation")}</span>
        <PlotMap plots={[]} marker={marker} onPick={setMarker} height={260} />
        {errors.marker && <span className="error">{errors.marker}</span>}
      </div>
      <div className="field">
        <label htmlFor="edit-notes">{t("notes")}</label>
        <textarea className="input" rows={2} {...fieldProps("notes")} />
      </div>
      {bad && (
        <div className="error-box" role="alert">
          <Icon name="error" fill /> {errors.form || errors.marker || t("errFixFields")}
        </div>
      )}
      <div className="row">
        <button className="btn btn-primary" disabled={saving}>
          <Icon name="save" size={18} /> {saving ? t("saving") : t("saveChanges")}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>{t("cancel")}</button>
      </div>
    </form>
  );
}
