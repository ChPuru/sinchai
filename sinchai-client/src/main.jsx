import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { AppProvider } from "./context/AppContext.jsx";
import { DataProvider } from "./context/DataContext.jsx";

// Exp 1 / 3.1 : entry point - createRoot mounts <App/> into #root
// Exp 3.3 - BrowserRouter uses the HTML5 History API, so back/forward/bookmarks work with no reload.
// Providers sit inside the router so every route can read the user, the language and the plot data.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <DataProvider>
          <App />
        </DataProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);
