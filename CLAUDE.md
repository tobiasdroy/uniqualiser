# Uniqualiser — Project Context for Claude

## What this is

A client-side web app for hearing-based EQ profiling. Users sweep a sine oscillator across 20 Hz–20 kHz, identify peaks and troughs in their own hearing response, and correct them with a parametric EQ until the perceived response sounds flat. They can then verify the profile by playing an uploaded audio file through the same EQ. All audio processing happens in the browser via the Web Audio API — nothing is sent to a server.

A guided wizard flow is planned (`/wizard` route) but not yet built. The architecture is deliberately laid out to accommodate it.

---

## Tech stack

- **Vite + React + TypeScript**
- **Web Audio API** — raw nodes, no libraries
- **React Router** (`BrowserRouter`) — `/` (main tool) and `/wizard` (stub) routes
- **CSS Modules** + CSS custom properties — no CSS-in-JS, no Tailwind
- **`@radix-ui/react-slider`** — frequency and scrubber sliders (both use this instead of native `<input type="range">`)
- **`@radix-ui/react-tooltip`** — tooltips on EQ band header buttons; `<Tooltip.Provider delayDuration={700}>` wraps the whole app in `App.tsx`
- **`framer-motion`** — band row add/remove animations (`AnimatePresence`), sweep progress bar fade, audio transport entrance, page-load card stagger
- **`lucide-react`** — icons throughout (Play, Square, Waves, RotateCcw, Plus, X, Pause, Music, FolderOpen, Download, Sun, Moon, Volume2)

---

## Design system

Font: `'Helvetica Neue', Helvetica, Arial, sans-serif`, weight 500 everywhere.

**Light mode (default)** and **dark mode** toggled via `data-theme="dark"` on `<html>`. Theme preference stored in `localStorage` under key `eq-theme`.

```css
/* Light */
--bg-primary:  #ffffff        /* thumb borders, input backgrounds */
--bg-secondary: #f5f4f2       /* page background (warm grey) + internal card surfaces */
--bg-elevated: #f5f4f2        /* band rows, drop zones, slider tracks (grey on white cards) */
--page-bg:     #f5f4f2        /* html/body background — grey so white cards lift off the page */
--card-bg:     linear-gradient(150deg, #ffffff 0%, #fdfcfa 100%)  /* white cards */
--text-primary: rgba(0,0,0,0.88)
--text-secondary: rgba(0,0,0,0.58)   /* ≥4.5:1 on white — WCAG AA */
--accent / --eq-curve: #b91c1c       /* deep red, ≥4.5:1 on white — WCAG AA */
--accent-secondary: #d97706          /* warm amber, decorative gradients only — not contrast-checked */

/* Dark */
--bg-primary:  #1c1b1a
--bg-secondary: #2c2b2a
--bg-elevated: #3a3938
--page-bg:     #1c1b1a        /* darkest — cards lift above it */
--card-bg:     linear-gradient(150deg, #3a3938 0%, #312f2e 100%)  /* lighter than page */
--text-primary: rgba(255,255,255,0.92)
--text-secondary: rgba(255,255,255,0.55)  /* ≥4.5:1 on #2c2b2a — WCAG AA */
--accent / --eq-curve: #ff6060            /* lighter red, ≥4.5:1 on all dark surfaces */
--accent-secondary: #fbbf24                /* warm amber, decorative gradients only — not contrast-checked */
```

**Shadows** — three-layer diffuse shadow for depth; dark mode uses a heavier version:
```css
/* Light */
--shadow: 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06), 0 24px 64px rgba(0,0,0,0.05);
/* Dark */
--shadow: 0 2px 8px rgba(0,0,0,0.3), 0 12px 40px rgba(0,0,0,0.25);
```

**Cards** — `border-radius: 20px`; `transition: transform + box-shadow 0.22s`; hover lifts `translateY(-3px)` with a deeper shadow. Card section titles are `24px` title case, `--text-primary` (not secondary), no `text-transform` or `letter-spacing`.

