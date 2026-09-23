/**
 * 页面外壳。原站外面还套了两层（div > div.parking-app-layout），
 * 那是妙搭的运行时容器，本项目不需要，但保留 .parking-app-layout
 * 这一层以免以后要加全局样式时无处挂。
 *
 * 这一层同时是 React Bits 的两个挂载点：
 *   · ClickSpark      包在最外层 —— 它只渲染一个铺满父元素的 canvas
 *                     （pointer-events:none），不进排版，点哪儿都在那儿冒火花
 *   · AnimatedContent 包住票券内容 —— 入场时从下方淡入 + 轻微放大到位，
 *                     落位后 transform 归零，静态视觉与原来逐像素相同
 *
 * 两者都不改变任何静态几何，compare.mjs 的 34 项比对仍然全过（见 README）。
 */

import { useCallback, useEffect, useState } from 'react'
import { DEFAULTS, loadConfig, type SiteConfig } from './config'
import { Ticket } from './components/Ticket'
import { SetupPanel } from './components/SetupPanel'
import ClickSpark from './components/reactbits/ClickSpark'
import AnimatedContent from './components/reactbits/AnimatedContent'

/** 配置页只在 URL 带 ?setup=1 时出现，主页面完全不受影响 */
const SETUP_PARAM = 'setup'

export default function App() {
  const [config, setConfig] = useState<SiteConfig | null>(null)
  const [setupOpen, setSetupOpen] = useState(
    () => new URLSearchParams(window.location.search).has(SETUP_PARAM),
  )

  useEffect(() => {
    loadConfig().then(setConfig)
  }, [])

  // 标题跟随配置 —— 原站也是运行时写 document.title
  useEffect(() => {
    if (setupOpen) {
      document.title = '挪车通知 · 接收设置'
      return
    }
    if (config?.siteTitle) document.title = config.siteTitle
  }, [config?.siteTitle, setupOpen])

  const closeSetup = useCallback(() => {
    // 把 ?setup=1 从地址栏摘掉，再重新读一次配置（本机覆盖可能刚改过）
    const url = new URL(window.location.href)
    url.searchParams.delete(SETUP_PARAM)
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    setSetupOpen(false)
    loadConfig().then(setConfig)
  }, [])

  if (setupOpen) return <SetupPanel onClose={closeSetup} />

  // 配置没到之前先渲染默认值，避免闪一下空白
  const cfg = config ?? DEFAULTS

  return (
    <ClickSpark
      /*
       * ⚠️ 必须传字面量颜色。canvas 的 strokeStyle 不解析 CSS 变量，
       *    写 'var(--parking-yellow)' 不会报错，只是什么都不画。
       *    #f1c84b = --parking-yellow。
       */
      sparkColor="#f1c84b"
      sparkSize={11}
      sparkRadius={19}
      sparkCount={9}
      duration={420}
      easing="ease-out"
      extraScale={1}
    >
      <div className="parking-app-layout">
        <main className="page-shell">
          <AnimatedContent
            className="pb-reveal"
            distance={26}
            duration={0.7}
            ease="power3.out"
            delay={0.05}
            scale={0.985}
            /* 本页基本不滚动，不需要「滚到才播」的保守阈值，进来就播 */
            threshold={0}
          >
            <Ticket config={cfg} />
            <p className="privacy-note">
              页面不会显示车主手机号。你留下的联系方式仅用于本次挪车沟通，请勿填写无关的个人信息。
            </p>
          </AnimatedContent>
        </main>
      </div>
    </ClickSpark>
  )
}
