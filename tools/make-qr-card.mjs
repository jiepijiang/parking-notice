/**
 * 生成贴车物料：矢量二维码 + 高清 PNG + 可打印提示卡（A4 一版 4 张，95×130mm）。
 *
 * 为什么要有提示卡：光贴一张二维码，路人不知道那是干嘛的、也不知道扫了会发生什么。
 * 卡上把「扫了做什么」「会不会泄露信息」写清楚，转化率完全不一样。
 *
 * 用法：
 *   npm run qr                       # 地址从 vite.config.ts 的 REPO_NAME 推导
 *   npm run qr -- --url=https://example.com/parking/   # 换自定义域名
 *   npm run qr -- --out=~/Desktop/车上物料              # 换输出目录
 *
 * 产物默认落在 tools/out/（已 gitignore）。改完仓库名记得重跑，
 * 否则车上那张卡还指着老地址。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

/** 从 vite.config.ts 抠出 REPO_NAME，保证二维码和实际部署地址永远一致 */
function resolveUrl() {
  const explicit = arg('url')
  if (explicit) return explicit.endsWith('/') ? explicit : explicit + '/'
  const cfg = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8')
  const m = cfg.match(/REPO_NAME\s*=\s*['"]([^'"]+)['"]/)
  if (!m) throw new Error('vite.config.ts 里没找到 REPO_NAME，请用 --url= 显式指定地址')
  // 从 package.json 的 repository 字段或 git remote 拿用户名太绕，直接读环境变量兜底
  const owner = process.env.GH_OWNER || 'jiepijiang'
  return `https://${owner}.github.io/${m[1]}/`
}

const URL_TO_QR = resolveUrl()
const OUT = path.resolve(
  (arg('out') ?? path.join(HERE, 'out')).replace(/^~/, process.env.HOME),
)
fs.mkdirSync(OUT, { recursive: true })

const INK = '#171916'
const TICKET = '#fffdf4'
const YELLOW = '#f1c84b'
const MUTED = '#686b63'
const LINE = '#d6d0ba'

const OPTS = {
  errorCorrectionLevel: 'M', // 贴车上会沾灰、被晒，M 够用；H 会让码更密、更难扫
  margin: 2, // 静区，别设 0 —— 没有静区很多扫码器识别不了
  // light 用纯白而不是票券的 #fffdf4：卡上二维码有个白色承托框（.qr-box），
  // 两个白差一点点会在框里显出一块方形的色差，看着像印歪了
  color: { dark: INK, light: '#ffffff' },
}

// ---- 1) 矢量 SVG（打印用，放大不糊）----
const svg = await QRCode.toString(URL_TO_QR, { ...OPTS, type: 'svg', width: 1024 })
fs.writeFileSync(path.join(OUT, 'qr.svg'), svg)

// ---- 2) 高清 PNG（贴进 Word / 微信 / 打印软件）----
await QRCode.toFile(path.join(OUT, 'qr.png'), URL_TO_QR, { ...OPTS, type: 'png', width: 2048 })

// ---- 3) 可打印提示卡 ----
const svgInline = svg.replace(/<\?xml[^>]*\?>/, '').replace('<svg ', '<svg class="qr" ')

const card = `
  <div class="card">
    <div class="card-head">
      <div class="brand">
        <span class="mark">P</span>
        <span class="brand-copy">PARKING<br />NOTICE</span>
      </div>
      <span class="meta">临时停车凭证</span>
    </div>
    <div class="card-body">
      <div class="qr-box">${svgInline}</div>
      <h1>临时停车，请联系我</h1>
      <p class="lede">扫码即可<strong>匿名</strong>通知车主挪车</p>
      <p class="hint">不需要装 App，不需要注册<br />不会看到车主手机号</p>
    </div>
    <div class="card-foot">
      <span class="dot"></span>
      <span>扫码后选一个原因即可，也可留联系方式</span>
    </div>
  </div>`

