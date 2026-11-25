import { useT } from '../../i18n'
import type { SampleId } from '../../journal/samples'
import type { DataSourceRef } from '../../journal/types'

/** Human-readable label for where a dataset came from. */
export const useSourceLabel = () => {
  const t = useT()
  return (source: DataSourceRef) => {
    if (source.kind === 'example') {
      return `${t.sources.example}: ${t.samples[source.ref as SampleId]?.title ?? source.ref}`
    }
    return `${t.sources[source.kind]}: ${source.ref}`
  }
}