The page background has a subtle radial red accent at the top (`radial-gradient` on `html/body background-image`).

Cards are differentiated by background colour only — no border outlines.

---

## Directory structure

```
src/
├── audio/
│   ├── AudioEngine.ts      # Imperative class owning all Web Audio nodes
│   ├── eqProfile.ts        # APO .txt import/export (pure functions)
│   └── frequencyMath.ts    # Log-scale helpers, SVG coords, path builder
├── components/
│   ├── EQCurve/            # SVG frequency response + draggable handles
│   ├── EQBandControl/      # Per-band freq/gain/Q/type controls
│   ├── OscillatorControl/  # Radix log-scale slider + play/sweep controls + editable freq display
│   ├── AudioFilePlayer/    # Upload, playback with Radix scrubber, animated transport
│   ├── ProfileManager/     # Import/export buttons (APO format)
│   ├── SafetyModal/        # Gatekeeper + reviewable safety notice
│   ├── PanicButton/        # Fixed bottom-right emergency stop
│   ├── Footer/             # Safety Notice + Privacy links
│   └── Wizard/             # Placeholder stub at /wizard
├── hooks/
│   ├── useAudioEngine.ts   # Engine lifecycle; gated on safetyAccepted
│   ├── useEQBands.ts       # useReducer for band state; syncs to engine
│   ├── useSweep.ts         # rAF-driven sweep progress via ctx.currentTime
│   └── useTheme.ts         # localStorage theme persistence
├── context/
│   └── AppContext.tsx       # Composes useAudioEngine + useEQBands
├── types/
│   └── index.ts
├── styles/
│   └── globals.css         # Tokens + global resets + focus styles
└── App.tsx                 # Router, AppProvider, SafetyModal gate; also houses Header, IntroCard, InstructionsModal (all small, no separate file)
```

---

## App-level UI (App.tsx)

### Header

Sticky, blurred, `z-index: 100`. Contains:
- **Logo** — `public/eq-icon.svg` (28 px) + "Uniqualiser" wordmark (32 px), links to `/`
- **Nav** — "How to use" button (opens `InstructionsModal`). The Wizard link is intentionally hidden until the feature ships.
- **Header right** — Dark/Light theme toggle + `ProfileManager` (import/export)

### InstructionsModal

Opened from the "How to use" nav button. Focus-trapped; Escape closes it. Four numbered steps (accent-coloured pill + bold heading + body text) explaining the profiling workflow. "Got it" button in the footer. Lives in `App.tsx` alongside the header — no separate file.

### IntroCard

First card in `MainLayout` (above `OscillatorControl`). Uses the same card styling as all other cards (hover lift, `card-bg`, `border-radius: 20px`).

Opens with a **hero split** (`introHero`, grid `1fr 300px`, single column ≤760 px) so the intro isn't one unbroken block of text: left is a heading + lead paragraph; right is `HeroVisual`, a decorative SVG echoing the real EQ curve (grid, glow, curve path, three handle dots that idly float via `framer-motion`). Purely decorative (`aria-hidden`), not the live EQ curve. A `border-bottom` separates the hero from the "Why personalise your EQ?" two-column section below it, which explains why AutoEQ alone is insufficient (HRTF variation) and the recommended workflow (AutoEQ for sub-1 kHz, Uniqualiser for above), and includes a link to The Headphone Show YouTube video.

The hero visual's background and the page-level `html/body` background both layer a subtle SVG `feTurbulence` grain texture (via `background-image`/`::after`, `mix-blend-mode: overlay`, ~5-6% opacity) plus radial gradients built from `--accent` and the new `--accent-secondary` (warm amber — `#d97706` light / `#fbbf24` dark) using `color-mix()`, so both stay theme-correct automatically. `--accent-secondary` is decorative only — never used for text, buttons, or focus states.

---

## Types

