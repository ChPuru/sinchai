import { Navigate, Outlet } from "react-router-dom";
import { useApp } from "../context/AppContext";

// Exp 3.3 - role guard, again a layout route with no UI of its own.
// A field supervisor owns no plots, so /add-plot is farmer-only and anyone else lands back on "/".
export default function RequireRole({ role }) {
  const { user } = useApp();
  if (user?.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}
