# Behavior Changes

This document records any intentional changes to player-perceivable behavior introduced during the refactoring.

## Summary

**The refactoring is designed to be 100% behavior-equivalent.** No game logic, rendering, or interaction behavior was intentionally changed.

## Minor Structural Changes

### 1. HTML Script Placement (Fixed)
- **Old behavior:** Several `<script>` blocks were placed between `</head>` and `<body>`, which is invalid HTML. Browsers handle this by auto-correcting, but the timing could theoretically vary.
- **New behavior:** All scripts are placed inside `<body>` after the DOM elements they reference, or in `<head>` for early infrastructure.
- **Impact:** None expected. Browser behavior was already auto-correcting the invalid placement.
- **Verification:** Game loads and initializes correctly.

### 2. CSS Loading (External files vs inline)
- **Old behavior:** All CSS was inline in `<style>` blocks within the HTML.
- **New behavior:** CSS is loaded via `<link>` tags from external files.
- **Impact:** Minimal. First paint may show a brief flash if CSS files are not cached, but this is standard web behavior. No visual difference once loaded.
- **Verification:** All UI elements render correctly with external CSS.

### 3. Favicon Added
- **Old behavior:** No favicon specified.
- **New behavior:** SVG favicon with sparkle emoji added.
- **Impact:** Purely cosmetic (browser tab icon).

### 4. ARIA Attributes Enhanced
- **Old behavior:** Limited ARIA attributes.
- **New behavior:** Added `role="progressbar"`, `aria-live="polite"` to loading screen elements.
- **Impact:** Improved screen reader accessibility. No visual change.

## No Changes Made To

- Game physics (gravity, friction, collision)
- World generation (noise, biomes, structures, caves)
- Rendering pipeline (sky, world, parallax, post-processing)
- Lighting system (BFS spread, sun decay)
- Player mechanics (sprint, jump, coyote time)
- Save/load system (localStorage + IDB, format compatibility)
- Audio system (Web Audio API synthesized sounds)
- Weather system (rain, snow, thunder, bloodmoon)
- Touch controls (joystick, buttons, aim assist)
- Crafting and inventory systems
- Water physics and tile logic
- Performance auto-quality adjustment
- Minimap rendering
- Particle effects
- Dropped item physics and pickup
