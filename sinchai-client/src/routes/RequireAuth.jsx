import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";

// Exp 3.3 - a layout route with no UI of its own: it either redirects or renders <Outlet />.
// Logged out farmers are bounced to /login, and the page they asked for travels along in
// location.state.from so the login screen can send them straight back after signing in.
export default function RequireAuth() {
  const { user } = useApp();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
