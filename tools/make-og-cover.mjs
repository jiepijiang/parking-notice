/**
 * tools/make-og-cover.mjs —— 生成分享卡片图（og:image）
 * ---------------------------------------------------------------------------
 * 为什么需要它：本站**没有任何位图素材** —— favicon 是 SVG，而 `og:image`
 * **不支持 SVG**（分享平台的抓取方只认 png / jpg / webp）。所以封面得自己产。
 *
 * 为什么不直接截页面：页面在 1200×630 下会被裁断（内容比一屏长），
 * 截出来是半张卡。这里按站点自己的视觉语言（深底 + 米白票根 + 黄票头）
 * 画一张**构图完整**的封面。
 *
 * 用法：
 *   node tools/make-og-cover.mjs
 *   node tools/make-og-cover.mjs --url=https://example.com/parking/   # 换域名
 *
 * 产物：public/og-cover.jpg（1200×630，跟着仓库走，构建时拷进 dist）
 * 改完仓库名 / 域名记得重跑 —— 封面里印着二维码，指着老地址就白搭了。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { homedir } from 'node:os'
import QRCode from 'qrcode'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const OUT_FILE = path.join(ROOT, 'public/og-cover.jpg')

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

/** 从 vite.config.ts 抠出 REPO_NAME —— 和 make-qr-card.mjs 同一套做法 */
function resolveUrl() {
  const explicit = arg('url')
  if (explicit) return explicit.endsWith('/') ? explicit : explicit + '/'
  const cfg = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8')
  const m = cfg.match(/REPO_NAME\s*=\s*['"]([^'"]+)['"]/)
  if (!m) throw new Error('vite.config.ts 里没找到 REPO_NAME，请用 --url= 显式指定')
  const owner = process.env.GH_OWNER || 'jiepijiang'
  return `https://${owner}.github.io/${m[1]}/`
}

const SITE_URL = resolveUrl()

/** playwright 的统一解析 —— 别写死绝对路径（换台机器就 ERR_MODULE_NOT_FOUND） */
async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_PATH,
    path.join(ROOT, 'node_modules/playwright-core/index.js'),
    path.join(homedir(), 'node_modules/playwright-core/index.js'),
    path.join(homedir(), 'node_modules/playwright/index.js'),
  ].filter(Boolean)
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue
    const m = await import(pathToFileURL(c).href)
    return m.default ?? m
  }
  throw new Error(
    `找不到 playwright，试过：\n${candidates.map((c) => '  ' + c).join('\n')}\n` +
      `装一个：npm i --no-save playwright-core`,
  )
}

/* ------------------------------------------------------------------ */
/* 二维码                                                              */
/* ------------------------------------------------------------------ */

const qrSvg = await QRCode.toString(SITE_URL, {
  type: 'svg',
  margin: 0,
  errorCorrectionLevel: 'M',
  color: { dark: '#171916', light: '#ffffff' },
})

/* ------------------------------------------------------------------ */
/* 封面 HTML —— 站点配色取自 src/styles/ticket.css                     */
/* ------------------------------------------------------------------ */

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    background: #202321;
    font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
    display: flex; align-items: center; justify-content: center;
    -webkit-font-smoothing: antialiased;
  }
  .ticket {
    width: 1020px; height: 486px;
    background: #fffdf4;
    border-radius: 20px;
    overflow: hidden;
    display: flex; flex-direction: column;
  }
  .head {
    background: #f1c84b;
    height: 104px;
    padding: 0 44px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .brand { display: flex; align-items: center; gap: 18px; }
  .mark {
    width: 60px; height: 60px; border-radius: 50%;
    background: #171916; color: #fffdf4;
    display: flex; align-items: center; justify-content: center;
    font-size: 36px; font-weight: 900; line-height: 1;
  }
  .brand-en { color: #171916; font-size: 21px; font-weight: 800; letter-spacing: 2px; line-height: 1.25; }
  .stub { text-align: right; color: #171916; }
  .stub b { display: block; font-size: 21px; font-weight: 800; letter-spacing: 1px; }
  .stub span { display: block; font-size: 13px; font-weight: 600; letter-spacing: 3px; margin-top: 6px; opacity: .72; }
  .body {
    flex: 1; display: flex; align-items: center;
    padding: 0 44px; gap: 40px;
  }
  .text { flex: 1; }
  .kicker {
    display: inline-block; background: #f1c84b; color: #171916;
    font-size: 15px; font-weight: 700; letter-spacing: 2px;
    padding: 5px 12px; border-radius: 6px; margin-bottom: 20px;
  }
  h1 { font-size: 62px; font-weight: 900; color: #171916; letter-spacing: 1px; line-height: 1.12; }
  .sub { margin-top: 20px; font-size: 21px; color: #686b63; line-height: 1.65; }
  .qr { text-align: center; flex-shrink: 0; }
  .qr-box {
    width: 190px; height: 190px; background: #fff; border: 1px solid #d6d0ba;
    border-radius: 14px; padding: 12px;
  }
  .qr-box svg { width: 100%; height: 100%; display: block; }
  .qr-cap { margin-top: 14px; font-size: 15px; font-weight: 700; color: #171916; letter-spacing: 1px; }
  .qr-cap small { display: block; margin-top: 5px; font-size: 12px; font-weight: 400; color: #686b63; letter-spacing: 0; }
</style>
</head>
<body>
  <div class="ticket">
    <div class="head">
      <div class="brand">
        <div class="mark">P</div>
        <div class="brand-en">PARKING<br>NOTICE</div>
      </div>
      <div class="stub">
        <b>临时停车凭证</b>
        <span>NO. MOVE-CAR</span>
      </div>
    </div>
    <div class="body">
      <div class="text">
        <div class="kicker">车辆临时停放</div>
        <h1>临时停车<br>请联系我</h1>
        <div class="sub">给您带来不便，可匿名通知或留下联系方式，<br>我会尽快回来处理。</div>
      </div>
      <div class="qr">
        <div class="qr-box">${qrSvg}</div>
        <div class="qr-cap">扫码通知车主<small>不用注册 · 不显示你的号码</small></div>
      </div>
    </div>
  </div>
</body>
</html>`

/* ------------------------------------------------------------------ */
/* 渲染                                                                */
/* ------------------------------------------------------------------ */

const pw = await loadPlaywright()
const browser = await pw.chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
})
await page.setContent(html, { waitUntil: 'load' })
await page.screenshot({ path: OUT_FILE, type: 'jpeg', quality: 90 })
await browser.close()

const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(0)
console.log(`✅ 已生成 ${path.relative(ROOT, OUT_FILE)}（1200×630，${kb}KB）`)
console.log(`   二维码指向：${SITE_URL}`)