```typescript
export type FilterType = 'PK' | 'LSC' | 'HSC';

export interface EQBand {
  id: string;
  enabled: boolean;
  type: FilterType;
  frequency: number;   // Hz, 20–20000
  gain: number;        // dB, -18 to +18  (matches ±18 dB EQ curve range)
  q: number;           // 0.1 to 10
}

export interface SweepConfig {
  duration: number;    // seconds
  startFreq: number;
  endFreq: number;
}

export interface EQProfile {
  preampGain: number;
  bands: EQBand[];
}
```

---

## Audio engine

`AudioEngine` is an imperative class held in a `useRef`. **Never put it in React state.** It is not initialised until the user accepts the safety disclaimer (`enabled` prop to `useAudioEngine`).

### Node graph

Normal (EQ active) — EQ chain is unmodified:
```
OscillatorNode  → oscGainNode  ─┐
                                 ├→ filterNode[0] → ... → filterNode[N] → analyserNode
AudioBufferSourceNode            │   (or fileGainNode → analyserNode when fileEQEnabled=false)    ↓
  via fileGainNode  ─────────────┘                                                       masterGainNode (preamp)
                                                                                                   ↓
                                                                                      safetyLimiterNode (gain = 0.89, ≈ −1 dBFS)
                                                                                                   ↓
                                                                                       compressorNode (threshold −1 dBFS, ratio 20:1)
                                                                                                   ↓
                                                                                              destination
```

A/B bypassed (`eqBypassed = true`) — flat signal attenuated by `bypassTrimNode`:
```
OscillatorNode  → oscGainNode  ─┐
                                 ├→ bypassTrimNode → analyserNode → masterGainNode → ... → destination
AudioBufferSourceNode            │
  via fileGainNode  ─────────────┘
```

### Key rules

1. **AudioContext on user gesture only.** `init()` is called inside `useAudioEngine` when `enabled` flips true (user accepted safety modal). Never construct on mount.
2. **OscillatorNode and AudioBufferSourceNode are one-shot.** Create a fresh node on every play call.
3. **BiquadFilterNode setters use direct `.value =` assignment**, not `setValueAtTime`, so `getFrequencyResponse()` sees changes immediately (used by EQCurve to draw the live curve).
4. **`rebuildChain()` must be called after adding/removing bands, and checks both `eqBypassed` and `fileEQEnabled` flags.** It disconnects all nodes between `oscGainNode`/`fileGainNode` and `analyserNode`, then reconnects in the correct topology.
5. **Two independent bypass flags:**
   - `fileEQEnabled` — internal engine flag (always `true` now; the per-file toggle was removed from the UI since A/B + Level Match is strictly better). The method `setFileEQEnabled` still exists on `AudioEngine` but is not called from any component.
   - `eqBypassed` (A/B toggle in `EQBandControl`) — routes both sources through `bypassTrimNode` → `analyserNode`, skipping all filters. `bypassTrimNode.gain` is 1 normally; when Level Match is on it's set to `10^(avgEqDb/20)` to attenuate the flat signal to match the EQ path's average level. Exposed via `AppContext`. When active the EQ curve dims to 20% opacity.
6. **`panic()`** sets `masterGainNode.gain` to 0 immediately and stops all sources. `startOscillator()` / `startFile()` restore `masterGainNode.gain` to 1 before playing in case `panic()` was previously called.

### FilterType → BiquadFilterType

| FilterType | BiquadFilterType |
|---|---|
| `PK` | `peaking` |
| `LSC` | `lowshelf` |
| `HSC` | `highshelf` |

---

## State model

| State | Lives in |
|---|---|
| `EQBand[]` + `preampGain` | `AppContext` via `useEQBands` reducer |
| `AudioEngine` instance | `useRef` in `useAudioEngine` (NOT React state) |
| `isEngineReady` | `AppContext` |
| `eqBypassed` | `AppContext` (drives A/B toggle + EQ curve dimming) |
| Oscillator `isPlaying`, `currentFreq`, `editingFreq` | `OscillatorControl` local state |
| Sweep `isSweeping`, `progress`, `currentFreq` | `useSweep` |
| File `isPlaying`, `currentTime`, `duration`, `isScrubbing` | `AudioFilePlayer` local state |

