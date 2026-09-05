export type DriveAxes = { forward: number; turn: number };
export interface KeyboardControlOptions {
  /** Evaluated on each keydown, so pause/loading/fall guards stay with the host. */
  canDrive(): boolean;
  onDriveStart(): void;
  onClear(): void;
  /** Return true when the host handles a shortcut. Form fields are excluded. */
  onShortcut?(event: KeyboardEvent): boolean;
}

const movementKeys = new Set(["KeyW", "KeyS", "KeyA", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/** No renderer, simulation, timers or DOM selectors. The host samples axes in its own loop. */
export function createKeyboardControls(host: Window, options: KeyboardControlOptions) {
  const pressed = new Set<string>();
  const document = host.document;
  const editing = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    return typeof element?.closest === "function" && !!element.closest("input, select, textarea, [contenteditable]:not([contenteditable=false])");
  };
  const clear = () => { pressed.clear(); options.onClear(); };
  const keydown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || editing(event.target)) return;
    if (options.onShortcut?.(event)) { event.preventDefault(); return; }
    if (!movementKeys.has(event.code) || !options.canDrive()) return;
    event.preventDefault();
    pressed.add(event.code);
    options.onDriveStart();
  };
  const keyup = (event: KeyboardEvent) => { pressed.delete(event.code); };
  const visibility = () => { if (document.hidden) clear(); };
  const focus = (event: FocusEvent) => { if (editing(event.target)) clear(); };
  host.addEventListener("keydown", keydown);
  host.addEventListener("keyup", keyup);
  host.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", visibility);
  document.addEventListener("focusin", focus);
  return {
    sample(): DriveAxes {
      return {
        forward: Number(pressed.has("KeyW") || pressed.has("ArrowUp")) - Number(pressed.has("KeyS") || pressed.has("ArrowDown")),
        turn: Number(pressed.has("KeyA") || pressed.has("ArrowLeft")) - Number(pressed.has("KeyD") || pressed.has("ArrowRight")),
      };
    },
    clear,
    dispose() {
      host.removeEventListener("keydown", keydown);
      host.removeEventListener("keyup", keyup);
      host.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("focusin", focus);
      clear();
    },
  };
}
