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

  /**
   * 构建期把飞书 Webhook 打进产物 —— **这是 Webhook 的正式来源**。
   *
   * 为什么必须构建期注入：
   *   · 放 `public/parking-config.json` → 那个文件是入库的，仓库 public，
   *     Webhook 会进 git 历史、被代码搜索和搜索引擎索引到，等于把钥匙挂网上；
   *   · 放 localStorage → **按设备隔离**。在电脑上配好、手机扫码打开，
   *     手机那份是空的，页面掉进演示模式，车主什么都收不到。
   *   纯静态站点没有服务端，所以「藏」是藏不住的；这里的目标是**不进仓库**，
   *   同时保证每个访客的浏览器都拿得到。
   *
   * 值来自 GitHub Actions Secret（见 .github/workflows/deploy.yml）。
   * 本地不设这两个环境变量就是空串 → 页面走演示模式，这是安全的默认值。
   *
   * 注意：Vite 的 define 是**文本替换**，所以必须 JSON.stringify 包一层。
   */
  define: {
    __FEISHU_WEBHOOK__: JSON.stringify(process.env.FEISHU_WEBHOOK?.trim() ?? ''),
    __FEISHU_SECRET__: JSON.stringify(process.env.FEISHU_SECRET?.trim() ?? ''),
    __FEISHU_MESSAGE_TYPE__: JSON.stringify(process.env.FEISHU_MESSAGE_TYPE?.trim() ?? ''),
  },

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
