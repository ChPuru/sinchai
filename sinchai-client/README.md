# SinchAI - Smart Irrigation Advisory (client)

Frontend built for the MERN lab evaluation. UI follows the Google Stitch design
(`../stitch_design/` - Material 3 green palette, Inter, Material Symbols, sidebar layout). Scope covers Experiments 1-5:
React function components, JSX, props, CSS design tokens, events, conditional rendering,
hooks (useState, useEffect, useContext, useReducer, useRef, useMemo, useCallback),
client-side routing with `react-router-dom`, form validation - and, since **Exp 5**, a real back end:
every screen reads and writes the Express + MongoDB API in `../sinchai-server` (see "Exp 5 - talking to the API" below).

## Run
The API must be running first (`cd ../sinchai-server && npm install && npm start`; MongoDB service on), then:
```
npm install
npm start        # http://localhost:5173  (Vite proxies /api to http://localhost:3000)
npm run build    # production build in dist/
npm run preview  # serve the production build (also proxies /api)
```
`react-router-dom` **6.30.6** is the only runtime library besides React. Everything else is plain React + Vite, plain CSS, plain `.jsx`.
To point a production build at an API on another host, build with `VITE_API_URL=https://your-api.example/api`.

## Accounts
There is **no pre-loaded data**: register at `/register` (as a farmer or a field supervisor), then log in with your
**mobile number + password** (`POST /api/auth/login`, checked by the server).
- Registering as a **Field Supervisor** needs an access code. It is generated randomly the first time the API starts and
  stored in `sinchai-server/.env`; run `npm run supervisor-code` in `sinchai-server` to print it.
- Duplicate emails / mobile numbers are refused by the server (409) and shown under the right field.
- `/about`, `/login` and `/register` are public - you can read them logged out. Everything else is
  behind the `RequireAuth` guard.
- Change language (English / Hindi / Marathi) from the navbar, the login card or the register form. A language you pick is
  remembered on the device and saved on your account.
- A new farmer starts with no plots: add one on the map (`/add-plot`) and the dashboard then shows the live weather, the
  advisory and the analytics for it.

## Where each experiment concept lives
| Concept | File |
|---|---|
| Entry / createRoot / BrowserRouter | `src/main.jsx` |
| Function components, props, JSX, styling | `components/Icon.jsx`, `PlotCard.jsx`, `WeatherStrip.jsx`, `AdvisoryCard.jsx`, `PlotMap.jsx` |
| Events + conditional rendering | `components/Layout.jsx` (links by role), `pages/Home.jsx` (farmer vs supervisor), `pages/MyPlots.jsx` (empty state) |
| useState / useRef / useEffect | `pages/Login.jsx`, `pages/Register.jsx`, `context/DataContext.jsx` |
| useContext (user + language) | `context/AppContext.jsx`, `data/i18n.js` |
| useContext (plots / weather / history) | `context/DataContext.jsx` |
| useReducer (plot form) | `pages/AddPlot.jsx` |
| useMemo (FAO water balance, stats, search) | `pages/Dashboard.jsx`, `pages/History.jsx`, `pages/MyPlots.jsx`, `pages/PlotDetail.jsx` |
| useCallback | `context/AppContext.jsx`, `context/DataContext.jsx`, `pages/SupervisorDashboard.jsx` |
| Routing table | `src/App.jsx` |
| Route guards | `routes/RequireAuth.jsx`, `routes/RequireRole.jsx` |
| Validation rules (shared regexes) | `utils/validators.js` (the server repeats them in `sinchai-server/utils/validators.js`) |
| Plot-field rules shared by Add and Edit | `utils/plotRules.js` |
| FAO-56 soil water balance (browser copy) | `utils/waterBalance.js` |
| **Exp 5** - API client (JWT, errors, `/api` base URL) | `api/client.js` |
| **Exp 5** - session `{user, token}` + language saved on the account | `context/AppContext.jsx` |
| **Exp 5** - data loaded from MongoDB, saved with POST / PUT / DELETE | `context/DataContext.jsx` |
| **Exp 5** - real login / register (server errors shown under the right field) | `pages/Login.jsx`, `pages/Register.jsx` |
| **Exp 5** - real OpenStreetMap map (Leaflet), pins stored as latitude / longitude | `components/PlotMap.jsx` |
| **Exp 5** - create / edit / delete a plot (+ optional usual-hours and pump-kW figures) | `pages/AddPlot.jsx`, `components/PlotEditForm.jsx`, `pages/PlotDetail.jsx` |
| **Exp 5** - "live weather unavailable" notice and live-data chip | `components/WeatherNotice.jsx`, `components/WeatherStrip.jsx` |
| **Exp 5** - irrigation log with delete, water-saving chart | `pages/History.jsx`, `components/UsageChart.jsx`, `pages/Dashboard.jsx` |
| **Exp 5** - supervisor alerts stored in MongoDB | `pages/SupervisorDashboard.jsx` |

