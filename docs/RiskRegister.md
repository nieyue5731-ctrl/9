# Risk Register

## Active Risks

### R1: CSS Load Order Race Condition
- **Severity:** LOW
- **Description:** External CSS files load asynchronously. If JS executes before CSS is fully loaded, initial DOM measurements might be slightly off.
- **Mitigation:** CSS `<link>` tags are in `<head>` and will block rendering. JS scripts are in `<body>` and execute after CSS is parsed.
- **Status:** MITIGATED

### R2: Script Loading Order Dependencies
- **Severity:** HIGH
- **Description:** The original monolith had implicit ordering guarantees. Split files must maintain exact same execution order.
- **Mitigation:** Script tags in index.html follow the exact same dependency order as the original file's script blocks. All scripts are synchronous (no `defer` or `async`).
- **Status:** MITIGATED - verified via code review

### R3: Monkey-Patch Chain Integrity
- **Severity:** HIGH
- **Description:** Multiple patches override `Renderer.renderWorld`, `Game.init`, `Game.update`, etc. If load order changes, the wrong version may be the "last writer wins."
- **Mitigation:** Patch files are loaded in the exact same order as the original IIFE blocks. The `PatchManager.once()` guards prevent duplicate application.
- **Status:** MITIGATED

### R4: Global Variable Accessibility
- **Severity:** MEDIUM
- **Description:** Original code relies heavily on `window.*` globals. Splitting into files must not break cross-file access.
- **Mitigation:** All files still use global scope (no ES modules). All `window.TU`, `window.ObjectPool`, `window.game` etc. assignments are preserved.
- **Status:** MITIGATED

### R5: Inline Event Handlers / DOM References
- **Severity:** LOW
- **Description:** Some code references DOM elements by ID. If HTML structure changes, these could break.
- **Mitigation:** HTML body structure is preserved exactly from the original. All element IDs are unchanged.
- **Status:** MITIGATED

### R6: Worker Inline Source
- **Severity:** MEDIUM
- **Description:** Web Workers are created from inline source strings (Blob URLs). These reference class names and constants that must be available.
- **Mitigation:** Worker source strings are preserved exactly. They are self-contained and don't reference external files.
- **Status:** MITIGATED

## Resolved Risks

### R7: Invalid HTML (Scripts between head/body)
- **Severity:** LOW (was being auto-corrected by browsers)
- **Resolution:** Fixed in refactoring. Scripts now properly placed in head or body.

## Monitoring

After deployment, monitor for:
1. Console errors on first load
2. Save/load functionality across browser refresh
3. Mobile touch controls responsiveness
4. Weather effects rendering
5. World generation consistency (same seed = same world)
