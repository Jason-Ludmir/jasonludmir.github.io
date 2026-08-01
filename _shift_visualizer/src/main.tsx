import React from "react";
import { createRoot } from "react-dom/client";

import PresentPage from "./PresentPage";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Presentation root element was not found.");
}

createRoot(root).render(
  <React.StrictMode>
    <PresentPage />
  </React.StrictMode>,
);
