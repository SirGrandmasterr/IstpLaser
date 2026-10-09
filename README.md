# The ISTP Ballpoint

An interactive 3D explainer of the ISTP emotional pipeline. A laser (the raw impulse, what is actually felt) travels through four floating optical instruments, **Ti → Se → Ni → Fe**, and exits a tiny ballpoint nib onto a sheet of paper on the floor: other people. When all three upstream conditions hold at once, the nib writes a glowing pink heart. Take any one away and the mark goes wrong in its own way.

> This is a *model* built on Jungian / MBTI typology, offered as a way of thinking, not as scientific fact. The app says so once, on the intro card.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # Vitest: the beam model and stroke model
npm run build     # type-check + static build into dist/
npm run preview   # serve dist/ locally
```

### Docker

```bash
# Using Docker Compose:
docker compose up --build

# Or standard Docker:
docker build -t istp-ballpoint .
docker run -p 8080:80 istp-ballpoint
```

Then visit `http://localhost:8080`.

`dist/` is fully static, with relative asset paths. Drop it on any static host, sub-path included. There's no backend and no analytics. Nothing is downloaded at runtime: all geometry is procedural and all textures are generated in the browser.

Append `?nowebgl` to the URL to see the WebGL-unsupported fallback.

## Controls

Every condition can be changed in the scene and from the panel; both write to the same store.

| | In the scene | Panel / keyboard |
|---|---|---|
| **Ti** alignment | Drag the knurled ring on the big lens so its bright notch meets the index mark (← → while hovering it) | Slider + **Lock** (`1`) |
| **Se** input | Move the pointer through the scene, scroll, or hold `F` (any unbound letter) to throw particles at the ring | **Feed** (`2`), a steady stream for lectures |
| **Ni** direction | Drag the target on the paper and hold it still for about a second | **Compile** (`3`) |
| Social prompts | — | Three buttons; `Space` repeats the last |
| Other | Click an instrument (or its label) to focus it and open its card | Story `S`, Reset `R`, Labels `L`, Sound `M`, `Esc` closes |

## The eight states

The first failure along the beam decides the character of the mark; later failures only modify it.

| Ti | Se | Ni | What you see |
|---|---|---|---|
| off | off | off | Facets churn; the beam loops inside Ti. A weak, erratic ray escapes off-axis, misses the Se hole and hits the nib at an angle: a dark, jagged **burn-scribble**, dim embers. |
| off | off | on | Same; Ni tries to telescope but sags (no coherent beam to work with). |
| off | on | off | Burn-scribble, hotter: brighter ember edge, more sparks. |
| off | on | on | Burn-scribble at its brightest; Ni only half extends (capped by coherence). |
| on | off | off | Clean core ray through a still ring; the beam dims, breaks up and dies inside Ni as indigo haze, with a faint back-reflection to Ti (**Ti–Ni loop**). The nib drags a faint, dry, grey **groove**. |
| on | off | on | Same; Ni keeps its intent but sags to a pancake until energy returns. |
| on | on | off | Golden, energised beam meets a flat Ni that sprays a halo of possible vectors: a soft, washed-out **pink puddle** with no edges, landing wherever the axis falls. |
| on | on | on | Locked, spinning, telescoped: a razor-sharp beam and a crisp, glowing **heart** exactly where Ni aimed. |

Because A, T and D are continuous, the mark degrades continuously in between.

## Metaphor → code

| Metaphor | Code |
|---|---|
| The three conditions and their dependencies | [`src/model/beam.ts`](src/model/beam.ts): pure `computeBeamState(controls, dt, prev)`, unit-tested in [`beam.test.ts`](src/model/beam.test.ts) |
| How the nib writes for a given beam | [`src/model/stroke.ts`](src/model/stroke.ts): four presets blended by output weights, then modified by C, E, F |
| Single source of truth | [`src/state.ts`](src/state.ts) (store + tiny event bus) |
| The impulse | [`src/scene/Source.ts`](src/scene/Source.ts) |
| Ti, kinematic kaleidoscope | [`src/scene/Ti.ts`](src/scene/Ti.ts): ~230 instanced prisms on gimbals, lock spring, knurled ring |
| Se, dynamo | [`src/scene/Se.ts`](src/scene/Se.ts) + [`src/scene/Particles.ts`](src/scene/Particles.ts) (particles arrive tangentially; each hit is torque) |
| Ni, variable-focal collimator | [`src/scene/Ni.ts`](src/scene/Ni.ts): five lens elements and four sleeves on a spring |
| Fe, nib with galvo mirrors | [`src/scene/Fe.ts`](src/scene/Fe.ts) |
| The laser itself | [`src/scene/Beam.ts`](src/scene/Beam.ts): rebuilt per frame as instanced segments, coloured per stage |
| The page (other people) | [`src/scene/Sheet.ts`](src/scene/Sheet.ts): a light canvas and an ink canvas, both fading over ~20 s |
| Someone reaches out | [`src/scene/Prompts.ts`](src/scene/Prompts.ts): orb → source → Fe actuation → drawing |
| Story / UI / audio | [`src/story/Story.ts`](src/story/Story.ts), [`src/ui/UI.ts`](src/ui/UI.ts), [`src/audio/Audio.ts`](src/audio/Audio.ts) |
| All copy | [`src/strings.ts`](src/strings.ts) |

### The beam model

```
A  Ti alignment      raw slider/ring value, snaps to 1 at ≥ 0.85
T  Se torque         T += Σ hit impulses;  dT/dt = −(0.45·T + 0.1)   → halts ≈ 3.8 s after input stops
D  Ni direction      intent compiles at 1/s (held still), scatters at 0.8/s (moving);
                     D chases intent × C × seGate(T)   (up 1.1/s, sag 0.8/s)

C = smoothstep(A)    E = 0.06 + 0.94·T    F = D·C    authenticity = C·E·F
starved: T < 0.25    primed: D ≥ 0.6
```

