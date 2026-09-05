import type { Viewer } from "../viewer";
import type { MovementProgram } from "./program";

/** Direct walking input; agents author longer sequences through MovementProgram. */
export function attachClickWalking(options: {
  viewer: Viewer;
  program(): MovementProgram;
  enabled(): boolean;
  beforeRun(): void;
  onMessage(message: string): void;
}) {
  const canvas = options.viewer.renderer.domElement;
  let down: { x: number; y: number; id: number } | undefined;
  const pointerDown = (event: PointerEvent) => {
    down = event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : undefined;
  };
  const cancel = () => { down = undefined; };
  const pointerUp = (event: PointerEvent) => {
    const start = down; cancel();
    if (!start || start.id !== event.pointerId || !options.enabled() || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
    const target = options.viewer.pickMovementTarget(event.clientX, event.clientY);
    if (!target) { options.onMessage("Choose a visible floor surface."); return; }
    try {
      options.beforeRun();
      options.program().run([{ type: "walk", ...target }]);
      options.onMessage(options.program().status === "blocked" ? options.program().message : "");
    } catch (error) { options.onMessage(error instanceof Error ? error.message : String(error)); }
  };
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", cancel);
  return () => {
    canvas.removeEventListener("pointerdown", pointerDown);
    canvas.removeEventListener("pointerup", pointerUp);
    canvas.removeEventListener("pointercancel", cancel);
  };
}
