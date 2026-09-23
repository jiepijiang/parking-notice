# parking-notice · 临时停车挪车通知

扫码打开的一张「停车票」，匿名通知车主回来挪车。

视觉与交互 **1:1 复刻**自飞书妙搭应用 `app_17cw6j1xyk0`，但**完全不依赖妙搭**：
纯静态站点，直接部署在 GitHub Pages 上，通知走飞书群自定义机器人 Webhook，
浏览器直连飞书，不需要任何后端。

- 线上：<https://jiepijiang.github.io/parking-notice/>
- 配置页：<https://jiepijiang.github.io/parking-notice/?setup=1>

---

## 它是什么

车主把二维码贴在车上。路人扫码 → 选一个原因（挡住车辆 / 挡住出入口 / 临时占位 /
其他紧急情况）→ 可留联系方式也可不留 → 点「通知车主挪车」。

车主的飞书群里立刻收到一条卡片消息，知道是什么情况、要不要下来。

**不需要装 App、不需要注册、不会看到车主手机号。**

---

## 快速开始

```bash
npm install
npm run dev          # http://127.0.0.1:5175
npm run build        # tsc --noEmit && vite build → dist/
npm run preview      # 本地预览构建产物
```

技术栈：Vite 6 + React 18 + TypeScript，无 UI 框架、无 CSS 预处理器、
**无动效库**（React Bits 组件是按源码搬进来的，见下）。

产物很小：

| 文件 | 原始 | gzip |
| --- | --- | --- |
| JS | 164.9 kB | **54.3 kB** |
| CSS | 13.1 kB | **3.5 kB** |

---

## 接飞书（一条命令 + 一个 Secret）

### 唯一推荐的做法：构建期注入

Webhook 存进 GitHub Actions Secret，CI 构建时打进 JS 产物。
**每个访客的浏览器都会拿到它 —— 所以任何人扫码都能通知到你。**

```bash
gh secret set FEISHU_WEBHOOK --repo <你>/<仓库>   # 粘贴 Webhook 后回车
gh secret set FEISHU_SECRET  --repo <你>/<仓库>   # 只有开了「签名校验」才需要
```

设完 **Actions 会自动重跑一次部署吗？不会** —— 加 Secret 不触发工作流，
去 Actions 页点一次 **Run workflow**（或随便推一个 commit）。

验证方式：Actions 的构建日志里会打印

```
✅ 已注入 Webhook：http****abcd（长度 63）
✅ 产物里已包含 Webhook（尾段 token 命中）
```

没配的话会是一条 **warning 注解**：`未注入飞书 Webhook::页面会走演示模式`。
（日志只打印脱敏后的地址和长度，**绝不回显明文**。）

> **为什么必须构建期注入 —— 这里踩过一个很贵的坑。**
> 最初的实现把 Webhook 存在浏览器 `localStorage` 里。`localStorage` 是
> **按设备隔离**的：在电脑上配好，用手机扫码打开，手机那份是空的。
> 于是页面掉进「演示模式」，而当时的演示模式**返回的是成功** ——
> 界面上原样显示「已匿名通知车主，请在安全位置耐心等候。」，
> 车主那边一条消息都没有，**从页面上完全看不出问题**。
> 纯静态站点没有服务端，配置要发给浏览器就藏不住；这里能做的、
> 也是必须做的，是让它**不进仓库**（不进 git 历史、不被代码搜索和索引到），
> 同时保证每个访客都拿得到。

### 验证通没通

打开 `<站点地址>?setup=1`，这是一页**接收诊断**：

- 显示当前生效的接收方（**脱敏**成 `…/hook/FAKE****abcd`）和它的**来源**
- 「发一条测试消息」用的是**当前生效配置**，等价于此刻有人扫码提交 ——
  **想验证手机能不能发出去，就用手机打开这一页点一下**
- 失败时**原样显示飞书返回的原因**（比如 `param invalid: incoming webhook access token invalid`），
  同时写进浏览器控制台。访客那边看到的仍是原站那两句通用文案（他也没法处理具体原因）

### 怎么拿 Webhook

飞书群 → 右上角设置 → 群机器人 → 添加机器人 → **自定义机器人** → 复制 Webhook 地址。

如果开启了「签名校验」，密钥也要设成 `FEISHU_SECRET`。
签名在**浏览器里现算**（`crypto.subtle` 的 HMAC-SHA256），不经过任何第三方，
算法与飞书官方 Python 示例逐字节一致（`base64(HMAC-SHA256(key = "{timestamp}\n{secret}", msg = ""))`）。

### 本机临时覆盖（调试用，别用来正式配置）

