/**
 * 本机配置覆盖层。
 *
 * 存在的理由：仓库是 public，而飞书自定义机器人的 Webhook URL 只要泄露，
 * 任何人都能往群里灌消息。所以真实 Webhook **不该**写进
 * public/parking-config.json 一起提交。
 *
 * 于是配置分三层，优先级从低到高：
 *   1. DEFAULTS                  —— 代码里的兜底值
 *   2. public/parking-config.json —— 随仓库走，放文案这类不敏感的东西
 *   3. localStorage（本文件）      —— 放 Webhook / 密钥，只在这台设备上
 *
 * 用法：打开 `<站点地址>?setup=1`，在配置页里粘贴 Webhook，保存即可。
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
      if (typeof parsed[k] === 'string') out[k] = parsed[k]
    }
    return out as Overrides
  } catch {
    return {}
  }
}

export function writeOverrides(next: Overrides) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
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

/** 判断本机是否已经配过 Webhook —— 配置页用来显示当前状态 */
export function hasLocalWebhook(): boolean {
  return !!readOverrides().feishuWebhookUrl
}
