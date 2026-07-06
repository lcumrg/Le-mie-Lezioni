import { defineConfig } from 'vitest/config'

// Config separata da vite.config.js: i test della logica pura non hanno
// bisogno dei plugin React/Tailwind né del DOM.
export default defineConfig({
  test: {
    environment: 'node',
  },
})