**Sync pattern:** event handler calls `engine.setBandXxx(index, value)` AND `dispatch(UPDATE_BAND)` together. The reducer is pure — no side effects inside it.

`preampGain` (dB, −20 to +6) is stored in the reducer and converted to linear before calling `engine.setMasterGain()`. `AudioEngine` stores `preampLinear` internally so that `startOscillator()`/`startFile()` restore to the correct level after a `panic()` call — they must restore `this.preampLinear`, not a hardcoded `1`.

---

## Oscillator control

The oscillator sits full-width at the top of the page. Key details:

- **Slider** — `@radix-ui/react-slider` mapping 0–1000 internally to 20–20,000 Hz on a log scale (`sliderToFreq` / `freqToSlider` helpers). ARIA attributes on the `Thumb` override Radix's defaults to expose the real Hz range.
- **Tick axis** — ten log-spaced labels (20 → 20k) rendered in a `tickMarks` div below the slider root. `padding: 0 9px` compensates for the thumb's 9 px half-width so 0 %/100 % positions align with track endpoints. Edge labels use `data-anchor="left"/"right"` to avoid clipping.
- **Frequency display** — an `<input type="text">` styled to look like a large read-only number. On focus it switches to a raw integer (e.g. `1115`); on blur or Enter it strips commas, clamps to 20–20,000, updates `frequency` state, moves the slider, and updates the oscillator pitch if playing. Escape reverts. The field is `readOnly` during a sweep.
- **Progress bar** — wrapped in `AnimatePresence` for a fade in/out when sweep starts/stops.
- **Volume slider** — Radix slider (−40 to 0 dB, default −12 dB) inline with the play/sweep controls. Maps to `engine.setOscillatorGain(linear)`. `oscGainLinear` is stored on the engine so fade in/out and gain changes don't clobber each other.
- **Click prevention** — `startOscillator()` fades in over 8 ms (`linearRampToValueAtTime`). `stopOscillatorFaded()` fades out over 8 ms then stops the node in a `setTimeout`. `stopOscillator()` is the immediate version (used internally).
- **Safari autoplay** — `handlePlayStop` and `handleSweep` always `await initEngine()` (first use) or `await engineRef.current!.resumeContext()` (subsequent uses) as the very first async op in the gesture handler.
- **Layout** — `OscillatorControl` is the first card in `MainLayout`; the old two-column row (oscillator + audio player) was removed.

---

## EQ curve

- 512-point log-spaced `Float32Array` from 20 Hz to 20 kHz, allocated once at module level.
- `BiquadFilterNode.getFrequencyResponse()` works on disconnected nodes, so the curve renders before any audio plays.
- Frequency axis: logarithmic. dB axis: linear, ±18 dB range. The ±18 dB boundary lines render without labels; labels appear for −12, −6, 0, +6, +12 only.
- Per-band dimmed curves + a glowing combined curve (blurred duplicate path underneath).
- Draggable handles: `setPointerCapture` for reliable drag-outside. Horizontal = frequency, vertical = gain.
- Keyboard: arrow keys on focused handles adjust frequency (×1.05) and gain (±0.5 dB). Shift multiplies step.
- **SVG focus ring** — rendered as a `<circle>` sibling inside the SVG at the handle coordinates (not CSS `outline`). CSS outline on SVG elements doesn't track `cx`/`cy` changes on arrow-key moves, leaving ring remnants. The `<circle>` follows the handle exactly.
- **Hover interaction** — each band's `<g>` calls `setHoveredBandIndex` on mouseenter/leave (from `AppContext`). When hovered on a PK band: bandwidth shading (`bwRegion` rect), dashed Q boundary lines, and circular Q drag handles at `f_low`/`f_high` appear. Dragging a Q handle uses `Q = 1/(2 * log2(f_edge/f0))`. The `bandFreq` is stored in the drag ref to avoid adding `bands` to the callback deps.
- `isEngineReady` is in the `useEffect` dependency array — without it the curve won't redraw after the engine initialises.
- When `eqBypassed` is true the container gets `.bypassed` CSS class: `filter: grayscale(1); opacity: 0.35` on the SVG, and `pointer-events: none` on handles (drag is disabled during bypass).

