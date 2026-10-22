import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages 项目站点路径
export default defineConfig({
  base: '/tianditu-coordinate-picker/',
  plugins: [vue()],
  server: {
    port: 3000,
    open: true
  }
})
