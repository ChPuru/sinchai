# SinchAI - API server (Express + MongoDB)

Back end of the SinchAI smart-irrigation platform. It covers **Experiment 4.1** (Node.js basics), **Experiment 4.2**
(Express scaffolding + static files) and **Experiment 5** (MongoDB + Mongoose CRUD REST API), and it is the real API
the React app in `../sinchai-client` talks to.

**Nothing in the product is pre-loaded, generated or assumed.** There is no seed data: accounts, plots and irrigation
logs are whatever people create. Weather and ET0 are fetched live from Open-Meteo. If Open-Meteo cannot be reached the
API answers "weather unavailable" (HTTP 503) and gives no advice - it never estimates a forecast.

## Run it
```
cd sinchai-server
npm install
npm start           # http://localhost:3000   (the MongoDB service must be running)
```
Then start the client (`cd ../sinchai-client && npm install && npm start`), open http://localhost:5173 and **register**.

On first start the server writes a random `JWT_SECRET` and a random `SUPERVISOR_CODE` to `.env` (git ignores it);
`npm run supervisor-code` prints the code that a person needs to register as a **Field Supervisor**.

| Command | What it does |
|---|---|
| `npm start` / `npm run dev` | run the API (`bin/www`) / the same, restarting on file changes |
| `npm test` | 61 tests against a throw-away `sinchai_test` database |
| `npm run demo` | **Exp 5 "Demonstrate the Endpoints"**: calls all 42 endpoints incl. error cases against the running API and prints a status table (uses live weather, registers and removes its own accounts) |
| `npm run supervisor-code` | print the supervisor sign-up code |
| `npm run exp4.1` / `npm run exp4.1:servers` | run the Exp 4.1 console programs / check the three Exp 4.1 web servers |

Configuration is optional - see `.env.example` (port, Mongo URI, `JWT_SECRET`, `SUPERVISOR_CODE`).

