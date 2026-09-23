/**
 * 票券底部细条：左边一个状态点 + 服务状态，右边一句副信息。
 * 原站 data-state=ready 时点是绿色（--success）。
 *
 * 三种状态：
 *   · notifyEnabled=false  原站文案，服务未启用
 *   · 有 Webhook           原站文案，服务可用
 *   · 演示模式（没 Webhook）**偏离原站**，明说没接入
 *
 * 为什么要偏离：原站永远有后端，不存在「演示模式」这个状态。我们这套是纯静态的，
 * Webhook 一旦没打进产物（比如忘了配 Actions Secret），页面照样显示
 * 「挪车通知服务可用 / 已启用防重复提醒」—— 车主自己都看不出没接上，
 * 更别说扫码的访客。这里宁可少 1:1 一分，也要把话说清楚。
 * 正常部署（Webhook 已注入）时走的仍是原站文案，1:1 不受影响。
 */

export function TicketFooter({ enabled, demo }: { enabled: boolean; demo?: boolean }) {
  const state = !enabled ? 'error' : demo ? 'error' : 'ready'
  const text = !enabled ? '挪车通知服务未启用' : demo ? '演示模式：未接入飞书' : '挪车通知服务可用'
  const note = !enabled ? '请联系车主' : demo ? '消息不会真正发出' : '已启用防重复提醒'

  return (
    <footer className="ticket-footer">
      <span className="service-state" data-state={state}>
        <span className="service-state__dot" aria-hidden="true" />
        <span>{text}</span>
      </span>
      <span>{note}</span>
    </footer>
  )
}
