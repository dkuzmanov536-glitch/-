import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: '/-/' защото сайтът се хоства на GitHub Pages под името на репото (`-`).
export default defineConfig({
  base: '/-/',
  plugins: [react()],
})
