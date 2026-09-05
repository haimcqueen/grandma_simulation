# House hazard simulation — full project context

For the newer house visuals, second floor, continuous stair traversal, and replaceable asset API, read [the September 5 environment handoff](docs/TEAM-HANDOFF-HOUSE.md). It supersedes the ground-floor-only and no-stairs descriptions below.

Portable context for an LLM or a new teammate. Written 2026-09-05, mid-hackathon
(Spatial Intelligence + Generative 3D, San Francisco; submissions 18:00).

---

## 1. What this is

A browser simulation of a real ground-floor house, with swappable human/animal
subjects walking or crawling through it, used to examine household hazards.

Two codebases, one repo:

| Path | Owner | State |
|---|---|---|
| `environment-sim/v1-draft/` | teammate (committed) + robot layer (uncommitted) | **the live app** |
| `web/` | separate exploration | superseded; keep only for its hazard module |
| `sandbox/` | clone of Microduck Sandbox (HF Space) | reference only |

Only `environment-sim/v1-draft/` matters. `web/` was an independent app built
before the team repo existed; it duplicates scene ownership and should not be
merged. Its one reusable piece is `web/src/scenario/` (see §7).

---

## 2. Run it

```sh
cd environment-sim/v1-draft
npm ci
npm run dev        # http://localhost:5173 (or next free port)
npm test           # 19 tests, tsx --test
```

Node 22.12+. Vite + TypeScript + three.js 0.185. No backend, no API keys.

---

## 3. The house (teammate's, committed)

Tantau Ave, Cupertino — a real listing (6 bed, 2 storey, 2,611 sq ft). Ground
floor only.

- **`src/environment.ts`** — stable object and destination IDs, authored
  footprints, scenario obstacles, floor regions. Metres, right-handed Y-up,
  **plan front is +Z**.
- **`src/navigation.ts`** — eight-neighbour A* on a 0.2 m grid, 0.28 m
  clearance, no diagonal corner cutting, collision-checked route simplification.
  Rendering and planning share the same footprint data.
- **`src/simulation.ts`** — **sole owner** of resident, task, scenario, clock and
  observation state. API: `requestDestination`, `setScenario`, `advance`,
  `reset`, plus `setManual` / `drive` (added, see §5). Changes bump
  `revision` and synchronously replan. No async navigation results.
- **`src/scene.ts`** — three.js presentation and destination picking.
  **Character forward is +Z**; heading rotates about Y.
- **`src/main.ts`** — controls and one fixed-step **60 Hz** loop; rendering at
  display rate. Long frame gaps clamped.