诊断页底部折叠着一个「本机临时覆盖」，写进这台设备的 `localStorage`。
**它不会随页面发给别人** —— 在这里填完，别人的手机照样收不到。
留着只是为了本机换个地址试东西，不用重新部署。

### 最后一步：把二维码贴在车上

```bash
npm run qr        # 生成到 tools/out/（已 gitignore）
```

产出三样：`qr.svg`（矢量，打印不糊）、`qr.png`（2048²，贴进 Word / 微信）、
`挪车提示卡.html`（**A4 一版 4 张，卡片 95×130mm，二维码 48×48mm**）。
浏览器打开那个 HTML → `Cmd/Ctrl + P` → 纸张 A4、缩放 **100%**（别选「适合页面」）→ 打印。

地址不是写死的，脚本从 `vite.config.ts` 的 `REPO_NAME` 推导，
**改仓库名之后记得重跑 `npm run qr`**，否则车上那张卡还指着老地址。
换自定义域名：`npm run qr -- --url=https://your.domain/parking/`。

**为什么是提示卡而不是光一张二维码**：路人看到一张孤零零的码，不知道那是什么、
扫了会发生什么，多半就不扫了。卡上把「扫码即可匿名通知车主挪车」「不需要装 App、
不需要注册」「不会看到车主手机号」三句写清楚，扫码意愿完全不一样。
建议用**哑光**相纸或覆膜 —— 光面纸在阳光下反光，扫码器容易读不到。

> 生成后建议真机扫一次再打印。这个项目的二维码做过反向验证：
> 把生成的 PNG 缩放到 2048 / 1024 / 512 / 246 / 123px 五档都能解出正确 URL，
> 最终 PDF 里 4 张卡的码也都能解 —— 打印出来一定能扫。

### 另一种（不推荐）：写进 `public/parking-config.json`

**⚠️ 本仓库是 public。** Webhook 地址 = 「往这个群发消息」的钥匙，
提交上去等于公开挂网上。真要走这条路，至少：
在机器人设置里加上**自定义关键词**（比如「挪车」），并接受被刷群的风险。

---

## 配置优先级

四层，后者盖前者：

| 层 | 来源 | 放什么 | 谁会看到 |
| --- | --- | --- | --- |
| 1 | `src/config.ts` 的 `DEFAULTS` | 代码兜底 | — |
| 2 | `public/parking-config.json` | 文案（随仓库） | 所有人 |
| 3 | **构建期注入**（`vite.config.ts` 的 `define`） | **Webhook / 密钥** | 所有人（但不进仓库） |
| 4 | `localStorage` | 本机调试 | 只有这台设备 |

- 第 3 层的值来自 `FEISHU_WEBHOOK` / `FEISHU_SECRET` / `FEISHU_MESSAGE_TYPE`
  三个环境变量，CI 从 Actions Secret 取。**本地不设就是空串**，
  页面走演示模式 —— 这是安全的默认值，不会误发。
- 空串一律**不覆盖**下层。所以把诊断页的输入框清空再保存，
  不会把第 3 层那份盖成空（这个坑在设计时就堵住了）。
- `loadConfig()` 只认识 `DEFAULTS` 里出现过的键（`pick()`），
  JSON 里写错键名不会静默吃掉整份配置，只会被忽略。
- `webhookSource()` 会告诉诊断页当前生效值来自哪一层。

> **⚠️ 别把 Webhook 放进第 2 层。** 那个文件是入库的，仓库 public，
> 等于把钥匙公开挂在网上（连 git 历史里都有，删了也还在）。
> 第 3 层是唯一既能让访客拿到、又不进仓库的位置。

---

## React Bits 用在哪

