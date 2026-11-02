import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Flex, Select, Table, Text } from '@radix-ui/themes'

import { niceTicks, parseTime, stepsFor, timeColumnsOf, timeSeriesOf, type SeriesStat, type TimeStep } from '../core/timeseries'
import type { ColumnMeta, DataTable } from '../core/types'
import { formatDate, formatNumber, lang, pick, t } from '../i18n'

/**
 * Categorical slots 1–3 of the dataviz palette (blue, orange, aqua; checked
 * with its validator, light surface). One line uses slot 1.
 */
const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a']
const HEIGHT = 220
const MARGIN = { top: 12, right: 12, bottom: 26, left: 48 }
/** Columns (for counts) are at most this wide. */
const MAX_COLUMN = 24
/** Below this many points, every point gets a dot. */
const DOTS_UP_TO = 40

const STATS: Exclude<SeriesStat, 'count'>[] = ['mean', 'max', 'min']
const COUNT = '__count__'

const nameOf = (column: ColumnMeta) => pick(column.label) ?? column.name

/** Short x-axis labels by step; the tooltip and the table use the full date. */
function axisLabel(at: number, step: TimeStep, sameDay: boolean): string {
  const d = new Date(at)
  if (step === 'year') return String(d.getFullYear())
  if (step === 'month') return new Intl.DateTimeFormat(lang, { month: 'short', year: '2-digit' }).format(d)
  if (step === 'day') return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'numeric' }).format(d)
  return new Intl.DateTimeFormat(lang, sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
}

/** Full label of a point: the step's own precision ("Okt. 2024", "27.10.2026, 14:00"). */
const pointLabel = (key: string, at: number, step: TimeStep) =>
  step === 'raw' ? new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(at) : formatDate(key)

/** Axis numbers: whole numbers from 1 000 up, else at most two decimals. */
const tickText = (v: number) => formatNumber((Math.abs(v) >= 1000 ? Math.round(v) : Math.round(v * 100) / 100) + 0)

/**
 * Values over time for data with a time column: one measurement (mean,
 * highest or lowest per step) or the number of rows per step. Up to three
 * places get a line each; more are one line with the range of their values
 * as a band. Columns hidden for a guess are left out.
 */
