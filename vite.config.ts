import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import basicSsl from "@vitejs/plugin-basic-ssl"; // <--- Добавляем импорт

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(), 
    //viteSingleFile(), 
    basicSsl() // <--- Добавляем плагин в список
  ],
  server: {
    https: true, // <--- Принудительно включаем режим HTTPS
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});