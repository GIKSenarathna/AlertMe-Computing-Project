import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // Error if port is taken (don't silently jump to 5175 which breaks Firebase auth)
    fs: {
      strict: false,
    },
  },
})