export function TimeChart({ table, hidden }: { table: DataTable; hidden: ReadonlySet<string> }) {
  const measures = useMemo(() => table.columns.filter((c) => c.semanticType === 'measurement' && !hidden.has(c.name)), [table, hidden])
  const [chosen, setChosen] = useState<string | undefined>(undefined)
  const timeColumns = useMemo(() => timeColumnsOf(table), [table])
  const [chosenTime, setChosenTime] = useState<string | undefined>(undefined)
  const time = (timeColumns.find((c) => c.name === chosenTime) ?? timeColumns[0])?.name
  const [stat, setStat] = useState<Exclude<SeriesStat, 'count'>>('mean')
  const [step, setStep] = useState<TimeStep | 'auto'>('auto')
  const [asTable, setAsTable] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(480)

  useEffect(() => {
    const element = box.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry.contentRect.width))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // A measurement by default; "count" when there is none (sightings, quakes …) or when chosen.
  const measure = chosen === COUNT ? undefined : (measures.find((c) => c.name === chosen) ?? measures[0])
  const counting = !measure

  const choice = useMemo(() => {
    if (!time) return null
    const times = table.rows.flatMap((r) => {
      const ms = parseTime(r[time])
      return ms === null ? [] : [ms]
    })
    return stepsFor(times)
  }, [table, time])
  const shownStep: TimeStep = step !== 'auto' && choice?.steps.some((s) => s.step === step) ? step : (choice?.auto ?? 'day')

  const data = useMemo(
    () => (choice ? timeSeriesOf(table, { measure: measure?.name, stat: counting ? 'count' : stat, step: shownStep, time }) : null),
    [table, measure, counting, stat, shownStep, choice, time],
  )
  if (!choice || !data) return null

  const { points, series } = data
  const plotW = width - MARGIN.left - MARGIN.right
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom

  // Scales.
  const [t0, t1] = [points[0].at, points.at(-1)!.at]
  const span = t1 - t0 || 1
  // Columns sit in the middle of their slot; lines from the first to the last point.
  const slot = plotW / points.length
  const x = (i: number) => (counting ? MARGIN.left + slot * (i + 0.5) : MARGIN.left + ((points[i].at - t0) / span) * plotW)
  const all = series.flatMap((s) => [...s.values, ...(s.low ?? []), ...(s.high ?? [])]).filter((v): v is number => v !== null)
  let [lo, hi] = all.length ? [Math.min(...all), Math.max(...all)] : [0, 1]
  if (counting) lo = 0
  if (lo === hi) [lo, hi] = [lo - 1, hi + 1]
  const ticks = niceTicks(lo, hi)
  ;[lo, hi] = [Math.min(lo, ticks[0] ?? lo), Math.max(hi, ticks.at(-1) ?? hi)]
  const y = (v: number) => MARGIN.top + plotH - ((v - lo) / (hi - lo)) * plotH

  // Line paths with gaps where a step has no value.
  const linePath = (values: (number | null)[]) => {
    let d = ''
    let open = false
    values.forEach((v, i) => {
      if (v === null) {
        open = false
        return
      }
      d += `${open ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
      open = true
    })
    return d
  }
  const bandPath = (low: (number | null)[], high: (number | null)[]) => {
    // One closed shape per run of steps that have values.
    const runs: number[][] = []
    low.forEach((v, i) => {
      if (v === null || high[i] === null) return
      const run = runs.at(-1)
      if (run && run.at(-1) === i - 1) run.push(i)
      else runs.push([i])
    })
    return runs
      .map((run) => {
        const top = run.map((i) => `${x(i).toFixed(1)},${y(high[i]!).toFixed(1)}`)
        const bottom = [...run].reverse().map((i) => `${x(i).toFixed(1)},${y(low[i]!).toFixed(1)}`)
        return `M${top.join('L')}L${bottom.join('L')}Z`
      })
      .join('')
  }
  const columnPath = (i: number, v: number) => {
    const w = Math.max(1, Math.min(MAX_COLUMN, slot - 2))
    const [left, top, base] = [x(i) - w / 2, y(v), y(0)]
    const r = Math.min(4, w / 2, base - top)
    if (base - top < 0.5) return ''
    // Rounded at the data end, square at the baseline.
    return `M${left},${base}V${top + r}Q${left},${top} ${left + r},${top}H${left + w - r}Q${left + w},${top} ${left + w},${top + r}V${base}Z`
  }

  // X labels: as many as fit, evenly spread.
  const labelCount = Math.max(2, Math.min(points.length, Math.floor(plotW / 90)))
  const labelIdx = [...new Set(Array.from({ length: labelCount }, (_, k) => Math.round((k * (points.length - 1)) / (labelCount - 1))))]
  const sameDay = new Date(t0).toDateString() === new Date(t1).toDateString()

  const unit = measure?.unit ? ` (${measure.unit})` : ''
  const valueText = (v: number | null) => (v === null ? t('chart.noValue') : `${formatNumber(Math.round(v * 100) / 100)}${measure?.unit ? ` ${measure.unit}` : ''}`)
  const yTitle = counting ? t('chart.rowCount') : `${nameOf(measure!)}: ${t(`map.stat.${stat}`)}${unit}`
  const stepName = t(`chart.step.${shownStep}`)
  const onePlaceLine = series.length === 1
  const band = onePlaceLine && series[0].low && data.places !== 1

  // The crosshair snaps to the nearest point.
  const snapTo = (clientX: number) => {
    const svg = box.current?.querySelector('svg')
    if (!svg) return
    const px = clientX - svg.getBoundingClientRect().left
    let best = 0
    points.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i
    })
    setHover(best)
  }
  const shown = hover !== null && hover < points.length ? hover : null

  const notes = [
    counting ? t('chart.countNote', { step: stepName }) : t('chart.valueNote', { stat: t(`map.stat.${stat}`), step: stepName }),
    data.places > 1 && onePlaceLine && t('chart.allPlaces', { count: formatNumber(data.places) }),
    band && t('chart.band'),
    data.withoutTime > 0 && t('chart.withoutTime', { count: formatNumber(data.withoutTime) }),
  ].filter(Boolean)

  return (
    <Flex direction="column" gap="2">
      <Flex gap="2" wrap="wrap" align="center" role="group" aria-label={t('chart.shows')}>
        <Text size="1" color="gray">
          {t('chart.shows')}
        </Text>
        <Button size="1" variant={counting ? 'solid' : 'soft'} color={counting ? undefined : 'gray'} aria-pressed={counting} onClick={() => setChosen(COUNT)}>
          {t('chart.rowCount')}
        </Button>
        {measures.map((c) => (
          <Button
            key={c.name}
            size="1"
            variant={c === measure ? 'solid' : 'soft'}
            color={c === measure ? undefined : 'gray'}
            aria-pressed={c === measure}
            onClick={() => setChosen(c.name)}
          >
            {nameOf(c)}
          </Button>
        ))}
      </Flex>
      <Flex gap="3" wrap="wrap" align="center">
        {/* Data can have several times (GBIF: when seen, when last processed); the best is chosen first. */}
        {timeColumns.length > 1 && (
          <Flex gap="2" align="center">
            <Text size="1" color="gray">
              {t('chart.timeColumn')}
            </Text>
            <Select.Root size="1" value={time} onValueChange={setChosenTime}>
              <Select.Trigger aria-label={t('chart.timeColumn')} />
              <Select.Content>
                {timeColumns.map((c) => (
                  <Select.Item key={c.name} value={c.name}>
                    {nameOf(c)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>
        )}
        <Flex gap="2" align="center">
          <Text size="1" color="gray">
            {t('chart.step')}
          </Text>
          <Select.Root size="1" value={step === 'auto' ? 'auto' : shownStep} onValueChange={(v) => setStep(v as TimeStep | 'auto')}>
            <Select.Trigger aria-label={t('chart.step')} />
            <Select.Content>
              <Select.Item value="auto">{t('chart.auto', { step: t(`chart.step.${choice.auto}`) })}</Select.Item>
              {choice.steps.map((s) => (
                <Select.Item key={s.step} value={s.step}>
                  {t(`chart.step.${s.step}`)} ({formatNumber(s.count)})
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Flex>
        {!counting && (
          <Flex gap="2" align="center">
            <Text size="1" color="gray">
              {t('chart.statLabel')}
            </Text>
            <Select.Root size="1" value={stat} onValueChange={(v) => setStat(v as Exclude<SeriesStat, 'count'>)}>
              <Select.Trigger aria-label={t('chart.statLabel')} />
              <Select.Content>
                {STATS.map((s) => (
                  <Select.Item key={s} value={s}>
                    {t(`map.stat.${s}`)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>
        )}
        <Button size="1" variant="ghost" onClick={() => setAsTable((v) => !v)}>
          {asTable ? t('chart.asChart') : t('chart.asTable')}
        </Button>
      </Flex>

      <Text size="1" weight="medium">
        {yTitle}
      </Text>
      <div ref={box} className="time-chart" hidden={asTable}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${yTitle} – ${t('chart.title')}`}
          tabIndex={0}
          onPointerMove={(e) => snapTo(e.clientX)}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover((h) => h ?? points.length - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? points.length) - 1))
            if (e.key === 'ArrowRight') setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1))
          }}
        >
          {/* Recessive hairline grid and y ticks. */}
          {ticks.map((v) => (
            <g key={v}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(v)} y2={y(v)} className="chart-grid" />
              <text x={MARGIN.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="chart-tick">
                {tickText(v)}
              </text>
            </g>
          ))}
          {labelIdx.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor={i === 0 && !counting ? 'start' : i === points.length - 1 && !counting ? 'end' : 'middle'}
              className="chart-tick"
            >
              {axisLabel(points[i].at, shownStep, sameDay)}
            </text>
          ))}

          {counting
            ? series[0].values.map((v, i) => (v ? <path key={i} d={columnPath(i, v)} fill={SERIES_COLORS[0]} opacity={shown === null || shown === i ? 1 : 0.55} /> : null))
            : series.map((s, k) => (
                <g key={k}>
                  {s.low && s.high && band && <path d={bandPath(s.low, s.high)} fill={SERIES_COLORS[k]} opacity={0.1} />}
                  <path d={linePath(s.values)} fill="none" stroke={SERIES_COLORS[k]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {s.values.map((v, i) => {
                    const alone = (s.values[i - 1] ?? null) === null && (s.values[i + 1] ?? null) === null
                    return v !== null && (points.length <= DOTS_UP_TO || alone) ? (
                      <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={SERIES_COLORS[k]} className="chart-dot" />
                    ) : null
                  })}
                </g>
              ))}

          {shown !== null && (
            <g pointerEvents="none">
              <line x1={x(shown)} x2={x(shown)} y1={MARGIN.top} y2={MARGIN.top + plotH} className="chart-crosshair" />
              {!counting &&
                series.map((s, k) =>
                  s.values[shown] !== null ? <circle key={k} cx={x(shown)} cy={y(s.values[shown]!)} r={4} fill={SERIES_COLORS[k]} className="chart-dot" /> : null,
                )}
            </g>
          )}
        </svg>
        {shown !== null && (
          <div
            className="chart-tooltip"
            style={x(shown) > width / 2 ? { right: width - x(shown) + 10 } : { left: x(shown) + 10 }}
            role="status"
          >
            <div className="chart-tooltip-time">{pointLabel(points[shown].key, points[shown].at, shownStep)}</div>
            {series.map((s, k) => (
              <div key={k} className="chart-tooltip-row">
                <span className="chart-key" style={{ background: SERIES_COLORS[k] }} />
                <strong>{counting ? formatNumber(s.values[shown] ?? 0) : valueText(s.values[shown])}</strong>
                {s.label && <span className="chart-tooltip-label">{s.label}</span>}
              </div>
            ))}
            {band && series[0].low?.[shown] != null && series[0].low[shown] !== series[0].high?.[shown] && (
              <div className="chart-tooltip-label">
                {t('chart.range', { low: valueText(series[0].low[shown]), high: valueText(series[0].high![shown]) })}
              </div>
            )}
          </div>
        )}
      </div>

      {asTable && (
        <Box className="table-scroll">
          <Table.Root size="1" variant="surface" className="dataset-table scroll-table preview-table">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>{stepName}</Table.ColumnHeaderCell>
                {series.map((s, k) => (
                  <Table.ColumnHeaderCell key={k}>{s.label ?? (counting ? t('chart.rowCount') : nameOf(measure!))}</Table.ColumnHeaderCell>
                ))}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {points.map((p, i) => (
                <Table.Row key={p.key}>
                  <Table.Cell>{pointLabel(p.key, p.at, shownStep)}</Table.Cell>
                  {series.map((s, k) => (
                    <Table.Cell key={k}>{counting ? formatNumber(s.values[i] ?? 0) : valueText(s.values[i])}</Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      )}

      {series.length > 1 && (
        <Flex gap="3" wrap="wrap" role="list" aria-label={t('chart.places')}>
          {series.map((s, k) => (
            <Flex key={k} align="center" gap="1" role="listitem">
              <span className="chart-key" style={{ background: SERIES_COLORS[k] }} />
              <Text size="1" color="gray">
                {s.label}
              </Text>
            </Flex>
          ))}
        </Flex>
      )}
      <Text as="p" size="1" color="gray">
        {notes.join(' · ')}
      </Text>
    </Flex>
  )
}
