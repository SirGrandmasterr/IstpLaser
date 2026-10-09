# The ISTP Ballpoint

An interactive 3D explainer of the ISTP emotional pipeline. A laser (the raw impulse, what is actually felt) travels through four floating optical instruments, **Ti → Se → Ni → Fe**, and exits a tiny ballpoint nib onto a sheet of paper on the floor: other people. When all three upstream conditions hold at once, the nib writes a glowing pink heart. Take any one away and the mark goes wrong in its own way.

> This is a *model* built on Jungian / MBTI typology, offered as a way of thinking, not as scientific fact. The app says so once, on the intro card.

The guided story is about two named people (Phillip and Lucie unless you name them on the intro card): Act I shows the construct working, Act II breaks it stage by stage, and in Act III you repair it stage by stage with the real controls. The whole page is available in English and German.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # Vitest: beam, stroke, nib and path models; prompt and story sequencing; i18n
npm run build     # type-check + static build into dist/
npm run preview   # serve dist/ locally
```

### Docker

Both ways publish the container's port 80 on **`127.0.0.1:8085`** (this machine only):

```bash
# Docker Compose (as configured in docker-compose.yml):
docker compose up --build

# Or plain Docker, same port:
docker build -t istp-ballpoint .
docker run -p 127.0.0.1:8085:80 istp-ballpoint
```

Then visit `http://localhost:8085`. To serve other machines, change the mapping to `8085:80` (or put a reverse proxy in front).

The image is a two-stage build (Node 22 builds `dist/`, `nginx:alpine` serves it) and comes to **94.3 MB** (`docker images`, Docker 29.7 on Windows). nginx sends `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy` on every response, from a snippet ([`nginx/security-headers.conf`](nginx/security-headers.conf)) that each `location` includes, because a location with its own `add_header` doesn't inherit the server's. Hashed assets are cached for a year; `index.html` is never cached. Unknown paths are a plain 404: there's no client-side routing, and an SPA fallback would serve HTML for `./assets/…` under a wrong path.

`dist/` is fully static, with relative asset paths. Drop it on any static host, sub-path included. There's no backend and no analytics. Nothing is downloaded at runtime: all geometry is procedural and all textures are generated in the browser.

Append `?nowebgl` to the URL to see the WebGL-unsupported fallback.

### Names and language in the URL

A lecturer can link to a prepared version. Query values win over what the visitor saved; they are not written back unless the visitor changes them.

```
?lang=de&istp=Anna&istpPronoun=she&other=Jonas&otherPronoun=he
```

