/**
 * Variable names for each data block in the generated Python, so several
 * datasets can live side by side. Assigned for the whole workspace before
 * generating code, so a block has the same name in every code view.
 */
const names = new Map<string, string>()

export function setPythonNames(byBlockId: ReadonlyMap<string, string>) {
  names.clear()
  for (const [id, name] of byBlockId) names.set(id, name)
}

export const pythonNameOf = (blockId: string, fallback = 'df') => names.get(blockId) ?? fallback
