# SafeReturn UI system

SafeReturn uses a trust-first, modern public-service visual language. The UI
must feel approachable to a first-time wallet user while keeping blockchain
state inspectable for experienced users.

## Design dials

- Design variance: 4/10. Mostly predictable layouts with a few asymmetric
  moments on the landing page.
- Motion intensity: 3/10. Motion is reserved for feedback and state changes.
- Visual density: 5/10. Product pages are compact enough for daily use without
  turning the app header or forms into a dashboard cockpit.

## Tokens and rules

- Be Vietnam Pro is the interface and display typeface. JetBrains Mono is only
  for wallet addresses, hashes and numeric chain data.
- Forest green is the sole brand accent. Amber, rose, sky and emerald are used
  only for semantic states.
- Cards use 16px radii, controls use 12px radii and small status labels use 8px
  radii. Interactive controls never wrap on desktop.
- Light and dark palettes follow the operating-system preference through CSS
  semantic tokens (`prefers-color-scheme` in `src/app/globals.css`). Prefer
  semantic classes (`alert-box-*`, `status-pill-*`, `badge-devnet`) over
  hard-coded Tailwind amber/rose utilities so hierarchy stays identical in both modes.
- Desktop navigation is one line and at most 72px high. Network balances move
  out of the header below desktop widths to prevent crowding.
- Empty, loading, error and pending-signature states are required for every
  data or transaction surface.
