import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { STRINGS } from "../data/i18n";
import { api, SESSION_KEY } from "../api/client";

// Exp 3.2 - useContext: logged-in user + language shared with every screen (no prop drilling)
const AppContext = createContext(null);

// Exp 3.3 - BrowserRouter promises that refreshing and bookmarking a URL keep working. React state alone
// is wiped by a reload, so a farmer who refreshed /plots would be thrown back to /login. Keeping the
// session in localStorage is what makes a deep link to a protected route actually usable.
// Exp 5 - the session is now { user, token }: the token is the JWT issued by POST /api/auth/login, and
// api/client.js sends it with every request. The server re-checks it each time, so a stale one just logs you out.
function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    return s && s.token && s.user && s.user.id ? s : null; // an old pre-backend session has no token: start logged out
  } catch {
    return null; // private mode / disabled storage - just start logged out
  }
}

// The language is stored only when someone CHOOSES one (setLang below), so "a value is stored" means "this device
// has an explicit choice". Without one, the language saved on the account is used after login.
const LANG_KEY = "sinchai.lang";
function readLang() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    return STRINGS[stored] ? stored : null;
  } catch {
    return null;
  }
}

export function AppProvider({ children }) {
  // lazy initialiser: the function runs only on the first render, not on every one
  const [session, setSession] = useState(readSession); // { user: { id, name, role, ... }, token }
  const [lang, setLangState] = useState(() => readLang() ?? "en");
  const pickedLang = useRef(readLang() !== null); // true once the person has chosen a language on this device
  const user = session?.user ?? null;

  // Exp 3.2 - useEffect keeps the browser copy in step with the state after every login/logout
  useEffect(() => {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage unavailable - the app still works for this tab */
    }
  }, [session]);

  // Exp 5 - the API answered 401 for our saved token (expired / account removed): drop the session
  useEffect(() => {
    const onUnauthorized = () => setSession(null);
    window.addEventListener("sinchai:unauthorized", onUnauthorized);
    return () => window.removeEventListener("sinchai:unauthorized", onUnauthorized);
  }, []);

  // Exp 5 - Login / Register post to the API and pass the reply ({ token, user }) here
  const login = useCallback(({ token, user: account }) => {
    // the language saved on the account follows the person to a new device, unless they just chose one here
    if (!pickedLang.current && account.language) setLangState(account.language);
    setSession({ token, user: account });
  }, []);
  const logout = useCallback(() => setSession(null), []);

  // changing the language also saves it on the account, so the next device starts in the same language
  const setLang = useCallback(
    (next) => {
      pickedLang.current = true;
      setLangState(next);
      try {
        localStorage.setItem(LANG_KEY, next); // remembered on this device, even after logout
      } catch {
        /* storage unavailable - the choice lasts until the tab is closed */
      }
      if (session) {
        api.patch("/users/me", { language: next }).catch(() => {}); // a failed save must not break the UI
        setSession((s) => (s ? { ...s, user: { ...s.user, language: next } } : s));
      }
    },
    [session]
  );

  const t = useCallback((key) => STRINGS[lang][key] ?? STRINGS.en[key] ?? key, [lang]);
  return (
    <AppContext.Provider value={{ user, login, logout, lang, setLang, t }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