## Where the data comes from
| Data | Source |
|---|---|
| Tmax / Tmin, rain, humidity, **ET0 (FAO-56 reference evapotranspiration)**, 5-day forecast | **Open-Meteo**, fetched live for the plot's exact map pin (rounded to a 0.1-degree / ~11 km cell, the finest a forecast model resolves). Every day fetched is stored in MongoDB (`WeatherDay`) so a plot's water balance can be replayed later |
| Plot location | the pin the farmer placed on the map (OpenStreetMap), saved as latitude/longitude and validated to lie inside India |
| Soil type, crop stage, area, pump L/hr | entered by the farmer |
| Usual irrigation hours, pump power (kW) - optional | entered by the farmer; the **only** basis for "water saved" and "electricity used" |
| Irrigation events | recorded by the farmer (button on the advisory, or the form) |
| Crop coefficients (Kc), soil water capacity, 30 % allowed depletion, root depth | the simplified **FAO-56** published values, in `utils/waterBalance.js` |
| Heatwave | Tmax >= 40 C (the India Meteorological Department's plains threshold) |

When Open-Meteo is unreachable the API falls back to readings it fetched earlier (still real), and when there are none it
answers 503 `WEATHER_UNAVAILABLE`. A past day with no stored reading stops the daily roll-forward there; no advisory is
given for that plot until the data exists. `npm test` proves each of these paths.

## Exp 4.1 - Node.js: `exp4.1-node-basics/`
Case study: the SinchAI farm portal (the writeup's "College Student Management System").

| Writeup topic | Program | Run it |
|---|---|---|
| 1.1 First server with `http` | `1_basic_routing/server.js` | `node server.js` -> http://localhost:3000/ |
| 1.2 Basic routing, HTML + JSON file, 404 | `1_basic_routing/routing.js` (+ `register.html`, `plots.json`) | `/`, `/register`, `/plots`, `/xyz` |
| 1.3 Callbacks | `1_basic_routing/callback.js` | `node callback.js` (last line prints first) |
| 2.1 File / directory exists, permissions | `2_file_operations/fileops.js` | `node fileops.js` |
| 2.2 Create, append, read, line count, line by line | `2_file_operations/irrigation_records.js` | `node irrigation_records.js` |
| 2.3 Buffer | `2_file_operations/buffer.js` | `node buffer.js` |
| 2.4 Read a large file with a stream | `2_file_operations/stream.js` (streams the project's real `package-lock.json`) | `node stream.js` |
| 2.5 File server in the browser, 404 File Not Found | `2_file_operations/fileserver.js` | http://localhost:3000/irrigation_log.txt |
| 3 Custom modules (maths functions) | `3_custom_modules/plot.js`, `waterBalance.js`, `app.js` (fetches **live** Open-Meteo weather) | `node app.js` |
| 4 Blocking vs non-blocking | `4_blocking_nonblocking/blocking.js`, `nonblocking.js`, `alerts.txt` | run both and compare the order |

Notes: only Node core modules are used (plus the global `fetch` in `app.js`). The file server serves `.txt/.csv/.json/.log` files
only and uses `path.basename()` so `/../..` cannot leave the folder. `fs.constants.X_OK` always reports "Allowed" on Windows
(the OS has no execute bit). `3_custom_modules/waterBalance.js` is the lab-sized version of `utils/waterBalance.js`; a test
fails if the two (and the React copy) ever disagree. **Sample input files:** `plots.json`, `register.html`, `alerts.txt` and
`irrigation_log.txt` exist only because the writeup's exercises need a file to read; the product never reads them.

## Exp 4.2 - Express: scaffolding and static files
Scaffolded with `npx express-generator --no-view --git sinchai-server`, then extended (the writeup's "FreshCart").

| Writeup topic | Where |
|---|---|
| Scaffold: `bin/www`, `app.js`, `routes/`, `public/`, `package.json` | the project root (`bin/www` also connects to MongoDB before listening) |
| Sign up page as root / homepage | `GET /` -> `pages/signup.html` (`routes/index.js`), `POST /signup` creates a real account |
| Login page | `GET /login`, `POST /login` |
| Route parameter, query string, request body | `GET /api/plots/:id`, `GET /api/plots?village=karad`, `GET /api/weather/point?lat=&lng=`, `POST /api/plots` |
| `express.Router()` modules mounted in `app.js` | `routes/*.js` |
| Built-in `express.static()` (also under `/static`) | `app.js` |
| Images of any type | `public/images/`: `banner.jpg`, `logo.png`, `sugarcane.svg`, `drop.gif`, `field.webp` -> http://localhost:3000/gallery.html |
| CSS + HTML | `public/stylesheets/style.css`, `public/about.html`, `public/gallery.html` |
| JSON file of employee info | `public/data/supervisors.json` -> `/data/supervisors.json`, shown as a table at `/supervisors.html` (sample staff list the writeup asks for - "assume your own data"; the app does not read it) |
| 404 handler (last) | `app.js` (HTML page; JSON under `/api`) |
| morgan request log, 200 / 304 | terminal while running (`npm test` proves the 304) |

## Exp 5 - MongoDB + Mongoose
Database `sinchai`. Flow: *client -> Express routes -> Mongoose model -> MongoDB*.

| Writeup step | Where |
|---|---|
| 1) Generate the database model | `models/` - `User`, `Plot` (the "Student" of this project), `IrrigationLog`, `WeatherDay`, `Advisory` (validators, `unique`, `timestamps`) |
| 2) RESTful API (create / read all / read one / update / delete) | `routes/plots.js` |
| `{ new: true, runValidators: true }` on update | `routes/plots.js` - written `returnDocument: 'after'`, because Mongoose 9 deprecates `new: true` (it still works and maps to the same thing) |
| Central error handler: 400 / 404 / 409 | `middleware/errors.js` |
| MongoDB connection | `db.js`, `bin/www` |
| 3) Demonstrate the endpoints | `npm run demo`, `docs/SinchAI.postman_collection.json` (36 requests, run with `newman` and clean), `docs/requests.http` (VS Code REST Client) |
| Check the data in MongoDB Compass | database `sinchai`: collections `users`, `plots`, `irrigationlogs`, `weatherdays`, `advisories`; unique indexes `mobile_1`, `email_1`, `owner_1_name_1`, `location_1_date_1` |

### API
Everything under `/api` is JSON. `Authorization: Bearer <token>` is required except for `register` and `login`.

| Method | URL | Who | Success | Errors |
|---|---|---|---|---|
| POST | `/api/auth/register` | anyone | 201 `{token,user}` | 400 fields, 403 bad supervisor code, 409 duplicate email/mobile |
| POST | `/api/auth/login` | anyone | 200 `{token,user}` | 400, 401 |
| GET | `/api/auth/me` | any | 200 | 401 |
| PATCH | `/api/users/me` | any | 200 (language / village / name) | 400 |
| POST | `/api/plots` | farmer | 201 | 400 (incl. pin outside India), 403, 409 duplicate plot name |
| GET | `/api/plots` (`?village= &soilType= &cropStage=`) | farmer: own, supervisor: all | 200 | |
| GET | `/api/plots/:id` | owner / supervisor | 200 | 400 bad id, 404 |
| PUT / PATCH | `/api/plots/:id` | owner | 200 | 400, 403, 404, 409 |
| DELETE | `/api/plots/:id` | owner | 200 (log + advisories go too) | 403, 404 |
| GET | `/api/plots/:id/advisory` | owner / supervisor | 200 `{advisory, weather}` | 404, **503 no live weather** |
| GET | `/api/advisories` | any | `{advisories, unavailable}` | |
| GET | `/api/weather` | any | `{primary, villages, unavailable}` per weather cell | |
| GET | `/api/weather/point?lat=&lng=` | any | 200 | 400, **503** |
| GET / POST | `/api/history` (`?plot=`) | farmer: own, supervisor: all / farmer | 200 / 201 `{log, plot}` | 400, 404 |
| GET / PUT / DELETE | `/api/history/:id` | owner (supervisor: read) | 200 | 400, 404 |
| GET | `/api/alerts` | supervisor | heat-stress and > 3 h alerts | 403 |
| POST | `/api/alerts/:id/ack` | supervisor | 200, stored in MongoDB | 400, 404 |
| GET | `/api/analytics/summary` | any | litres, saved, kWh, 8-week trend | |
| GET | `/api/health` | anyone | `{status, database}` | |

## How the water balance works (`utils/waterBalance.js`, `services/balance.js`)
* `ETc = ET0 x Kc` (Kc by growth stage: 0.4 / 0.75 / 1.25 / 0.75). `TAW` = soil water per metre x 0.6 m root depth;
  irrigate when depletion passes `TAW x 0.3` (management-allowed depletion).
* `plot.depletion` is the depletion at the start of `balanceDate`. Every elapsed day adds `ETc - rain` (clamped to 0..TAW), using
  the stored real daily weather. Logging an irrigation lowers it by what the soil could absorb; deleting the log puts exactly
  that back.
* Advisory types: **irrigate** (hours = mm x acres x 4047 L / pump L/hr), **heat** (same, Tmax >= 40 C), **skip**
  (tomorrow's rain covers a day of crop use *and* brings the root zone under the threshold - a light drizzle does not
  cancel irrigation for a dry plot), **wait**. A supervisor *alert* is a heat advisory or an irrigation of more than 3 hours.
* `jobs/daily.js` refreshes weather and advisories at start-up and every 6 hours; the API also does it lazily on request.

### Analytics use only what the farmer entered
* **Water saved** = for each irrigation that followed the advisory on a plot whose farmer entered their *usual irrigation hours*:
  `(usual hours - hours actually pumped) x pump L/hr`, never below zero. No usual hours -> no baseline -> **no figure** (`null`, shown as "-").
* **Electricity** = pumped hours x the pump power (kW) the farmer entered. No kW -> no figure.
* `coverage` in the response says how many plots each total is based on, and the dashboard prints it.

## Security notes
Passwords are hashed with bcrypt and never returned; JWTs are HS256 with a 7-day expiry and are re-checked against the
database on every request; query values are type-checked so `{"$ne": null}` cannot reach a filter; request bodies are
whitelisted (a client cannot set `owner` or `depletion` bookkeeping); farmers get 404 for other people's plots;
supervisors are read-only and need an access code to sign up; login / register are rate-limited; `helmet` sets security
headers; HTML responses escape user text; map tooltips are built from text nodes. The JWT secret and supervisor code are
generated per install, never hardcoded. Production refuses to start without `JWT_SECRET`.
The React app keeps the token in `localStorage` (simple, and consistent with Exp 3.3); an httpOnly cookie would need
CSRF handling and a same-site deployment, which is out of scope for this project.

## Folder map
```
bin/www            server start-up (generated, + MongoDB connect, daily job, Ctrl+C handling)
app.js             middleware, static files, routers, 404, error handler
config.js db.js    environment (generates secrets on first run), MongoDB connection
models/            Mongoose schemas            routes/        HTTP routes
services/          auth, weather (Open-Meteo), geo, balance, analytics     middleware/  auth guards, central error handler
utils/             waterBalance.js (custom module), validators, dates, geo     jobs/daily.js
pages/ public/     Exp 4.2 HTML pages and static files
scripts/           demo-endpoints.js, supervisor-code.js     test/   node:test suites (auth, plots, irrigation, static, waterBalance)
docs/              Postman collection, requests.http     exp4.1-node-basics/   Exp 4.1
```
