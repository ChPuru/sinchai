import { useApp } from "../context/AppContext";

// Exp 5 - the water-use chart: for each of the last 8 weeks, the litres actually pumped. When the farmer has told us
// their usual irrigation hours (showHabit) a second bar shows what watering by that habit would have used, so the
// difference is the farmer's own figure, not an assumption. Plain divs, no chart library: bar height is a share of the tallest bar.
export default function UsageChart({ weekly, showHabit }) {
  const { t } = useApp();
  const top = Math.max(1, ...weekly.map((w) => Math.max(w.litres, showHabit ? w.baselineLitres : 0)));
  const fmtWeek = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const kl = (n) => Math.round(n / 1000).toLocaleString("en-IN");
  const summary = weekly.map((w) => fmtWeek(w.weekStart) + ": " + kl(w.litres) + "k L").join(", ");

  return (
    <div className="card">
      <div className="between mb-3" style={{ flexWrap: "wrap", gap: 8 }}>
        <h2 className="headline-md">{t("weeklyUsage")}</h2>
        <div className="row" style={{ gap: 16 }}>
          <span className="legend"><i className="swatch used" /> {t("usedLabel")}</span>
          {showHabit && <span className="legend"><i className="swatch habit" /> {t("habitLabel")}</span>}
        </div>
      </div>
      <div className="usage-chart" role="img" aria-label={t("weeklyUsage") + " - " + summary}>
        {weekly.map((w) => (
          <div className="usage-col" key={w.weekStart}>
            <div className="usage-bars">
              {showHabit && <div className="bar habit" style={{ height: (w.baselineLitres / top) * 100 + "%" }} title={t("habitLabel") + ": " + kl(w.baselineLitres) + "k L"} />}
              <div className="bar used" style={{ height: (w.litres / top) * 100 + "%" }} title={t("usedLabel") + ": " + kl(w.litres) + "k L"} />
            </div>
            <div className="label-sm muted">{fmtWeek(w.weekStart)}</div>
          </div>
        ))}
      </div>
      {showHabit && <p className="label-sm muted" style={{ margin: "12px 0 0" }}>{t("analyticsNote")}</p>}
    </div>
  );
}