## Exp 3.3 - Routing and form validation

`src/App.jsx` now holds nothing but the `<Routes>` table. All shared state moved into two providers
(`AppProvider` for user + language, `DataProvider` for plots / weather / history), so any route element
can read what it needs without prop drilling.

### Route table
| URL | Element | Notes |
|---|---|---|
| `/login` | `pages/Login.jsx` | **Public.** Static path. Sends you on to the page you originally asked for. |
| `/register` | `pages/Register.jsx` | **Public.** Static path. The validated registration form. |
| `/about` | `pages/About.jsx` | **Public.** Static path. Explains the FAO-56 idea; readable logged out. |
| `/` | `routes/RequireAuth.jsx` -> `components/Layout.jsx` | **Protected.** Layout is the parent route: sidebar / tabs plus an `<Outlet/>` for the child page. |
| `/` (index) | `pages/Home.jsx` | **Protected.** `index` route of `/`; picks `Dashboard` or `SupervisorDashboard` by role. |
| `/plots` | `pages/MyPlots.jsx` | **Protected.** Nested child of `/`. |
| `/plots/:plotId` | `pages/PlotDetail.jsx` | **Protected.** Dynamic segment, read with `useParams()`. |
| `/add-plot` | `pages/AddPlot.jsx` | **Protected + farmer only.** Wrapped in `RequireRole role="farmer"`; a supervisor is bounced to `/`. |
| `/history` | `pages/History.jsx` | **Protected.** Nested child of `/`. |
| `*` | `pages/NotFound.jsx` | **Public.** Wildcard 404 for every unmatched URL. |

"Protected" means the URL sits inside `<Route element={<RequireAuth />}>`. That guard renders `<Outlet/>`
when a user exists and `<Navigate to="/login" replace />` when it does not, so typing a protected URL
while logged out lands you on the login page instead of a blank screen.

### Routing concept -> file
| Concept | Where it is demonstrated |
|---|---|
| `BrowserRouter` | `src/main.jsx` - wraps `AppProvider > DataProvider > App` |
| `Routes` / `Route` | `src/App.jsx` - the whole route table |
| `path` (static) | `/login`, `/register`, `/about`, `/plots`, `/history` in `src/App.jsx` |
| `path` (dynamic `:param`) | `/plots/:plotId` in `src/App.jsx` |
| `path` (wildcard `*`) | `<Route path="*" element={<NotFound />} />` in `src/App.jsx` |
| `index` route | `<Route index element={<Home />} />` inside `/` |
| Nested routes + `<Outlet/>` | `components/Layout.jsx` (renders the child page), `routes/RequireAuth.jsx`, `routes/RequireRole.jsx` |
| `Link` | `components/Layout.jsx` (brand), `components/PlotCard.jsx` (details button), `pages/Login.jsx` / `pages/Register.jsx` (tabs), `pages/NotFound.jsx` |
| `NavLink` + `isActive` | `components/Layout.jsx` - sidebar items and mobile tabs take their `active` class from the `isActive` argument |
| `useNavigate` | `pages/Register.jsx` and `pages/Login.jsx` (`navigate("/")` after a successful submit), `pages/AddPlot.jsx` (`navigate("/plots")` after saving) |
| `navigate(-1)` | `pages/PlotDetail.jsx` and `pages/NotFound.jsx` - the "Back" button steps through browser history |
| `useParams` | `pages/PlotDetail.jsx` - `const { plotId } = useParams()` picks the plot out of context |
| `useSearchParams` | `pages/MyPlots.jsx` - the search box is mirrored into `?q=`, so a filtered list is a shareable URL |
| `useLocation` | `routes/RequireAuth.jsx` remembers the blocked URL; `pages/Login.jsx` reads it back and returns you there |
| `Navigate` | `routes/RequireAuth.jsx` (`to="/login"`), `routes/RequireRole.jsx` (`to="/"`), and the already-logged-in redirect on `/login` |

