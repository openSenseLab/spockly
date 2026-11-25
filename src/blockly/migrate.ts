import { migrateSelections } from './selection'
import { migrateValueSlots } from './valueInputs'

/** Bring a workspace saved by an older version up to date before Blockly loads it. */
export const migrateWorkspace = <T>(state: T): T => migrateSelections(migrateValueSlots(state))
