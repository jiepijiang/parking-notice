/**
 * AnimatedContent —— React Bits 的「进入视口后入场」组件
 *
 *   文档   https://reactbits.dev/animations/animated-content
 *   上游   src/ts-default/Animations/AnimatedContent/AnimatedContent.tsx
 *   版本   c5df8610c0b47d7cd805cda480baba402f7267c1
 *   原版   docs/reactbits-upstream/AnimatedContent.tsx（留着方便对照/回退）
 *
 * ─────────────────────────────────────────────────────────────
 * 与原版的唯一区别：去掉了 gsap + ScrollTrigger 依赖
 * ─────────────────────────────────────────────────────────────
 *
 * 原版用 `gsap.timeline()` 做补间、用 `ScrollTrigger.create()` 做「滚进视口才播放」
 * 的触发。本页是扫码打开的一屏式 H5（内容约 1000px，基本不滚动），为此引入
 * gsap(≈23KB gzip) + ScrollTrigger(≈11KB gzip) 不划算 ——
 * 移动端首屏体积是这类页面的第一约束。
 *
 * 因此按能力一一替换，语义保持不变：
 *   补间   gsap.timeline().to()          → CSS transition
 *   触发   ScrollTrigger.create()        → IntersectionObserver（threshold 语义对齐）
 *   缓动   'power3.out' 等 gsap 字符串    → 同名 cubic-bezier（见 EASE）
 *
 * 对外 props 与原版完全一致（含 disappearAfter 系列与两个回调）。
 * 想换回 gsap 版：把 docs/reactbits-upstream/AnimatedContent.tsx 覆盖本文件、
 * `npm i gsap` 即可，调用方一行都不用改。
 */

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

/** gsap 缓动名 → 等价的 CSS cubic-bezier（CSS 的 easeOutXxx 是标准近似值） */
const EASE: Record<string, string> = {
  none: 'linear',
  linear: 'linear',
  'power1.out': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // easeOutQuad
  'power1.in': 'cubic-bezier(0.55, 0.085, 0.68, 0.53)', // easeInQuad
  'power1.inOut': 'cubic-bezier(0.455, 0.03, 0.515, 0.955)', // easeInOutQuad
  'power2.out': 'cubic-bezier(0.215, 0.61, 0.355, 1)', // easeOutCubic
  'power2.in': 'cubic-bezier(0.55, 0.055, 0.675, 0.19)', // easeInCubic
  'power2.inOut': 'cubic-bezier(0.645, 0.045, 0.355, 1)', // easeInOutCubic
  'power3.out': 'cubic-bezier(0.165, 0.84, 0.44, 1)', // easeOutQuart
  'power3.in': 'cubic-bezier(0.895, 0.03, 0.685, 0.22)', // easeInQuart
  'power3.inOut': 'cubic-bezier(0.77, 0, 0.175, 1)', // easeInOutQuart
  'power4.out': 'cubic-bezier(0.23, 1, 0.32, 1)', // easeOutQuint
  'power4.in': 'cubic-bezier(0.755, 0.05, 0.855, 0.06)', // easeInQuint
  'power4.inOut': 'cubic-bezier(0.86, 0, 0.07, 1)', // easeInOutQuint
}

const toCssEase = (ease: string) => EASE[ease] ?? ease

export interface AnimatedContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** 滚动容器；留空则用视口。传 documentElement/body 等同于用视口 */
  container?: Element | string | null
  /** 入场位移距离（px） */
  distance?: number
  direction?: 'vertical' | 'horizontal'
  /** 反向入场（从下方改成从上方） */
  reverse?: boolean
  /** 补间时长（秒） */
  duration?: number
  /** gsap 缓动名，见 EASE */
  ease?: string
  initialOpacity?: number
  animateOpacity?: boolean
  scale?: number
  /** 触发阈值 0~1 */
  threshold?: number
  /** 延迟（秒） */
  delay?: number
  /** 入场结束后停留多久自动退场（秒），0 = 不退场 */
  disappearAfter?: number
  disappearDuration?: number
  disappearEase?: string
  onComplete?: () => void
  onDisappearanceComplete?: () => void
}

type Phase = 'before' | 'shown' | 'gone'

export default function AnimatedContent({
  children,
  container,
  distance = 100,
  direction = 'vertical',
  reverse = false,
  duration = 0.8,
  ease = 'power3.out',
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  threshold = 0.1,
  delay = 0,
  disappearAfter = 0,
  disappearDuration = 0.5,
  disappearEase = 'power3.in',
  onComplete,
  onDisappearanceComplete,
  className = '',
  style,
  ...props
}: AnimatedContentProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('before')

  // ── 触发：IntersectionObserver 等价于 ScrollTrigger.start = `top ${(1-threshold)*100}%`
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let raf = 0
    // 用 rAF 把状态翻转推到下一帧：保证「初始位移」这一帧真的被绘制过，
    // 否则浏览器可能把初始态和终态合并成一次样式计算，transition 不触发。
    const play = () => {
      raf = requestAnimationFrame(() => setPhase((p) => (p === 'before' ? 'shown' : p)))
    }

    if (typeof IntersectionObserver === 'undefined') {
      play()
      return () => cancelAnimationFrame(raf)
    }

    let root: Element | null = null
    if (typeof container === 'string') root = document.querySelector(container)
    else if (container instanceof Element) root = container
    // documentElement / body 交给视口默认行为，否则 root 会被当成一个零尺寸的容器
    if (root === document.documentElement || root === document.body) root = null

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          play()
        }
      },
      { root, threshold: Math.min(Math.max(threshold, 0), 1) },
    )
    io.observe(el)

    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [container, threshold])

  // ── 入场结束回调
  useEffect(() => {
    if (phase !== 'shown') return
    const t = setTimeout(() => onComplete?.(), (delay + duration) * 1000)
    return () => clearTimeout(t)
  }, [phase, delay, duration, onComplete])

  // ── 自动退场
  useEffect(() => {
    if (phase !== 'shown' || disappearAfter <= 0) return
    const t = setTimeout(() => setPhase('gone'), (delay + duration + disappearAfter) * 1000)
    return () => clearTimeout(t)
  }, [phase, disappearAfter, delay, duration])

  // ── 退场结束回调
  useEffect(() => {
    if (phase !== 'gone') return
    const t = setTimeout(() => onDisappearanceComplete?.(), disappearDuration * 1000)
    return () => clearTimeout(t)
  }, [phase, disappearDuration, onDisappearanceComplete])

  const axis = direction === 'horizontal' ? 'X' : 'Y'
  const offset = reverse ? -distance : distance

  const phaseStyle: CSSProperties =
    phase === 'before'
      ? {
          transform: `translate${axis}(${offset}px) scale(${scale})`,
          opacity: animateOpacity ? initialOpacity : 1,
        }
      : phase === 'shown'
        ? {
            transform: 'none',
            opacity: 1,
          }
        : {
            transform: `translate${axis}(${reverse ? distance : -distance}px) scale(0.8)`,
            opacity: animateOpacity ? initialOpacity : 0,
          }

  const easeFor = phase === 'gone' ? toCssEase(disappearEase) : toCssEase(ease)
  const durFor = phase === 'gone' ? disappearDuration : duration

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transition: `transform ${durFor}s ${easeFor} ${delay}s, opacity ${durFor}s ${easeFor} ${delay}s`,
        ...phaseStyle,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
