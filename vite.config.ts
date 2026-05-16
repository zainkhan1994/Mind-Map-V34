import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/Mind-Map-V34/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react-konva') || id.includes('/konva/')) {
            return 'mindmap-canvas'
          }
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
            return 'react-vendor'
          }
          return undefined
        }
      }
    }
  },
  server: {
    port: 5173,
    open: true
  }
})