Output weights (summing to 1) come from per-stage "pass" scores: `pTi = C³`, `pSe = seGate(T)`, `pNi = smoothstep(.25,.9,F)`. Then `scribble = 1−pTi`, `groove = pTi(1−pSe)`, `puddle = pTi·pSe(1−pNi)`, `heart = pTi·pSe·pNi`. The first failing stage claims what's left, so earlier failures dominate.

## Decisions where the brief left room

- **Start screen.** An intro card offers *Begin the story* (S) or *Explore freely*. The story is the recommended path, and the sandbox is one click away.
- **Ti off bypasses the chain.** With Ti unaligned, the escaping ray is off-axis and misses Se's hole and Ni. So "Ti off" produces a scribble whatever Se and Ni are doing (as the table requires), and Se's energy only makes it hotter.
- **Ni intent survives a sag.** The model separates *intent* (what you aimed at) from *D* (how far the barrel can actually extend given Ti and Se). When Se starves, Ni sags but remembers. Feed it again and it re-extends without re-aiming.
- **Direction decides where the mark lands.** The mark is centred on a blend of where the axis happens to fall and where Ni aims, weighted by F. A puddle lands vaguely; a heart lands on the target.
- **Ti lock hysteresis.** Locks at A ≥ 0.85; once locked, the ring must be pulled back below 0.79 to unlock, so the snap feels deliberate.
- **Coherence pass is C³.** The character stays a scribble until Ti is nearly locked, so the lock snap visibly matters.
- **Two drawing surfaces.** A burn and a dry scratch *darken* paper, which emission alone can't do. So the sheet has a light canvas (emissive) and an ink canvas (multiplies the paper colour).
- **CPU-backed canvases.** Uploading a GPU-accelerated 2D canvas to WebGL forces a readback. I measured ~8 ms for both canvases on a desktop GPU; `willReadFrequently` canvases bring that to ~1.5 ms.
- **Stepped fade.** 8-bit canvases can't fade by tiny amounts every frame (values stall), so they fade every 0.2 s by the amount that gives ~2% after 20 s. The stalled residue is clipped in the sheet shader.
- **Prompts queue.** One prompt at a time; a new request while one is running is queued (latest wins).
- **Clicking the paper aims; it doesn't focus.** The paper's info card opens from its label.
- **Holding any unbound letter key feeds Se** (F is suggested in the UI).
- **Glass is transparent, not transmissive**, to keep integrated GPUs happy.
- **Story pacing.** Each scene waits for the nib to finish before cutting. *Skip* hands control back with all three conditions met, like the ending.
- **Framing.** The projection is offset so the subject centres between the info card and the panel. The FOV adapts to the visible aspect so narrower screens (and the tablet drawer) widen the view instead of cropping. The HUD lives bottom-left because the beam always leaves that corner empty.
- **Resolution governor.** DPR is clamped to 2. If a 2 s window averages under ~45 fps, the pixel ratio steps down by 0.25 (never below 0.75). It only steps down; a window resize starts over from the cap.
- **Galvo mirrors are satin**, because chrome highlights from the nib's light bloomed into blobs that hid the instrument.
- **Typography** uses system grotesk/mono stacks; no web fonts are downloaded.

## What was verified

In a Chromium-based browser (desktop app's browser pane, ANGLE/D3D11 on an RTX 3080):

- **All four output characters, in the scene.** Burn-scribble with sparks, dry groove, pink puddle and heart, each checked close up on the paper. Also checked Ti unaligned vs. locked, Se fed and spinning, Ni flat (halo) vs. telescoped, and the Fe galvo path.
- **All six story scenes, end to end.** In order, ~8–11 s each, ending in sandbox with Ti locked, Se fed and Ni primed.
- **Real pointer input:**
  - Dragging the Ti ring locks it; the pointer motion spawns Se particles.
  - Reticle hold-to-compile, scatter-on-move, and keep-on-release all behave as intended.
- **Click to focus.** Clicking an instrument and clicking a label each focus it and open its card.
- **Keyboard.** Keys `1 2 3`, Space, `L M R` and Esc all work.
- **Layouts.** 1440×900, 1024×768, and 820×1180 portrait (panel becomes a drawer; the scene lifts above it).
- **Fallbacks.** Reduced motion (instant camera cuts, no drift, fewer particles) and the WebGL fallback page.
- **Clean console** (no errors or warnings) in dev and in the production build.
- **Render cost.** About 3–5 ms per frame including GPU sync at DPR 2 on the test machine; ~120 draw calls and ~44 k triangles. Simulation is ~0.2 ms per frame.

## Known limitations

- **Not tested on integrated graphics.** The 60 fps target on an ordinary laptop isn't proven; the resolution governor is the safety net.
- **Hidden browser pane during testing.** Most visual checks advanced the simulation in fixed steps through a dev-only console hook, rather than watching it live at 60 fps. Timings (Se coast-down, Ni extension, compile time) are covered by unit tests.
- **Audio** was verified to start (the AudioContext runs after unmuting) but not listened to critically.
- **Firefox and Safari** weren't tested.
- **Phones (< 768 px) aren't a target.** The HUD hides below 680 px.
- **Touch.** Touch devices only produce pointer movement while dragging, so Se mostly relies on the Feed toggle there.
- **Legible, not physical, optics.** The galvo reflection angles are approximate, and the beam bends where the story needs it to.
- **Copy** is English only, though all of it lives in `src/strings.ts`.
- **Bundle size.** The bundle is ~680 kB (~177 kB gzipped), almost all three.js.
