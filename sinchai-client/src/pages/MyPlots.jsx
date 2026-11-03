import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useData } from "../context/DataContext";
import PlotCard from "../components/PlotCard";
import Icon from "../components/Icon";

// Exp 3.3 - useSearchParams keeps the search text in the URL, so /plots?q=karad is bookmarkable and shareable
// Exp 3.2 - useMemo still does the filtering; the data now comes from useData() instead of props
export default function MyPlots() {
  const { t, user } = useApp();
  const { plots, loading, markIrrigated } = useData();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";

  // replace: true so typing does not push one history entry per keystroke
  const onSearch = (value) => setParams(value ? { q: value } : {}, { replace: true });

  // Exp 5 - the ownership rule moved to the server: GET /api/plots returns every plot to a supervisor and
  // only the farmer's own plots to a farmer, so nothing needs filtering by name here any more
  const shown = useMemo(() => plots.filter((p) => (p.name + p.village + p.owner).toLowerCase().includes(q.toLowerCase())), [plots, q]);

  if (loading) return <p className="muted" style={{ textAlign: "center", padding: 48 }}>{t("loading")}</p>;

  return (
    <div className="stack" style={{ gap: 32 }}>
      <div className="between" style={{ borderBottom: "1px solid var(--outline-variant)", paddingBottom: 24 }}>
        <div>
          <h1 className="headline-lg">{t("myPlots")}</h1>
          <p className="muted" style={{ margin: "8px 0 0" }}>{t("manageSub")}</p>
        </div>
        <div className="input-icon" style={{ minWidth: 260 }}>
          <Icon name="search" />
          <input className="input" placeholder={t("searchPlots")} value={q} onChange={(e) => onSearch(e.target.value)} aria-label={t("searchPlots")} />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--surface-low)", margin: "0 auto 32px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="add_location_alt" size={48} style={{ color: "var(--outline)" }} />
          </div>
          <h2 className="headline-lg mb-3">{t("readyToGrow")}</h2>
          {/* Exp 3.1 - conditional rendering: a supervisor (or a search that found nothing) is told
              nothing matched, only a farmer with no plots at all is invited to add one */}
          <p className="muted" style={{ maxWidth: 440, margin: "0 auto 32px" }}>{user.role === "farmer" && !q ? t("noPlots") : t("noMatch")}</p>
          {/* Exp 3.3 - Link replaces the old onNavigate("addPlot") callback. It is farmer-only,
              because RequireRole would bounce a supervisor straight back off /add-plot. */}
          {user.role === "farmer" && (
            <Link to="/add-plot" className="btn btn-primary">
              <Icon name="add" /> {t("addNewPlot")}
            </Link>
          )}
        </div>
      ) : (
        <div className="grid-3">
          {/* no hours passed: markIrrigated logs the hours the FAO-56 advisory asked for */}
          {shown.map((p) => (
            <PlotCard key={p.id} plot={p} onIrrigate={markIrrigated} />
          ))}
        </div>
      )}
    </div>
  );
}
