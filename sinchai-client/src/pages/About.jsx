import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Icon from "../components/Icon";

// Exp 3.1 - the four steps live in an array and are rendered with .map() + a key
const STEPS = ["aboutStep1", "aboutStep2", "aboutStep3", "aboutStep4"];

// Exp 3.3 - PUBLIC static route "/about": it is declared outside <RequireAuth />, so a visitor
// can read it without logging in and it renders standalone, with no <Layout /> shell around it.
export default function About() {
  const { user, t, lang, setLang } = useApp();

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px" }}>
      <div className="between" style={{ marginBottom: 32 }}>
        <Link to="/" className="brand-link">
          <img src="/logo.png" alt="SinchAI" style={{ width: 40, height: 40 }} />
          <span className="label-bold">{t("appName")}</span>
        </Link>
        <span className="header-btn">
          <Icon name="language" />
          <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="mr">मराठी</option>
          </select>
        </span>
      </div>

      <div className="stack" style={{ gap: 24 }}>
        <div>
          <h1 className="headline-lg">{t("aboutTitle")}</h1>
          <p className="muted" style={{ margin: "8px 0 0" }}>{t("aboutIntro")}</p>
        </div>

        <div className="card stack">
          <h2 className="headline-md">{t("aboutHow")}</h2>
          <ol className="stack" style={{ gap: 12, margin: 0, paddingLeft: 20 }}>
            {STEPS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ol>
        </div>

        <p className="muted label-sm">{t("aboutTech")}</p>

        {/* Exp 3.1 - conditional rendering: /about is public, so a visitor is offered the login
            screen and only a signed-in user is offered the dashboard RequireAuth would let them see */}
        <div className="row">
          {user ? (
            <Link to="/" className="btn btn-primary">
              <Icon name="arrow_back" /> {t("backHome")}
            </Link>
          ) : (
            /* Exp 3.3 - <Link> renders an <a> but the router intercepts the click, so there is no page reload */
            <Link to="/login" className="btn btn-primary">
              <Icon name="login" /> {t("login")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
