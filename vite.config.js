import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 源码打包路径前缀为 /pickCoordinates/
export default defineConfig({
  base: '/pickCoordinates/',
  plugins: [vue()],
  server: {
    port: 3000,
    open: true
  }
})
