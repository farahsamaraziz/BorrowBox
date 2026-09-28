import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  plugins: [react()],
  test: { include: ['tests/**/*.test.jsx'], environment: 'jsdom', environmentOptions: { jsdom: { url: 'http://localhost:5173/' } }, testTimeout: 60000, hookTimeout: 60000 },
});
