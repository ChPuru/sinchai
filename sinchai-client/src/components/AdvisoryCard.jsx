import { useApp } from "../context/AppContext";
import Icon from "./Icon";

// Exp 3.1 - presentational component driven entirely by props; conditional rendering by advisory type
const META = {
  irrigate: { icon: "water_drop", color: "var(--primary)" },
  heat: { icon: "warning", color: "var(--error)" },
  skip: { icon: "rainy", color: "var(--on-info-container)" },
  wait: { icon: "hourglass_empty", color: "var(--outline)" },
};

export default function AdvisoryCard({ plot, advisory, onDone }) {
  const { t } = useApp();
  const m = META[advisory.type];
  const pct = Math.min(100, (advisory.depletion / advisory.taw) * 100);
  return (
    <div className="card" style={{ display: "flex", gap: 0, padding: 0, overflow: "hidden" }}>
      <div style={{ background: m.color, color: "#fff", padding: 16, display: "flex", alignItems: "center" }}>
        <Icon name={m.icon} fill size={30} />
      </div>
      <div style={{ padding: 20, flex: 1 }}>
        <div className="label-sm muted">
          {plot.name} · {plot.areaAcres} {t("acUnit")} · {t("stage_" + plot.cropStage)}
        </div>
        <h3 className="headline-md" style={{ margin: "4px 0 6px" }}>
          {advisory.type === "skip" && t("skip")}
          {advisory.type === "heat" && <>{t("heatwave")} · {advisory.hours} {t("hours")}</>}
          {advisory.type === "irrigate" && <>{t("irrigateFor")} <span className="text-primary-c">{advisory.hours} {t("hours")}</span></>}
          {advisory.type === "wait" && (
            advisory.daysLeft > 0
              ? <>{t("noIrrigationNeeded")} · {t("nextCheckIn")} {advisory.daysLeft} {t("daysUnit")}</>
              : <>{t("noIrrigationNeeded")} · {t("irrigateTomorrowSoon")}</>
          )}
        </h3>
        <div className="label-sm muted">
          ETc {advisory.etc} mm/day · {t("depletionWord")} {advisory.depletion.toFixed(0)} / {advisory.taw.toFixed(0)} mm
        </div>
        <div className="progress" style={{ margin: "8px 0 12px", maxWidth: 420 }}>
          <div style={{ width: pct + "%", background: pct > 50 ? "var(--error)" : "var(--primary)" }} />
        </div>
        {advisory.hours > 0 && (
          <button className="btn btn-primary btn-sm" onClick={() => onDone(plot, advisory.hours)}>
            <Icon name="play_circle" size={18} /> {t("markDone")}
          </button>
        )}
      </div>
    </div>
  );
}
