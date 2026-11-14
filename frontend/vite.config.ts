import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app calls the Python API (mariadb/server) directly; see src/services/articleService.ts.
export default defineConfig({
  plugins: [react()],
});
