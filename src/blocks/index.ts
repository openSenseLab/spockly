/** Registers all SPOCKLY block definitions (side-effect imports). */
import './load_huwise/definition'
import './load_huwise/python'
import './load_osem/definition'
import './load_osem/python'
import './load_nasa_power/definition'
import './load_nasa_power/python'
import './load_natural_earth/definition'
import './load_natural_earth/python'
import './load_nasa_grid/definition'
import './load_nasa_grid/python'
import './load_osm/definition'
import './load_osm/python'
import './predict/definition'
import './predict/python'

import type { DataTable, ExecContext } from '../core/types'
import { loadHuwiseOperation, type LoadHuwiseParams } from './load_huwise/operation'
import { loadOsemOperation } from './load_osem/operation'
import { normalizeParams } from './load_osem/mapping'
import { loadNasaPowerOperation } from './load_nasa_power/operation'
import { normalizeParams as normalizeNasaParams } from './load_nasa_power/mapping'
import { loadNaturalEarthOperation, type LoadNaturalEarthParams } from './load_natural_earth/operation'
import { normalizeGridParams } from './load_nasa_grid/mapping'
import { loadNasaGridOperation, today } from './load_nasa_grid/operation'
import { normalizeOsmParams } from './load_osm/mapping'
import { loadOsmOperation } from './load_osm/operation'
import { OSM_TOPICS } from './load_osm/presets'

export { LOAD_HUWISE } from './load_huwise/definition'
export { loadHuwiseToStep } from './load_huwise/generator'
export { LOAD_OSEM, setOsemParams } from './load_osem/definition'
export {
  markSetupShown,
  needsSetup,
  requestBlockSetup,
  setBlockSetupOpener,
  type SetupBlock,
} from './setup'
export type { OsemBlock } from './load_osem/definition'
export { loadOsemToStep } from './load_osem/generator'
export { LOAD_NASA_POWER, setNasaParams, type NasaBlock } from './load_nasa_power/definition'
export { loadNasaPowerToStep } from './load_nasa_power/generator'
export { LOAD_NATURAL_EARTH } from './load_natural_earth/definition'
export { loadNaturalEarthToStep } from './load_natural_earth/generator'
export { LOAD_NASA_GRID } from './load_nasa_grid/definition'
export { loadNasaGridToStep } from './load_nasa_grid/generator'
export { LOAD_OSM } from './load_osm/definition'
export { loadOsmToStep } from './load_osm/generator'
export { PREDICT, refreshPrediction, resetPrediction, setRevealed, type PredictBlock } from './predict/definition'
export { predictToStep } from './predict/generator'
export { setTableProvider } from './fields/columnDropdown'
export { spocklyTheme } from './theme'
export { setPythonNames } from './pythonNames'

import type * as Blockly from 'blockly'
import { huwisePythonBase } from './load_huwise/python'
import { osemPythonBase } from './load_osem/python'
import { nasaPythonBase } from './load_nasa_power/python'
import { naturalEarthPythonBase } from './load_natural_earth/python'
import { nasaGridPythonBase } from './load_nasa_grid/python'
import { osmPythonBase } from './load_osm/python'

/** Text a data block's Python variable name is made from, by block type. */
export const pythonBaseNames: Record<string, (block: Blockly.Block) => string> = {
  load_huwise: huwisePythonBase,
  load_osem: osemPythonBase,
  load_nasa_power: nasaPythonBase,
  load_natural_earth: naturalEarthPythonBase,
  load_nasa_grid: nasaGridPythonBase,
  load_osm: osmPythonBase,
}

/** Load operations by op name; the runner looks them up here. */
export const loadOperations: Record<
  string,
  (params: Record<string, unknown>, ctx: ExecContext) => Promise<DataTable>
> = {
  load_huwise: (params, ctx) =>
    loadHuwiseOperation.execute(null, params as unknown as LoadHuwiseParams, ctx),
  load_osem: (params, ctx) => loadOsemOperation.execute(null, normalizeParams(params), ctx),
  load_nasa_power: (params, ctx) =>
    loadNasaPowerOperation.execute(null, normalizeNasaParams(params), ctx),
  load_natural_earth: (params, ctx) =>
    loadNaturalEarthOperation.execute(null, params as unknown as LoadNaturalEarthParams, ctx),
  load_nasa_grid: (params, ctx) => loadNasaGridOperation.execute(null, normalizeGridParams(params, today()), ctx),
  load_osm: (params, ctx) => loadOsmOperation.execute(null, normalizeOsmParams(params, OSM_TOPICS), ctx),
}
