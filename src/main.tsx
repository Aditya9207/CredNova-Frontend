import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "./styles/wirely.css";
import { ClerkWithRouter } from "./ClerkRouter";

const clerkKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  "pk_test_ZGFybGluZy1wb3NzdW0tMTQuY2xlcmsuYWNjb3VudHMuZGV2JA";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ClerkWithRouter publishableKey={clerkKey}>
        <App />
      </ClerkWithRouter>
    </BrowserRouter>
  </React.StrictMode>
);
