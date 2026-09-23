/**
 * 票券引言区：小字「车辆临时停靠」+ 大标题 + 说明，后面跟一条虚线撕口。
 *
 * 大标题的 id 与 article 的 aria-labelledby 对应，保留原站的无障碍结构。
 */

export function TicketIntro({ title, label }: { title: string; label: string }) {
  return (
    <>
      <section className="ticket-intro">
        <p className="eyebrow">车辆临时停靠</p>
        <h1 id="parking-page-title">{title}</h1>
        <p className="vehicle-label">{label}</p>
      </section>

      {/* 虚线撕口。两端的半圆缺口是 .parking-ticket:before/:after 画的 */}
      <div className="cut-line" aria-hidden="true">
        <span>TEAR HERE</span>
      </div>
    </>
  )
}
