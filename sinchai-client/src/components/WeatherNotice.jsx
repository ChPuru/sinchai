import { useState } from "react";
import { useApp } from "../context/AppContext";
import { useData } from "../context/DataContext";
import Icon from "./Icon";

// Exp 5 - shown when live weather could not be fetched for some of the plots. SinchAI never guesses a forecast, so those
// plots simply get no advice until Open-Meteo answers again; "Try again" asks the server for the weather once more.
export default function WeatherNotice() {
  const { t } = useApp();
  const { weatherUnavailable, refreshWeather } = useData();
  const [busy, setBusy] = useState(false);
  if (!weatherUnavailable.length) return null;

  const retry = async () => {
    setBusy(true);
    try {
      await refreshWeather();
    } catch {
      /* still down: the notice stays */
    }
    setBusy(false);
  };

  return (
    <div className="banner banner-warn" role="status" style={{ alignItems: "center" }}>
      <Icon name="cloud_off" fill style={{ color: "var(--secondary)" }} />
      <div style={{ flex: 1 }}>
        <div className="label-bold">{t("weatherUnavailable")}</div>
        <div style={{ fontSize: 14 }}>
          {weatherUnavailable.map((w) => w.village).join(", ")}: {t("weatherUnavailableMsg")}
        </div>
      </div>
      <button className="btn btn-sm btn-outline" onClick={retry} disabled={busy}>{busy ? t("loading") : t("tryAgain")}</button>
    </div>
  );
}
