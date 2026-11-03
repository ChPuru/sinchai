import { useState, useRef, useEffect } from "react";
import { Link, NavLink, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api, errorKey } from "../api/client";
import Icon from "../components/Icon";
import { NAME_RE, EMAIL_RE, MOBILE_RE, UPPER_DIGIT_RE, PASSWORD_MIN, isBlank } from "../utils/validators";

// Exp 3.3 - the form-validation centrepiece: controlled components held in ONE state object,
// a validate() that returns an errors object, preventDefault() in the submit handler,
// useNavigate() for the redirect after a successful register, and Link / NavLink for routing.
// Exp 3.2 kept alive here too: useState, useRef + useEffect (autofocus), useContext via useApp().

// every field starts empty so the form has a single, obvious reset point
const initialState = { name: "", email: "", mobile: "", village: "", role: "farmer", supervisorCode: "", password: "", confirm: "", agree: false };

// pure helper: 0..3 password strength, no state, no side effects
function score(pw) {
  let s = 0;
  if (pw.length >= PASSWORD_MIN) s += 1;
  if (UPPER_DIGIT_RE.test(pw)) s += 1;
  if (pw.length >= 12) s += 1;
  return s;
}

export default function Register() {
  const { user, login, t, lang, setLang } = useApp();
  // Exp 3.3 - controlled components: React state is the single source of truth for every input
  const [form, setForm] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false); // Exp 5 - true while the POST is in flight, disables the button
  const nameRef = useRef(null);

  // Exp 3.3 - useNavigate: programmatic redirect once the form is valid.
  // useLocation carries the page RequireAuth parked, so registering also honours a deep link.
  const navigate = useNavigate();
  const location = useLocation();

  // Exp 3.2 - useRef + useEffect: focus the first field on mount
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Exp 3.3 - one handler for every input, keyed off e.target.name; checkbox uses .checked
  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
    setErrors({ ...errors, [name]: "" }); // clear only this field's message as the user types
  };

  // Exp 3.3 - validate() returns an errors object; empty object means the form is clean
  const validate = () => {
    const err = {};
    if (isBlank(form.name)) err.name = t("errNameReq");
    else if (!NAME_RE.test(form.name.trim())) err.name = t("errNameFmt");

    if (isBlank(form.email)) err.email = t("errEmailReq");
    else if (!EMAIL_RE.test(form.email.trim())) err.email = t("errEmailFmt");

    if (!MOBILE_RE.test(form.mobile)) err.mobile = t("errMobileFmt");

    if (isBlank(form.village)) err.village = t("errVillageReq");

    // Exp 5 - a supervisor account can see every farmer's plots, so signing up as one needs an access code
    if (form.role === "supervisor" && isBlank(form.supervisorCode)) err.supervisorCode = t("errSupCodeReq");

    if (form.password.length < PASSWORD_MIN) err.password = t("errPwdLen");
    else if (!UPPER_DIGIT_RE.test(form.password)) err.password = t("errPwdFmt");

    if (form.confirm !== form.password) err.confirm = t("errConfirm");

    if (!form.agree) err.agree = t("errTerms");
    return err;
  };

  // Exp 5 - the server repeats every rule above (the browser check is only for speed), and it alone knows about
  // duplicates, so a 409 / 403 reply is turned back into a message under the right field
  const serverErrors = (err) => {
    if (err.status === 409 && err.fields.email) return { email: t("errEmailTaken") };
    if (err.status === 409 && err.fields.mobile) return { mobile: t("errMobileTaken") };
    if (err.status === 403 && err.fields.supervisorCode) return { supervisorCode: t("errSupCodeBad") };
    if (err.status === 400 && Object.keys(err.fields).length) return err.fields; // a rule the browser missed: show the server's wording
    return { form: t(errorKey(err)) };
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // Exp 3.3 - stops the browser reloading the page on submit
    const err = validate();
    setErrors(err);
    if (Object.keys(err).length > 0) return;
    setSubmitting(true);
    try {
      const session = await api.post("/auth/register", {
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile,
        village: form.village.trim(),
        role: form.role,
        supervisorCode: form.role === "supervisor" ? form.supervisorCode.trim() : undefined,
        password: form.password,
        language: lang,
      });
      login(session); // a successful registration logs you straight in
      const from = location.state?.from;
      // replace so Back does not return to the registration form
      navigate(from ? from.pathname + (from.search || "") : "/", { replace: true });
    } catch (apiErr) {
      setErrors(serverErrors(apiErr));
      setSubmitting(false);
    }
  };

  // Exp 3.3 - <Navigate> redirect: an already logged-in user has no business on this page
  if (user) return <Navigate to="/" replace />;

  const strength = score(form.password);
  const strengthLabel = strength >= 3 ? t("pwdStrong") : strength === 2 ? t("pwdFair") : t("pwdWeak");
  const strengthKey = strength >= 3 ? "on-strong" : strength === 2 ? "on-fair" : "on-weak";
  const hasErrors = Object.keys(errors).some((k) => errors[k]);

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

        <div className="login-card" style={{ maxWidth: 560 }}>
          {/* Exp 3.3 - NavLink knows whether it is the active route, so the URL picks the tab */}
          <div className="tabs">
            <NavLink to="/login" state={location.state} className={({ isActive }) => (isActive ? "active" : "")}>{t("login")}</NavLink>
            <NavLink to="/register" state={location.state} className={({ isActive }) => (isActive ? "active" : "")}>{t("register")}</NavLink>
          </div>

          <h3 className="headline-md" style={{ margin: "0 0 4px" }}>{t("createAccount")}</h3>
          <p className="muted label-sm" style={{ margin: "0 0 20px" }}>{t("registerSub")}</p>

          {/* noValidate: we render our own messages instead of the browser bubbles */}
          <form onSubmit={handleSubmit} className="stack" noValidate>
            {hasErrors && (
              <div className="error-box" role="alert">
                <Icon name="error" fill /> {errors.form || t("errFixFields")}
              </div>
            )}

            <div className="form-grid">
              <div className="field">
                <label htmlFor="name">{t("fullName")}</label>
                <div className="input-icon">
                  <Icon name="person" />
                  <input
                    ref={nameRef}
                    id="name"
                    name="name"
                    className={"input" + (errors.name ? " invalid" : "")}
                    placeholder="Kisan Kumar"
                    value={form.name}
                    onChange={handleChange}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "name-err" : undefined}
                  />
                </div>
                {errors.name && <span className="error" id="name-err">{errors.name}</span>}
              </div>

              <div className="field">
                <label htmlFor="email">{t("email")}</label>
                <div className="input-icon">
                  <Icon name="mail" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className={"input" + (errors.email ? " invalid" : "")}
                    placeholder="kisan@example.com"
                    value={form.email}
                    onChange={handleChange}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-err" : undefined}
                  />
                </div>
                {errors.email && <span className="error" id="email-err">{errors.email}</span>}
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="mobile">{t("mobileNo")}</label>
                <div className="input-icon">
                  <span className="input-prefix">+91</span>
                  <input
                    id="mobile"
                    name="mobile"
                    className={"input" + (errors.mobile ? " invalid" : "")}
                    style={{ paddingLeft: 48 }}
                    placeholder="9876543210"
                    value={form.mobile}
                    onChange={handleChange}
                    maxLength={10}
                    inputMode="numeric"
                    aria-invalid={!!errors.mobile}
                    aria-describedby={errors.mobile ? "mobile-err" : undefined}
                  />
                </div>
                {errors.mobile && <span className="error" id="mobile-err">{errors.mobile}</span>}
              </div>

              <div className="field">
                <label htmlFor="village">{t("village")}</label>
                <div className="input-icon">
                  <Icon name="home_pin" />
                  <input
                    id="village"
                    name="village"
                    className={"input" + (errors.village ? " invalid" : "")}
                    placeholder="Kolhapur"
                    value={form.village}
                    onChange={handleChange}
                    aria-invalid={!!errors.village}
                    aria-describedby={errors.village ? "village-err" : undefined}
                  />
                </div>
                {errors.village && <span className="error" id="village-err">{errors.village}</span>}
              </div>
            </div>

            <div className="field">
              <label htmlFor="role">{t("role")}</label>
              <select id="role" name="role" className="select" value={form.role} onChange={handleChange}>
                <option value="farmer">{t("farmer")}</option>
                <option value="supervisor">{t("supervisor")}</option>
              </select>
            </div>

            {/* Exp 3.1 - conditional rendering: the access-code field only exists for a supervisor sign-up */}
            {form.role === "supervisor" && (
              <div className="field">
                <label htmlFor="supervisorCode">{t("supervisorCode")}</label>
                <div className="input-icon">
                  <Icon name="badge" />
                  <input
                    id="supervisorCode"
                    name="supervisorCode"
                    className={"input" + (errors.supervisorCode ? " invalid" : "")}
                    value={form.supervisorCode}
                    onChange={handleChange}
                    autoComplete="off"
                    aria-invalid={!!errors.supervisorCode}
                    aria-describedby={errors.supervisorCode ? "supervisorCode-err" : "supervisorCode-hint"}
                  />
                </div>
                {errors.supervisorCode ? (
                  <span className="error" id="supervisorCode-err">{errors.supervisorCode}</span>
                ) : (
                  <span className="label-sm muted" id="supervisorCode-hint">{t("supervisorCodeHint")}</span>
                )}
              </div>
            )}

            <div className="form-grid">
              <div className="field">
                <label htmlFor="password">{t("password")}</label>
                <div className="input-icon">
                  <Icon name="lock" />
                  <input
                    id="password"
                    name="password"
                    type={showPwd ? "text" : "password"}
                    className={"input" + (errors.password ? " invalid" : "")}
                    style={{ paddingRight: 44 }}
                    value={form.password}
                    onChange={handleChange}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-err" : undefined}
                  />
                  <button
                    type="button"
                    className="pwd-toggle"
                    onClick={() => setShowPwd(!showPwd)}
                    aria-label={showPwd ? t("hidePwd") : t("showPwd")}
                  >
                    <Icon name={showPwd ? "visibility_off" : "visibility"} />
                  </button>
                </div>
                {errors.password && <span className="error" id="password-err">{errors.password}</span>}
              </div>

              <div className="field">
                <label htmlFor="confirm">{t("confirmPassword")}</label>
                <div className="input-icon">
                  <Icon name="lock_reset" />
                  <input
                    id="confirm"
                    name="confirm"
                    type={showPwd ? "text" : "password"}
                    className={"input" + (errors.confirm ? " invalid" : "")}
                    value={form.confirm}
                    onChange={handleChange}
                    aria-invalid={!!errors.confirm}
                    aria-describedby={errors.confirm ? "confirm-err" : undefined}
                  />
                </div>
                {errors.confirm && <span className="error" id="confirm-err">{errors.confirm}</span>}
              </div>
            </div>

            {/* Exp 3.1 - conditional rendering: the strength meter only exists once something is typed */}
            {form.password && (
              <div className="row">
                <div className="strength">
                  <i className={strength >= 1 ? strengthKey : ""} />
                  <i className={strength >= 2 ? strengthKey : ""} />
                  <i className={strength >= 3 ? strengthKey : ""} />
                </div>
                <span className="label-sm muted">{strengthLabel}</span>
              </div>
            )}

            <div className="field">
              <label className="check-row" htmlFor="agree">
                <input
                  id="agree"
                  name="agree"
                  type="checkbox"
                  checked={form.agree}
                  onChange={handleChange}
                  aria-invalid={!!errors.agree}
                  aria-describedby={errors.agree ? "agree-err" : undefined}
                />
                <span>{t("agreeTerms")}</span>
              </label>
              {errors.agree && <span className="error" id="agree-err">{errors.agree}</span>}
            </div>

            <button className="btn btn-primary btn-block" style={{ padding: 16 }} disabled={submitting}>
              {submitting ? t("creatingAccount") : t("register")}
            </button>
          </form>
        </div>

        {/* Exp 3.3 - Link: plain declarative navigation, no page reload */}
        <p style={{ color: "#e5e7eb", marginTop: 20, textAlign: "center" }}>
          {t("haveAccount")} <Link to="/login" state={location.state} className="link-plain" style={{ color: "#fff", fontWeight: 600 }}>{t("login")}</Link>
          {" · "}
          <Link to="/about" className="link-plain" style={{ color: "#fff", fontWeight: 600 }}>{t("about")}</Link>
        </p>
      </div>
    </div>
  );
}
