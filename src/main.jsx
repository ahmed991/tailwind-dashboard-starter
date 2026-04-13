import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import { FarmProvider } from "./context/FarmContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <FarmProvider>
        <App />
      </FarmProvider>
    </AuthProvider>
  </React.StrictMode>
);
