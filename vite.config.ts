import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  // ЗАМЕНИТЕ 'название-вашего-репозитория' на реальное имя вашего проекта на GitHub
  // Например, если ссылка https://github.com/sotrymore/my-game, то base: '/my-game/'
  base: '/', 
  
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
