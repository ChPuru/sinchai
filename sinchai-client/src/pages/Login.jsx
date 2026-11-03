import { useState, useRef, useEffect } from "react";
import { NavLink, Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api, errorKey } from "../api/client";
import { MOBILE_RE, isBlank } from "../utils/validators";
import Icon from "../components/Icon";

// Exp 3.2 - useState (controlled form), useRef (autofocus), useEffect, useContext for language
// Exp 3.3 - NavLink tabs (the URL, not local state, picks login vs register), useNavigate +
//           useLocation to return the farmer to the page RequireAuth interrupted, and a
//           validate() function that returns a per-field errors object.
// Exp 5 - the form now logs in for real: mobile number + password go to POST /api/auth/login, which answers
//         with the account and a JWT; the role comes from the account, no longer from a drop-down.
export default function Login() {
  const { user, login, t, lang, setLang } = useApp();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const phoneRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  // Exp 3.3 - <Navigate> is the declarative redirect: an already logged-in user never sees this screen
  if (user) return <Navigate to="/" replace />;

  // Exp 3.3 - validate() returns an errors object; an empty object means the form is clean
  const validate = (values) => {
    const found = {};
    if (!MOBILE_RE.test(values.phone)) found.phone = t("errMobileFmt");
    if (isBlank(values.password)) found.password = t("errPasswordReq");
    return found;
  };

  // Exp 3.3 - controlled components: React state is the single source of truth for every input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "", form: "" })); // typing clears that field's message
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // Exp 3.3 - stop the browser doing a full-page form post
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitting(true);
    try {
      const session = await api.post("/auth/login", { mobile: form.phone, password: form.password });
      login(session);
      // Exp 3.3 - RequireAuth parked the whole location the user originally asked for in
      // location.state.from, so the query string (/history?plot=2) travels back with it
      const from = location.state?.from;
      navigate(from ? from.pathname + (from.search || "") : "/", { replace: true });
    } catch (err) {
      // 401 / unreachable server / too many attempts: one message above the form, never revealing which half was wrong
      setErrors({ form: t(errorKey(err)) });
      setSubmitting(false);
    }
  };

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <div className="login-bg">
      <div className="login-lang">
        <span className="header-btn" style={{ background: "#fff" }}>
          <Icon name="language" />
          <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t("preferredLang")}>
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="mr">मराठी</option>
          </select>
        </span>
      </div>
      <div className="login-inner">
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img className="login-logo" src="/logo.png" alt="SinchAI logo" />
          <h2 className="headline-lg" style={{ color: "#fff", marginTop: 16 }}>{t("appName")}</h2>
          <p style={{ color: "#e5e7eb", margin: "8px 0 0" }}>{t("tagline")}</p>
        </div>

        <div className="login-card">
          {/* Exp 3.3 - NavLink knows which route is active and hands us isActive for the styling */}
          {/* state={location.state} forwards the page RequireAuth parked, so switching tabs does not lose it */}
          <div className="tabs">
            <NavLink to="/login" state={location.state} className={({ isActive }) => (isActive ? "active" : "")}>{t("login")}</NavLink>
            <NavLink to="/register" state={location.state} className={({ isActive }) => (isActive ? "active" : "")}>{t("register")}</NavLink>
          </div>
          <form onSubmit={handleSubmit} className="stack" noValidate>
            {hasErrors && (
              <div className="error-box" role="alert">
                <Icon name="error" fill /> {errors.form || t("errFixFields")}
              </div>
            )}
            <div className="field">
              <label htmlFor="phone">{t("mobileNo")}</label>
              <div className="input-icon">
                <span className="input-prefix">+91</span>
                <input
                  ref={phoneRef}
                  id="phone"
                  name="phone"
                  className={errors.phone ? "input invalid" : "input"}
                  style={{ paddingLeft: 48 }}
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={handleChange}
                  maxLength={10}
                  inputMode="numeric"
                  autoComplete="username"
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "phone-error" : "phone-hint"}
                />
              </div>
              {errors.phone ? (
                <span className="error" id="phone-error">{errors.phone}</span>
              ) : (
                <span className="label-sm muted" id="phone-hint">{t("errMobileFmt")}</span>
              )}
            </div>
            <div className="field">
              <label htmlFor="password">{t("password")}</label>
              <div className="input-icon">
                <Icon name="lock" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  className={errors.password ? "input invalid" : "input"}
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                />
              </div>
              {errors.password && <span className="error" id="password-error">{errors.password}</span>}
            </div>
            <button className="btn btn-primary btn-block" style={{ padding: 16, marginTop: 8 }} disabled={submitting}>
              {submitting ? t("signingIn") : t("login")}
            </button>
          </form>

        </div>

        {/* Exp 3.3 - <Link> renders a real <a> but navigates client-side, without reloading the app */}
        <div className="stack" style={{ alignItems: "center", gap: 8, marginTop: 24, color: "#e5e7eb" }}>
          <p style={{ margin: 0 }}>
            {t("newHere")}{" "}
            <Link className="link-plain" to="/register" state={location.state} style={{ fontWeight: 700, textDecoration: "underline" }}>{t("register")}</Link>
          </p>
          <Link className="link-plain" to="/about" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="info" size={18} /> {t("about")}
          </Link>
        </div>
      </div>
    </div>
  );
}