Interactions: pick a destination, place an obstruction ("Add cart", "Block
route"), watch it detour or report no route. Pause, reset, floor-plan camera,
navigation-clearance overlay.

---

## 4. The subjects (added, uncommitted)

`src/robot/` — six files, ~440 lines, no dependency on the house code.

- **`robot.ts`** — loads a baked GLB + joint-axis JSON. `set(joint, angle)`
  rotates about the URDF axis relative to the baked rest pose.
  `settleOnGround(lift)` measures the bounding box **after posing** and rests
  the lowest point on y=0.
- **`gait.ts`** — biped walk. Stance + step cycle + instability wobble.
- **`stance.ts`** — posture as blendable parameters: `waistPitch` (kyphosis),
  `hipFlex`, `kneeFlex`, `shoulderProtract`, `headForward`, `stepScale`.
  `UPRIGHT`, `STOOPED`, `TODDLING`, and `lerpStance()` to dial severity live.
- **`crawl.ts`** — quadruped. `BABY_CRAWL` is a lateral-sequence gait
  (RL→FL→RR→FR) at **0.78 duty factor**, so three limbs stay loaded. `TROT` is
  0.5 duty, diagonal pairs — reads as a dog, not a baby.
- **`subjects.ts`** — pairs body + gait + speed + clearance + reach.

| Key | Subject | Body | Gait | Speed | Reach |
|---|---|---|---|---|---|
| 1 | Older adult | G1 1.32 m | biped, stooped | 0.77 m/s | 1.55 m |
| 2 | Adult | H1 1.81 m | biped, upright | 1.30 m/s | 2.05 m |
| 3 | Infant, crawling | Go2 0.54 m | quadruped | 0.28 m/s | 0.72 m |
| 4 | Toddler, walking | G1 | biped, unsteady | 0.55 m/s | 0.95 m |
| 5 | Dog | Go2 | quadruped trot | 1.10 m/s | 0.55 m |

Gait phase is driven by `simulation.distance`, not wall-clock, so feet do not
slide at any speed.

---

## 5. What was added to the teammate's files

Three files modified, kept inside their stated contract:

- **`simulation.ts`** — `manual` flag, `setManual(on)`, `drive(forward, turn, dt)`.
  Manual movement refuses anything `isWalkable()` refuses, using the same
  obstacle set and clearance as the planner, and slides along blocked axes
  rather than sticking. `advance()` returns early in manual mode so steering and
  A* never fight over position. Picking a destination releases manual control;
  `reset()` restores it; `paused` freezes it.
- **`main.ts`** — arrow/WASD sampled **inside the fixed step**, subject keys 1–5,
  follow-camera and zoom keys.
- **`scene.ts`** — placeholder capsule resident replaced by the GLB; biped vs
  quadruped gait dispatch; follow camera. The `resident` group contract is
  unchanged — simulation still owns position and heading.

**Controls:** `↑↓` walk · `←→` turn · `WASD` same · `1-5` subject ·
`F` follow camera · scroll or `+`/`-` zoom · `[` `]` hunch severity · `K` skin

---

## 6. Robot assets and how they were made

`public/robot/` — `g1.glb`, `h1.glb`, `go2.glb` plus `*.joints.json`.

Baked by **`bake_g1.py`** (repo root, needs `.venv` with trimesh + pycollada):

```sh
.venv/bin/python bake_g1.py <urdf> <out.glb>
```

Source: `unitreerobotics/unitree_ros` → `robots/*_description`. The script walks
the URDF, assembles the loose STL/DAE meshes into one GLB with the joint
hierarchy preserved as named nodes, and writes a sidecar of joint axes+limits.

**Two corrections are baked in, deliberately, so no runtime code has to guess:**

```python
Zup     = rotation_matrix(-pi/2, [1,0,0])   # URDF Z-up  -> three.js Y-up
Forward = rotation_matrix(-pi/2, [0,1,0])   # URDF +X fwd -> +Z fwd
```

The forward correction matters: without it the robot faces +X while movement
drives +Z, so it strafes sideways at 90°. Verified against the G1's
forward-facing D435 camera, which sits at `x = +0.058`.

**If another scene applies its own Z-up→Y-up fix on import, the robot will be
rotated twice.** These GLBs are already correct for a Y-up, +Z-forward world.

More bodies available and not yet baked: H1-2, A1, Go1, B2, Aliengo, Z1 (all
URDF, same script). MuJoCo Menagerie adds ToddlerBot, Robotis OP3, Booster T1,
Spot, ANYmal — but ships MJCF, which `bake_g1.py` does not parse.

---

## 6b. Swapping skins and adding bodies

**Skins** — `src/robot/livery.ts`. STL and DAE carry no materials, so appearance
is assigned per link by name. Five ship: `factory` (white/black/grey Unitree),
`slate`, `ghost` (translucent), `wire` (edges only), `alert` (red).

Press **`K`** to cycle. Programmatically: `robot.setSkin('ghost')` or
`view.setSkin('ghost')`. Swapping does not reload geometry.

To add one, append to `LIVERIES`:

```ts
export const MINE: Livery = {
  id: 'mine', label: 'Mine',
  base: std(0x2244ff),                                  // fallback for all links
  parts: [{ match: /head|hand/, material: std(0x111111) }],  // first match wins
}
```

`match` is tested against the lowercased link name, so it works across G1, H1
and Go2 without per-body configuration.

**A new body**, three steps:

1. `.venv/bin/python bake_g1.py <path>.urdf public/robot/<id>.glb`
2. Add a `Subject` in `src/robot/subjects.ts` with `asset: '<id>'`, a gait
   (`stance` for bipeds, `crawl` for quadrupeds), speed, clearance, reach, and a
   `note` saying where the numbers came from.
3. Nothing else. Height and floor offset are measured from the mesh at load; the
   subject appears on the next free number key.

---

## 7. Hazard module (built, NOT wired in)

`web/src/scenario/` — renderer-agnostic, plain `{x,y,z}`, 6 passing tests.

- `ConditionSpec` carries **`provenance`**: `hand-authored` | `geometry-derived`
  | `model-proposed`. Never conflated.
- `ScenarioRunner.advance(dt, walkers)` consumes positions from elsewhere and
  emits `hazardExposureStarted`, `reachExceeded`, `balanceMarginExhausted`.
  It does not move anyone and does not own a loop.
- `findings()` returns observations, not scores: *"N of M modelled traversals
  ended with the balance margin exhausted"*, each carrying its assumptions.
  An unvisited condition reports **"no observation available"**, never zero.

Porting it means feeding it the resident's position each fixed step. ~30 lines.

---

## 8. Framing constraints — important

From the team brief, and they are correct:

- **A manually marked zone is not automatic detection.** Every hazard here is
  hand-authored. Say so.
- **No unexplained danger scores.** The "balance margin" is a scenario device,
  not biomechanics, and predicts nothing about a real person.
- **Do not infer mobility from age or appearance.** Subject parameters are
  explicit and configurable.
- Only one number is sourced: **0.77 m/s**, the mean comfortable gait speed of
  mobility-limited over-65s (*Age and Ageing*, 2026 — a study of 1,110 adults
  where only 1.5% could cross at a 1.2 m/s signal). Everything else is a chosen
  demonstration value, and `subjects.ts` says so per subject.

---

## 9. Known gaps

- **Clearance is not per-subject in the planner.** `navigation.ts` uses a fixed
  0.28 m for everyone, so a 1.81 m adult and a crawling infant path identically.
  `subjects.ts` already carries per-subject `clearanceM`; wiring it is the
  obvious next step and belongs to the navigation workstream.
- **Reach is defined but unused.** Nothing yet tests whether a subject can
  reach an object.
- No Marble/World Labs splat is integrated. `scene.ts` has no splat loader.
- The hazard module is not connected to the house.
- Nothing is committed. The robot layer is untracked working-tree state.

---

## 10. Repo hygiene

Untracked and **should not be committed**: `.venv/`, `.tmp_unitree/`,
`.tmp_men/`, `.tmp_lerobot/`, `sandbox/`, and probably `web/`.

Worth committing: `environment-sim/v1-draft/{src/robot,public/robot,tests}` and
the three modified files, plus `bake_g1.py`.

Note `public/robot/*.glb` is ~17 MB total — consider Git LFS.
