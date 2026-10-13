/** Registers all SPOCKLY block definitions (side-effect imports). */
import './load_huwise/definition'
import './load_huwise/python'
import './load_osem/definition'
import './load_osem/python'
import './load_nasa_power/definition'
import './load_nasa_power/python'

import type { DataTable, ExecContext } from '../core/types'
import { loadHuwiseOperation, type LoadHuwiseParams } from './load_huwise/operation'
import { loadOsemOperation } from './load_osem/operation'
import { normalizeParams } from './load_osem/mapping'
import { loadNasaPowerOperation } from './load_nasa_power/operation'
import { normalizeParams as normalizeNasaParams } from './load_nasa_power/mapping'

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
export { spocklyTheme } from './theme'
export { setPythonNames } from './pythonNames'

import type * as Blockly from 'blockly'
import { huwisePythonBase } from './load_huwise/python'
import { osemPythonBase } from './load_osem/python'
import { nasaPythonBase } from './load_nasa_power/python'

/** Text a data block's Python variable name is made from, by block type. */
export const pythonBaseNames: Record<string, (block: Blockly.Block) => string> = {
  load_huwise: huwisePythonBase,
  load_osem: osemPythonBase,
  load_nasa_power: nasaPythonBase,
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
}
