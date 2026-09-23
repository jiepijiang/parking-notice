/**
 * 接收诊断页 —— 只在 URL 带 `?setup=1` 时出现，主页面完全不受影响。
 *
 * 这一页的定位在 2026-09-23 变过：
 *
 *   原来：把飞书 Webhook 存进本机 localStorage 的「配置页」。
 *   现在：**诊断页**。Webhook 的正式来源是构建期注入
 *        （GitHub Actions Secret → vite.config.ts 的 define），
 *        因为 localStorage 按设备隔离 —— 在这台设备配好，别人扫码打开是空的。
 *
 * 所以现在这一页主要回答三个问题：
 *   ① 这台设备拿到的配置里，接收方到底配上了没有？（脱敏显示 + 来源）
 *   ② 从这台设备发得出去吗？（「发一条测试消息」用的是**当前生效配置**，
 *      不是下面表单里的草稿 —— 这样在手机上打开就能验证手机这条路通不通）
 *   ③ 想临时换个地址调试怎么办？（折叠在最后，只影响这台设备）
 *
 * ⚠️ 测试按钮**必须**用生效配置而不是表单草稿：草稿是「你打算存什么」，
 *    生效配置才是「访客扫码后真正会用什么」。两者不一致时，用草稿测出来的
 *    「成功」是假象 —— 这正是这次「扫码收不到通知」的教训。
 */

import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULTS,
  WEBHOOK_SOURCE_LABEL,
  loadConfig,
  webhookSource,
  type SiteConfig,
} from '../config'
import { clearOverrides, hasLocalWebhook, readOverrides, writeOverrides } from '../lib/overrides'
import { isDemoMode, maskWebhook, notifyOwner } from '../lib/notify'

type Msg = { ok: boolean; text: string } | null

