/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Sous-dossier d'hébergement (ex. « npm run build -- --base=/citoyen2027/ ») : par défaut à la racine.
  base: "/",
  // Fichiers servis tels quels (photos des candidats) : dossier « static/ ».
  publicDir: "static",
  test: {
    environment: "node",
  },
});
