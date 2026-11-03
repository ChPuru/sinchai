import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useData } from "../context/DataContext";
import { computeAdvisory, moisturePct } from "../utils/waterBalance";
import AdvisoryCard from "../components/AdvisoryCard";
import WeatherStrip from "../components/WeatherStrip";
import WeatherNotice from "../components/WeatherNotice";
import PlotCard from "../components/PlotCard";
import PlotMap from "../components/PlotMap";
import UsageChart from "../components/UsageChart";
import Icon from "../components/Icon";

// Exp 3.2 - useMemo recomputes the FAO water balance only when plots/weather change
// Exp 3.3 - now a route element: no props at all, data comes from useData() and the two
// navigation buttons became <Link> elements instead of onNavigate() callbacks
// Exp 5 - the plots, per-location weather and analytics all come from the Express API. The server only returns
// the signed-in farmer's own plots, so the old "owner === user.name" filter is gone. Every number on this page is
// either fetched (weather, ET0), recorded by the farmer (plots, irrigation log) or worked out from those by the FAO-56 model.
export default function Dashboard() {
  const { t, user } = useApp();
  const { plots: myPlots, weather, weatherByVillage, weatherFor, analytics, loading, markIrrigated } = useData();
  const [selectedId, setSelectedId] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  // each plot is advised on the weather at its own pin; a plot without live weather gets no advice at all
  const advisories = useMemo(
    () => myPlots.map((p) => ({ plot: p, advisory: weatherFor(p) ? computeAdvisory(p, weatherFor(p)) : null })).filter((a) => a.advisory),
    [myPlots, weatherFor]
  );
  const primary = useMemo(() => advisories.find((a) => a.advisory.hours > 0) ?? advisories[0], [advisories]);

  const avgMoisture = useMemo(() => {
    if (!myPlots.length) return 0;
    return Math.round(myPlots.reduce((sum, p) => sum + moisturePct(p), 0) / myPlots.length);
  }, [myPlots]);
  const needWater = advisories.filter((a) => a.advisory.hours > 0).length;

  const shown = selectedId ? advisories.filter((a) => a.plot.id === selectedId) : advisories;
  // a heatwave warning when any place the farmer has plots in is hot now or forecast to be within 3 days
  const heat = Object.values(weatherByVillage).some((w) => w.heatwave?.active || w.heatwave?.upcoming);
  const primaryHot = primary ? weatherFor(primary.plot)?.heatwave?.active : false;

  // after every hook, so the hook order stays the same on each render: while the fetch is in
  // flight there is nothing to advise on yet, and "no plots" would be the wrong thing to say
  if (loading) return <p className="muted" style={{ textAlign: "center", padding: 48 }}>{t("loading")}</p>;

  const stats = analytics ?? { litres: 0, savedLitres: null, kwh: null, events: 0, weekly: [], coverage: { plots: 0, habit: 0, pumpKw: 0 } };
  const kl = (n) => (n / 1000).toFixed(0) + "k L";
  const c = stats.coverage;
  const partial = c.plots > 0 && (c.habit < c.plots || c.pumpKw < c.plots);

  return (
    <div className="stack" style={{ gap: 32 }}>
      <div className="between">
        <div>
          <h1 className="headline-lg">{t("hello")}, {user.name}</h1>
          <p className="muted row" style={{ gap: 4, margin: "4px 0 0" }}>
            <Icon name="location_on" size={18} /> {weather?.village ?? user.village}{weather ? " · " + Math.round(weather.tmax) + "°C" : ""}
          </p>
        </div>
        <span className="chip chip-info" style={{ padding: "8px 16px" }}>
          <Icon name="agriculture" size={18} /> {t(user.role)}
        </span>
      </div>

      <WeatherNotice />

      {heat && (
        <div className="banner banner-error">
          <Icon name="warning" fill size={28} className="text-error-c" />
          <div style={{ flex: 1 }}>
            <div className="label-bold text-error-c">{t("heatwave")}</div>
            <p style={{ margin: "4px 0 0" }}>{t("heatwaveMsg")}</p>
          </div>
        </div>
      )}

      <div className="bento">
        <div className="card" style={{ position: "relative", overflow: "hidden" }}>
          <Icon name="water_drop" size={200} style={{ position: "absolute", right: -40, top: -40, opacity: 0.05 }} />
          <div className="row text-primary-c mb-3" style={{ gap: 8 }}>
            <Icon name="smart_toy" fill />
            <span className="label-bold" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>{t("aiAdvice")}</span>
          </div>
          {primary ? (
            <>
              <h2 style={{ fontSize: 28, lineHeight: "36px", fontWeight: 700 }}>
                {primary.advisory.type === "skip" && t("skip")}
                {primary.advisory.type === "wait" && <>{t("noIrrigationNeeded")} · {primary.plot.name}</>}
                {(primary.advisory.type === "irrigate" || primary.advisory.type === "heat") && (
                  <>
                    {t("irrigateFor")} <br />
                    <span className="text-primary-c">{primary.advisory.hours} {t("hours")}</span> · {primary.plot.name}
                  </>
                )}
              </h2>
              <p className="muted" style={{ maxWidth: 480 }}>
                ETc {primary.advisory.etc} mm/day · {t("depletionWord")} {primary.advisory.depletion.toFixed(0)} / {primary.advisory.taw.toFixed(0)} mm.{" "}
                {primaryHot ? t("adviceHeat") : t("adviceMorning")}
              </p>
              {primary.advisory.hours > 0 && !dismissed && (
                <div className="row mt-4">
                  {/* logs the irrigation as done (POST /api/history) - the same action as the button on the advisory card */}
                  <button className="btn btn-primary" onClick={() => markIrrigated(primary.plot, primary.advisory.hours)}>
                    <Icon name="play_circle" /> {t("markDone")}
                  </button>
                  <button className="btn btn-outline" onClick={() => setDismissed(true)}>{t("dismiss")}</button>
                </div>
              )}
            </>
          ) : (
            <p className="muted">{myPlots.length ? t("weatherUnavailableMsg") : t("noPlots")}</p>
          )}
        </div>

        <div className="card">
          <div className="label-bold muted mb-4">{t("conditions")}</div>
          <div className="stack" style={{ gap: 24 }}>
            {[
              ["water_ph", t("avgMoisture"), myPlots.length ? avgMoisture + "%" : "—", "rgba(253,188,130,.3)", "#683c0c"],
              ["sunny", t("et0Label"), weather ? weather.et0 + " mm/day · RH " + weather.humidity + "%" : "—", "rgba(255,218,214,.5)", "#93000a"],
              ["water_drop", t("plotsNeedWater"), advisories.length ? needWater + " / " + advisories.length : "—", "rgba(216,228,235,.5)", "#121d22"],
            ].map(([icon, label, val, bg, fg]) => (
              <div className="row" key={label}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={icon} size={20} />
                </div>
                <div>
                  <div className="label-sm muted">{label}</div>
                  <div className="headline-md">{val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Exp 5 - the four tiles are the server's totals from GET /api/analytics/summary. Saved water and electricity are
          worked out from the usual hours and pump power the farmer entered; until then they show a dash, not a guess. */}
      <div className="grid-4">
        {[
          ["water_drop", t("savedVsHabit"), stats.savedLitres == null ? "—" : kl(stats.savedLitres), "var(--primary)"],
          ["opacity", t("waterUsed"), kl(stats.litres), "var(--secondary)"],
          ["bolt", t("pumpEnergy"), stats.kwh == null ? "—" : stats.kwh + " kWh", "#f59e0b"],
          ["agriculture", t("events"), stats.events, "var(--primary)"],
        ].map(([icon, label, val, color]) => (
          <div className="stat-tile" key={label}>
            <Icon name={icon} style={{ color }} />
            <div className="label-sm muted" style={{ textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 8 }}>{label}</div>
            <div className="val">{val}</div>
          </div>
        ))}
      </div>
      {partial && (
        <p className="label-sm muted" style={{ margin: "-16px 0 0" }}>
          {t("coverageNote").replaceAll("{habit}", c.habit).replaceAll("{kw}", c.pumpKw).replaceAll("{plots}", c.plots)}
        </p>
      )}

      {stats.weekly.length > 0 && stats.events > 0 && <UsageChart weekly={stats.weekly} showHabit={stats.savedLitres != null} />}

      {weather && <WeatherStrip weather={weather} />}

      <div className="split">
        <div className="stack">
          {shown.length > 0 && <h2 className="headline-md">{t("todayAdvisory")}</h2>}
          {shown.map(({ plot, advisory }) => (
            <AdvisoryCard key={plot.id} plot={plot} advisory={advisory} onDone={markIrrigated} />
          ))}
        </div>
        <div className="stack">
          <div className="between">
            <h2 className="headline-md">{t("myPlots")}</h2>
            {/* Exp 3.3 - Link replaces the old onNavigate("plots") button, so the URL changes to /plots */}
            <Link to="/plots" className="header-btn">{t("viewAll")} <Icon name="arrow_forward" size={16} /></Link>
          </div>
          <PlotMap plots={myPlots} selectedId={selectedId} height={240} />
          <div className="grid-2">
            {myPlots.map((p) => (
              <PlotCard key={p.id} plot={p} selected={p.id === selectedId} onSelect={(pl) => setSelectedId(pl.id === selectedId ? null : pl.id)} />
            ))}
            {/* Exp 3.3 - the "add a plot" tile is a Link to the role-guarded /add-plot route */}
            <Link to="/add-plot" className="empty card-hover">
              <Icon name="add_circle" size={32} className="text-primary-c" />
              <span className="label-bold">{t("addNewPlot")}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
