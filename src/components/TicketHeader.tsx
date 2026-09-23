/**
 * 票券顶部的黄色条：圆形 P 标 + PARKING NOTICE 字标 + 右侧票号。
 * 结构与原站 DOM 一一对应（.ticket-header / .ticket-brand / .ticket-meta）。
 */

export function TicketHeader({ vehicleId }: { vehicleId: string }) {
  return (
    <header className="ticket-header">
      <div className="ticket-brand" aria-hidden="true">
        <span className="ticket-brand__mark">P</span>
        <span className="ticket-brand__copy">
          PARKING
          <br />
          NOTICE
        </span>
      </div>
      <div className="ticket-meta">
        <span>临时停车凭证</span>
        <span>NO. {vehicleId}</span>
      </div>
    </header>
  )
}
