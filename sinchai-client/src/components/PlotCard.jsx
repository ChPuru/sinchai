import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Icon from "./Icon";
import { SOIL } from "../utils/waterBalance";

// Exp 3.1 - reusable card via props, default prop, computed expression in JSX
export default function PlotCard({ plot, onSelect, selected = false, onIrrigate }) {
  const { t } = useApp();
  const taw = SOIL[plot.soilType].taw * 0.6;
  const moisture = Math.max(0, Math.round(100 - (plot.depletion / taw) * 100));
  const low = moisture < 50;
  return (
    <div className={"card card-hover " + (selected ? "selected" : "")} onClick={() => onSelect?.(plot)} style={{ padding: 20 }}>
      <div className="between mb-3" style={{ alignItems: "flex-start" }}>
        <div>
          <h3 className="headline-md">{plot.name}</h3>
          <div className="label-sm muted">
            {plot.areaAcres} {t("acUnit")} · {t("soil_" + plot.soilType)} · {t("stage_" + plot.cropStage)}
          </div>
          <div className="label-sm muted row" style={{ gap: 4, marginTop: 4 }}>
            <Icon name="location_on" size={16} /> {plot.village}
          </div>
        </div>
        <div className={"ring " + (low ? "low" : "")}>{moisture}%</div>
      </div>
      <div className="progress mb-3">
        <div style={{ width: moisture + "%", background: low ? "var(--error)" : "var(--primary)" }} />
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {/* Exp 3.1 - conditional rendering: the irrigate button only appears on a dry plot... */}
        {low && onIrrigate && (
          <button className="btn btn-primary btn-sm btn-block" onClick={(e) => { e.stopPropagation(); onIrrigate(plot); }}>
            {t("startIrrigation")}
          </button>
        )}
        {/* Exp 3.3 - ...but the Link to the dynamic /plots/:plotId route is always there, so a dry
            plot is still openable. Link renders a real anchor yet navigates client-side. */}
        <Link to={"/plots/" + plot.id} className="btn btn-outline-primary btn-sm btn-block" onClick={(e) => e.stopPropagation()}>
          {t("details")}
        </Link>
      </div>
    </div>
  );
}
