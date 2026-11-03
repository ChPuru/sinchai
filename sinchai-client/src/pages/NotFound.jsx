import { Link, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Icon from "../components/Icon";

// Exp 3.3 - wildcard route "*": <Routes> picks only the single best-matching route, so the
// wildcard can sit anywhere in the table and still fires only when nothing else matched.
export default function NotFound() {
  const { t } = useApp();
  const navigate = useNavigate(); // Exp 3.3 - useNavigate: navigate from code instead of from a <Link>
  // Exp 3.3 - useLocation: read the URL the router could not match. Its `key` is "default" when
  // this is the first entry in the router stack, so navigate(-1) would leave the app entirely.
  const location = useLocation();

  return (
    <div className="notfound">
      <div className="code">404</div>
      <h1 className="headline-lg">{t("notFound")}</h1>
      <p className="muted" style={{ maxWidth: 440, margin: 0 }}>{t("notFoundMsg")}</p>
      <span className="mono label-sm muted">{location.pathname}</span>
      <div className="row">
        <Link to="/" className="btn btn-primary">
          <Icon name="home" /> {t("backHome")}
        </Link>
        {/* Exp 3.3 - navigate(-1) walks one step back through the browser history stack, like the back button */}
        <button className="btn btn-outline" onClick={() => (location.key === "default" ? navigate("/") : navigate(-1))}>
          <Icon name="arrow_back" /> {t("back")}
        </button>
      </div>
    </div>
  );
}