### Registration form validation rules
Every rule below lives once in `src/utils/validators.js` and is applied by the `validate()` function in
`src/pages/Register.jsx`. `validate()` takes the form state and returns a plain **errors object**
(`{ field: "message" }`); the form is valid when that object has no keys. The submit handler calls
`event.preventDefault()` first, so the browser never does a full page reload.

| Field | Rule | Message |
|---|---|---|
| Full name | Required (not blank) | Name is required |
| Full name | `NAME_RE` = `/^[A-Za-z ]{3,}$/` - letters and spaces only, at least 3 characters | Name must be at least 3 letters, alphabets only |
| Email address | Required (not blank) | Email is required |
| Email address | `EMAIL_RE` = `/^[\w.-]+@[\w.-]+\.[A-Za-z]{2,}$/` | Enter a valid email address |
| Mobile number | `MOBILE_RE` = `/^[6-9]\d{9}$/` - exactly 10 digits, first digit 6-9 | Enter a valid 10 digit mobile number starting with 6-9 |
| Village | Required (not blank) | Village is required |
| Password | At least `PASSWORD_MIN` = 8 characters | Password must be at least 8 characters |
| Password | `UPPER_DIGIT_RE` = `/(?=.*[A-Z])(?=.*\d)/` - one uppercase letter and one digit | Use at least one uppercase letter and one digit |
| Confirm password | Must be exactly equal to Password | Passwords do not match |
| Disclaimer checkbox | Must be ticked | Please accept the advisory disclaimer |
| Whole form | Any error present -> summary box with `role="alert"` above the form | Please correct the highlighted fields |

The same helpers are reused for the field checks on `pages/AddPlot.jsx` (plot name, crop stage,
area of 0.1 acre or more, pump of 1000 L/hr or more, and a marker clicked on the map) and for the
mobile check on `pages/Login.jsx`, so no rule is written twice.

Each message renders in a `<span class="error">` carrying an `id`; the input gets `aria-invalid` and
`aria-describedby` pointing at that id, and every input has a `<label htmlFor>`. Validation itself runs
**on submit**; the shared `handleChange` then clears just that one field's message as soon as the user
starts editing it, so corrected fields stop shouting while the untouched ones keep their message.

### Controlled vs uncontrolled
Every field on the registration form is a **controlled component**: its `value` comes from React state
and its `onChange` writes back to that state, so React is the single source of truth and `validate()` can
be run against the state object at any moment. The one deliberate exception in the whole app is the
"Notes for your supervisor" textarea on `pages/AddPlot.jsx`, which is **uncontrolled** - the DOM keeps
its own value and we read it only on submit through `notesRef.current.value`. It is there for the
contrast: an uncontrolled field is cheaper, but it cannot be validated as you type, reset from state, or
reflected anywhere else in the UI.

### Client-side validation is not security
Everything above runs in the browser and exists purely for user experience - fast, specific feedback in
the farmer's own language. Anyone can bypass it with devtools or by posting straight to the API. That is why
the identical rules (name format, email, 10-digit mobile, password strength, uniqueness of email and mobile) are
**repeated on the server** (`sinchai-server/utils/validators.js`, `services/auth.js`, the Mongoose schemas), the
password is hashed there with bcrypt, and the server's replies (400 / 409) are mapped back under the right field.

### Keeping the session across a refresh
`BrowserRouter` promises that refreshing and bookmarking a URL keep working, but React state alone is
wiped by a reload - a farmer who refreshed `/plots` would have been thrown straight back to `/login`.
`context/AppContext.jsx` therefore mirrors the session into `localStorage`: `useState` takes a lazy initialiser
that reads the stored session on the first render, and a `useEffect` writes it back after every login and logout.
Both are wrapped in `try/catch`, so a browser with storage disabled simply starts logged out. Since Exp 5 the session
is `{ user, token }` where `token` is the **JWT** issued by the server; `api/client.js` sends it with every request, and if
the server ever answers 401 (expired token, deleted account) the session is dropped and the guard sends you to `/login`.
Plot edits are now **persisted** in MongoDB: a refresh shows exactly what was saved.

## Exp 5 - talking to the API
* **Where the data comes from.** `context/DataContext.jsx` loads `/api/plots`, `/api/weather`, `/api/history` and
  `/api/analytics/summary` (plus `/api/alerts` for a supervisor) when someone logs in. A fresh `DataStore` is mounted for
  every login/logout (it is keyed by the user id), so one person's data can never leak into the next session.
  The old mock files in `public/data/` were deleted: the client contains no built-in data at all.
