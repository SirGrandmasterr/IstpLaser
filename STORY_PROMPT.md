# The ISTP Ballpoint — new story ("{istp} and {other}") and German localisation

This brief builds on `OPUS_PROMPT.md` (the specification) and `REVIEW_PROMPT.md` (fixes already
applied). Do not regress either. Two features:

1. Replace the current six-scene story with a personal, named narrative that first shows the
   construct working, then breaks it stage by stage, then repairs it stage by stage with the
   user's participation.
2. Add a language switch so the entire page can be shown in German.

Plan first, keep `npm test`, `npm run build` and the clean console green, and verify in the
browser the way the previous reviews did (story end to end in both languages, sandbox after
the story, 1440×900 and 820×1180).

---

## Part 1 — the story

### 1.1 Names first

- Before the story can begin, the intro card asks for two names: the ISTP the story is about
  and the person they are with. Defaults, shown as placeholders and used when a field is left
  empty: **Phillip** (the ISTP) and **Lucie** (the companion).
- Each name has a pronoun choice next to it (he / she / they), defaulting to *he* for the ISTP
  and *she* for the companion. These drive the captions; see 1.5 for how.
- Validation: trim, cap at 24 characters, strip control characters; fall back to the default
  when empty. Names are plain text, never interpreted as HTML.
- Names and pronouns persist in `localStorage` and can be preset by query string
  (`?istp=Phillip&other=Lucie`), so a lecturer can link to a prepared version. They can be
  changed later from a small "Names" control in the panel's View section, which re-renders
  every string that uses them.
- The names are used everywhere a person is referred to, not only in the story: the sheet's
  label becomes the companion's name ("The page · {other}"), the source's role becomes
  "what {istp} actually feels", the sandbox prompt buttons become
  "{other} asks: 'You okay?'" and so on.

### 1.2 Arc

Ten scenes in three acts. Scenes in Act I and II play automatically. Scenes in Act III wait
for the user to perform the repair with the real controls; each offers a
"Do it for {istp}" button that performs the action for them, and the hint for the relevant
control pulses until the condition is met. The story never advances while the nib is writing.

Camera framings: whenever the nib writes, the sheet must be the subject (cut to the sheet view
when drawing begins). Whenever an instrument changes state, frame that instrument.

**Act I — Together (the construct in working order)**

1. *Wide view. Ti locked, Se fed and spinning, Ni telescoped.*
   Caption: "{istp} and {other} are on the sofa, close. {istp} understands what they have,
   knows where it is going, and feels it fully."
   After 3 s a prompt arrives: "{other}: 'I like this.'" → the nib draws a heart.
   Caption on drawing: "Saying it is easy. The nib writes exactly what {he} feels."

**Act II — The break**

2. *Frame Ti.* Caption: "{other} says something that doesn't fit the picture:" followed by the
   companion's line, which is an editable string in the strings file with a deliberately
   ambiguous default, for example "'I've been thinking about moving away for a while.'" (Keep
   it ambiguous: not a breakup, not a joke. The point is that the old model no longer fits.)
   On the line's arrival Ti **shatters**: an abrupt unlock, not the gradual slider decay (see
   1.3). The facets jolt out of lock, the beam starts looping inside the disc.
   Caption: "Ti's model of the situation no longer holds. Everything {istp} thought {he} knew
   is back in pieces, being re-sorted."
3. *Sheet view.* Prompt: "{other}: 'Say something?'" → burn-scribble.
   Caption: "What comes out is blunt and off-axis. Not what {he} feels; what escaped."
4. *Frame Se.* Caption: "They stop cuddling. No more live input reaches Se." Feed off; the
   ring coasts down; the beam dims and dies inside Ni; the Ti–Ni loop appears.
   Caption: "Without fresh data the wheel stops. Ti and Ni loop on each other."
5. *Frame Ni, then sheet.* Ni sags to a pancake. Caption: "No structure, no input: Ni has no
   idea where this is going. The pipeline is dormant." Prompt: "{other} waits." → dry groove.
   Caption: "Nothing comes. {other} reads the silence as distance."

**Act III — Repair (the user does it)**

6. *Frame Ti.* Caption: "Ti needs a new structure, and it can only get one from {other}:
   {istp} has to ask." The **Ask** control (see 1.3) is highlighted. Each press sends a
   question orb from the source outward and an answer orb back into Ti; a third of the facets
   settle with each answer; the third answer locks the disc with the click.
   The three questions are captions, one per press: "'What did you mean?'", "'What do you
   want?'", "'What happens to us?'" On lock: "Ti understands the new situation. Not the old
   one back; a new one."
7. *Frame Se.* Caption: "Understanding alone changes nothing. Something has to happen between
   them again: {istp} moves closer; {other} leans in." The user feeds Se (pointer movement,
   held key, or the Feed toggle). The ring spins up, the beam re-energises, the haze in Ni
   clears. On threshold: "Live input again. The beam reaches the world."
8. *Frame Ni and the sheet.* Caption: "Now Ni can compile a direction: where this is going, and
   what this moment is." The user drags the reticle and lets it rest (dwell compiles, per the
   review fix), or uses Compile. The barrel telescopes. On primed: "Direction compiled."
9. *Sheet view.* Prompt: "{other}: 'So… how do you feel?'" → heart.
   Caption: "Fe works again. Not because {istp} tried harder to feel. Because the three
   upstream conditions hold again."
10. *Wide view.* Caption: "That is the whole model: when expression fails, look upstream.
    Explore with the controls." Hand control back in sandbox with all three conditions met.

Timing: Act I and II scenes 8–11 s each as now; Act III scenes wait for the user. A **Skip**
button still ends the story at any point with all three conditions met.

