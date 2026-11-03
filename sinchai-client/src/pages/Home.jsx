import { useApp } from "../context/AppContext";
import Dashboard from "./Dashboard";
import SupervisorDashboard from "./SupervisorDashboard";

// Exp 3.3 - index route: rendered when the parent path "/" matches exactly, i.e. the user is
// on the layout route but has not gone into any child segment like /plots or /history.
// Exp 3.1 - conditional rendering: this is the role-based dashboard split from the problem
// statement - one URL ("/"), two completely different screens chosen from the logged-in role.
export default function Home() {
  const { user } = useApp();
  return user?.role === "supervisor" ? <SupervisorDashboard /> : <Dashboard />;
}