* **Saving.** `addPlot`, `updatePlot`, `deletePlot`, `markIrrigated`, `deleteLog` and `acknowledgeAlert` call the API first and
  update state from the reply, so what the screen shows is what MongoDB holds. Click-actions are guarded against a double
  click (one irrigation logged, not two) and failures appear as a banner in the layout.
* **Each plot is advised on the weather at its own map pin** (`weatherFor(plot)`; plots in the same ~11 km cell share one
  reading). The weather card says where the numbers came from and when: *Live data - Open-Meteo - updated 14:05*. If live
  weather cannot be fetched the page says so, shows **no advice and no forecast** for those plots and offers *Try again*:
  nothing is ever estimated.
* **A real map.** `components/PlotMap.jsx` is an interactive OpenStreetMap (Leaflet): click to place a pin, drag / zoom, or
  press "Use my location". Plots are saved as latitude / longitude and must lie inside India.
* **Same maths in two places.** The advisory is computed live in the browser (`utils/waterBalance.js`, the `useMemo` of Exp 3.2)
  and stored daily by the server (`sinchai-server/utils/waterBalance.js`); a server test fails if they ever disagree.
* **Water-saving analytics** (dashboard tiles and the 8-week chart) are the server's totals, worked out only from what the
  farmer entered: "water saved" uses the **usual irrigation hours** entered on the plot and "electricity" uses the
  **pump kW** entered on the plot. Until they are entered the tile shows a dash, and a note says how many plots each
  figure covers.

Note on `BrowserRouter`: it uses the real History API, so the server must return `index.html` for **every**
path or a refresh on `/plots/1` gives a 404. The Vite dev server and `npm run preview` already do this;
a plain static host would need a rewrite / fallback rule (or `HashRouter` instead).

## Demo walkthrough for the viva
1. Start logged out and open `/about` directly - a public route renders with no login, proving the guard is per-route.
2. Now ask for `/history` while still logged out - `RequireAuth` bounces you to `/login` and remembers the URL you wanted.
3. Click the **Register** tab (a `Link`, not a button) to reach `/register`, then submit the empty form: `preventDefault()` stops the reload and every rule fires at once - name, email, mobile, village, password, confirm, disclaimer.
4. Fix the fields one at a time: each message disappears the moment you edit that field, and the next submit re-checks everything. Try `ram` style short names, `1234567890` for the mobile (10 digits, but it does not start with 6-9) and `password` (no uppercase, no digit) to see the specific messages and the strength bar move Weak -> Fair -> Strong.
5. Submit the completed form - the account is created in MongoDB (`POST /api/auth/register`), and `useNavigate` sends you on - to `/` here, or back to the page you first asked for - where the `index` route picks the farmer dashboard by role. Registering the same email again shows "already registered" under the email field (server 409).
6. Notice you land back on `/history` if you came from step 2 - `useLocation` returned you to the page you originally asked for.
7. Click a plot card's details button: a `Link` takes you to `/plots/1`, a dynamic route whose `useParams()` reads `plotId`. Press **Back** there to see `navigate(-1)` step through history.
8. On `/plots`, type in the search box and watch the address bar - `useSearchParams` writes the query into `?q=`, so a filtered list is a shareable URL.
9. Type a nonsense URL such as `/plotss/99` - the `*` wildcard route renders the 404 page; use its link to get back to the dashboard.
10. Switch the language selector to हिन्दी or मराठी and confirm every routed page, label and validation message re-renders through `t()`; then log out, confirm you are pushed back to `/login` and cannot reopen `/add-plot` by typing it, and finally log in as the Field Supervisor (9988776655) and try `/add-plot` again to see `RequireRole` redirect a non-farmer to `/` - the API refuses it too (403).
11. **Exp 5 end to end:** on a farmer's plot page click **Edit plot**, change the crop stage, drag the pin to a new spot and save (PUT). Then register a supervisor (access code from `npm run supervisor-code`) in a second browser: alerts come from MongoDB - a dry plot with a small pump needs a long run, which is an alert - **Acknowledge** one, refresh: it stays acknowledged.

## Git (Exp 2)
```
git init
git add .
git commit -m "feat: SinchAI client - routing and form validation"
git branch -M main
git remote add origin https://github.com/<user>/sinchai.git
git push -u origin main
```
