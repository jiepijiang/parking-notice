/**
 * 站点配置。
 *
 * 分三层，优先级从低到高：
 *   1. DEFAULTS                    —— 兜底值，写在代码里
 *   2. public/parking-config.json  —— 随仓库走，放文案这类不敏感的东西
 *   3. localStorage                —— 放飞书 Webhook / 密钥，只在这台设备上
 *                                    （见 src/lib/overrides.ts，仓库是 public，
 *                                      Webhook 泄露 = 任何人都能往群里灌消息）
 *
 * 为什么要前两层分离：部署到 GitHub Pages 之后没有后端，改文案不该逼你重新构建。
 * 直接在 GitHub 网页上编辑 public/parking-config.json 提交，Actions 会自动
 * 重新部署，改完就生效。拿不到那个文件（比如本地首次跑）时用 DEFAULTS。
 *
 * 文案默认值与原站 /api/parking/config 的返回完全一致。
 */

import { applyOverrides } from './lib/overrides'

export type IconName = 'car-front' | 'door-open' | 'square-parking' | 'triangle-alert'

export interface Reason {
  /** 提交给后端的值，与原站一致 */
  value: string
  /** 主标题 */
  label: string
  /** 副标题 */
  hint: string
  icon: IconName
}

export interface SiteConfig {
  /** 浏览器标题 + 票券大标题 */
  siteTitle: string
  /** 票券标题下方那句话 */
  vehicleLabel: string
  /** 票券编号，显示成「NO. MOVE-CAR」 */
  vehicleId: string
  /** 关掉后按钮恒为禁用，footer 显示服务不可用 */
  notifyEnabled: boolean
  /** 防重复提醒的冷却秒数 */
  cooldownSeconds: number
  /**
   * 飞书群自定义机器人 Webhook。
   * 留空 = 演示模式（点提交只显示成功态，不真发消息）。
   */
  feishuWebhookUrl: string
  /** 机器人「签名校验」的密钥。没开签名校验就留空。 */
  feishuSecret: string
  /** 消息用卡片还是纯文本 */
  feishuMessageType: 'card' | 'text'
  /** 挪车原因，顺序即显示顺序 */
  reasons: Reason[]
}

export const DEFAULTS: SiteConfig = {
  siteTitle: '临时停车，请联系我',
  vehicleLabel: '给您带来不便，可匿名通知或留下联系方式，我会尽快回来处理。',
  vehicleId: 'MOVE-CAR',
  notifyEnabled: true,
  cooldownSeconds: 60,
  feishuWebhookUrl: '',
  feishuSecret: '',
  feishuMessageType: 'card',
  reasons: [
    { value: 'blocked_vehicle', label: '挡住车辆', hint: '我的车无法驶出', icon: 'car-front' },
    { value: 'blocked_entrance', label: '挡住出入口', hint: '影响道路或通行', icon: 'door-open' },
    { value: 'temporary_parking', label: '临时占位', hint: '影响当前车位使用', icon: 'square-parking' },
    { value: 'other_urgent', label: '其他紧急情况', hint: '需要尽快联系车主', icon: 'triangle-alert' },
  ],
}

/** 只认识 config 里出现的键，避免 json 写错键名时静默吃掉整份配置。 */
function pick(src: Record<string, unknown>): Partial<SiteConfig> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(DEFAULTS)) {
    if (src[key] !== undefined) out[key] = src[key]
  }
  return out as Partial<SiteConfig>
}

export async function loadConfig(): Promise<SiteConfig> {
  const url = `${import.meta.env.BASE_URL}parking-config.json`
  try {
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const raw = (await res.json()) as Record<string, unknown>
    const merged = { ...DEFAULTS, ...pick(raw) }
    // 原因列表整份替换，不做逐项合并 —— 少一项就少一项，别混着来
    if (!Array.isArray(merged.reasons) || merged.reasons.length === 0) {
      merged.reasons = DEFAULTS.reasons
    }
    return applyOverrides(merged)
  } catch {
    // 拿不到 json 也不能丢掉本机配置
    return applyOverrides(DEFAULTS)
  }
}
