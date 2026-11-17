import * as Blockly from "blockly";

/** How long the mouse rests on a block before its explanation appears (ms). Blockly's own: 750. */
export const TOOLTIP_DELAY = 300;

/** An element Blockly gave a tooltip (a block's shape, a field): it carries the tooltip's owner. */
type TooltipElement = Element & { tooltip: unknown };

const tooltipElementAt = (target: EventTarget | null): TooltipElement | null => {
  for (let element = target instanceof Element ? target : null; element; element = element.parentElement) {
    if ((element as Partial<TooltipElement>).tooltip) return element as TooltipElement;
  }
  return null;
};

/**
 * Shows block tooltips sooner than Blockly does. Blockly's 750 ms are written
 * into its code (Tooltip.HOVER_MS is only for reading), so this starts its own,
 * shorter timer and then shows the tooltip with Blockly's public
 * Tooltip.display. That places a tooltip at the bottom corner of what it
 * measures; the stand-in measures as a point under the mouse, so the tooltip
 * appears where Blockly would put it and hides, as usual, once the mouse moves
 * on. Like Blockly, it shows once per hover; nothing during a drag (Blockly
 * blocks tooltips then). Returns the clean-up.
 */
export function quickTooltips(workspace: Blockly.WorkspaceSvg): () => void {
  const area = workspace.getInjectionDiv();
  let timer = 0;
  let shownFor: Element | null = null;

  const cancel = () => {
    window.clearTimeout(timer);
    timer = 0;
  };

  /** A dropdown menu or a text editor is open: a tooltip would cover it (and catch its clicks). */
  const menuOpen = () => Blockly.DropDownDiv.isVisible() || Blockly.WidgetDiv.isVisible();

  const onMove = (event: PointerEvent) => {
    cancel();
    const element = tooltipElementAt(event.target);
    if (!element) {
      shownFor = null;
      return;
    }
    if (element === shownFor || Blockly.Tooltip.isVisible() || event.buttons || menuOpen()) return;
    const { pageX, pageY } = event;
    timer = window.setTimeout(() => {
      // The click that opened a menu may come after the last move.
      if (menuOpen()) return;
      shownFor = element;
      const point = { x: pageX, y: pageY, width: 0, height: 0 };
      const standIn = {
        tooltip: element.tooltip,
        RTL: workspace.RTL,
        getFocusableElement: () => ({ getBoundingClientRect: () => point }),
      };
      Blockly.Tooltip.display(standIn as unknown as Blockly.IFocusableNode, workspace);
    }, TOOLTIP_DELAY);
  };

  const onLeave = () => {
    cancel();
    shownFor = null;
  };

  area.addEventListener("pointermove", onMove);
  area.addEventListener("pointerdown", cancel);
  area.addEventListener("pointerleave", onLeave);
  return () => {
    cancel();
    area.removeEventListener("pointermove", onMove);
    area.removeEventListener("pointerdown", cancel);
    area.removeEventListener("pointerleave", onLeave);
  };
}
