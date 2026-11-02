# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Overview

"Zotero ViewFlow" (package name `zotero-viewflow`, add-on ID `zotero-viewflow@groele`) is a Zotero plugin that renders live citation and bibliography previews in the native item pane across both library and PDF reader views, providing one-click copy with rich-text and HTML formatting.

Target: Developed and perfected based on Zotero 10, forward-looking for future versions and upcoming platform features, with declared compatibility across Zotero 10.0-12.* (`strict_min_version: "10.0"`, `strict_max_version: "12.*"`). Build output targets Firefox 140+ / Gecko 153+ modern architecture. Node v20+ required for development.

## Repository Source of Truth

The maintained ViewFlow source is the repository root, on local `main` tracking `origin/main`.
The entry point is `src/index.js`, bundled with esbuild into root `zoteropreview.js`.
Runtime assets and installer packaging are defined in `scripts/build.ps1` and `package.json`.

## Standard Commands

```bash
# Bundle modular source into root zoteropreview.js
npm run build:bundle       # node scripts/build-source.mjs

# Package production XPI and refresh updates feed
npm run build:xpi          # pwsh -NoProfile -File scripts/build.ps1 -UpdateFeed

# Full build: bundle + package
npm run build

# Syntax verification of runtime scripts
npm run test:syntax        # node --check bootstrap.js zoteropreview.js zoteropreview_prefs.js

# Execute 56-test unit test suite
npm run test:unit          # node --test tests/*.test.cjs

# Full test pipeline (bundle, syntax, unit tests)
npm test

# Self-test SemVer release tag validation
python scripts/release-tags.py --self-test
```

## Architecture & Module Structure

ViewFlow is organized as a decoupled, modular ES architecture under `src/`:

1. **Constants & Configuration (`src/constants.js`)**:
   - Centralizes preference prefix (`extensions.zoteropreview.`), LRU limits (`CACHE_LIMIT = 64`, `CACHE_BYTE_LIMIT = 2MB`, `CACHE_TTL = 60s`), style initialization timeout (`10s`), embedded SVG icons, error message definitions, and numeric normalization helpers (`parseNumber`, `createPreviewError`).

2. **LRU Cache Subsystem (`src/cache.js`)**:
   - `CacheManager`: Encapsulates an LRU cache with entry count bounding, total byte budget enforcement, TTL invalidation, and targeted item ID invalidation upon library mutations.

3. **CSL Processing & Item Resolution (`src/csl.js`)**:
   - `normalizeItem`: Traverses attachment parent hierarchies to locate the regular library item while preventing cycles and trashed item leakage.
   - `resolveItems`: Distinguishes between library multi-selection and single-item reader tab contexts.
   - `resolveConfig`: Extracts and unifies QuickCopy format settings, custom style overrides, layout parameters, and drag limits.
   - `getPreviewKey`: Generates deterministic cache keys incorporating item modification timestamps and style revisions.
   - `generateCSL`: Calls `Zotero.QuickCopy.getContentFromItems` to produce dual HTML and plain-text outputs.
   - `waitForStyles`: Asynchronous guard awaiting `Zotero.Styles.init()` with timeout and cancellation hooks.

4. **Clipboard & Feedback Engine (`src/clipboard.js`)**:
   - `writeToXPCOMClipboard`: Safely populates `text/html` and `text/plain` flavors via `nsITransferable` without deprecated window mediator lookups.
   - `showCopyFeedback`: Coordinates success animation timers and icon state transitions.
   - `renderCopyError`: Displays localized copy error status when the clipboard is unavailable.

5. **Position & Sizing Management (`src/position.js`)**:
   - `resolvePosition`: Maps preference values (`zotero-item-pane-header`, `zotero-editpane-item-box`, `zotero-editpane-related`).
   - `observePosition` & `queuePosition`: Debounces and coordinates native pane reordering via `item-details` and `sidenav.changePaneOrder`.
   - `fitWidth`: Adjusts section `maxWidth` via `ResizeObserver` to prevent XUL intrinsic width expansion.

6. **DOM Rendering & Templates (`src/view.js`)**:
   - `ensureSectionHeader`: Guarantees stable branding text before Fluent strings resolve.
   - `buildBlock`: Generates citation / bibliography preview containers and copy buttons.
   - `setHTML`: Safe HTML parsing via DOMParser and `importNode` into Zotero's XML/XUL document namespace.
   - `renderPayload` & `renderMessage`: Handles layout styling properties, truncated item alerts, and retry buttons.

7. **Lifecycle & Section Coordination (`src/section.js`)**:
   - Coordinates `initSection`, `changeItem`, `prepareRender`, `renderSection`, `runRender`, `cancelRender`, `destroySection`, `scheduleRefresh`, `queueAllPreviews`, and `updateLayout`.

8. **Plugin Facade & Entry (`src/index.js`)**:
   - Binds and exposes the authoritative `Zotero.zoteropreview` singleton object with 100% backward-compatible methods and properties.

## Key Invariants & Rules

- **API & Test Compatibility**: Tests in `tests/native-sidebar.test.cjs` mock the environment and directly access `plugin._states`, `plugin._cache`, `plugin._positionTimers`, and override `plugin._setHTML`. All internal members must remain accessible on `Zotero.zoteropreview`.
- **Gecko 153 Sandbox Freeze**: Sandboxed execution freezes `Array.prototype`, `JSON`, and `Promise`. Never mutate or monkey-patch prototype methods.
- **Fail-Closed Clipboard Copy**: Before copying, citation inputs and item modification timestamps are re-checked against active selection to prevent copying stale or trashed citations.
- **Zotero 10 ~ 12 Scope**: Keep `strict_min_version: "10.0"` and `strict_max_version: "12.*"` synchronized across `manifest.json`, `package.json`, and `zotero-viewflow-updates.json`.
