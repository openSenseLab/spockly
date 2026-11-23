/** Scroll to a cell once it is rendered (e.g. right after switching from the lab to the journal). */
export const scrollToCell = (id: string, attempts = 30) => {
  const element = document.getElementById(`cell-${id}`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    element.animate(
      [{ boxShadow: '0 0 0 4px rgba(122, 182, 41, 0.55)' }, { boxShadow: '0 0 0 4px rgba(122, 182, 41, 0)' }],
      { duration: 1800, easing: 'ease-out' },
    )
  } else if (attempts > 0) {
    window.setTimeout(() => scrollToCell(id, attempts - 1), 100)
  }
}