---

## EQ band controls

`NumberInput` is a local wrapper around `<input type="number">` that holds string state while the field is focused to prevent snap-back on intermediate values (empty field, partial numbers, leading minus). It commits and clamps on blur, and only syncs from the external `value` prop when not focused.

Each band parameter (Freq, Gain, Q) has a `Knob` SVG component to the left of the label+input. The knob is a 32×32 SVG with a 270° arc (7:30 to 4:30 clock positions). Drag up = increase, drag down = decrease; 200 px of travel = full range. Freq and Q use `logScale=true`. Rounding is done with `parseFloat(raw.toFixed(dp))` where `dp = Math.round(-Math.log10(step))` — this avoids floating-point noise (e.g. `1.3000000000000003`). Arrow keys on a focused knob adjust by one step (Shift = ×10).

Filter type buttons display human-readable labels — **Peak** (PK), **Lo Shelf** (LSC), **Hi Shelf** (HSC) — while the underlying `FilterType` value in state remains the APO code. Q is hidden for Lo Shelf and Hi Shelf (an empty `<div>` placeholder preserves the grid column so Gain stays in the same position across all band types). The row grid is always 6 columns: `32px auto 1fr 1fr 1fr 28px`.

Gain range is **±18 dB** (matching the EQ curve's visible ±18 dB axis). This limit is enforced in `EQBandControl`, `EQCurve` drag/keyboard handlers, and ARIA attributes.

Bands: min 1, max 10. Add/remove buttons. Enable toggle per band (button labelled with band number, `aria-pressed`). Remove buttons use `<X size={12} strokeWidth={2.5} />` from lucide-react (the `×` glyph had uneven metrics that prevented centring in the circle).

**Bidirectional hover** — `hoveredBandIndex` in `AppContext` is set by both `BandRow` (mouseenter/leave) and the EQCurve band group (mouseenter/leave). Whichever fires sets the shared index; the other direction reacts to it. `BandRow` applies `.highlighted` (accent tint + left accent bar) when its index matches.

**Q / bandwidth display toggle** — `bwMode` is local state in `EQBandControl`. It's intentionally low-prominence (not a header button): a plain underlined text link — "Switch to bandwidth" / "Switch to Q" — in the bottom bar hint row, next to the band-count text. Toggling it converts every PK band's Q knob/input between Q factor and bandwidth in octaves via `qToBw`/`bwToQ` (exact conversion: `BW = 2/ln(2) · arcsinh(1/(2Q))`), passed down to `BandRow` as the `bwMode` prop. The underlying `band.q` value in state is always Q factor — `bwMode` only affects display and the knob/input range (`BW_MIN`/`BW_MAX` ≈ Q 10/0.1).

### Preamp row

A single `Preamp [input] dB` row sits between the header and the band list. Range −20 to +6 dB, step 0.5. Uses the same `NumberInput` component as band parameters. Maps to `setPreampGain` in context → `engine.setMasterGain(Math.pow(10, gain/20))`. Saved to and loaded from APO profiles.

### Header action buttons (right side of EQ Bands header)

All four buttons have Radix tooltips (via the local `Tip` helper in `EQBandControl.tsx`). Band rows animate in/out with `AnimatePresence` + `motion.div` (height: 0 → auto, opacity fade).

- **Reset** — zeroes all band gains (frequencies, Q, and types are unchanged). Uses an inline two-step confirm: clicking "Reset" replaces the button in-place with "Reset all gains?" + Confirm + Cancel. No browser dialog. State is local to `EQBandControl` (`resetPending` boolean). `resetGains` lives in `useEQBands` as a `RESET_GAINS` reducer action.
- **Level Match** — toggles `levelMatch` local state. When active (highlighted green), a `useEffect` in `EQBandControl` calls `computeAverageGainDb(filterNodes)` from `frequencyMath.ts` and sets `engine.setBypassTrim(10^(avgDb/20))`. This attenuates the flat bypass signal to match the EQ'd level — the EQ path is never modified, so there is no clipping risk. Recomputes automatically on every band change. `bypassTrimNode` is only in the bypass path, so when EQ is active the trim has no effect.
- **Bypass** — toggles `eqBypassed` in `AppContext`. Button label is "Bypass" (EQ active) / "Bypassed" (EQ off). When active: the full filter chain is bypassed in the audio graph; the EQ curve goes full grayscale (`grayscale(1)`, opacity 0.35); the preamp row, band list, and bottom bar also desaturate (`grayscale(1)`, opacity 0.5) — but the header action buttons stay at full colour (`.bypassed` scoped selectors exclude `.header`).
- **Auto-preamp** — `AppContext` wraps `updateBand`, `addBand`, `removeBand`, `resetGains`, and `loadProfile` with an `applyAutoPreamp()` call after every mutation. `applyAutoPreamp` calls `computePeakGainDb(filterNodes)` from `frequencyMath.ts` (multiplies all filter responses across 512 log-spaced points, finds the max) and sets preamp to `−max(0, peakDb)`, rounded to 1 decimal.
- **Add Band** — adds a new band (disabled at 10).

---

## APO Equalizer format

```
Preamp: -6 dB
Filter 1: ON PK Fc 1000 Hz Gain 3.5 dB Q 1.41
Filter 2: ON LSC Fc 80 Hz Gain -2 dB Q 0.71
```

`exportToAPO(profile)` and `importFromAPO(text)` are pure functions in `src/audio/eqProfile.ts`. Shelf Q defaults to 0.707 when importing APO files that omit Q or specify S (shelf slope).

---

## Compliance

### Hearing safety gatekeeper

`SafetyModal` blocks the entire UI until accepted. Two modes:

- `'gate'` — checkbox + "Get started" button. Displayed on **every** page load (not just first visit — `safetyAccepted` always initialises as `false`, no localStorage read). This guarantees a user gesture before any `AudioContext` is created, satisfying Safari's autoplay policy.
- `'review'` — "Close" button only. Opened from a "Safety Notice" link in the footer.

The `AudioEngine` is not initialised (no `AudioContext` created) until acceptance. The app root has `aria-hidden` while the modal is open. The old `eq-safety-accepted` localStorage key is no longer written or read.

The modal has a focus trap. Content is friendly and concise (~80 words): intro, a "turn your volume down" action card, and four bullets covering risk/liability, no medical use, under-18 restriction.

### Audio safeguards

- `safetyLimiterNode`: hard gain ceiling at 0.89 (≈ −1 dBFS).
- `compressorNode`: brick-wall at −1 dBFS, ratio 20:1, knee 0, attack 1 ms.
- `PanicButton`: fixed bottom-right, red, silences all audio instantly. Spacebar shortcut (guarded against form elements).

### Privacy Policy

Hearing/audio data is local-only and never leaves the browser. The site itself uses **Cloudflare Web Analytics** (cookieless, no persistent identifier, hosted via the Cloudflare dashboard — no client-side beacon script is added in code) for aggregate visitor stats; this is disclosed in the modal and is entirely separate from the calibration data. One-line notice in the footer. The **Privacy Policy** modal (opened via footer link) documents compliance with UK GDPR / DUAA, EU GDPR (Article 6 & 9), US state health privacy laws (Washington MHMDA), COPPA, and the EU AI Act, including a dedicated "Site analytics" section covering the Cloudflare Web Analytics disclosure. The modal heading and footer button are both labelled "Privacy Policy".

The footer also contains a **Feedback** link (`mailto:tobias.droy@gmail.com?subject=Uniqualiser%20feedback`) for bug reports and feature suggestions.

### Accessibility (WCAG 2.2 AA)

- All interactive elements have `aria-label`.
- EQ curve handles: `role="slider"`, `aria-valuenow/min/max/valuetext`.
- Band rows: `role="group"` with label.
- Filter type buttons: `aria-pressed`.
- Global `:focus-visible` ring using `--accent` (2 px, offset 2 px).
- Skip-to-content link.
- Safety modal focus trap.
- Under-18 restriction documented in safety modal (UK Children's Code / Age Appropriate Design Code).

### SEO

- `index.html` head: descriptive `<title>`, `<meta name="description">`, canonical link (`https://uniqualiser.com/`), Open Graph + Twitter meta tags, and a `WebApplication` JSON-LD block describing what the app actually does (personalised EQ profiling by ear, not just "plays sine tones") — added so search/AI-overview crawlers summarise it correctly.
- `App.tsx` has a visually-hidden `<h1>` (`.srOnly` in `App.module.css`) as the first element in `<main>` — the visible header uses a plain `<Link>` logo, not a heading, so this is the page's only `<h1>`.
- `IntroCard` opens with a visible one-paragraph plain-language definition (`.introLead`) above the "Why personalise your EQ?" section, so both users and crawlers get the core value prop before the HRTF explanation.
- `public/robots.txt` and `public/sitemap.xml` — `/wizard` is disallowed and excluded from the sitemap since it's an unlinked stub route.
- `public/eq-icon.svg` — placeholder favicon (deep-red rounded square, white EQ curve, matching `--accent`). Swap for a real logo when one exists.
- `public/og-image.png` (1200×630) — social link-preview card, built to match the actual card/EQ-curve visual language (white card, warm-grey page background, red curve with glow + handle dots). Referenced by `og:image`/`twitter:image` in `index.html`. Regenerate by rendering an HTML mockup with Playwright at 1200×630 if the design changes — there's no build-time image generation step.

---

## Known gotchas

- `AudioContext` starts suspended (and can enter `'interrupted'` on iOS when app loses focus). `resumeContext()` checks `state !== 'running'` (not just `=== 'suspended'`) and must be called and **awaited** as the very first async op inside the user gesture handler — before any state updates or other async work — otherwise Safari rejects it.
- EQCurve's `useEffect` **must** include `isEngineReady` in its dependency array, otherwise the curve stays flat on first render (engine initialises after the effect runs).
- When `setBandEnabled(false)` is called, gain is set to 0. `setBandEnabled(true, restoreGain)` must receive the band's actual gain value to restore it — `useEQBands.updateBand` passes this automatically.
- `frequencyMath.ts` uses shared module-level `MAG_BUF` / `PHASE_BUF` buffers. These are not thread-safe, but Web Audio runs on the main thread so this is fine.
- Frequency label text anchors: `"start"` for 20 Hz, `"end"` for 20 kHz, `"middle"` for all others — prevents labels clipping outside the SVG.
- `startOscillator()`/`startFile()` must restore `masterGainNode` to `this.preampLinear`, not hardcoded `1.0`, otherwise a panic followed by replay silently overrides the user's preamp setting.
- `AudioBufferSourceNode` is one-shot and has no seek or pause. Pause is implemented by storing `playbackOffset = getFilePosition()` then stopping the source. Resume calls `startFile(offset)` which creates a fresh source. Seek follows the same pattern. `onFileEnded` callback is stored on the engine and reused across resume/seek so React can reset state when the track ends naturally.
- The scrubber (Radix Slider) commits the seek on `onValueCommit` (pointer up or key release), not `onValueChange`, to avoid creating a new buffer source on every pixel of drag. `onPointerDown` on the root sets `isScrubbing = true`; `isScrubbingRef` blocks the rAF loop from overwriting the visual position during drag.
- `bypassTrimNode` must be disconnected in `rebuildChain()` at the top of every call (alongside filter nodes), otherwise stale connections to `analyserNode` accumulate. It only reconnects in the bypass branch.

---

## GitHub

Repository: `https://github.com/tobiasdroy/uniqualiser`
