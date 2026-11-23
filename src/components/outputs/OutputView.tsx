import { CircleCheck } from 'lucide-react'

import { format, useLanguageStore, useT } from '../../i18n'
import type { CellOutput } from '../../journal/types'
import { InspectionPanel } from '../inspect/InspectionPanel'
import { cardClass, cn } from '../ui/styles'
import { ChartOutput, VegaView } from './ChartOutput'
import { HtmlOutput } from './HtmlOutput'
import { mapLayersOf } from './mapLayers'
import { MapOutput } from './MapOutput'
import { formatNumber } from './palette'
import { TableOutput } from './TableOutput'

function Note({ children }: { children: string }) {
  return <p className="mt-2 text-xs text-ink-500">{children}</p>
}

function Single({ output }: { output: CellOutput }) {
  const t = useT()
  const language = useLanguageStore((state) => state.language)

  switch (output.type) {
    case 'table':
      return <TableOutput columns={output.columns} rows={output.rows} totalRows={output.totalRows} />
    case 'chart':
      return (
        <>
          <ChartOutput chart={output} />
          {output.rows.length < output.totalRows && (
            <Note>{format(t.outputs.rowsShownOf, { shown: output.rows.length, total: output.totalRows })}</Note>
          )}
        </>
      )
    case 'map': {
      const { basemap, layers } = mapLayersOf(output)
      const cut = layers.filter((layer) => layer.geojson.features.length < layer.totalFeatures)
      return (
        <>
          <MapOutput layers={layers} basemap={basemap} />
          {cut.map((layer, index) => (
            <Note key={index}>
              {`${layer.name ? `${layer.name}: ` : ''}${format(t.outputs.featuresShownOf, { shown: layer.geojson.features.length, total: layer.totalFeatures })}`}
            </Note>
          ))}
        </>
      )
    }
    case 'vega':
      return <VegaView spec={output.spec} />
    case 'html':
      return <HtmlOutput html={output.html} />
    case 'value':
      return (
        <div className="inline-flex flex-col rounded-2xl bg-gradient-to-br from-brand-50 to-white px-5 py-4 ring-1 ring-brand-100">
          <span className="text-sm font-medium text-ink-500">{output.label}</span>
          <span className="mt-1 text-4xl font-bold tracking-tight text-ink-900 tabular-nums">{formatNumber(output.value, language)}</span>
        </div>
      )
    case 'text': {
      // print("Label:", value) reads as a key figure.
      const figure = output.text.trim().match(/^([^\n:]{1,80}):\s*(-?[\d.,]+(?:e[+-]?\d+)?)$/i)
      if (figure) {
        const value = Number(figure[2])
        return (
          <div className="inline-flex flex-col rounded-2xl bg-gradient-to-br from-brand-50 to-white px-5 py-4 ring-1 ring-brand-100">
            <span className="text-sm font-medium text-ink-500">{figure[1]}</span>
            <span className="mt-1 text-4xl font-bold tracking-tight text-ink-900 tabular-nums">
              {Number.isFinite(value) ? formatNumber(value, language) : figure[2]}
            </span>
          </div>
        )
      }
      return (
        <pre className="overflow-auto rounded-xl bg-ink-50 p-4 font-mono text-sm whitespace-pre-wrap text-ink-800 ring-1 ring-ink-200">
          {output.text.replace(/\n$/, '')}
        </pre>
      )
    }
    case 'inspection':
      return <InspectionPanel profile={output.profile} />
    case 'saved':
      return (
        <p className="flex items-center gap-2 rounded-xl bg-leaf-50 px-3.5 py-2.5 text-sm text-leaf-800 ring-1 ring-leaf-100">
          <CircleCheck className="size-4 shrink-0" />
          {format(t.outputs.saved, { name: output.name, rows: output.rows })}
        </p>
      )
  }
}

/** Charts, maps and tables sit in a card with their title; small outputs stay inline. */
export function OutputView({ outputs }: { outputs: CellOutput[] }) {
  return (
    <div className="flex flex-col gap-4">
      {outputs.map((output, index) => {
        const framed = output.type === 'chart' || output.type === 'map' || output.type === 'vega'
        const title = 'title' in output ? output.title : ''
        return (
          <figure key={index} className={cn('m-0 min-w-0', framed && cn(cardClass, 'p-4'))}>
            {title && <figcaption className="mb-3 font-semibold text-ink-900">{title}</figcaption>}
            <Single output={output} />
          </figure>
        )
      })}
    </div>
  )
}