export function SetupPanel({ onClose }: { onClose: () => void }) {
  const [live, setLive] = useState<SiteConfig>(DEFAULTS)
  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [msgType, setMsgType] = useState<'card' | 'text'>('card')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  const refresh = useCallback(async () => {
    const c = await loadConfig()
    setLive(c)
    // ⚠️ 输入框只回填**本机覆盖**的值，绝不回填构建期注入的那份。
    //
    // 这里踩过一次：原来写的是 `setUrl(c.feishuWebhookUrl)`，而 c 是**生效配置**
    // （含构建期注入的完整 Webhook）。于是 `?setup=1` 展开折叠区，
    // 输入框里就是明文地址 —— 而这一页的地址在 README 里是公开的，
    // 等于把「需要开 DevTools 才能拿到」变成「一个 URL 就能拿到」。
    // 上面那块脱敏展示已经足够回答「配上了没有、从哪来」。
    const o = readOverrides()
    setUrl(o.feishuWebhookUrl ?? '')
    setSecret(o.feishuSecret ?? '')
    setMsgType(o.feishuMessageType ?? c.feishuMessageType)
    return c
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const demo = isDemoMode(live)
  const source = webhookSource(live)

  /** 用**当前生效配置**发一条 —— 等价于「现在有人扫码提交」 */
  async function testLive() {
    setBusy(true)
    setMsg(null)
    const res = await notifyOwner(
      { reason: 'other_urgent', requesterContact: '这是一条来自诊断页的测试消息' },
      live,
    )
    setBusy(false)
    setMsg(
      res.demo
        ? { ok: false, text: '这台设备没拿到接收方地址，页面走的是演示模式 —— 消息不会真正发出。' }
        : res.ok
          ? { ok: true, text: '发送成功，去飞书群里看看收到没有。' }
          : { ok: false, text: `发送失败：${res.error}` },
    )
  }

  function save() {
    writeOverrides({
      feishuWebhookUrl: url.trim(),
      feishuSecret: secret.trim(),
      feishuMessageType: msgType,
    })
    setSaved(true)
    setMsg(null)
    void refresh()
  }

  function reset() {
    clearOverrides()
    setSaved(false)
    setMsg({ ok: true, text: '已清除本机覆盖，回落到构建期注入 / 仓库里的那份配置。' })
    void refresh()
  }

  return (
    <div className="parking-app-layout">
      <main className="page-shell setup-shell">
        <article className="setup-card">
          <header className="setup-head">
            <p className="eyebrow">接收诊断</p>
            <h1 className="setup-title">挪车通知 · 接收设置</h1>
            <p className="setup-lede">
              接收方地址由 <strong>GitHub Actions Secret 在构建期注入</strong>，
              随页面发给每个访客 —— 所以任何人扫码都能通知到你。
              这一页用来确认<strong>当前这台设备</strong>拿到的是什么。
            </p>
          </header>

          <section className="setup-body">
            <div className="setup-diag" data-state={demo ? 'error' : 'ready'}>
              <div className="setup-diag__row">
                <span className="setup-diag__label">接收方</span>
                <span className="setup-diag__value">
                  {demo ? <em>未配置</em> : <code>{maskWebhook(live.feishuWebhookUrl)}</code>}
                </span>
              </div>
              <div className="setup-diag__row">
                <span className="setup-diag__label">来源</span>
                <span className="setup-diag__value">{WEBHOOK_SOURCE_LABEL[source]}</span>
              </div>
              <div className="setup-diag__row">
                <span className="setup-diag__label">消息样式</span>
                <span className="setup-diag__value">
                  {live.feishuMessageType === 'text' ? '纯文本' : '卡片'}
                  {live.feishuSecret.trim() ? ' · 已开签名校验' : ''}
                </span>
              </div>
            </div>

            {demo && (
              <div className="status-panel" data-state="error" role="status">
                <span className="status-panel__mark" aria-hidden="true" />
                <span>
                  演示模式：没有接收方地址，访客提交后消息不会真正发出。
                  去仓库 Settings → Secrets and variables → Actions 添加{' '}
                  <strong>FEISHU_WEBHOOK</strong> 后重新部署。
                </span>
              </div>
            )}

            {msg && (
              <div className="status-panel" data-state={msg.ok ? 'success' : 'error'} role="status">
                <span className="status-panel__mark" aria-hidden="true" />
                <span>{msg.text}</span>
              </div>
            )}

            <div className="setup-actions">
              <button type="button" className="primary-action" onClick={testLive} disabled={busy}>
                <span className="primary-action__label">
                  {busy ? '正在发送…' : '发一条测试消息'}
                </span>
                <span className="primary-action__arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </div>
            <p className="setup-hint">
              用的是<strong>当前生效配置</strong>，等价于此刻有人扫码提交 —— 想验证手机能不能发出去，
              就用手机打开这一页点一下。
            </p>

            <details className="setup-advanced">
              <summary>本机临时覆盖（调试用，只影响这台设备）</summary>
              <div className="setup-advanced__body">
                <p className="setup-hint">
                  输入框里显示的是<strong>本机已存的值</strong>，不会显示构建期注入的那份
                  —— 上面那块脱敏地址才是当前真正生效的。
                  这里存的值<strong>不会</strong>随页面发给别人，所以
                  <strong>路人扫码时用的仍是构建期注入的那份</strong>，
                  别指望在这里填完别人的手机就能收到。
                </p>

                <label className="setup-field">
                  <span>
                    飞书群机器人 Webhook
                    {hasLocalWebhook() && <em className="setup-tag">本机有覆盖</em>}
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
                  <small>开了签名校验后，签名在浏览器里用 HMAC-SHA256 现算，不经过任何第三方。</small>
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

                <div className="setup-actions">
                  <button type="button" className="secondary-action" onClick={save}>
                    {saved ? '已保存到本机' : '保存到本机'}
                  </button>
                  <button type="button" className="secondary-action" onClick={reset}>
                    清除本机覆盖
                  </button>
                </div>
              </div>
            </details>
          </section>

          <footer className="ticket-footer">
            <span className="service-state" data-state={demo ? 'error' : 'ready'}>
              <span className="service-state__dot" aria-hidden="true" />
              <span>{demo ? '演示模式（未接入）' : '已接入飞书群'}</span>
            </span>
            <span>{demo ? '消息不会真正发出' : '接收方随页面下发'}</span>
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
