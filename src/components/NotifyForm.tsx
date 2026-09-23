/**
 * 票券下半部分：选原因 → 选填联系方式 → 通知车主。
 *
 * 状态机（phase）：
 *   idle ──选中原因──▶ 可提交
 *     └─提交─▶ submitting ─┬─成功─▶ success
 *                          └─失败─▶ error（可再次提交）
 *
 * 文案与原站逐条对齐（含「匿名 / 带联系方式」两套措辞）：
 *   加载中   正在发送匿名通知，请不要关闭页面。
 *            正在发送挪车原因和联系方式，请不要关闭页面。
 *   成功     已匿名通知车主，请在安全位置耐心等候。
 *            已将挪车原因和联系方式发送给车主。
 *   失败     通知未能发送，请检查网络后重试。      （网络层失败）
 *            通知服务暂时繁忙，请稍后重试。        （HTTP 5xx）
 *
 * 与原站的一处有意差异见 README「已知差异」：
 *   原站的防重复提醒在服务端（rateLimitMode: memory），纯静态站点没有服务端，
 *   这里改成浏览器本地冷却（cooldownSeconds，设为 0 可关闭）。
 */

import { useEffect, useRef, useState } from 'react'
import type { SiteConfig } from '../config'
import { ReasonIcon } from './ReasonIcon'
import StarBorder from './reactbits/StarBorder'
import { cooldownLeft, markSent, notifyOwner } from '../lib/notify'

type Phase = 'idle' | 'submitting' | 'success' | 'error'

interface Panel {
  state: 'loading' | 'success' | 'error'
  text: string
}

const IDLE_PANEL: Panel | null = null

export function NotifyForm({ config }: { config: SiteConfig }) {
  const [reason, setReason] = useState('')
  const [contact, setContact] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [panel, setPanel] = useState<Panel | null>(IDLE_PANEL)
  const [cool, setCool] = useState(() => cooldownLeft(config.cooldownSeconds))

  /** 提交那一刻是否带了联系方式 —— 决定用哪套文案，之后再改输入框也不影响 */
  const sentWithContact = useRef(false)
  const busy = phase === 'submitting'
  const done = phase === 'success'
  const locked = busy || done

  // 冷却倒计时
  useEffect(() => {
    if (cool <= 0) return
    const t = setInterval(() => setCool((n) => (n <= 1 ? 0 : n - 1)), 1000)
    return () => clearInterval(t)
  }, [cool > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const withContact = contact.trim().length > 0
  const canSubmit = !!reason && config.notifyEnabled && !locked && cool === 0

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    sentWithContact.current = withContact
    setPhase('submitting')
    setPanel({
      state: 'loading',
      text: withContact
        ? '正在发送挪车原因和联系方式，请不要关闭页面。'
        : '正在发送匿名通知，请不要关闭页面。',
    })

    const res = await notifyOwner({ reason, requesterContact: contact.trim() }, config)

    if (res.ok) {
      markSent()
      setPhase('success')
      setPanel({
        state: 'success',
        text: withContact
          ? '已将挪车原因和联系方式发送给车主。'
          : '已匿名通知车主，请在安全位置耐心等候。',
      })
      setCool(config.cooldownSeconds)
      return
    }

    setPhase('error')
    setPanel({
      state: 'error',
      text: /^HTTP 5\d\d$/.test(res.error ?? '')
        ? '通知服务暂时繁忙，请稍后重试。'
        : '通知未能发送，请检查网络后重试。',
    })
  }

  const badgeContact = withContact || (phase === 'success' && sentWithContact.current)

  return (
    <section className="ticket-action" aria-labelledby="reason-title">
      <div className="section-heading">
        <div>
          <p className="step-label">通知原因</p>
          <h2 id="reason-title">请选择当前情况</h2>
        </div>
        <span className="anonymous-badge" data-mode={badgeContact ? 'contact' : 'anonymous'} aria-live="polite">
          {badgeContact ? '携带联系方式' : '匿名发送'}
        </span>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={locked}>
          <legend className="sr-only">选择需要车主挪车的原因</legend>
          <div className="reason-grid">
            {config.reasons.map((r) => (
              <label className="reason-option" key={r.value}>
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                />
                <span className="reason-option__icon" aria-hidden="true">
                  <ReasonIcon name={r.icon} />
                </span>
                <span className="reason-option__text">
                  <strong>{r.label}</strong>
                  <small>{r.hint}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="contact-field">
          <label htmlFor="requester-contact">
            联系方式
            <span>选填</span>
          </label>
          <input
            id="requester-contact"
            name="requesterContact"
            type="text"
            maxLength={50}
            autoComplete="off"
            spellCheck={false}
            placeholder="手机号、微信号或其他联系方式"
            value={contact}
            disabled={locked}
            aria-invalid={false}
            aria-describedby="contact-privacy-note contact-error"
            onChange={(e) => setContact(e.target.value)}
          />
          <p className="contact-privacy-note" id="contact-privacy-note">
            填写即表示同意将该信息随提醒发送，可能显示在接收者的 App 消息列表或锁屏通知中；本页面不会保存该信息。
          </p>
          <span className="sr-only" id="contact-error" aria-live="polite" />
        </div>

        {/* 蜜罐：真人看不见，被自动填表机器人填了就拒收 */}
        <input
          className="honeypot"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <p className="form-hint">不填写联系方式也可以发送，车主只会收到所选原因。</p>

        {panel && (
          <div className="status-panel" data-state={panel.state} role="status" aria-live="polite">
            <span className="status-panel__mark" aria-hidden="true" />
            <span>{panel.text}</span>
          </div>
        )}

        {cool > 0 && phase !== 'success' && (
          <div className="status-panel" data-state="error" role="status" aria-live="polite">
            <span className="status-panel__mark" aria-hidden="true" />
            <span>刚刚已经通知过车主，请 {cool} 秒后再试。</span>
          </div>
        )}

        {/*
          React Bits 的 StarBorder：沿按钮上下边缘来回扫的一条黄色流光。

          它默认是「外层容器比内容大一圈，光带在那一圈里跑」的结构，
          我们这里不需要那一圈 —— 那会在黑按钮外面露出一圈奶油色票券底，
          等于凭空给按钮加了个描边。所以 thickness={0}，
          容器与按钮同为 308×58，光带改到按钮**内侧**的上下 3px 里跑
          （定位与渐变形状在 effects.css 里覆写）。

          backgroundColor / textColor 必须显式传：组件把这两个值写成内联样式，
          不传的话内容壳会盖上默认的黑底和不透明文字色。
        */}
        <StarBorder
          as="div"
          className="pb-star-border"
          thickness={0}
          speed="5s"
          backgroundColor="transparent"
          textColor="inherit"
          borderColor="transparent"
        >
          <button className="primary-action" type="submit" disabled={!canSubmit}>
            <span className="primary-action__label">
              {busy ? '正在通知车主…' : done ? '通知已发送' : cool > 0 ? '请稍后再试' : '通知车主挪车'}
            </span>
            <span className="primary-action__arrow" aria-hidden="true">
              →
            </span>
          </button>
        </StarBorder>
      </form>
    </section>
  )
}
