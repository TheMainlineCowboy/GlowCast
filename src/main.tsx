import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../styles.css";
import "./animation-upgrades.css";
import "./shape-guides.css";
import "./effect-controls";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
