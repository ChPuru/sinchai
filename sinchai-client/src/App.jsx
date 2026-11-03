import { Routes, Route } from "react-router-dom";
import RequireAuth from "./routes/RequireAuth";
import RequireRole from "./routes/RequireRole";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import About from "./pages/About";
import MyPlots from "./pages/MyPlots";
import PlotDetail from "./pages/PlotDetail";
import AddPlot from "./pages/AddPlot";
import History from "./pages/History";
import NotFound from "./pages/NotFound";

// Exp 3.3 - the whole route table of SinchAI lives here; App holds no state and fetches nothing any more.
// <Routes> scores every child <Route> against the current URL and renders only the single best match.
// "/login", "/register" and "/about" are public; everything else sits inside the RequireAuth layout route.
// The parent path="/" Route renders <Layout />, whose <Outlet /> is the hole the matched child page drops into,
// and its `index` child is what shows at "/" itself.
// "plots/:plotId" is a dynamic segment - PlotDetail reads the value with useParams().
// "*" is the wildcard: any URL that matches nothing above falls through to the 404 page.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/about" element={<About />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="plots" element={<MyPlots />} />
          <Route path="plots/:plotId" element={<PlotDetail />} />
          <Route element={<RequireRole role="farmer" />}>
            <Route path="add-plot" element={<AddPlot />} />
          </Route>
          <Route path="history" element={<History />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
