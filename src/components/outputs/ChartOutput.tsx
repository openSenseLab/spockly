import { useEffect, useMemo, useRef } from 'react'

import { useLanguageStore, useT } from '../../i18n'
import type { CellOutput, ColumnKind } from '../../journal/types'
import { CATEGORICAL, NEUTRAL_MARK } from './palette'

type Chart = Extract<CellOutput, { type: 'chart' }>

const vlType = (kind: ColumnKind | undefined) =>
  kind === 'number' ? 'quantitative' : kind === 'date' ? 'temporal' : 'nominal'

/** Vega-Lite treats dots and brackets in field names as nested access. */
const field = (name: string) => name.replace(/([.[\]\\])/g, '\\$1')

const buildSpec = (chart: Chart) => {
  const kindOf = (name: string) => chart.fields.find((f) => f.name === name)?.kind
  const x = { field: field(chart.x), type: vlType(kindOf(chart.x)), title: chart.x }
  const y = chart.y
    ? { field: field(chart.y), type: vlType(kindOf(chart.y)), title: chart.y }
    : { aggregate: 'count', type: 'quantitative', title: '#' }
  const color = chart.color
    ? {
        field: field(chart.color),
        type: vlType(kindOf(chart.color)),
        title: chart.color,
        scale: kindOf(chart.color) === 'number' ? { scheme: 'blues' } : { range: CATEGORICAL },
      }
    : undefined

  const encodings: Record<string, object> = {
    // sort: null keeps the row order, so a "sort by" step decides the bar order.
    bar: { x: { ...x, type: x.type === 'quantitative' ? 'ordinal' : x.type, sort: null, axis: { labelAngle: 0 } }, y, color },
    line: { x, y, color },
    scatter: { x, y, color },
    histogram: { x: { ...x, bin: { maxbins: 20 } }, y: { aggregate: 'count', type: 'quantitative', title: '#' }, color },
  }
  const marks: Record<string, object> = {
    bar: { type: 'bar', cornerRadiusEnd: 4, color: NEUTRAL_MARK },
    histogram: { type: 'bar', cornerRadiusEnd: 4, color: NEUTRAL_MARK, binSpacing: 2 },
    line: { type: 'line', strokeWidth: 2, point: { size: 30 }, color: NEUTRAL_MARK },
    scatter: { type: 'circle', size: 64, opacity: 0.8, stroke: '#fff', strokeWidth: 1, color: NEUTRAL_MARK },
  }

  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: 'container',
    height: 300,
    data: { values: chart.rows },
    mark: { ...marks[chart.kind], tooltip: true },
    encoding: encodings[chart.kind],
    config: {
      font: 'Mulish Variable, Muli, system-ui, sans-serif',
      axis: { gridColor: '#e7e9ee', domainColor: '#b8bcc6', tickColor: '#b8bcc6', labelColor: '#52514e', titleColor: '#52514e' },
      legend: { labelColor: '#52514e', titleColor: '#52514e' },
      view: { stroke: null },
    },
  }
}

/** Shared look for every chart: palette, font and recessive axes (merged into Altair's specs too). */
const THEME = {
  font: 'Mulish Variable, Muli, system-ui, sans-serif',
  axis: { gridColor: '#e4e4df', domainColor: '#d0d0c9', tickColor: '#d0d0c9', labelColor: '#55554f', titleColor: '#55554f' },
  legend: { labelColor: '#55554f', titleColor: '#55554f' },
  title: { color: '#3f3f3c', fontWeight: 600, anchor: 'start' as const },
  range: { category: CATEGORICAL },
  mark: { color: NEUTRAL_MARK },
  bar: { cornerRadiusEnd: 4 },
  view: { stroke: null },
}

/** Renders a Vega-Lite specification (from Altair or built here) with the app's theme. */
export function VegaView({ spec }: { spec: object }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const t = useT()
  const language = useLanguageStore((state) => state.language)

  useEffect(() => {
    let disposed = false
    let finalize: (() => void) | undefined
    import('vega-embed').then(async ({ default: embed }) => {
      if (disposed || !hostRef.current) return
      const result = await embed(hostRef.current, { height: 300, ...spec } as never, {
        actions: { export: true, source: false, compiled: false, editor: false },
        renderer: 'svg',
        config: THEME as never,
        i18n: { PNG_ACTION: t.outputs.savePng, SVG_ACTION: t.outputs.saveSvg } as never,
        formatLocale: language === 'de' ? { decimal: ',', thousands: '.', grouping: [3], currency: ['', ' €'] } : undefined,
      })
      finalize = () => result.finalize()
      if (disposed) finalize()
    })
    return () => {
      disposed = true
      finalize?.()
    }
  }, [spec, language, t])

  return <div ref={hostRef} className="w-full min-w-0" />
}

/** Charts saved before Altair: the spec is built from the stored description. */
export function ChartOutput({ chart }: { chart: Chart }) {
  const spec = useMemo(() => buildSpec(chart), [chart])
  return <VegaView spec={spec} />
}
