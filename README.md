# Uniqualiser

A web-based tool for creating a personalised equaliser profile based on your HRTF (Head-Related Transfer Function). Sweep a sine oscillator across the audible frequency range, identify where your hearing peaks and dips, and correct them with a parametric EQ until the response sounds flat to you. Verify the result by toggling your profile on and off against an audio file.

All processing is done client-side via the Web Audio API — no server, no data leaves your browser.

## Features

- **Sine oscillator** — sweep 20 Hz to 20 kHz manually or via auto-sweep (10 / 30 / 60 s); click the frequency display to type an exact value (e.g. 2,220 Hz) and the slider jumps to that point
- **Oscillator volume** — dedicated volume slider (default −12 dB) to balance the tone against your audio file; 8 ms fade in/out prevents audible clicks on play and stop
- **Parametric EQ** — 5 bands by default, expandable to 10; Peak, Lo Shelf, and Hi Shelf filter types per band; preamp gain control (−20 to +6 dB); gain range ±18 dB matches the visible EQ curve
- **Auto-preamp** — preamp is automatically reduced to compensate whenever a band boost would risk clipping
- **Rotary knobs** — each band parameter (Freq, Gain, Q) has a drag knob alongside the number input; drag up to increase, down to decrease; Q knob hidden for shelf filters
- **Live EQ curve** — SVG frequency response computed in real time; drag handles to adjust frequency and gain directly on the curve; hover a handle to see bandwidth shading and drag the Q edges
- **Bidirectional hover** — hovering a curve node highlights the corresponding EQ band row, and hovering a band row highlights the corresponding node on the curve
- **Bypass** — toggle the entire EQ in and out with one button to compare your correction against the flat signal; the curve and band controls desaturate when bypassed to make the state unmistakable
- **Level Match** — compensates the bypass path so the comparison is at equal perceived loudness (eliminates the "louder sounds better" bias)
- **Reset** — zero all band gains in one step (with confirmation)
- **Audio file player** — upload any audio file; play/pause and scrub through the track to revisit specific sections with Bypass toggled on and off
- **Import / Export** — standard APO Equalizer `.txt` format, compatible with most system-level EQ tools
- **Light and dark mode** — system-agnostic toggle, preference saved across sessions

## Safety

A safety notice is shown on every visit before any audio can play. Hardware limiting (−1 dBFS ceiling + brick-wall compressor) and a panic button are built in as additional safeguards.

## Privacy

All audio and hearing data is processed entirely within your browser and is never transmitted to any server. The site uses cookieless Cloudflare Web Analytics for aggregate visitor stats (page views, referrers, country) — entirely separate from your calibration data. See the in-app Privacy Policy for full compliance details (UK GDPR, EU GDPR, US MHMDA, COPPA, EU AI Act).

## Tech stack

- [Vite](https://vitejs.dev) + [React](https://react.dev) + TypeScript
- Web Audio API (no audio libraries)
- React Router
- CSS Modules + CSS custom properties (design tokens, dark/light mode)
- [Radix UI](https://www.radix-ui.com) — accessible slider and tooltip primitives
- [Framer Motion](https://www.framer.com/motion/) — layout and entrance animations
- [Lucide React](https://lucide.dev) — icon set

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Usage

1. Accept the safety notice and lower your listening volume before starting
2. Click **Play** to start the sine oscillator; use the volume slider to balance its level against your audio file
3. Drag the frequency slider, use **Auto Sweep**, or click the frequency display and type an exact value to move through the spectrum
4. Where you hear a peak (louder than expected), add a negative gain correction on that band. Where you hear a trough, add positive gain.
5. Use the rotary knobs, number inputs, or drag the handles directly on the curve to dial in Freq, Gain, and Q for each band; hover a handle to see bandwidth shading and drag the Q edges
6. Adjust until the oscillator sounds perceptually flat across the range
7. Enable **Level Match** before using **Bypass** — it automatically compensates the bypass path so both states are at equal perceived loudness, removing the "louder sounds better" bias
8. Use **Bypass** to toggle the EQ in and out and confirm the correction is working
9. Upload an audio file and use **Bypass** (with Level Match on) to hear the difference on real material
10. **Export Profile** to save your settings as a `.txt` file

## APO format

Profiles are saved in the EqualizerAPO text format, compatible with tools like EqualizerAPO (Windows) and others:

```
Preamp: -3.0 dB
Filter 1: ON PK Fc 1000 Hz Gain 3.5 dB Q 1.41
Filter 2: ON LSC Fc 80 Hz Gain -2.0 dB Q 0.71
Filter 3: ON HSC Fc 10000 Hz Gain 1.5 dB Q 0.71
```

## License

Copyright (c) 2026 Uniqualiser. All rights reserved.

The source code in this repository is made available for educational and review purposes only. Permission is granted to view the source and run the application locally for personal, non-commercial use. Unauthorised copying, distribution, modification, public hosting, or commercial exploitation is strictly prohibited without explicit written permission from the copyright holder.
