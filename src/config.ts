/**
 * 站点配置。
 *
 * 分四层，优先级从低到高：
 *   1. DEFAULTS                    —— 兜底值，写在代码里
 *   2. public/parking-config.json  —— 随仓库走，放文案这类不敏感的东西
 *   3. 构建期注入（__FEISHU_*__）   —— CI 从 Actions Secret 打进产物，**正式来源**
 *   4. localStorage                —— 本机调试用，只在这台设备上
 *                                    （见 src/lib/overrides.ts）
 *
 * ⚠️ 第 3 层是「路人扫码能通知到车主」这件事成立的前提。
 *    Webhook 曾经只走第 4 层，而 localStorage 按设备隔离 ——
 *    在电脑上配好、手机扫码打开，手机那份是空的，页面静默掉进演示模式。
 *    第 3 层的值不进仓库（不进 git 历史、不被代码搜索索引到），
 *    但会随产物发给每个访客，这才是纯静态站点唯一可行的做法。
 *
 * 为什么要前两层分离：部署到 GitHub Pages 之后没有后端，改文案不该逼你重新构建。
 * 直接在 GitHub 网页上编辑 public/parking-config.json 提交，Actions 会自动
 * 重新部署，改完就生效。拿不到那个文件（比如本地首次跑）时用 DEFAULTS。
 *
 * 文案默认值与原站 /api/parking/config 的返回完全一致。
 */

import { applyOverrides } from './lib/overrides'

/** Webhook 当前是从哪来的 —— 诊断页要显示，出问题时第一眼看这个 */
export type WebhookSource = 'local' | 'injected' | 'file' | 'none'

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

/**
 * 盖上构建期注入的那一层。空串 = 没注入，不覆盖 ——
 * 这样本地 `npm run build`（不设环境变量）会保留 json 里的值，
 * 而不是把 json 里的东西抹成空。
 */
function applyInjected(base: SiteConfig): SiteConfig {
  const out = { ...base }
  if (__FEISHU_WEBHOOK__) out.feishuWebhookUrl = __FEISHU_WEBHOOK__
  if (__FEISHU_SECRET__) out.feishuSecret = __FEISHU_SECRET__
  if (__FEISHU_MESSAGE_TYPE__ === 'card' || __FEISHU_MESSAGE_TYPE__ === 'text') {
    out.feishuMessageType = __FEISHU_MESSAGE_TYPE__
  }
  return out
}

/**
 * Webhook 当前生效值的来源。诊断页显示用。
 *
 * 判据只看「值是否非空」，不看「谁写的」—— 因为 localStorage 里存空串
 * 会被 readOverrides 过滤掉（见那边的注释），所以能读到的就是真生效的。
 */
export function webhookSource(config: SiteConfig): WebhookSource {
  if (!config.feishuWebhookUrl.trim()) return 'none'
  try {
    if (localStorage.getItem('parking-notice:config-override')) return 'local'
  } catch {
    /* 隐私模式，忽略 */
  }
  if (__FEISHU_WEBHOOK__) return 'injected'
  return 'file'
}

export const WEBHOOK_SOURCE_LABEL: Record<WebhookSource, string> = {
  local: '本机临时覆盖（只在这台设备生效）',
  injected: '构建期注入（GitHub Actions Secret）',
  file: 'public/parking-config.json（随仓库，公开）',
  none: '未配置 —— 页面走演示模式，消息不会真正发出',
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
    return applyOverrides(applyInjected(merged))
  } catch {
    // 拿不到 json 也不能丢掉本机配置和构建期注入
    return applyOverrides(applyInjected(DEFAULTS))
  }
}
