import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api/client";
import { useApp } from "./AppContext";
import { computeAdvisory } from "../utils/waterBalance";

// Exp 3.2 - useContext: plots / weather / history live here so any route can read them.
// Exp 3.3 - state moved out of App.jsx, because App.jsx is now only the <Routes> table.
// Exp 5 - the data now comes from the Express + MongoDB API (sinchai-server) instead of public/data/*.json:
// it is loaded when someone logs in, and every change below is saved with a POST / PUT / DELETE first and
// only then reflected in state, so what the screen shows is what MongoDB holds.
const DataContext = createContext(null);

// A new DataStore is mounted for every login and logout (key = the user id), so each person starts with empty
// state and loading = true; nothing from the previous session can leak into the next one, and no reset code is needed.
export function DataProvider({ children }) {
  const { user } = useApp();
  return (
    <DataStore key={user?.id ?? "anonymous"} user={user}>
      {children}
    </DataStore>
  );
}

function DataStore({ user, children }) {
  const [plots, setPlots] = useState([]);
  const [weatherByVillage, setWeatherByVillage] = useState({}); // { karad: {...}, satara: {...} } - each plot uses its own village
  const [primaryVillage, setPrimaryVillage] = useState(null);
  const [weatherUnavailable, setWeatherUnavailable] = useState([]); // [{ key, village }] - live weather could not be fetched: no advice is shown, nothing is guessed
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]); // supervisors only
  const [analytics, setAnalytics] = useState(null);
  // true until the first load for this login has finished, so "No plots yet" can never flash before the request is done
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // the initial load failed
  const [actionError, setActionError] = useState(""); // an irrigate / delete / acknowledge click failed
  const busy = useRef(new Set()); // keys of requests in flight, so a double click cannot log an irrigation twice
  const userId = user?.id;
  const role = user?.role;

  // useEffect with [userId] - runs once when this store mounts for a logged-in person and loads everything
  useEffect(() => {
    if (!userId) return undefined;
    let stale = false; // ignore a slow answer that arrives after the user has already logged out / switched
    // fetch() does NOT reject on a 404, but api.get() does (ApiError), so one .catch covers every failure
    Promise.all([
      api.get("/plots"),
      api.get("/weather"),
      api.get("/history"),
      api.get("/analytics/summary"),
      role === "supervisor" ? api.get("/alerts") : Promise.resolve([]),
    ])
      .then(([p, w, h, a, al]) => {
        if (stale) return;
        setPlots(p);
        setWeatherByVillage(w.villages);
        setPrimaryVillage(w.primary);
        setWeatherUnavailable(w.unavailable);
        setHistory(h);
        setAnalytics(a);
        setAlerts(al);
      })
      .catch((e) => {
        if (stale) return;
        console.error("SinchAI: could not load the field data", e);
        setError(true);
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [userId, role]);

  // the weather of the user's own village, or the first village they have plots in
  const weather = weatherByVillage[primaryVillage] ?? Object.values(weatherByVillage)[0] ?? null;
  // each plot is advised on the weather of ITS village, falling back to the main one
  const weatherFor = useCallback((plot) => weatherByVillage[plot.villageKey] ?? weather, [weatherByVillage, weather]);

  const refreshWeather = useCallback(async () => {
    const w = await api.get("/weather");
    setWeatherByVillage(w.villages);
    setPrimaryVillage(w.primary);
    setWeatherUnavailable(w.unavailable);
  }, []);
  const refreshAnalytics = useCallback(async () => setAnalytics(await api.get("/analytics/summary")), []);

  // run a click-action once at a time; a failure becomes the banner in Layout instead of an unhandled rejection
  const guarded = useCallback(async (key, work) => {
    if (busy.current.has(key)) return;
    busy.current.add(key);
    setActionError("");
    try {
      await work();
    } catch (e) {
      console.error("SinchAI: " + key + " failed", e);
      setActionError(e.status === 0 ? "errNetwork" : "errAction");
    } finally {
      busy.current.delete(key);
    }
  }, []);

  // useCallback - stable handlers shared through context. The form handlers (addPlot / updatePlot) let the
  // ApiError reach the form, which shows it next to the right field; the click handlers use guarded().
  const addPlot = useCallback(async (data) => {
    const plot = await api.post("/plots", data);
    setPlots((ps) => [...ps, plot]);
    refreshWeather().catch(() => {}); // the new plot may sit in a village we have no weather for yet
    return plot;
  }, [refreshWeather]);

  const updatePlot = useCallback(async (id, data) => {
    const plot = await api.put("/plots/" + id, data);
    setPlots((ps) => ps.map((p) => (p.id === id ? plot : p)));
    refreshWeather().catch(() => {});
    return plot;
  }, [refreshWeather]);

  const deletePlot = useCallback(async (id) => {
    await api.delete("/plots/" + id);
    setPlots((ps) => ps.filter((p) => p.id !== id));
    setHistory((hs) => hs.filter((h) => h.plotId !== id));
    refreshAnalytics().catch(() => {});
  }, [refreshAnalytics]);

  // hours is optional: when a caller omits it the FAO-56 advisory decides, so no screen can
  // log a duration that disagrees with the advisory it was shown next to.
  const markIrrigated = useCallback(
    (plot, hours) =>
      guarded("irrigate:" + plot.id, async () => {
        const w = weatherFor(plot);
        const advised = w ? computeAdvisory(plot, w).hours : 0;
        const { log, plot: updated } = await api.post("/history", { plotId: plot.id, hours: hours || advised || 2, advised: true });
        setHistory((hs) => [log, ...hs]);
        setPlots((ps) => ps.map((p) => (p.id === updated.id ? updated : p)));
        await refreshAnalytics();
      }),
    [guarded, weatherFor, refreshAnalytics]
  );

  const deleteLog = useCallback(
    (id) =>
      guarded("log:" + id, async () => {
        const { plot: updated } = await api.delete("/history/" + id);
        setHistory((hs) => hs.filter((h) => h.id !== id));
        if (updated) setPlots((ps) => ps.map((p) => (p.id === updated.id ? updated : p)));
        await refreshAnalytics();
      }),
    [guarded, refreshAnalytics]
  );

  // supervisor: the acknowledgement is stored in MongoDB, so it survives a refresh and other supervisors see it
  const acknowledgeAlert = useCallback(
    (id) =>
      guarded("ack:" + id, async () => {
        const done = await api.post("/alerts/" + id + "/ack");
        setAlerts((as) => as.map((a) => (a.id === id ? done : a)));
      }),
    [guarded]
  );

  return (
    <DataContext.Provider
      value={{
        plots, weather, weatherByVillage, weatherFor, weatherUnavailable, refreshWeather, history, alerts, analytics, loading, error, actionError,
        addPlot, updatePlot, deletePlot, markIrrigated, deleteLog, acknowledgeAlert,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
