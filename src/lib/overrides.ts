/**
 * 本机配置覆盖层（调试用）。
 *
 * ⚠️ **这一层不能用来正式配置 Webhook。**
 * localStorage 是**按设备隔离**的：在电脑上配好，用手机扫码打开，
 * 手机那份是空的 → 页面走进演示模式 → 车主什么都收不到，
 * 而且界面上完全看不出来（这个坑真踩过，见 README「已知差异」）。
 * 正式配置走**构建期注入**（vite.config.ts 的 define + GitHub Actions Secret），
 * 这样每个访客的浏览器都能拿到。
 *
 * 这一层剩下的用途：本机临时换个 Webhook 调试，不影响线上。
 *
 * 配置优先级，从低到高：
 *   1. DEFAULTS                    —— 代码里的兜底值
 *   2. public/parking-config.json  —— 随仓库走，放文案这类不敏感的东西
 *   3. 构建期注入（__FEISHU_*__）   —— CI 从 Actions Secret 打进产物，**正式来源**
 *   4. localStorage（本文件）       —— 本机调试用，只在这台设备上
 */

import type { SiteConfig } from '../config'

const KEY = 'parking-notice:config-override'

/** 允许被本机覆盖的键 —— 只放敏感的，其余走仓库里的 json */
const OVERRIDABLE = ['feishuWebhookUrl', 'feishuSecret', 'feishuMessageType'] as const
export type OverrideKey = (typeof OVERRIDABLE)[number]
export type Overrides = Partial<Pick<SiteConfig, OverrideKey>>

export function readOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of OVERRIDABLE) {
      // 空串当作「没覆盖」，不是「覆盖成空」。
      // 否则在配置页把输入框清空再点保存，就会把构建期注入的那份盖成空串，
      // 于是这台设备静默掉回演示模式 —— 又一个「看不出哪里不对」的坑。
      if (typeof parsed[k] === 'string' && parsed[k] !== '') out[k] = parsed[k]
    }
    return out as Overrides
  } catch {
    return {}
  }
}

export function writeOverrides(next: Overrides) {
  try {
    // 同上：只存非空值，语义与 readOverrides 保持一致
    const clean: Record<string, string> = {}
    for (const k of OVERRIDABLE) {
      const v = next[k]
      if (typeof v === 'string' && v.trim() !== '') clean[k] = v.trim()
    }
    if (Object.keys(clean).length === 0) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(clean))
  } catch {
    /* 隐私模式下 localStorage 会抛，忽略 */
  }
}

export function clearOverrides() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 同上 */
  }
}

/** 把覆盖层盖到配置上（loadConfig 的最后一步） */
export function applyOverrides(base: SiteConfig): SiteConfig {
  const o = readOverrides()
  const merged = { ...base }
  for (const k of OVERRIDABLE) {
    const v = o[k]
    if (v !== undefined) (merged as Record<string, unknown>)[k] = v
  }
  return merged
}

/** 判断本机是否有覆盖 —— 配置页用来显示当前状态 */
export function hasLocalWebhook(): boolean {
  return !!readOverrides().feishuWebhookUrl
}
