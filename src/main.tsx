import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "./index.css";
import { dbReady } from "@/db/client";
import { UpdateToast } from "@/src/components/UpdateToast";
import { router } from "./router";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

// Show loading indicator immediately, before dbReady resolves
rootEl.innerHTML =
  '<div style="display:flex;min-height:100vh;align-items:center;justify-content:center;font-family:sans-serif;color:#6b7280;">Cargando…</div>';

dbReady
  .then(() => {
    rootEl.innerHTML = "";
    createRoot(rootEl).render(
      <StrictMode>
        <RouterProvider router={router} />
        <UpdateToast />
      </StrictMode>
    );
  })
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    rootEl.innerHTML = `<div style="display:flex;flex-direction:column;min-height:100vh;align-items:center;justify-content:center;font-family:sans-serif;padding:24px;text-align:center;"><p style="color:#dc2626;font-weight:bold;margin-bottom:8px;">Error al inicializar el almacenamiento</p><p style="color:#ef4444;font-size:0.875rem;">${msg}</p></div>`;
  });
