# SinchAI - Smart Irrigation Advisory (MERN)

SinchAI tells sugarcane farmers **when to irrigate and for how many hours**, using the FAO-56 soil-water-balance method on
free weather and evapotranspiration data instead of costly soil-moisture sensors. Farmers register plots on an interactive
map (soil type, crop stage, pump), get a plain daily advisory in **English / Hindi / Marathi** ("irrigate tomorrow morning
for 2.5 hours" / "rain expected - skip irrigation"), heatwave warnings, an irrigation history and water-saving analytics;
field supervisors get a role-based dashboard with alerts and every plot.

MERN mini project - Full Stack Development.

## Team
| Name |
|---|
| Purunjay Choudhary |
| Manas Raut |
| Akash Chaturvedi |

## What is in this repository
| Folder | What |
|---|---|
| [`sinchai-server/`](sinchai-server) | Express 5 + MongoDB (Mongoose 9) API, JWT auth, FAO-56 engine, live Open-Meteo weather, `node:test` suites. Also holds the Exp 4.1 Node.js programs in `exp4.1-node-basics/` |
| [`sinchai-client/`](sinchai-client) | React 19 + Vite front end: real map (Leaflet / OpenStreetMap), routing, hooks, validation, 3 languages |
| [`docs/`](docs) | raw test output, newman and mongosh output, and the screenshots used in the report |

Each folder has its own README with the details ([server](sinchai-server/README.md), [client](sinchai-client/README.md)).

## Run it locally (2 terminals)
Prerequisites: Node.js 20.12 or newer, internet access (live weather and map tiles) and MongoDB running on
`mongodb://127.0.0.1:27017` (Windows: `net start MongoDB`).

```
# 1. API + database
cd sinchai-server
npm install
npm start               # http://localhost:3000

# 2. React app (new terminal)
cd sinchai-client
npm install
npm start               # http://localhost:5173  (Vite proxies /api to port 3000)
```

Open http://localhost:5173 and **register** - there are no pre-made accounts and no sample data. Then:
1. add a plot: click the map where the field is (or "Use my location"), choose soil, crop stage, area and pump output;
2. the dashboard shows the **live** weather for that spot and today's FAO-56 advisory; "Mark irrigated" logs the irrigation;
3. optionally enter the plot's *usual irrigation hours* and *pump kW* to see water saved and electricity used (nothing is assumed);
4. to try the supervisor side, register a second account as **Field Supervisor** with the access code printed by
   `npm run supervisor-code` (in `sinchai-server`).

The first start writes a random `JWT_SECRET` and `SUPERVISOR_CODE` to `sinchai-server/.env` (git ignores it).

## Tests
```
cd sinchai-server
npm test                # 61 tests against a throw-away "sinchai_test" database
```
`npm test` drops the database it connects to, so it only runs against a database whose name contains `test` (the default is
`sinchai_test`). Unset `MONGO_URI` first if it points anywhere else. The last full run is saved in
[`docs/test-results.txt`](docs/test-results.txt). The API is also covered by the Postman collection
`sinchai-server/docs/SinchAI.postman_collection.json` (`npx newman run ...`).

## What is real, and what is not
| | |
|---|---|
| **Weather, ET0, rain, forecast** | fetched live from Open-Meteo for the plot's exact pin, stored in MongoDB. If it cannot be reached the app says "weather unavailable" and gives **no advice** - it never estimates a forecast |
| **Map** | OpenStreetMap through Leaflet; plots are stored as true latitude / longitude |
| **Accounts, plots, irrigation log, alerts** | whatever people create; passwords are hashed with bcrypt, sessions are JWTs, supervisor alerts and acknowledgements live in MongoDB |
| **Secrets** | the JWT secret and the supervisor access code are generated randomly on first start, never hardcoded |
| **Water saved / electricity** | computed from the usual-hours and pump-kW the *farmer* enters; without them the tile shows a dash |
| **Agronomy constants** | the simplified FAO-56 values (crop coefficients, soil water capacity, 30 % allowed depletion) and the 40 C heatwave threshold - published parameters, not data |

Not included (out of scope for the lab): password reset / e-mail verification, SMS delivery of advisories, and soil-type
detection from the map (the farmer picks it). Crop coefficients are generic sugarcane values, not a field calibration.
`sinchai-server/exp4.1-node-basics/` and `sinchai-server/public/data/supervisors.json` contain small **sample input files**
because the Exp 4.1 / 4.2 write-ups ask for them; the product never reads them.

## Problem statement -> where it is
| Requirement | Implementation |
|---|---|
| Register farm plots on an interactive map (soil, crop stage, pump) | `AddPlot` page + `PlotMap` (OpenStreetMap) -> `POST /api/plots`, Mongoose `Plot` model; edit / delete on the plot page |
| Daily plot-specific water balance, FAO-56, free weather + ET0 | `sinchai-server/utils/waterBalance.js`, `services/balance.js` (daily roll-forward), `services/weather.js` (Open-Meteo) |
| Simple advisories - "irrigate tomorrow for 2.5 h", "rain expected, skip" | `computeAdvisory` -> irrigate / heat / skip / wait, shown on the dashboard and plot pages |
| Heatwave monitoring adjusts recommendations | Tmax >= 40 C -> heat advisory; banner when a heatwave is on or forecast within 3 days |
| Regional languages | English / Hindi / Marathi, all strings in `sinchai-client/src/data/i18n.js`, saved on the account |
| Role-based dashboards, alerts, history, water-saving analytics | farmer dashboard + supervisor dashboard (alerts stored in MongoDB), history page, usage chart |
| Affordable: software model instead of sensors | no sensor input anywhere - only weather, soil and crop stage |
