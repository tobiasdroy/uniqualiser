# PersonalisedEQ — Project Context for Claude

## What this is

A client-side web app for hearing-based EQ profiling. Users sweep a sine oscillator across 20 Hz–20 kHz, identify peaks and troughs in their own hearing response, and correct them with a parametric EQ until the perceived response sounds flat. They can then verify the profile by playing an uploaded audio file through the same EQ. All audio processing happens in the browser via the Web Audio API — nothing is sent to a server.

A guided wizard flow is planned (`/wizard` route) but not yet built. The architecture is deliberately laid out to accommodate it.

---

## Tech stack

- **Vite + React + TypeScript**
- **Web Audio API** — raw nodes, no libraries
- **React Router** (`BrowserRouter`) — `/ `(main tool) and `/wizard` (stub) routes
- **CSS Modules** + CSS custom properties — no CSS-in-JS, no Tailwind

---

## Design system

Font: `'Helvetica Neue', Helvetica, Arial, sans-serif`, weight 500 everywhere.

**Light mode (default)** and **dark mode** toggled via `data-theme="dark"` on `<html>`. Theme preference stored in `localStorage` under key `eq-theme`.

```css
/* Light */
--bg-primary: #ffffff
--bg-secondary: #f5f5f7
--bg-elevated: #ffffff
--text-primary: rgba(0,0,0,0.88)
--text-secondary: rgba(0,0,0,0.58)   /* ≥4.5:1 on white — WCAG AA */
--accent / --eq-curve: #0062cc       /* ≥4.5:1 on white — WCAG AA */

/* Dark */
--bg-primary: #1c1c1e
--bg-secondary: #2c2c2e
--bg-elevated: #3a3a3c
--text-primary: rgba(255,255,255,0.92)
--text-secondary: rgba(255,255,255,0.55)  /* ≥4.5:1 on #2c2c2e — WCAG AA */
--accent / --eq-curve: #5aabff            /* ≥4.5:1 on all dark surfaces */
```

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
│   ├── OscillatorControl/  # Log-scale slider + play/sweep controls
│   ├── AudioFilePlayer/    # Upload, playback, EQ bypass toggle
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
└── App.tsx                 # Router, AppProvider, SafetyModal gate
```

---

## Types

```typescript
export type FilterType = 'PK' | 'LSC' | 'HSC';

