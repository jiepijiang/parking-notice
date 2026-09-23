/**
 * 配置页 —— 只在 URL 带 `?setup=1` 时出现，主页面完全不受影响。
 *
 * 作用只有一个：把飞书 Webhook 存进本机 localStorage。
 * 为什么不直接写进 public/parking-config.json —— 仓库是 public，
 * Webhook 一旦提交上去，任何人都能拿去往群里灌消息。
 *
 * 顺带提供「发一条测试消息」，这样接完不用等真有人扫码才知道通没通。
 */

import { useEffect, useState } from 'react'
import { DEFAULTS, loadConfig, type SiteConfig } from '../config'
import { clearOverrides, hasLocalWebhook, writeOverrides } from '../lib/overrides'
import { notifyOwner } from '../lib/notify'

type Msg = { ok: boolean; text: string } | null

export function SetupPanel({ onClose }: { onClose: () => void }) {
  const [base, setBase] = useState<SiteConfig>(DEFAULTS)
  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [msgType, setMsgType] = useState<'card' | 'text'>('card')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  // 预填当前生效的值（loadConfig 已经把本机覆盖盖进去了）
  useEffect(() => {
    loadConfig().then((c) => {
      setBase(c)
      setUrl(c.feishuWebhookUrl)
      setSecret(c.feishuSecret)
      setMsgType(c.feishuMessageType)
    })
  }, [])

  const draft: SiteConfig = {
    ...base,
    feishuWebhookUrl: url.trim(),
    feishuSecret: secret.trim(),
    feishuMessageType: msgType,
  }

  function save() {
    writeOverrides({
      feishuWebhookUrl: url.trim(),
      feishuSecret: secret.trim(),
      feishuMessageType: msgType,
    })
    setSaved(true)
    setMsg(null)
  }

  async function test() {
    setBusy(true)
    setMsg(null)
    const res = await notifyOwner(
      { reason: 'other_urgent', requesterContact: '这是一条来自配置页的测试消息' },
      draft,
    )
    setBusy(false)
    setMsg(
      res.ok
        ? res.demo
          ? { ok: true, text: '当前没填 Webhook，走的是演示模式（没真发）。填上地址再试。' }
          : { ok: true, text: '发送成功，去飞书群里看看有没有收到。' }
        : { ok: false, text: `发送失败：${res.error}` },
    )
  }

  function reset() {
    clearOverrides()
    setUrl('')
    setSecret('')
    setMsgType('card')
    setSaved(false)
    setMsg({ ok: true, text: '已清除本机配置，回落到仓库里的 parking-config.json。' })
  }

  return (
    <div className="parking-app-layout">
      <main className="page-shell setup-shell">
        <article className="setup-card">
          <header className="setup-head">
            <p className="eyebrow">本机配置</p>
            <h1 className="setup-title">挪车通知 · 接收设置</h1>
            <p className="setup-lede">
              这里的值只写进<strong>这台设备</strong>的 localStorage，不会进仓库。
              换设备或清了浏览器数据就要重填一次。
            </p>
          </header>

          <section className="setup-body">
            <label className="setup-field">
              <span>
                飞书群机器人 Webhook
                {hasLocalWebhook() && <em className="setup-tag">本机已配置</em>}
              </span>
              <input
                type="url"
                inputMode="url"
                spellCheck={false}
                autoComplete="off"
                placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setSaved(false)
                }}
              />
              <small>
                飞书群 → 设置 → 群机器人 → 添加「自定义机器人」，复制 Webhook 地址。
                留空则整个页面走演示模式（能点，但不真发消息）。
              </small>
            </label>

            <label className="setup-field">
              <span>签名校验密钥（可选）</span>
              <input
                type="text"
                spellCheck={false}
                autoComplete="off"
                placeholder="机器人开了「签名校验」才需要填"
                value={secret}
                onChange={(e) => {
                  setSecret(e.target.value)
                  setSaved(false)
                }}
              />
              <small>
                开了签名校验后，消息会用 HMAC-SHA256 在浏览器里现算签名，不经过任何第三方。
              </small>
            </label>

            <label className="setup-field">
              <span>消息样式</span>
              <select
                value={msgType}
                onChange={(e) => {
                  setMsgType(e.target.value === 'text' ? 'text' : 'card')
                  setSaved(false)
                }}
              >
                <option value="card">卡片（推荐，带原因和联系方式分栏）</option>
                <option value="text">纯文本</option>
              </select>
            </label>

            {msg && (
              <div className="status-panel" data-state={msg.ok ? 'success' : 'error'} role="status">
                <span className="status-panel__mark" aria-hidden="true" />
                <span>{msg.text}</span>
              </div>
            )}

            <div className="setup-actions">
              <button type="button" className="primary-action" onClick={save}>
                <span className="primary-action__label">{saved ? '已保存' : '保存到本机'}</span>
                <span className="primary-action__arrow" aria-hidden="true">
                  →
                </span>
              </button>
              <button type="button" className="secondary-action" onClick={test} disabled={busy}>
                {busy ? '正在发送…' : '发一条测试消息'}
              </button>
              <button type="button" className="secondary-action" onClick={reset}>
                清除本机配置
              </button>
            </div>
          </section>

          <footer className="ticket-footer">
            <span className="service-state" data-state={draft.feishuWebhookUrl ? 'ready' : 'error'}>
              <span className="service-state__dot" aria-hidden="true" />
              <span>{draft.feishuWebhookUrl ? '已接入飞书群' : '演示模式（未接入）'}</span>
            </span>
            <span>配置只存本机</span>
          </footer>
        </article>

        <p className="privacy-note">
          <button type="button" className="link-button" onClick={onClose}>
            返回挪车通知页
          </button>
        </p>
      </main>
    </div>
  )
}
