/**
 * 把「挪车原因 + 联系方式」发到飞书群自定义机器人。
 *
 * 为什么能纯前端做：飞书 webhook 接口放开了 CORS
 * （`access-control-allow-origin: *`，OPTIONS 预检也放行），
 * 所以浏览器可以直接 POST，不需要任何后端。
 *
 * 两种情况：
 *   · 配了 feishuWebhookUrl → 真发
 *   · 没配                  → 演示模式，直接返回成功（界面表现完全一样）
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
    // 演示模式：等一下再返回，让「正在通知」这个中间态看得见
    await new Promise((r) => setTimeout(r, 700))
    return { ok: true, demo: true }
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
      return { ok: false, demo: false, error: data.msg || `code ${data.code}` }
    }
    return { ok: true, demo: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
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