`lang` is `en` or `de` (first visit: the browser's language). Pronouns are `he`, `she` or `they`; in German, `they` uses the name instead of a pronoun.

### Kurz auf Deutsch

Starten: `npm install`, dann `npm run dev` und <http://localhost:5173> öffnen; `npm test` führt die Tests aus, `npm run build` baut die statische Seite nach `dist/`. Mit Docker: `docker compose up --build`, danach <http://localhost:8085>. Die Seite lässt sich mit dem Schalter „EN · DE“ (Startkarte oder Ansicht) oder mit `?lang=de` auf Deutsch umstellen; Namen und Pronomen stehen auf der Startkarte und unter „Namen“, siehe oben für vorbereitete Links.

## Controls

Every condition can be changed in the scene and from the panel; both write to the same store.

| | In the scene | Panel / keyboard |
|---|---|---|
| **Ti** alignment | Drag the knurled ring on the big lens so its bright notch meets the index mark (← → while hovering it) | Slider + **Lock** (`1`); **Ask** (`Q`): each answer settles the next third; **Shatter** (`Shift+1`) |
| **Se** input | Move the pointer through the scene, scroll, or hold `F` (any unbound letter) to throw particles at the ring | **Feed** (`2`), a steady stream for lectures |
| **Ni** direction | Drag the target on the paper and let it rest for about a second: held or let go, a still target compiles; moving it scatters | **Compile** (`3`) |
| Social prompts | — | Three buttons; `Space` repeats the last |
| Other | Click an instrument (or its plate) to focus it and open its card | Story `S`, Reset `R`, Labels `L`, Sound `M`, `Esc` closes; **Names** and **EN · DE** in View |

The ring's arrow keys only work while the pointer hovers it; keyboard-only users have the slider and **Lock**.

## The eight states

The first failure along the beam decides the character of the mark; later failures only modify it.

| Ti | Se | Ni | What you see |
|---|---|---|---|
| off | off | off | Facets churn; the beam loops inside Ti and a few short stray rays flicker sideways. A weak, thin, erratic ray escapes off-axis, misses the Se hole and hits the nib at an angle. The nib scrawls a **burn-scribble**: jagged, reversing, thrown in pieces well off the aim point; char with a cold ember edge. No heart shape survives. |
| off | off | on | Same; Ni tries to telescope but sags (no coherent beam to work with). |
| off | on | off | Burn-scribble, hotter: brighter ember edge, more sparks. |
| off | on | on | Burn-scribble at its brightest; Ni only half extends (capped by coherence). |
| on | off | off | Clean core ray through a still ring; the beam dims, breaks up and dies inside Ni as indigo haze, and pulses travel back along an indigo arc from Ni to Ti (**Ti–Ni loop**). Nothing reaches the nib: it stays dark, slides out on its refill, presses the cold ball onto the page and scores a dry, grey, skipping **groove**. |
| on | off | on | Same; Ni keeps its intent but sags to a pancake until energy returns. |
| on | on | off | Golden, energised beam meets a flat Ni that fans a few dim "possible vectors" toward the page; the beam arrives wide and soft: a washed-out **pink puddle** with no edges, landing wherever the axis falls. |
| on | on | on | Locked, spinning, telescoped: a razor-sharp beam and a crisp, glowing **heart** exactly where Ni aimed. |

Because A, T and D are continuous, the mark degrades continuously in between.

**Dormant** is the all-off row read as a state: Ti unlocked, Se starved and Ni without any direction (no intent, barrel flat). The HUD shows a *dormant* badge next to the Ti–Ni loop badge and the ambient light dims a little; it comes straight back when any of the three recovers.

## Metaphor → code

| Metaphor | Code |
|---|---|
| The three conditions and their dependencies | [`src/model/beam.ts`](src/model/beam.ts): pure `computeBeamState(controls, dt, prev)`, unit-tested in [`beam.test.ts`](src/model/beam.test.ts) |
| How the nib writes for a given beam | [`src/model/stroke.ts`](src/model/stroke.ts): four presets blended by output weights, then modified by C, E, F |
| The path the nib traces (heart → scrawl) | [`src/model/path.ts`](src/model/path.ts): pure `strokePath`, tested for its deviation from the heart |
| What actually reaches the nib | [`src/model/nib.ts`](src/model/nib.ts): `arrivingEnergy` (survive × E) and `nibIntensity`, tested dead below starvation |
| Single source of truth | [`src/state.ts`](src/state.ts) (store + tiny event bus) |
| The impulse | [`src/scene/Source.ts`](src/scene/Source.ts) |
| Ti, kinematic kaleidoscope | [`src/scene/Ti.ts`](src/scene/Ti.ts): ~230 instanced prisms on gimbals, lock spring, knurled ring |
| Se, dynamo | [`src/scene/Se.ts`](src/scene/Se.ts) + [`src/scene/Particles.ts`](src/scene/Particles.ts) (particles arrive tangentially; each hit is torque) |
| Ni, variable-focal collimator | [`src/scene/Ni.ts`](src/scene/Ni.ts): five lens elements and four sleeves on a spring |
| Fe, nib with galvo mirrors | [`src/scene/Fe.ts`](src/scene/Fe.ts): glows only with the energy that arrives; a dead nib reaches the paper on its refill |
| The laser itself | [`src/scene/Beam.ts`](src/scene/Beam.ts): rebuilt per frame as instanced segments, coloured per stage |
| The page (other people) | [`src/scene/Sheet.ts`](src/scene/Sheet.ts): a light canvas and an ink canvas; light fades over ~20 s, ink a little slower |
| Someone reaches out | [`src/scene/Prompts.ts`](src/scene/Prompts.ts): orb → source → Fe actuation → drawing |
| Words between Ti and the other person | [`src/scene/Messengers.ts`](src/scene/Messengers.ts): the story's line that shatters Ti, Ask's question and answer |
| Story / UI / audio | [`src/story/Story.ts`](src/story/Story.ts), [`src/ui/UI.ts`](src/ui/UI.ts) (+ `StoryBar`, `PeopleForm`), [`src/audio/Audio.ts`](src/audio/Audio.ts); sequencing tested in [`Story.test.ts`](src/story/Story.test.ts) and [`Prompts.test.ts`](src/scene/Prompts.test.ts) |
| All copy | [`src/i18n/en.ts`](src/i18n/en.ts) and [`src/i18n/de.ts`](src/i18n/de.ts), one shape ([`types.ts`](src/i18n/types.ts)); tokens and genitives in [`format.ts`](src/i18n/format.ts), names and prefs in [`people.ts`](src/i18n/people.ts), all tested in [`i18n.test.ts`](src/i18n/i18n.test.ts); [`src/strings.ts`](src/strings.ts) returns the active language with the names filled in |

### The beam model

```
A  Ti alignment      raw slider/ring value, snaps to 1 at ≥ 0.85
T  Se torque         T += Σ hit impulses;  dT/dt = −(0.45·T + 0.1)   → halts ≈ 3.8 s after input stops
D  Ni direction      intent compiles at 1/s (held still), scatters at 0.8/s (moving);
                     D chases intent × C × seGate(T)   (up 1.1/s, sag 0.8/s)

C = smoothstep(A)    E = 0.06 + 0.94·T    F = D·C    authenticity = C·E·F
starved: T < 0.25    primed: D ≥ 0.6

survive = 1 − C + C·seGate(T)          (a stray from an unaligned Ti bypasses Ni)
arriving = survive · E                 nib lit = actuation · smoothstep(0.25, 0.6, arriving)
```

The HUD's *energy* gauge shows T, Se's spin, so it reads 0 at rest. The small residual in E only keeps the beam faintly visible; it isn't fresh energy.

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
- **Stepped fade.** 8-bit canvases can't fade by tiny amounts every frame (values stall), so they fade every 0.2 s by the amount that gives the target after 20 s. The stalled residue is clipped in the sheet shader.
- **Prompts queue.** One prompt at a time; a new request while one is running is queued (latest wins).
- **Clicking the paper aims; it doesn't focus.** The paper's info card opens from its label.
- **Holding any unbound letter key feeds Se** (F is suggested in the UI).
- **Glass is transparent, not transmissive**, to keep integrated GPUs happy.
- **Story pacing follows the reader.** Every caption and spoken line stays up for its reading time (1.2 s plus 15 characters a second, `READ_PAUSE` and `READ_CPS` in [`Story.ts`](src/story/Story.ts)), and nothing replaces it before then, so German simply runs longer. Visual beats get room of their own: the wheel is seen coasting down before the next caption, the line lands in Ti just as it has been read, the camera moves take 3 s. Each scene waits for the nib to finish, holds on the finished mark for 2.5 s, and lingers a moment after its last words. Acts I and II take about 100 s in English (about 55 s before). *Skip* hands control back with all three conditions met, like the ending.
- **The mark is the subject.** Whenever the nib writes in the story, the camera cuts to a framing of the page centred near where the mark will land, with the nib in frame. The one-line state caption is hidden in story mode so only the story bar speaks.
- **A dead nib still has to write.** When nothing arrives (the Ti–Ni loop), the nib is unlit: no glow, light or spark, and the ball turns a dull, cold colour. The refill slides out and the ball presses onto the paper under the draw point, so the dry groove has a visible cause instead of being scratched from a metre away.
- **Groove, scrawl, wash and heart are made differently.** The groove is a score: a dark grey core in the ink canvas with a faint raised edge of light beside it, skipping in short beats. The scrawl is char: a wide charcoal core with the ember glow only as a thin hot edge, plus sparks. The wash is low, saturated pink light with no core. The heart is crisp light that leaves a faint pink stain under itself, so it stays pink on light paper instead of blooming to white.
- **Ink outlasts light.** The light canvas keeps ~2% after 20 s, the ink canvas ~8%: embers cool before the char goes, and scores stay legible a little longer.
- **A faint beam is thin.** Segment radius scales with intensity (the core keeps a hairline floor, the glow none), so a weak beam reads as light, never as a rod. An unfocused beam is dimmer as well as wider.
- **Nothing reaches the floor.** Stray rays from Ti stay short and mostly sideways; Ni's "possible vectors" fan toward the page and fade out before the floor, so nothing reads as a stand or wire.
- **Layout.** The source sits lower than in the first build so the nib hangs just above the page (about 0.6 m) instead of beaming at it from far off, and the home framing is tighter.
- **Ni dwell.** A target you drop and leave alone counts as held still: it keeps compiling after release, and the Compile toggle turns on when it's done. Dragging it again scatters it. The toggle (or Reset) takes over from a resting target.
- **Plates.** Plates are laid out by the UI each frame (no CSS2DRenderer): compact name plus live state, the role line on hover or focus, and a leader line from the instrument's rim. The source and the page hang theirs below-left, the rest above-right, away from the beam. Overlapping plates are pushed further out, and any plate that would sit under the panel, card, HUD, caption or story bar is hidden.
- **Framing.** The projection is offset so the subject centres between the info card and the panel. The FOV adapts to the visible aspect (panel and tablet drawer included), so narrower screens widen the view instead of cropping. The info card shifts the view but doesn't widen it, since it always opens on a close-up of one instrument. The HUD lives bottom-left on desktop and top-right on tablets, where the beam never goes.
- **Screen readers** hear the state when the output mode changes and holds for 0.8 s, and when the nib starts writing, not on every flicker. In story mode the story bar is the only live region.
- **Resolution governor.** DPR is clamped to 2. If a 2 s window averages under ~45 fps, the pixel ratio steps down by 0.25 (never below 0.75). It only steps down; a window resize starts over from the cap.
- **Galvo mirrors are satin**, because chrome highlights from the nib's light bloomed into blobs that hid the instrument.
- **Typography** uses system grotesk/mono stacks; no web fonts are downloaded.
- **three.js in its own chunk** (~600 kB), so a change to the app (~90 kB) doesn't re-download it. Vite 8 bundles with Rolldown, so this is `build.rolldownOptions.output.codeSplitting` rather than Rollup's `manualChunks`.
- **No rendering until the canvas has a size.** A tab opened in the background can start at 0 × 0; the app waits for a real size rather than drawing into zero-size targets.
- **Act II follows the beam model.** The Ti–Ni loop and the dry groove both need a locked Ti; with Ti unlocked every mark is a scribble. So after the shatter and the scribble, Ti re-sorts the pieces on its own ("a picture built without asking"): the feed stops, the beam dies in Ni, the loop appears and the nib scores the groove. Only then does that private picture slip (a gradual decay, not a second shatter), which leaves the pipeline dormant for Act III.
- **Facets settle one by one.** Each facet has its own threshold (centre first, spread evenly), so a third of the alignment settles exactly a third of them, on small springs. A shatter throws them all back out with overshoot; with reduced motion it is a cut.
- **Ask settles the next third**, so three answers lock Ti from nothing (fewer if the ring is already partway). Asks beyond what the answers in flight will lock are ignored, and the button is off while Ti is locked.
- **Act III keeps what the user built.** Once Se is going in scene 7, the Feed toggle stays on (they stay close), so Ni can compile in scene 8 without the user feeding Se at the same time. "Do it for {istp}" also restores anything upstream that came undone, and if a step still isn't met 12 s later the story moves on anyway.
- **Pointer input to Se is ignored until Act III**, so moving the mouse can't spin Se back up during the coast-down.
- **German copy**, written as German: "du", no possessive pronouns (genitive names instead, `Felix’` with a typographic apostrophe), no accusative pronouns, and no sentence that starts with "sie"/"Sie". The panel stays 300 px wide; the German labels are short instead (*Neustart*, *Schilder*, *Zufuhr*, *Bündeln*).

## What was verified

The story and German round (dev and production build, same browser pane; time advanced with `step()` while the pane was hidden):

- A fresh profile asks for names; empty fields give Phillip and Lucie. Typed names and pronouns update the plates, prompt buttons, panel headings, cards and story at once, from the intro and from the panel. Typing a name never triggers a shortcut.
- The English story end to end, by hand: the heart in Act I; the line flying into Ti and the shatter (flash, facets thrown out, disc rocking); the scribble; the coast-down, Ti re-locking alone, the beam dying in Ni and the loop arc; the dry groove; the slip into dormant (badge, dimmer light). In Act III: three asks with their questions, Se fed by moving the pointer, Ni compiled by dropping the target and letting it rest. Each step was acknowledged, the final heart landed on the target, and the sandbox followed with all three conditions met.
- The German story end to end with "Für … übernehmen", read through for clumsy German, at 1440×900 and 820×1180 (drawer open and closed): nothing overflows or wraps in the panel, story bar, plates, HUD or intro, and the tablet drawer stacks above the story bar.
- `?lang=de&istp=Anna&other=Jonas` opens in German with those names; with "neutral" chosen, the name stands in for the pronoun ("Jonas dankt Anna von Herzen").
- Reduced motion: the shatter is a cut (checked in code paths: no pulse, no springs); the cue's pulse is removed by the reduced-motion stylesheet rule.
- `npm test` (79 tests), `npm run build`, and no console errors or warnings in dev or in the production build (including the German `?nowebgl` fallback).

The first build and the review follow-up:

In a Chromium-based browser (the desktop app's browser pane, ANGLE/D3D11 on an RTX 3080). The pane was hidden for most of the session, so `requestAnimationFrame` didn't run. Visual checks advanced the simulation in fixed steps through the dev-only hooks in [`src/debug.ts`](src/debug.ts) and then took screenshots, rather than watching it live at 60 fps.

- **The four marks, sheet view, labels off.** Scribble: a jagged scrawl in pieces, charcoal with a thin ember edge and sparks, no heart silhouette. Groove: a dashed, scored grey heart outline visible at a glance, with the nib dark and pressed onto the page while it writes. Wash: a soft pink haze with no edge. Heart: a crisp, glowing pink heart.
- **No hardware where there is none.** Home view, all three conditions off, labels off: the Ti strays are short and sideways, every dim segment is a hairline, and nothing touches the floor. Also checked close up from the Ni framing.
- **All six scenes of the earlier story, end to end.** Each writing scene cuts to the page, the mark is the subject, the story holds on it, and only the story bar is shown. The Ti–Ni loop arc is visible in scene 3's first framing. The story ends in sandbox with Ti locked, Se fed and Ni primed.
- **Ni dwell with real pointer input.** Dragged the target with the mouse, let go and waited: the direction compiled in about a second and the Compile toggle switched on.
- **Layouts.** 1440×900; 1024×768 with the card open (the focused instrument stays centred between card and panel at a 50° FOV); 820×1180 with the drawer open and closed (construct centred in the visible area, HUD top-right overlapping nothing, all plates visible).
- **Plates.** Hover expands the role line; plates under the card or panel hide. Accessible names checked in the accessibility tree: every toggle, button and plate is named, and the gauges and authenticity readout are meters.
- **Audio, measured rather than listened to.** With an analyser on the master bus: the lock click peaks ~12 dB above the full-spin hum overall and ~40 dB above it in 2–6 kHz (and the hum ducks for it). The groove's scratch sits around −42 dBFS (audible, quiet). The heart and wash add nothing above the hum in 2–6 kHz.
- **Clean console** (no errors or warnings) in dev and in the production build, including a simulated zero-size start.
- **Docker.** `docker compose up --build` on Docker 29.7: the page loads on `http://localhost:8085`, the three security headers are present on `/`, `/index.html` and a hashed asset, and unknown paths return 404.
- **Tests and build.** `npm test` (50 tests) and `npm run build` pass.
- **Render cost, measured the same way on this build and the previous one** (1440×900 at DPR 1 in the pane, dev build, per stepped frame including simulation, UI and a GPU sync): about 4.2–4.5 ms idle (previous build 3.6) and 7.9–8.2 ms while the nib writes (previous 6.5–6.9). GPU time is unchanged; the extra is CPU-side canvas compositing and beam segments.

## Known limitations

- **Not tested on integrated graphics.** The 60 fps target on an ordinary laptop isn't proven; the resolution governor is the safety net.
- **Not watched live.** As above, the pane was hidden, so motion and timing were checked by stepping. Timings (Se coast-down, Ni extension, compile time, prompt and story sequencing) are covered by unit tests rather than by eye.
- **Audio** levels were measured, but nobody has listened to it critically.
- **Firefox and Safari** weren't tested.
- **Phones (< 768 px) aren't a target.** The HUD hides below 680 px.
- **Portrait tablets** work, but the scene is framed by its width, so there is empty space above and below it.
- **Touch.** Touch devices only produce pointer movement while dragging, so Se mostly relies on the Feed toggle there. A plate's role line needs hover or keyboard focus.
- **Legible, not physical, optics.** The galvo reflection angles are approximate, the beam bends where the story needs it to, and the pool of light on the page is partly painted into the paper rather than lit.
- **The info card can scroll** on short screens (768 px tall or less); its Close button may need a scroll, and `Esc` always closes it.
- **Copy** is English only, though all of it lives in `src/strings.ts`.
- **Bundle size.** ~690 kB in total (~180 kB gzipped), almost all three.js, now in its own chunk.
