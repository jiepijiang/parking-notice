/**
 * 把「挪车原因 + 联系方式」发到飞书群自定义机器人。
 *
 * 为什么能纯前端做：飞书 webhook 接口放开了 CORS
 * （`access-control-allow-origin: *`，OPTIONS 预检也放行），
 * 所以浏览器可以直接 POST，不需要任何后端。
 *
 * 两种情况：
 *   · 配了 feishuWebhookUrl → 真发
 *   · 没配                  → 演示模式，**明确报错**（见下面 notifyOwner 里的说明）
 *
 * ⚠️ 这里有一条踩过的坑：Webhook 曾经只从 localStorage 读，而 localStorage
 *    是**按设备隔离**的。在电脑上配好、用手机扫码打开，手机那份是空的 ——
 *    于是走进演示模式。所以「路人扫码能不能通知到车主」这件事，
 *    **必须靠构建期把 Webhook 打进产物**（见 scripts/inject-config.mjs），
 *    localStorage 只能当本机调试用的临时覆盖。
 */

import type { Reason, SiteConfig } from '../config'

export interface NotifyPayload {
  reason: string
  requesterContact: string
}

export interface NotifyResult {
  ok: boolean
  /** 演示模式（没配 webhook），没真发 */
  demo: boolean
  error?: string
}

/** 没配 Webhook = 演示模式：界面照常，但不真发消息。 */
export function isDemoMode(config: SiteConfig): boolean {
  return !config.feishuWebhookUrl.trim()
}

/**
 * 把 Webhook 脱敏成 `https://open.feishu.cn/…/hook/FAKE****abcd`，用于诊断页展示。
 *
 * ⚠️ 必须取**最后一段路径**（token）的首尾，不能取整个 URL 的首尾 ——
 *    后者拿到的是 `http` + 域名尾巴，看着像脱敏了、其实一点 token 信息都没有。
 */
export function maskWebhook(url: string): string {
  const u = url.trim()
  if (!u) return ''
  const i = u.lastIndexOf('/')
  const prefix = i >= 0 ? u.slice(0, i + 1) : ''
  const token = i >= 0 ? u.slice(i + 1) : u
  if (token.length <= 8) return `${prefix}${token}`
  return `${prefix}${token.slice(0, 4)}****${token.slice(-4)}`
}

/** 飞书自定义机器人开启「签名校验」时的算法：base64(HMAC-SHA256(key=`${ts}\n${secret}`, msg="")) */
async function sign(secret: string, timestamp: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${timestamp}\n${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new Uint8Array(0))
  let bin = ''
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b)
  return btoa(bin)
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function buildBody(payload: NotifyPayload, reason: Reason | undefined, config: SiteConfig) {
  const title = reason?.label ?? payload.reason
  const hint = reason?.hint ?? ''
  const contact = payload.requesterContact.trim()
  const who = contact ? contact : '对方选择匿名，未留联系方式'

  if (config.feishuMessageType === 'text') {
    return {
      msg_type: 'text',
      content: {
        text: [
          '🚗 挪车提醒',
          `原因：${title}${hint ? `（${hint}）` : ''}`,
          `联系方式：${who}`,
          `时间：${stamp()}`,
        ].join('\n'),
      },
    }
  }

  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: 'orange',
        title: { tag: 'plain_text', content: '🚗 挪车提醒' },
      },
      elements: [
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'lark_md', content: `**原因**\n${title}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**补充**\n${hint || '—'}` } },
          ],
        },
        { tag: 'hr' },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: contact ? `**联系方式**\n${contact}` : '**联系方式**\n对方选择匿名，未留联系方式',
          },
        },
        { tag: 'note', elements: [{ tag: 'plain_text', content: `${stamp()} · 来自挪车通知页` }] },
      ],
    },
  }
}

export async function notifyOwner(
  payload: NotifyPayload,
  config: SiteConfig,
  signal?: AbortSignal,
): Promise<NotifyResult> {
  const url = config.feishuWebhookUrl.trim()
  if (!url) {
    // 演示模式：等一下再返回，让「正在通知」这个中间态看得见。
    //
    // ⚠️ ok 必须是 false。早先这里返回的是 { ok: true, demo: true }，
    //    界面于是照抄「已匿名通知车主，请在安全位置耐心等候。」——
    //    和真发出去一模一样。结果就是「手机扫码提交了、车主什么都没收到」，
    //    而且从页面上完全看不出问题。**没发出去就必须说没发出去。**
    await new Promise((r) => setTimeout(r, 700))
    return { ok: false, demo: true, error: '未配置接收方' }
  }

  const reason = config.reasons.find((r) => r.value === payload.reason)
  const body: Record<string, unknown> = buildBody(payload, reason, config)

  if (config.feishuSecret.trim()) {
    const timestamp = String(Math.floor(Date.now() / 1000))
    body.timestamp = timestamp
    body.sign = await sign(config.feishuSecret.trim(), timestamp)
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (!res.ok) return { ok: false, demo: false, error: `HTTP ${res.status}` }
    // 飞书即使业务失败也返回 200，要靠响应体里的 code 判断
    const data = (await res.json().catch(() => null)) as { code?: number; msg?: string } | null
    if (data && typeof data.code === 'number' && data.code !== 0) {
      const why = data.msg || `code ${data.code}`
      // 访客看到的仍是原站那两句通用文案（「token invalid」他也处理不了），
      // 但真实原因要留在控制台 —— 车主在手机上打开 ?setup=1 就能看到，
      // 不用回去翻电脑。这正是「配错了却完全看不出来」那个坑的解药。
      console.error('[parking-notice] 飞书拒收了这条消息：', why)
      return { ok: false, demo: false, error: why }
    }
    return { ok: true, demo: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[parking-notice] 发送失败：', msg)
    return { ok: false, demo: false, error: msg }
  }
}

/* ---------------------------------------------------------------- 冷却 */

const COOLDOWN_KEY = 'parking-notice:last-sent'

/** 距离下次可发送还剩几秒（0 = 可以发） */
export function cooldownLeft(seconds: number): number {
  if (!seconds) return 0
  try {
    const last = Number(localStorage.getItem(COOLDOWN_KEY) || 0)
    const left = Math.ceil((last + seconds * 1000 - Date.now()) / 1000)
    return left > 0 ? left : 0
  } catch {
    return 0
  }
}

export function markSent() {
  try {
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()))
  } catch {
    /* 隐私模式下 localStorage 会抛，忽略 */
  }
}
