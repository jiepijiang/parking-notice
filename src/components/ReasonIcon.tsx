/**
 * 4 个 Lucide 图标 —— 与原站用的完全同一套（car-front / door-open /
 * square-parking / triangle-alert），路径数据逐字抄自原站 DOM，
 * 所以图形是 1:1 的，没有引入 lucide-react 依赖。
 *
 * 原站的属性：width/height 20、viewBox 0 0 24 24、fill none、
 * stroke currentColor、stroke-width 2.2、圆头圆角。
 */

import type { IconName } from '../config'

const BASE = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function CarFront() {
  return (
    <svg {...BASE}>
      <path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8" />
      <path d="M7 14h.01" />
      <path d="M17 14h.01" />
      <rect width="18" height="8" x="3" y="10" rx="2" />
      <path d="M5 18v2" />
      <path d="M19 18v2" />
    </svg>
  )
}

function DoorOpen() {
  return (
    <svg {...BASE}>
      <path d="M11 20H2" />
      <path d="M11 4.562v16.157a1 1 0 0 0 1.242.97L19 20V5.562a2 2 0 0 0-1.515-1.94l-4-1A2 2 0 0 0 11 4.561z" />
      <path d="M11 4H8a2 2 0 0 0-2 2v14" />
      <path d="M14 12h.01" />
      <path d="M22 20h-3" />
    </svg>
  )
}

function SquareParking() {
  return (
    <svg {...BASE}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
    </svg>
  )
}

function TriangleAlert() {
  return (
    <svg {...BASE}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

const MAP: Record<IconName, () => JSX.Element> = {
  'car-front': CarFront,
  'door-open': DoorOpen,
  'square-parking': SquareParking,
  'triangle-alert': TriangleAlert,
}

export function ReasonIcon({ name }: { name: IconName }) {
  const C = MAP[name] ?? TriangleAlert
  return <C />
}
