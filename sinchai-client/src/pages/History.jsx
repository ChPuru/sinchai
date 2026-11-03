import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useData } from "../context/DataContext";
import Icon from "../components/Icon";

// Exp 3.2 - useMemo for the filtered/sorted list and the totals
// Exp 3.3 - useSearchParams reads AND writes the ?plot= query string, so the filter now lives in the
// URL: /history?plot=2 deep-links straight to one plot's log, which is how PlotDetail links here
// Exp 5 - plot ids are MongoDB ObjectIds (strings), so they are compared as strings; a farmer can delete a wrong entry
export default function History() {
  const { t, user } = useApp();
  const { history, plots, loading, deleteLog } = useData();
  const [params, setParams] = useSearchParams();
  const plotFilter = params.get("plot") ?? "all";
  const rows = useMemo(
    () => history.filter((h) => plotFilter === "all" || h.plotId === plotFilter).slice().sort((a, b) => b.date.localeCompare(a.date)),
    [history, plotFilter]
  );
  const totals = useMemo(() => rows.reduce((acc, r) => ({ litres: acc.litres + r.litres, hours: acc.hours + r.hours }), { litres: 0, hours: 0 }), [rows]);
  const plotName = (id) => plots.find((p) => p.id === id)?.name ?? "-";
  const farmer = user.role === "farmer"; // supervisors only read the log
  const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  // after every hook, like the other data pages, so an empty log is never shown while loading
  if (loading) return <p className="muted" style={{ textAlign: "center", padding: 48 }}>{t("loading")}</p>;

  return (
    <div className="stack" style={{ gap: 32 }}>
      <div>
        <h1 className="headline-lg">{t("history")}</h1>
        <p className="muted" style={{ margin: "8px 0 0" }}>{t("historySub")}</p>
      </div>
      <div className="card">
        <div className="between mb-4">
          <h2 className="headline-md">{t("activityLog")}</h2>
          {/* Exp 3.3 - changing the select rewrites the query string instead of local state */}
          <select
            className="select"
            style={{ width: "auto", minWidth: 200 }}
            value={plotFilter}
            onChange={(e) => setParams(e.target.value === "all" ? {} : { plot: e.target.value }, { replace: true })}
            aria-label={t("filterByPlot")}
          >
            <option value="all">{t("allPlots")}</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>{t("date")}</th><th>{t("plot")}</th><th>{t("hours")}</th><th>{t("litres")}</th><th>{t("source")}</th>{farmer && <th />}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{fmtDate(r.date)}</td>
                  <td style={{ fontWeight: 500 }}>{plotName(r.plotId)}</td>
                  <td>{r.hours}</td>
                  <td className="mono text-primary-c">{r.litres.toLocaleString("en-IN")}</td>
                  <td>
                    {r.advised ? (
                      <span className="chip chip-primary"><Icon name="smart_toy" size={14} /> {t("byAdvisory")}</span>
                    ) : (
                      <span className="chip chip-neutral"><Icon name="person" size={14} /> {t("manual")}</span>
                    )}
                  </td>
                  {farmer && (
                    <td>
                      {/* DELETE /api/history/:id - the plot's soil-water depletion is restored by the server */}
                      <button
                        className="icon-btn danger"
                        title={t("deleteEntry")}
                        aria-label={t("deleteEntry")}
                        onClick={() => window.confirm(t("confirmDeleteLog")) && deleteLog(r.id)}
                      >
                        <Icon name="delete" size={20} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={farmer ? 6 : 5} className="muted" style={{ textAlign: "center" }}>{t("noHistory")}</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="2" style={{ textAlign: "right", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("total")}</td>
                <td>{totals.hours.toFixed(1)} h</td>
                <td colSpan={farmer ? 3 : 2} className="mono text-primary-c" style={{ fontSize: 18 }}>{totals.litres.toLocaleString("en-IN")} L</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="between label-sm muted" style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--surface-variant)" }}>
          <span>{t("showingEntries").replace("{a}", rows.length).replace("{b}", history.length)}</span>
        </div>
      </div>
    </div>
  );
}
