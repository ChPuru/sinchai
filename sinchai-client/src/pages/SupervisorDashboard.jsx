import { useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useData } from "../context/DataContext";
import { computeAdvisory, SOIL } from "../utils/waterBalance";
import WeatherNotice from "../components/WeatherNotice";
import Icon from "../components/Icon";

// Exp 3.2 - useCallback keeps the row handler stable; useMemo builds the table rows
// Exp 3.3 - route element with no props: plots/weather/history come from useData(), and every
// plot name in the table is a <Link> to the dynamic /plots/:plotId route
// Exp 5 - the alert list and its "Acknowledge" button are backed by MongoDB (GET /api/alerts and
// POST /api/alerts/:id/ack): an acknowledgement survives a refresh and is shared by every supervisor.
export default function SupervisorDashboard() {
  const { t, user } = useApp();
  const { plots, weather, weatherFor, alerts, analytics, loading, acknowledgeAlert } = useData();
  const [q, setQ] = useState("");
  const acknowledge = useCallback((id) => acknowledgeAlert(id), [acknowledgeAlert]);

  const rows = useMemo(
    () => plots.map((p) => ({ plot: p, adv: weatherFor(p) ? computeAdvisory(p, weatherFor(p)) : null })), // adv is null while live weather for the plot is missing
    [plots, weatherFor]
  );
  const open = alerts.filter((a) => !a.acknowledged);
  const villages = useMemo(() => [...new Set(plots.map((p) => p.village))], [plots]);
  const farmers = useMemo(() => new Set(plots.map((p) => p.ownerId)).size, [plots]);
  const shown = rows.filter((r) => (r.plot.owner + r.plot.name + r.plot.village).toLowerCase().includes(q.toLowerCase()));
  const pct = (p) => Math.round((p.depletion / (SOIL[p.soilType].taw * 0.6)) * 100);
  const BADGE = { irrigate: ["chip-primary", "water_drop", "badgeIrrigate"], heat: ["chip-error", "warning", "badgeHeat"], skip: ["chip-info", "rainy", "badgeSkip"], wait: ["chip-primary", "check_circle", "badgeOptimal"] };

  // after every hook: while the API is still answering, "0 Farmers, 0 Plots" would be a lie
  if (loading) return <p className="muted" style={{ textAlign: "center", padding: 48 }}>{t("loading")}</p>;

  const totalLitres = analytics?.litres ?? 0;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <h1 className="headline-lg">{t("hello")}, {user.name}</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>{t("supervisor")} · {villages.join(", ")}</p>
      </div>

      <div className="card row" style={{ background: "var(--surface-high)", boxShadow: "none", padding: 16, justifyContent: "space-between" }}>
        <div className="row">
          <Icon name="partly_cloudy_day" style={{ color: "var(--secondary)" }} />
          <span className="label-bold">{weather?.village}</span>
          <span className="muted">{weather?.tmax}°C, {t("humidityWord")} {weather?.humidity}% · ET0 {weather?.et0} mm</span>
        </div>
        <span className="label-sm muted">{weather?.date} · {t("srcLive")}</span>
      </div>

      <WeatherNotice />

      <div className="grid-4">
        {[["group", t("farmersLabel"), farmers], ["grass", t("plotsLabel"), plots.length], ["location_city", t("villagesLabel"), villages.length], ["water_drop", t("waterLogged"), (totalLitres / 1000).toFixed(0) + "k L"]].map(([icon, label, val]) => (
          <div className="stat-tile" key={label}>
            <div className="row muted mb-2" style={{ gap: 8 }}><Icon name={icon} /> <span className="label-bold">{label}</span></div>
            <div className="val">{val}</div>
          </div>
        ))}
      </div>

      <div className="stack">
        <div className="row">
          <h2 className="headline-md">{t("alerts")}</h2>
          <span className="chip chip-error">{open.length} {t("actionRequired")}</span>
        </div>
        {alerts.length === 0 && <p className="muted" style={{ margin: 0 }}>{t("noAlerts")}</p>}
        <div className="grid-2">
          {alerts.map((a) => (
            <div key={a.id} className={"banner " + (a.acknowledged ? "" : "banner-warn")} style={a.acknowledged ? { background: "var(--surface-variant)", color: "var(--on-surface-variant)", boxShadow: "none" } : { alignItems: "center" }}>
              <Icon name={a.acknowledged ? "check_circle" : "warning"} style={{ color: a.acknowledged ? "var(--outline)" : "var(--secondary)" }} />
              <div style={{ flex: 1 }}>
                <div className="label-bold">{a.kind === "heat" ? t("heatStressRisk") : t("highWaterDemand")}</div>
                <div style={{ fontSize: 14 }}>{a.owner} · {a.plotName} ({a.village}) · {a.hours} {t("hAdvised")}</div>
              </div>
              {!a.acknowledged && (
                <button className="btn btn-sm" style={{ background: "var(--secondary)", color: "#fff" }} onClick={() => acknowledge(a.id)}>{t("acknowledge")}</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="between" style={{ padding: 12, background: "var(--surface-low)", borderBottom: "1px solid var(--outline-variant)" }}>
          <h3 className="headline-md" style={{ fontSize: 18 }}>{t("allPlots")}</h3>
          <div className="input-icon"><Icon name="search" /><input className="input" style={{ padding: "6px 12px 6px 36px" }} placeholder={t("searchPlots")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("searchPlots")} /></div>
        </div>
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 14 }}>
            <thead><tr><th>{t("farmer")}</th><th>{t("plot")}</th><th>{t("village")}</th><th>{t("soilType")}</th><th>{t("cropStage")}</th><th>{t("depletion")}</th><th>{t("advisory")}</th></tr></thead>
            <tbody>
              {shown.map(({ plot, adv }) => {
                const [cls, icon, labelKey] = adv ? BADGE[adv.type] : ["chip-neutral", "cloud_off", "badgeNoData"];
                return (
                  <tr key={plot.id}>
                    <td style={{ fontWeight: 500 }}>{plot.owner}</td>
                    {/* Exp 3.3 - dynamic route: the plot id is put into the URL and read back with useParams */}
                    <td className="muted"><Link to={"/plots/" + plot.id} className="link-plain">{plot.name}</Link></td>
                    <td className="muted">{plot.village}</td>
                    <td className="muted">{t("soil_" + plot.soilType)}</td>
                    <td className="muted">{t("stage_" + plot.cropStage)}</td>
                    <td className={pct(plot) > 50 ? "text-error-c" : "muted"} style={{ fontWeight: pct(plot) > 50 ? 700 : 400 }}>{pct(plot)}%</td>
                    <td><span className={"chip " + cls}><Icon name={icon} size={14} /> {t(labelKey)}{adv && adv.hours > 0 ? ` · ${adv.hours} h` : ""}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