export interface EQBand {
  id: string;
  enabled: boolean;
  type: FilterType;
  frequency: number;   // Hz, 20–20000
  gain: number;        // dB, -24 to +24
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
| Oscillator `isPlaying`, `currentFreq` | `OscillatorControl` local state |
| Sweep `isSweeping`, `progress`, `currentFreq` | `useSweep` |
| File `isPlaying`, `eqEnabled`, `fileName` | `AudioFilePlayer` local state |

**Sync pattern:** event handler calls `engine.setBandXxx(index, value)` AND `dispatch(UPDATE_BAND)` together. The reducer is pure — no side effects inside it.

`preampGain` (dB, −20 to +6) is stored in the reducer and converted to linear before calling `engine.setMasterGain()`. `AudioEngine` stores `preampLinear` internally so that `startOscillator()`/`startFile()` restore to the correct level after a `panic()` call — they must restore `this.preampLinear`, not a hardcoded `1`.

---

## EQ curve

- 512-point log-spaced `Float32Array` from 20 Hz to 20 kHz, allocated once at module level.
- `BiquadFilterNode.getFrequencyResponse()` works on disconnected nodes, so the curve renders before any audio plays.
- Frequency axis: logarithmic. dB axis: linear, ±18 dB range. The ±18 dB boundary lines render without labels; labels appear for −12, −6, 0, +6, +12 only.
- Per-band dimmed curves + a glowing combined curve (blurred duplicate path underneath).
- Draggable handles: `setPointerCapture` for reliable drag-outside. Horizontal = frequency, vertical = gain.
- Keyboard: arrow keys on focused handles adjust frequency (×1.05) and gain (±0.5 dB). Shift multiplies step.
- `isEngineReady` is in the `useEffect` dependency array — without it the curve won't redraw after the engine initialises.
- When `eqBypassed` is true the container gets `.bypassed` CSS class, which reduces curve/handle opacity to 0.2 and sets `pointer-events: none` on handles (drag is disabled during bypass).

---

## EQ band controls

`NumberInput` is a local wrapper around `<input type="number">` that holds string state while the field is focused to prevent snap-back on intermediate values (empty field, partial numbers, leading minus). It commits and clamps on blur, and only syncs from the external `value` prop when not focused.

Bands: min 1, max 10. Add/remove buttons. Enable toggle per band (button labelled with band number, `aria-pressed`).

### Preamp row

A single `Preamp [input] dB` row sits between the header and the band list. Range −20 to +6 dB, step 0.5. Uses the same `NumberInput` component as band parameters. Maps to `setPreampGain` in context → `engine.setMasterGain(Math.pow(10, gain/20))`. Saved to and loaded from APO profiles.

### Header action buttons (right side of EQ Bands header)

- **Reset** — zeroes all band gains (frequencies, Q, and types are unchanged). Uses an inline two-step confirm: clicking "Reset" replaces the button in-place with "Reset all gains?" + Confirm + Cancel. No browser dialog. State is local to `EQBandControl` (`resetPending` boolean). `resetGains` lives in `useEQBands` as a `RESET_GAINS` reducer action.
- **Level** — toggles `levelMatch` local state. When active (highlighted green), a `useEffect` in `EQBandControl` calls `computeAverageGainDb(filterNodes)` from `frequencyMath.ts` and sets `engine.setBypassTrim(10^(avgDb/20))`. This attenuates the flat bypass signal to match the EQ'd level — the EQ path is never modified, so there is no clipping risk. Recomputes automatically on every band change. `bypassTrimNode` is only in the bypass path, so when EQ is active the trim has no effect.
- **A/B** — toggles `eqBypassed` in `AppContext`. When active (highlighted in accent colour, `aria-pressed=true`) the entire EQ filter chain and `eqMakeupGainNode` are bypassed in the audio graph and the EQ curve dims.
- **+ Add Band** — adds a new band (disabled at 10).

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

- `'gate'` — checkbox + "Get started" button. Displayed on first visit.
- `'review'` — "Close" button only. Opened from a "Safety Notice" link in the footer.

Acceptance is stored in `localStorage` under `eq-safety-accepted`. The `AudioEngine` is not initialised (no `AudioContext` created) until acceptance. The app root has `aria-hidden` while the modal is open.

The modal has a focus trap. Content is friendly and concise (~80 words): intro, a "turn your volume down" action card, and four bullets covering risk/liability, no medical use, under-18 restriction.

### Audio safeguards

- `safetyLimiterNode`: hard gain ceiling at 0.89 (≈ −1 dBFS).
- `compressorNode`: brick-wall at −1 dBFS, ratio 20:1, knee 0, attack 1 ms.
- `PanicButton`: fixed bottom-right, red, silences all audio instantly. Spacebar shortcut (guarded against form elements).

### Privacy

Local-only processing. No data leaves the browser. One-line notice in the footer. Privacy modal documents this (UK GDPR / DUAA compliance).

### Accessibility (WCAG 2.2 AA)

- All interactive elements have `aria-label`.
- EQ curve handles: `role="slider"`, `aria-valuenow/min/max/valuetext`.
- Band rows: `role="group"` with label.
- Filter type buttons: `aria-pressed`.
- Global `:focus-visible` ring using `--accent` (2 px, offset 2 px).
- Skip-to-content link.
- Safety modal focus trap.
- Under-18 restriction documented in safety modal (UK Children's Code / Age Appropriate Design Code).

---

## Known gotchas

- `AudioContext` starts suspended; must call `resumeContext()` inside `startOscillator()` / `startFile()` before playing.
- EQCurve's `useEffect` **must** include `isEngineReady` in its dependency array, otherwise the curve stays flat on first render (engine initialises after the effect runs).
- When `setBandEnabled(false)` is called, gain is set to 0. `setBandEnabled(true, restoreGain)` must receive the band's actual gain value to restore it — `useEQBands.updateBand` passes this automatically.
- `frequencyMath.ts` uses shared module-level `MAG_BUF` / `PHASE_BUF` buffers. These are not thread-safe, but Web Audio runs on the main thread so this is fine.
- Frequency label text anchors: `"start"` for 20 Hz, `"end"` for 20 kHz, `"middle"` for all others — prevents labels clipping outside the SVG.
- `startOscillator()`/`startFile()` must restore `masterGainNode` to `this.preampLinear`, not hardcoded `1.0`, otherwise a panic followed by replay silently overrides the user's preamp setting.
- `bypassTrimNode` must be disconnected in `rebuildChain()` at the top of every call (alongside filter nodes), otherwise stale connections to `analyserNode` accumulate. It only reconnects in the bypass branch.

---

## GitHub

Repository: `https://github.com/tobiasdroy/personalised-eq`