### 1.3 New mechanics the story needs (and the sandbox gets)

- **Shatter** (`Controller.shatter()`): an immediate drop of Ti alignment to 0 with a visual
  jolt (facets spring out of lock with overshoot, a brief cyan flash, the lock click played in
  reverse or a short crack), clearing the latch and any animated target. Reachable in the
  sandbox from a small "Shatter" button next to Lock (key `Shift+1`).
- **Ask** (`Controller.ask()`): one clarifying question. Visual: a small cyan orb leaves the
  source along the beam's back direction (toward where prompts come from), and an answer orb
  returns into Ti; alignment rises by one third with a settle animation, so three asks lock Ti.
  Reachable in the sandbox as an "Ask" button in the Ti block (key `Q`). The story's three
  questions are captions; in the sandbox the button needs no caption.
- **Dormant** is a readable state, not just "all off": when Ti is unlocked, Se starved and Ni
  flat at the same time, dim the construct's ambient glow slightly and show a "dormant" badge in
  the HUD next to the Ti–Ni loop badge. Reverts the moment any condition improves.
- The companion's shattering line, the three questions and all prompts are strings, not code.

### 1.4 Participation UI

- In Act III the story bar shows the caption, the current step's hint ("Press Ask, or Q"),
  a "Do it for {istp}" button, and Skip. The highlighted control pulses (a soft outline, no
  colour-only cue). When the user completes the step by hand, the bar acknowledges it in one
  short line before the next scene.
- The panel's controls are enabled during Act III (they are disabled in the current story).
  Keep them disabled in Acts I and II.
- Reduced motion: no pulsing; the hint is static text.

### 1.5 Pronouns and templates

- Every person-referring string is a template with tokens: `{istp}`, `{other}` for names and
  `{he}`, `{him}`, `{his}` (and `{He}`, `{His}` capitalised) resolved from the ISTP's pronoun
  choice; `{she}`, `{her}`, `{hers}` for the companion. "They" maps to they/them/their with
  singular verbs handled in the copy, not by code.
- Put the resolver in a pure, unit-tested module (`src/i18n/format.ts`): `t(key, vars)` fills
  tokens, escapes nothing (strings go to `textContent`), and never throws on an unknown token.
- Write the English captions so that possessives are rare; names are clearer than pronouns in
  short captions anyway.

---

## Part 2 — German

- Add a language switch: a two-state control "EN · DE" on the intro card and in the panel's
  View section. Persist in `localStorage`; honour `?lang=de`; default from
  `navigator.language` on first visit. Set `document.documentElement.lang` and the page
  `<title>` accordingly.
- Restructure strings: `src/i18n/en.ts` and `src/i18n/de.ts` export the same typed shape
  (`Strings`); `src/strings.ts` becomes a thin accessor returning the active language. The UI
  must re-render all text on switch without reloading; the scene is untouched.
- German copy is to be written natively, not translated word for word. Register: "du" (the
  story is intimate; the UI follows). Function names stay abbreviated with their German
  expansions: **Ti · introvertiertes Denken**, **Se · extravertiertes Empfinden**,
  **Ni · introvertierte Intuition**, **Fe · extravertiertes Fühlen**. The piece's title stays
  "The ISTP Ballpoint"; the subtitle is translated ("Wie ein Gefühl von innen auf die Seite
  kommt").
- Pronouns in German: nominative and dative forms from the chosen set (er/ihm, sie/ihr); for
  "they" fall back to the name. Avoid possessive pronouns in German captions; use the name in
  the genitive instead, via a tested helper: `gen("Phillip") → "Phillips"`,
  `gen("Lucie") → "Lucies"`, names ending in s, ß, x or z get an apostrophe
  (`gen("Felix") → "Felix'"`).
- German strings are longer: check the panel (300 px), the toggle buttons, the story bar and
  the plates at 1440×900 and 820×1180 in German; nothing may wrap awkwardly or overflow.
  Widen the panel or shorten the copy, not both silently.
- Keyboard hints stay as keys (`1 2 3 Q S R L M`); their descriptions are translated.
- The intro disclaimer, the WebGL fallback, the `aria-label`s and the README's run
  instructions get German versions too (README: a short German section, not a full
  translation).

---

## Tests to add

- `format.ts`: token filling, capitalised tokens, unknown tokens left intact, "they" set.
- `gen()` for German genitives including the apostrophe cases.
- Name validation: trimming, length cap, control-character stripping, defaults.
- Story sequencing with a thin fake controller: Act I/II scenes advance on time only when no
  prompt is active; Act III scenes advance only when their condition is met
  (`tiLocked`, `!seStarved`, `niPrimed`) or "do it for me" was pressed; Skip from any scene
  ends with all three conditions met.
- Both language files satisfy the `Strings` type and have no empty strings (a test that walks
  both objects).

---

## Verification checklist (do all, report honestly)

1. Fresh profile: the intro asks for names; empty fields give Phillip and Lucie; the names
   appear in the labels, prompts and captions. Change names from the panel; everything updates.
2. The story, English, end to end: Act I shows a working construct and a heart; the shatter is
   abrupt and legible; the scribble, the coast-down, the loop and the dormant groove each have
   their moment on screen; Act III waits for the user, each step is completable by hand and by
   the button; the final heart lands; sandbox follows with all three on.
3. The same story in German, read by someone who would notice clumsy German. No overflow in
   the panel, bar, plates or intro at 1440×900 and 820×1180.
4. `?lang=de&istp=Anna&other=Jonas` opens in German with those names and the "they"/"sie"
   handling correct for whichever pronouns were chosen.
5. Reduced motion: no pulsing hints; the shatter is a cut, not a spring.
6. `npm test`, `npm run build`, zero console errors or warnings in dev and in the production
   build.
