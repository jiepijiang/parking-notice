/**
 * 票券底部细条：左边一个状态点 + 服务状态，右边一句副信息。
 * 原站 data-state=ready 时点是绿色（--success）。
 */

export function TicketFooter({ enabled }: { enabled: boolean }) {
  return (
    <footer className="ticket-footer">
      <span className="service-state" data-state={enabled ? 'ready' : 'error'}>
        <span className="service-state__dot" aria-hidden="true" />
        <span>{enabled ? '挪车通知服务可用' : '挪车通知服务未启用'}</span>
      </span>
      <span>{enabled ? '已启用防重复提醒' : '请联系车主'}</span>
    </footer>
  )
}
