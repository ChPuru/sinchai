import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useData } from "../context/DataContext";
import { computeAdvisory, SOIL } from "../utils/waterBalance";
import AdvisoryCard from "../components/AdvisoryCard";
import PlotEditForm from "../components/PlotEditForm";
import WeatherNotice from "../components/WeatherNotice";
import PlotMap from "../components/PlotMap";
import Icon from "../components/Icon";

// Exp 3.3 - route "/plots/:plotId": useParams() reads the dynamic segment out of the URL,
// useNavigate() gives the back button navigate(-1) (one step back in the history stack).
// Exp 5 - the owner can also edit (PUT /api/plots/:id) or delete (DELETE /api/plots/:id) the plot here.
export default function PlotDetail() {
  const { plotId } = useParams();
  const { t, user } = useApp();
  const navigate = useNavigate();
  // location.key is "default" only for the very first entry in the router stack, i.e. this page
  // was opened straight from a bookmark or a typed URL and there is nothing of ours to go back to
  const location = useLocation();
  const { plots, weatherFor, history, loading, markIrrigated, updatePlot, deletePlot } = useData();
  const [editing, setEditing] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const plot = plots.find((p) => String(p.id) === plotId);

  // Exp 3.2 - useMemo: the FAO-56 balance is recomputed only when this plot or its village's weather changes
  const weather = plot ? weatherFor(plot) : null;
  const advisory = useMemo(() => (plot && weather ? computeAdvisory(plot, weather) : null), [plot, weather]);
  const rows = useMemo(
    () => (plot ? history.filter((h) => h.plotId === plot.id).slice().sort((a, b) => b.date.localeCompare(a.date)) : []),
    [history, plot]
  );

  if (loading) return <p className="muted" style={{ textAlign: "center", padding: 48 }}>{t("loading")}</p>;

  // Exp 3.3 - a routed URL can be typed or bookmarked, so the page must always handle an id
  // that no longer exists instead of crashing on an undefined plot.
  if (!plot) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 48 }}>
        <Icon name="wrong_location" size={48} style={{ color: "var(--outline)" }} />
        <h2 className="headline-md" style={{ margin: "16px 0 24px" }}>{t("plotNotFound")}</h2>
        <Link to="/plots" className="btn btn-primary">
          <Icon name="arrow_back" size={18} /> {t("backToPlots")}
        </Link>
      </div>
    );
  }

  // same moisture maths as PlotCard, so the card and this page always show the same number
  const taw = SOIL[plot.soilType].taw * 0.6;
  const moisture = Math.max(0, Math.round(100 - (plot.depletion / taw) * 100));
  const low = moisture < 50;
  const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const owns = user.role === "farmer"; // a supervisor may read any plot but not change it (the API answers 403)

  const remove = async () => {
    if (!window.confirm(t("confirmDeletePlot"))) return;
    try {
      await deletePlot(plot.id);
      navigate("/plots", { replace: true });
    } catch {
      setDeleteFailed(true);
    }
  };

  return (
    <div className="stack" style={{ gap: 32 }}>
      <div className="between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="label-sm muted">{t("plotDetail")}</div>
          <h1 className="headline-lg">{plot.name}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {plot.areaAcres} {t("acUnit")} · {t("soil_" + plot.soilType)} · {t("stage_" + plot.cropStage)} · {plot.village}
            {plot.owner && user.role === "supervisor" ? " · " + plot.owner : ""}
          </p>
          {/* Exp 5 - the farmer's note is for the supervisor, so it is shown here */}
          {plot.notes && (
            <p className="label-sm" style={{ margin: "8px 0 0" }}>
              <span className="label-bold">{t("notesLabel")}:</span> {plot.notes}
            </p>
          )}
        </div>
        <div className="row">
          {owns && !editing && (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
                <Icon name="edit" size={18} /> {t("editPlot")}
              </button>
              <button className="btn btn-outline btn-sm danger" onClick={remove}>
                <Icon name="delete" size={18} /> {t("deletePlot")}
              </button>
            </>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => (location.key === "default" ? navigate("/plots") : navigate(-1))}>
            <Icon name="arrow_back" size={18} /> {t("back")}
          </button>
        </div>
      </div>

      {deleteFailed && (
        <div className="error-box" role="alert">
          <Icon name="error" fill /> {t("errAction")}
        </div>
      )}

      {/* Exp 3.1 - conditional rendering: the edit form replaces nothing, it opens above the details */}
      {editing && (
        <PlotEditForm
          plot={plot}
          onSave={async (data) => {
            await updatePlot(plot.id, data);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      <div className="detail-grid">
        <div className="card stack">
          <PlotMap plots={[plot]} selectedId={plot.id} height={280} />
          <div className="between">
            <div>
              <div className="label-sm muted">{t("moisture")}</div>
              <div className="headline-md">{moisture}%</div>
            </div>
            <div className={"ring " + (low ? "low" : "")}>{moisture}%</div>
          </div>
          <div className="progress">
            <div style={{ width: moisture + "%", background: low ? "var(--error)" : "var(--primary)" }} />
          </div>
          <div className="label-sm muted">
            {t("depletion")}: {plot.depletion.toFixed(0)} / {taw.toFixed(0)} mm · {t("pump")} {plot.pumpLph}
            {plot.pumpKw != null ? " · " + plot.pumpKw + " kW" : ""}
            {plot.habitHours != null ? " · " + t("habitHours") + ": " + plot.habitHours : ""}
          </div>
        </div>

        <div className="stack">
          <h2 className="headline-md">{t("todayAdvice")}</h2>
          {advisory ? (
            <AdvisoryCard plot={plot} advisory={advisory} onDone={markIrrigated} />
          ) : (
            <WeatherNotice />
          )}
        </div>
      </div>

      <div className="card">
        <div className="between mb-4">
          <h2 className="headline-md">{t("plotHistory")}</h2>
          {/* Exp 3.3 - a Link may carry a query string; /history reads ?plot= to pre-select this plot */}
          <Link to={"/history?plot=" + plot.id} className="btn btn-outline-primary btn-sm">
            {t("viewFullHistory")} <Icon name="arrow_forward" size={16} />
          </Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>{t("date")}</th><th>{t("hours")}</th><th>{t("litres")}</th><th>{t("source")}</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{fmtDate(r.date)}</td>
                  <td>{r.hours}</td>
                  <td className="mono text-primary-c">{r.litres.toLocaleString("en-IN")}</td>
                  <td>
                    {r.advised ? (
                      <span className="chip chip-primary"><Icon name="smart_toy" size={14} /> {t("byAdvisory")}</span>
                    ) : (
                      <span className="chip chip-neutral"><Icon name="person" size={14} /> {t("manual")}</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan="4" className="muted" style={{ textAlign: "center" }}>{t("noHistory")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
