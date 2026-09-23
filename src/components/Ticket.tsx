/**
 * 整张票券。结构与原站 article.parking-ticket 完全一致：
 *   header.ticket-header
 *   section.ticket-intro
 *   div.cut-line
 *   section.ticket-action   ← 表单在这里
 *   footer.ticket-footer
 *
 * 两端的半圆缺口不是 DOM 节点，是 .parking-ticket:before/:after 画的。
 */

import type { SiteConfig } from '../config'
import { isDemoMode } from '../lib/notify'
import { TicketHeader } from './TicketHeader'
import { TicketIntro } from './TicketIntro'
import { NotifyForm } from './NotifyForm'
import { TicketFooter } from './TicketFooter'

export function Ticket({ config }: { config: SiteConfig }) {
  return (
    <article className="parking-ticket" aria-labelledby="parking-page-title">
      <TicketHeader vehicleId={config.vehicleId} />
      <TicketIntro title={config.siteTitle} label={config.vehicleLabel} />
      <NotifyForm config={config} />
      <TicketFooter enabled={config.notifyEnabled} demo={isDemoMode(config)} />
    </article>
  )
}
