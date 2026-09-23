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

## 接飞书（二选一）

### 方式 A：配置页（推荐，不进仓库）

打开 `<站点地址>?setup=1`，粘贴 Webhook 地址 → 「保存到本机」。

这些值只写进**这台设备**的 `localStorage`（键 `parking-notice:config-override`），
不会提交到仓库。配置页里还有一个「发一条测试消息」，接完当场就能验证通没通。

> 为什么不在页面上常驻一个设置入口：这张票是给**路人**看的，
> 多一个齿轮图标就多一份误触和困惑。所以藏在 `?setup=1` 后面，只有车主知道。

### 怎么拿 Webhook

飞书群 → 右上角设置 → 群机器人 → 添加机器人 → **自定义机器人** → 复制 Webhook 地址。

如果开启了「签名校验」，把密钥也填进配置页的第二个输入框。
签名在**浏览器里现算**（`crypto.subtle` 的 HMAC-SHA256），不经过任何第三方，
算法与飞书官方 Python 示例逐字节一致（`base64(HMAC-SHA256(key = "{timestamp}\n{secret}", msg = ""))`）。

### 方式 B：写进 `public/parking-config.json`

改完提交，Actions 会自动重新部署。

**⚠️ 本仓库是 public。** Webhook 地址 = 「往这个群发消息」的钥匙，
提交上去等于公开。真要走这条路，至少：
在机器人设置里加上**自定义关键词**（比如「挪车」），并接受被刷群的风险。

---

## 配置优先级

三层，后者盖前者：

1. `src/config.ts` 里的 `DEFAULTS` —— 代码兜底
2. `public/parking-config.json` —— 随仓库走，放文案
3. `localStorage` —— 放 Webhook / 密钥，只在本机

`loadConfig()` 只认识 `DEFAULTS` 里出现过的键（`pick()`），
JSON 里写错键名不会静默吃掉整份配置，只会被忽略。

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
否则差异全是噪声），对 34 个元素逐个比 `getBoundingClientRect()` + 40 个计算样式属性。

**结论：34 / 34 全部一致，0 处差异。**

再做逐像素比对（把两张 PNG 丢进浏览器 canvas 比，不需要 PNG 解码库）：

**71 / 1,636,440 = 0.0043% 的像素不同**，且集中在一个 14×40 的小块，
6 倍放大后肉眼无法分辨（抗锯齿的亚像素噪声）。

几个不写不报错、只静默改变排版的坑，都在 `ticket.css` 注释里：
- **Tailwind preflight 的等价物必须补**：`html{line-height:1.5}`、`*,::before,::after{border:0 solid #dfe2e7}`、`h1~h6{font-size:inherit;font-weight:inherit}`。漏了这些，逐个元素比对时差一大片。
- **body 的文字色不是 `var(--ink)`**：原站外面套着妙搭外壳，外壳把 body 覆盖成了 `#1f2229`。要复刻的是**实际渲染值**，不是应用自己 CSS 里写的值。
- **`align-items:center` 不能漏**：只抄视觉属性会退化成 `stretch`，单行内容被顶到顶部。

---

## 已知差异

有意为之，不是 bug：

1. **防重复提醒改在浏览器本地。** 原站在服务端（`rateLimitMode: memory`），
   纯静态站点没有服务端，改成 `localStorage` 冷却（`cooldownSeconds`，设 0 可关）。
   **代价：清掉浏览器数据或换设备就能绕过冷却。** 对「路人扫码通知车主」这个场景够用。
2. **没有后端，也就没有服务端的请求校验。** 原站有蜜罐字段和限流；
   本项目保留了蜜罐 `<input name="website">`，但限流只能靠飞书机器人自身的频控。
3. **配置页（`?setup=1`）是新增的**，原站没有。原因见上文「接飞书」。
4. **入场动效是新增的**，原站是妙搭的加载壳。落位后 `transform` 归零，
   静态视觉与原来逐像素相同（34/34 就是带着动效跑的）。
5. **不引入妙搭的任何运行时**：没有 Service Worker、没有平台外壳、没有水印角标。

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

---

## 目录

```
src/
  config.ts                 三层配置的合并逻辑
  lib/
    notify.ts               飞书 Webhook + 签名 + 冷却
    overrides.ts            localStorage 覆盖层（Webhook / 密钥）
  components/
    Ticket.tsx              整张票券
    TicketHeader/Intro/Footer.tsx
    NotifyForm.tsx          表单状态机（文案与原站逐条对齐）
    ReasonIcon.tsx          4 个 Lucide 图标逐字内联
    SetupPanel.tsx          配置页（?setup=1）
    reactbits/              React Bits 组件源码（ClickSpark / StarBorder / AnimatedContent）
  styles/
    ticket.css              逐字来自原站构建产物，纯静态视觉
    effects.css             React Bits 适配层
    setup.css               配置页样式
docs/reactbits-upstream/    AnimatedContent 的 gsap 原版（留作回退对照）
```
