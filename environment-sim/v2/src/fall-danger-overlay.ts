import type { RoomFall } from "./falls";
import type { DangerLevel } from "./fall-danger";
import "./fall-danger-overlay.css";

const levels: DangerLevel[] = ["low", "medium", "high", "critical"];
const labels = { low: "Low", medium: "Moderate", high: "High", critical: "Critical" };

/** Mount once, update each frame; remains visible for the same fall through recovery. */
export function createFallDangerOverlay(host: HTMLElement) {
  const panel = document.createElement("section");
  panel.className = "fall-danger";
  panel.hidden = true;
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");
  panel.setAttribute("aria-atomic", "true");
  panel.innerHTML = `<div class="fall-danger-heading"><span class="fall-danger-icon" aria-hidden="true">!</span><div><strong data-title></strong><span data-phase></span></div></div>
    <dl>${[["likelihood", "Fall likelihood"], ["intensity", "Danger intensity"]].map(([key, label]) => `<div data-rating="${key}"><dt>${label}</dt><dd><strong></strong><span class="danger-meter" aria-hidden="true">${levels.map(() => "<i></i>").join("")}</span></dd></div>`).join("")}</dl>
    <p data-basis></p>`;
  host.append(panel);
  let previous = "";
  return {
    update(fall: RoomFall | null, status: string) {
      const key = fall ? JSON.stringify([fall.hazard, status]) : "";
      if (key === previous) return;
      previous = key;
      panel.hidden = !fall;
      if (!fall) return;
      panel.querySelector("[data-title]")!.textContent = fall.hazard?.label ?? "Simulated fall";
      panel.querySelector("[data-phase]")!.textContent = status === "recovering" ? "Getting back up" : status === "fallen"
        ? fall.obstacle?.support ? "Fall detected · Caught on the ottoman" : "Fall detected · On the floor" : "Fall detected";
      for (const dimension of ["likelihood", "intensity"] as const) {
        const level = fall.hazard?.danger?.[dimension];
        const row = panel.querySelector<HTMLElement>(`[data-rating="${dimension}"]`)!;
        row.dataset.level = level ?? "unknown";
        row.querySelector("strong")!.textContent = level ? labels[level] : "Not rated";
        row.querySelectorAll("i").forEach((bar, index) => bar.classList.toggle("filled", !!level && index <= levels.indexOf(level)));
      }
      panel.querySelector("[data-basis]")!.textContent = fall.hazard?.danger
        ? "Scenario ratings · Likelihood at contact / intensity if a fall occurs"
        : fall.hazard ? "No scenario ratings assigned to this hazard" : "Manual fall demo · No hazard assessment";
    },
    dispose() { panel.remove(); },
  };
}