const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<title>挪车提示卡 · 打印</title>
<style>
  :root{
    --ticket:${TICKET}; --ticket-deep:#f8f1d9;
    --parking-yellow:${YELLOW}; --ink:${INK}; --muted:${MUTED}; --line:${LINE};
  }
  *{box-sizing:border-box}
  body{
    margin:0; background:#e9e9e6; padding:24px 0;
    font-family:"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }
  .sheet{
    width:210mm; height:297mm; margin:0 auto; background:#fff;
    /* A4 可印区（8mm 页边距）= 194×281mm。2×2 摆 95×130 的卡片正好占 190×260mm，
       居中后左右各 2mm、上下各 10.5mm。gap:0 让相邻卡共边，裁的时候一刀两用。
       屏幕上就按这个尺寸排，做到所见即所得 */
    padding:8mm; display:grid; grid-template-columns:repeat(2,95mm);
    grid-auto-rows:130mm; gap:0; justify-content:center; align-content:center;
  }
  /* 卡片：95×130mm，贴前挡风玻璃内侧够醒目，又不会挡住视线 */
  .card{
    width:95mm; height:130mm; background:var(--ticket);
    border:0.6mm solid var(--ink); border-radius:1.5mm; overflow:hidden;
    display:flex; flex-direction:column; position:relative;
  }
  /* 裁切标记 */
  .card::before,.card::after{
    content:''; position:absolute; width:5mm; height:5mm; pointer-events:none;
  }
  .card::before{top:0;left:0;border-top:.3mm dashed #999;border-left:.3mm dashed #999}
  .card::after{bottom:0;right:0;border-bottom:.3mm dashed #999;border-right:.3mm dashed #999}

  .card-head{
    background:var(--parking-yellow); border-bottom:0.8mm solid var(--ink);
    display:flex; align-items:center; justify-content:space-between;
    padding:3.5mm 4mm;
  }
  .brand{display:flex; align-items:center; gap:2.5mm}
  .mark{
    width:10mm; height:10mm; border-radius:50%; background:var(--ink); color:var(--ticket);
    display:grid; place-items:center; font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif;
    font-size:6mm; line-height:1;
  }
  .brand-copy{
    font-family:"Arial Narrow","Segoe UI",sans-serif; font-weight:900; font-size:2.4mm;
    letter-spacing:.13em; line-height:.95;
  }
  .meta{
    font-family:Consolas,"Courier New",monospace; font-weight:700; font-size:2.2mm;
    letter-spacing:.04em; text-transform:uppercase;
  }

  .card-body{
    flex:1; display:flex; flex-direction:column; align-items:center;
    justify-content:center; padding:5mm 6mm; text-align:center; gap:3mm;
  }
  .qr-box{
    width:48mm; height:48mm; padding:2mm; background:#fff;
    border:0.4mm solid var(--line); border-radius:1mm;
  }
  .qr{width:100%; height:100%; display:block}
  h1{
    font-size:6.2mm; line-height:1.05; margin:0; letter-spacing:-.03em;
    font-family:"Arial Narrow","Microsoft YaHei",sans-serif; font-weight:900; font-stretch:75%;
  }
  .lede{margin:0; font-size:3.4mm; color:var(--ink); line-height:1.4}
  .lede strong{background:var(--parking-yellow); padding:0 1mm; border-radius:.6mm}
  .hint{margin:0; font-size:2.7mm; color:var(--muted); line-height:1.6}

  .card-foot{
    background:var(--ticket-deep); border-top:0.3mm solid var(--line);
    display:flex; align-items:center; gap:2mm; padding:2.8mm 4mm;
    font-family:Consolas,"Courier New",monospace; font-size:2.1mm; color:var(--muted);
  }
  .dot{width:2mm; height:2mm; border-radius:50%; background:#17643b; flex:none}

  .tip{
    width:210mm; margin:0 auto; color:#666; font-size:12px; line-height:1.9; padding:0 16mm;
  }
  .tip code{background:#0000000d; padding:1px 5px; border-radius:3px; font-size:11px}

  @media print{
    body{background:#fff; padding:0}
    /* 纸边距交给 @page，这里不再留 padding，否则会叠成 16mm */
    .sheet{width:auto; height:auto; padding:0; background:transparent}
    .tip{display:none}
  }
  @page{size:A4; margin:8mm}
</style>
</head>
<body>
  <div class="sheet">
    ${card.repeat(4)}
  </div>
  <p class="tip">
    <strong>打印说明：</strong>纸张选 A4，缩放保持 <strong>100%（不要选「适合页面」）</strong>，
    否则卡片尺寸会跑掉。一版 4 张，沿虚线裁开，一张贴前挡风玻璃内侧（避开驾驶员视线区），
    其余备用或送人。建议用哑光相纸或覆膜 —— 光面纸在阳光下会反光，扫码器容易读不到。<br>
    卡片尺寸 95 × 130 mm，二维码 48 × 48 mm。二维码指向
    <code>${URL_TO_QR}</code>，改了这个地址要重新生成。
  </p>
</body>
</html>
`

fs.writeFileSync(path.join(OUT, '挪车提示卡.html'), html)

console.log('已生成到', OUT)
for (const f of fs.readdirSync(OUT).sort()) {
  console.log('  ', f.padEnd(22), (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1) + ' KB')
}
console.log('\n二维码指向：', URL_TO_QR)
console.log('打印：浏览器打开 挪车提示卡.html → Cmd+P → A4 / 缩放 100%')