[React Bits](https://www.reactbits.dev/) 是「源码进你仓库」的模式（不是 npm 依赖），
所以 `src/components/reactbits/` 里是**可以直接读、直接改**的组件源码，
上游 commit 记录在 `docs/reactbits-upstream/UPSTREAM-REV.txt`。

上游 206 个组件里只有 44 个**零外部依赖**。本项目只用零依赖的那批，
因为这是个扫码打开的移动端 H5，为动效背 GSAP(≈23 kB gzip) 或 motion(≈13 kB gzip) 不划算。

| 组件 | 用在哪 | 改动 |
| --- | --- | --- |
| `ClickSpark` | 全站点击火花（黄色 8 条射线） | **原版逐字**，未改一行 |
| `StarBorder` | 主按钮上下边缘扫过的流光 | 原版源码未改，样式在 `effects.css` 覆写 |
| `AnimatedContent` | 票券入场（下方淡入 + 0.985 → 1 放大） | **去掉 gsap + ScrollTrigger**，换成 CSS transition + IntersectionObserver，props 完全一致 |

关于 `AnimatedContent` 的移植：原版用 `gsap.timeline()` 补间、`ScrollTrigger` 触发。
本页内容约 1000px、基本不滚动，ScrollTrigger 是纯浪费；为此加 34 kB gzip 不值。
移植版把 gsap 缓动名映射成等价 cubic-bezier（`power3.out` → `cubic-bezier(.165,.84,.44,1)`），
对外 API 一个没变。想换回去：把 `docs/reactbits-upstream/AnimatedContent.tsx`
覆盖 `src/components/reactbits/AnimatedContent.tsx`，`npm i gsap`，调用方一行都不用动。

### 动效尺度：克制点缀

静态视觉**一个像素都没动**（见下节验证）。动效只加在三处：
入场、按钮流光、点击火花。都遵守 `prefers-reduced-motion`。

`src/styles/effects.css` 是「适配层」：用双类选择器（`.star-border-container.pb-star-border`）
提权覆写，而不是去改 `src/components/reactbits/` 里的原版源码 —— 原版保持可对照、可升级。

里面有两个不那么显然的坑，都写在注释里了：
- `ClickSpark` 的 `sparkColor` **必须传字面量颜色**：canvas 的 `strokeStyle` 不认 CSS 变量，写 `var(--parking-yellow)` 不报错、只是什么都不画。
- `AnimatedContent` 的容器要 `display: flow-root`：`.privacy-note` 带 `margin-top:16px`，普通 block 父元素会让这个 margin 塌陷出去，把整张票券顶下去 16px。

---

## 1:1 还原是怎么验的

原站是妙搭（Feishu Aily）打包产物。做法是：把 212 kB 的构建产物 CSS 整个拉下来，
抽出应用样式段（14 kB）和 15 个设计令牌，**逐字**落进 `src/styles/ticket.css` ——
类名、数值、顺序全部保持原样，方便与原站源码对照。

然后同一个 Playwright 会话里先后加载原站与本地（视口、DPR、字体渲染必须完全一致，
否则差异全是噪声），对 34 个元素逐个比 `getBoundingClientRect()` + 40 个计算样式属性，
外加 `.parking-ticket` 的 `::before` / `::after`（票券两侧的撕口是伪元素画的）。

**8 个视口 × 34 项 = 272 项，全部一致，0 处差异：**

| 视口 | 结果 | 页高 | 撕口 `top` |
| --- | --- | --- | --- |
| 320×568（iPhone SE1） | 34/34 ✓ | 1114.2 | 211px |
| 360×640 | 34/34 ✓ | 1046.2 | 211px |
| 375×812（iPhone X） | 34/34 ✓ | 1047.6 | 211px |
| 390×844 | 34/34 ✓ | 1048.9 | 218px |
| 414×896（11 Pro Max） | 34/34 ✓ | 1051.1 | 218px |
| 699×900 | 34/34 ✓ | 1059.6 | 218px |
| 700×900 | 34/34 ✓ | 1097.6 | 218px |
| 1440×1000（桌面） | 34/34 ✓ | 1097.6 | 218px |

宽度不是随便挑的，**每个媒体查询的临界值上下各取一个**：

- `max-width:380px` —— 320 / 360 / 375 命中，390 不命中
- `min-width:700px` —— 700 / 1440 命中，699 不命中

不验这些就等于**没验断点**。撕口（`.parking-ticket::before`/`::after` 画的）在
窄屏下 `top` 会从 218px 变成 211px，差 7px —— 盯着截图看一百遍也发现不了，
但 `getComputedStyle(el, '::before')` 一量就出来了。实测两边逐项对得上。

页高这一列是**最灵敏的整体布局回归指标**：某一支 CSS 整体跑偏时，
逐个元素可能都还在容差内，页高会立刻跳出来。

再做逐像素比对（把两张 PNG 丢进浏览器 canvas 比，不需要 PNG 解码库）：

**71 / 1,636,440 = 0.0043% 的像素不同**，且集中在一个 14×40 的小块，
6 倍放大后肉眼无法分辨（抗锯齿的亚像素噪声）。

几个不写不报错、只静默改变排版的坑，都在 `ticket.css` 注释里：
- **Tailwind preflight 的等价物必须补**：`html{line-height:1.5}`、`*,::before,::after{border:0 solid #dfe2e7}`、`h1~h6{font-size:inherit;font-weight:inherit}`。漏了这些，逐个元素比对时差一大片。
- **body 的文字色不是 `var(--ink)`**：原站外面套着妙搭外壳，外壳把 body 覆盖成了 `#1f2229`。要复刻的是**实际渲染值**，不是应用自己 CSS 里写的值。
- **`align-items:center` 不能漏**：只抄视觉属性会退化成 `stretch`，单行内容被顶到顶部。

**上线后对着真实 URL 又跑了一遍**（不是只验本地）—— 34/34 依然全过。

---

## 已知差异

有意为之，不是 bug：

1. **防重复提醒改在浏览器本地。** 原站在服务端（`rateLimitMode: memory`），
   纯静态站点没有服务端，改成 `localStorage` 冷却（`cooldownSeconds`，设 0 可关）。
   **代价：清掉浏览器数据或换设备就能绕过冷却。** 对「路人扫码通知车主」这个场景够用。
2. **没有后端，也就没有服务端的请求校验。** 原站有蜜罐字段和限流；
   本项目保留了蜜罐 `<input name="website">`，但限流只能靠飞书机器人自身的频控。
3. **`?setup=1` 这一页是新增的**，原站没有，现在是一页**接收诊断**（见上文「接飞书」）。
4. **演示模式下 footer 和提交结果会明说「没发出去」**，原站没有这个状态
   （它永远有后端）。具体两处偏离：
   - footer 从「挪车通知服务可用 / 已启用防重复提醒」变成
     「演示模式：未接入飞书 / 消息不会真正发出」，状态点转红；
   - 提交后不再显示「已匿名通知车主」，而是
     「本页面尚未接入接收方，消息没有真正发出。请联系车主或改用其他方式通知。」

   **Webhook 正常注入时这两处都走原站文案，1:1 不受影响**（7 视口 × 34 项回归全过）。
   之所以宁可偏离：早先的演示模式返回的是「成功」，界面和真发出去一模一样，
   车主那边一条消息没有，**从页面上完全看不出问题** —— 这个坑真踩过。
5. **入场动效是新增的**，原站是妙搭的加载壳。落位后 `transform` 归零，
   静态视觉与原来逐像素相同（34/34 就是带着动效跑的）。
6. **不引入妙搭的任何运行时**：没有 Service Worker、没有平台外壳、没有水印角标。

---

## 部署

推 `main` 即自动部署（`.github/workflows/deploy.yml`，GitHub Actions）。
Pages 的 Source 必须是 **GitHub Actions**（不是分支）。

**改仓库名时唯一需要动的地方**：`vite.config.ts` 顶部的

```ts
const REPO_NAME = 'parking-notice'
```

build 时 `base = /<repo>/`，dev 仍是 `/`。
`spaFallbackPlugin` 在构建后把 `index.html` 复制成 `404.html`，做 SPA 深链回退
（代价：深链的 HTTP 状态码仍是 404，页面能正常渲染）。
`asset()` 助手统一给运行时资源加 `import.meta.env.BASE_URL` 前缀。

> 不要用 `vite preview` 验证子路径 —— 它对所有路径都回退成 `index.html`
> （连 JS/CSS 请求都返回 `text/html`），会误报一堆 404。

**首次部署必须做的一件事**：在仓库 Settings → Secrets and variables → Actions 里
加上 `FEISHU_WEBHOOK`（开了签名校验再加 `FEISHU_SECRET`），否则页面会走演示模式。
**加 Secret 不会触发重新部署** —— 要去 Actions 页点一次 Run workflow。

---

## 目录

```
src/
  config.ts                 四层配置的合并逻辑 + webhookSource() 溯源
  env.d.ts                  声明构建期注入的 __FEISHU_*__ 全局量
  lib/
    notify.ts               飞书 Webhook + 签名 + 冷却 + 脱敏
    overrides.ts            localStorage 覆盖层（本机调试）
  components/
    Ticket.tsx              整张票券
    TicketHeader/Intro/Footer.tsx
    NotifyForm.tsx          表单状态机（文案与原站逐条对齐）
    ReasonIcon.tsx          4 个 Lucide 图标逐字内联
    SetupPanel.tsx          接收诊断页（?setup=1）
    reactbits/              React Bits 组件源码（ClickSpark / StarBorder / AnimatedContent）
  styles/
    ticket.css              逐字来自原站构建产物，纯静态视觉
    effects.css             React Bits 适配层
    setup.css               诊断页样式
docs/reactbits-upstream/    AnimatedContent 的 gsap 原版（留作回退对照）
tools/
  make-qr-card.mjs          生成贴车物料（二维码 + A4 提示卡）
  out/                      生成物，已 gitignore
```

Webhook 的注入点在 `vite.config.ts` 的 `define` —— 想搞清楚配置从哪来，
从那里往下读 `src/config.ts` 的 `loadConfig()` 即可。