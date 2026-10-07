/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pyodide loads its own files at runtime; pre-bundling it makes Vite reload
  // the page on the first Python run, which kills the worker.
  optimizeDeps: { exclude: ['pyodide'] },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
