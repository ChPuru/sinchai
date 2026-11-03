import { useApp } from "../context/AppContext";
import Icon from "./Icon";

// Exp 3.1 - props + .map() with keys + conditional classes
// Exp 5 - every figure here was fetched from Open-Meteo by the server; the chip says when
export default function WeatherStrip({ weather }) {
  const { t } = useApp();
  if (!weather) return null; // no live weather: show nothing rather than an empty card or invented numbers
  const fetched = weather.fetchedAt ? new Date(weather.fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div className="card">
      <div className="between mb-3" style={{ flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 className="headline-md">{weather.village} {t("weatherWord")}</h2>
          <p className="label-sm muted" style={{ margin: "4px 0 0" }}>
            {weather.date} · ET0 {weather.et0} mm · RH {weather.humidity}%
          </p>
        </div>
        <span className="chip chip-primary"><Icon name="cloud_done" size={14} /> {t("srcLive")}{fetched ? " · " + t("updatedAt") + " " + fetched : ""}</span>
      </div>
      <div className="weather-days">
        {weather.forecast.map((d) => {
          const cls = d.tmax >= 40 ? "hot" : d.rain >= 10 ? "rain" : "";
          const icon = d.rain >= 10 ? "rainy" : d.tmax >= 40 ? "device_thermostat" : d.rain > 0 ? "partly_cloudy_day" : "sunny";
          return (
            <div key={d.date} className={"weather-day " + cls}>
              <div className="label-sm" style={{ textTransform: "uppercase" }}>{d.day}</div>
              <Icon name={icon} fill size={30} style={{ margin: "6px 0" }} />
              <div className="label-bold">{Math.round(d.tmax)}°</div>
              <div className="label-sm">{d.rain} mm</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
