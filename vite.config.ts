import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 仓库名。部署到 GitHub Pages 时线上地址是 https://<user>.github.io/<REPO_NAME>/
 * —— 改仓库名只需要动这一个常量。
 */
const REPO_NAME = 'parking-notice'

/**
 * Pages 的 SPA 回退：把 index.html 复制一份成 404.html。
 *
 * GitHub Pages 对不存在的路径会返回 404.html，但**状态码仍是 404**。
 * 这个项目是单页无路由的，理论上用不到；留着是为了以后加路由不会白屏。
 */
function spaFallback() {
  return {
    name: 'spa-fallback',
    closeBundle() {
      const out = path.resolve(__dirname, 'dist')
      const src = path.join(out, 'index.html')
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(out, '404.html'))
    },
  }
}

export default defineConfig(({ command }) => ({
  // dev 走根路径，build 走仓库子路径
  base: command === 'build' ? `/${REPO_NAME}/` : '/',
  plugins: [react(), spaFallback()],
  server: {
    host: '127.0.0.1',
    port: 5175,
  },
  build: {
    outDir: 'dist',
    // 票券是纯 CSS，产物很小；不开 sourcemap 让仓库干净些
    sourcemap: false,
  },
}))
