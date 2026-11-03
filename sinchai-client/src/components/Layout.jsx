import { Link, NavLink, Outlet } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useData } from "../context/DataContext";
import Icon from "./Icon";

// Exp 3.1 - app shell: desktop sidebar + mobile top bar, driven by context.
// Conditional rendering by role (supervisor cannot add a plot).
// Exp 3.3 - the link tables are now route paths instead of page keys.
const FARMER_LINKS = [
  ["/", "dashboard", "dashboard"],
  ["/plots", "potted_plant", "myPlots"],
  ["/add-plot", "add_circle", "addPlot"],
  ["/history", "history", "history"],
];
const SUPERVISOR_LINKS = [
  ["/", "dashboard", "dashboard"],
  ["/plots", "potted_plant", "myPlots"],
  ["/history", "history", "history"],
];

// Exp 3.3 - Layout takes NO props: it is a route element, mounted by App's <Route path="/">.
export default function Layout() {
  const { user, logout, lang, setLang, t } = useApp();
  const { error, actionError } = useData();
  const links = user.role === "supervisor" ? SUPERVISOR_LINKS : FARMER_LINKS;

  const langSelect = (cls) => (
    <select className={"lang-select " + cls} value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t("preferredLang")}>
      <option value="en">English</option>
      <option value="hi">हिन्दी</option>
      <option value="mr">मराठी</option>
    </select>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        {/* Exp 3.3 - Link: the brand always takes you back to the index route */}
        <Link to="/" className="brand-link sidebar-brand">
          <img src="/logo.png" alt="SinchAI" />
          <div>
            <div className="name">{t("appName")}</div>
            <div className="label-sm muted">{t("subtitle")}</div>
          </div>
        </Link>
        <nav className="sidebar-nav">
          {/* Exp 3.3 - NavLink gives us isActive, so no page state is needed any more.
              end is required on "/" because without it the index link stays "active"
              on every nested URL (/plots, /history, ...) since they all start with "/". */}
          {links.map(([path, icon, label]) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={({ isActive }) => "nav-item " + (isActive ? "active" : "")}
            >
              {({ isActive }) => (
                <>
                  <Icon name={icon} fill={isActive} />
                  {t(label)}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          {user.role === "farmer" && (
            <Link to="/add-plot" className="btn btn-primary btn-block">
              <Icon name="add" /> {t("addNewPlot")}
            </Link>
          )}
          <Link to="/about" className="nav-item">
            <Icon name="info" /> {t("about")}
          </Link>
          {/* Exp 3.3 - no navigate() here: clearing the user makes RequireAuth redirect to /login */}
          <button className="nav-item" onClick={logout}>
            <Icon name="logout" /> {t("logout")}
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="row">
            <Icon name="menu" />
            <span className="name">{t("appName")}</span>
          </div>
          <div className="row">
            <Icon name="language" />
            {langSelect("on-dark")}
            <button onClick={logout} title={t("logout")}>
              <Icon name="account_circle" />
            </button>
          </div>
        </header>
        <div className="mobile-tabs">
          {links.map(([path, , label]) => (
            <NavLink key={path} to={path} end={path === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
              {t(label)}
            </NavLink>
          ))}
          {/* the sidebar is hidden on phones, so /about needs its own tab here to stay reachable */}
          <NavLink to="/about" className={({ isActive }) => (isActive ? "active" : "")}>{t("about")}</NavLink>
        </div>
        <header className="desktop-header">
          <span className="header-btn">
            <Icon name="language" /> {langSelect("")}
          </span>
          <button className="header-btn" onClick={logout}>
            <Icon name="account_circle" /> {user.name} · {t(user.role)}
          </button>
        </header>
        {/* Exp 3.3 - <Outlet/> is where the matched child route renders */}
        <div className="page">
          {/* Exp 3.1 - conditional rendering: a failed API load is announced once,
              here in the shell, instead of every page pretending the farmer owns no plots */}
          {error && (
            <div className="error-box" role="alert" style={{ marginBottom: 24 }}>
              <Icon name="error" fill /> {t("dataError")}
            </div>
          )}
          {/* Exp 5 - a click that the API refused (irrigate, delete, acknowledge) is announced here too */}
          {actionError && (
            <div className="error-box" role="alert" style={{ marginBottom: 24 }}>
              <Icon name="error" fill /> {t(actionError)}
            </div>
          )}
          <Outlet />
        </div>
      </div>
    </div>
  );
}
