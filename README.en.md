> Current version: **17.0.0**. Unified Major Release across the Zotero Flow suite, reinforcing the structured micro-card settings pane (40px golden alignment), compact citation reverse lookup, local history cache, and Zotero 10 ~ 12 modern Gecko compatibility.

# Zotero ViewFlow


**Zotero Flow Series · Preview**

*让研究的每一步衔接起来。 / Connect each step of research.*

Preview and copy formatted references in Zotero’s item pane.

[简体中文](README.md) · [English](README.en.md)

[![Release](https://img.shields.io/badge/version-17.0.0-245ac7?style=flat-square)](https://github.com/groele/Zotero-ViewFlow/releases/tag/v17.0.0) · [Download XPI](https://github.com/groele/Zotero-ViewFlow/releases/download/v17.0.0/Zotero-ViewFlow-17.0.0.xpi) · [Report an issue](https://github.com/groele/Zotero-ViewFlow/issues)

[Overview](#overview) · [Installation and updates](#installation) · [Quick start](#quick-start) · [Key features](#features) · [Settings](#settings) · [Data, sync, and services](#data) · [Compatibility and validation](#compatibility) · [Troubleshooting](#troubleshooting) · [Development and documentation](#development) · [The Flow series](#series) · [Origin and license](#license)

<a id="overview"></a>

## Overview

For readers and writers who need a quick formatting check: display references and in-text citations in the item pane and copy the formatted output.

Install this add-on independently and combine it with other Flow products as needed.

<a id="installation"></a>

## Installation and updates

1. Download [Zotero-ViewFlow-17.0.0.xpi](https://github.com/groele/Zotero-ViewFlow/releases/download/v17.0.0/Zotero-ViewFlow-17.0.0.xpi) (add-on version **17.0.0**), not the Source code ZIP.
2. In Zotero, open **Tools → Plugins/Add-ons**, then choose **Install Add-on From File** from the gear menu.
3. Select the XPI, complete installation, and restart if requested.

Use the add-on manager to check for later updates. Automatic checking/installation depends on Zotero, per-add-on update settings, and compatibility. Back up important data before upgrades or migration.

Update feed: [update.json](https://github.com/groele/Zotero-ViewFlow/blob/main/update.json) · Add-on ID: `zotero-viewflow@groele`.

<a id="quick-start"></a>

## Quick start

1. **Instant preview and copy**: Select an item or open a reader tab, and click "📋 Copy Bibliography" or "📋 Copy Citation".
2. **Compact reverse lookup**: Copy a compact reference string (e.g. `Curr. Appl Phys., 2027, 94, 40–47.` or a DOI) from Word/PPT, click "📋 Clipboard" or paste and press Enter in the sidebar lookup panel to locate the source item and open its PDF in one click.
3. **Settings & cache management**: Configure the lookup feature toggle, local cache directory path, and retention quota in preferences.

<a id="features"></a>

## Key features

| Differentiator | What it does | Boundary |
|---|---|---|
| Immediate native item-pane preview | Displays the selected item’s bibliography and in-text citation in the main-library item pane, without switching to an external formatting tool. | A standalone reader window may lack the required native ItemPane; use a reader tab in the main window in that case. |
| One-click formatted citation copy | Dedicated buttons to copy formatted references or in-text citations, ready for pasting into slides, rebuttals, or emails. | Copy fidelity is constrained by Zotero and the destination application; it does not replace Zotero’s formal citation-insertion workflow. |
| Compact citation reverse lookup | Resolves compact citations and DOIs back to local Zotero library items in milliseconds, with one-click PDF opening. | Based on physical coordinate pruning and weighted verification; unindexed items will prompt not found. |
| Local history cache & eviction | Automatically caches copy history mappings with LRU+Hit priority eviction and 90-day TTL retention. | Stored locally in `viewflow-cache` within Zotero's data directory; supports custom paths and capacity quotas. |
| Alignment with Zotero styles and Quick Copy | Uses an installed Zotero CSL style or follows Quick Copy settings to inspect formatted output before writing. | Output depends on installed styles and Zotero’s formatting engine; it neither installs, repairs, nor validates a CSL style. |
| Adjustable layout and information density | Adjusts pane placement, visible content, font, and item limit for different workspaces and narrow windows. | Host zoom, window size, and Zotero theme still affect layout; it does not hide overflow by shrinking critical text. |

<a id="settings"></a>

## Settings

Open the add-on preference page in **Zotero → Settings → Zotero ViewFlow**.

The settings pane adheres strictly to the 40px golden alignment grid:
1. **Citation format and preview content**: CSL style selector (supports asynchronous style hydration and Quick Copy tracking) and visible content options;
2. **Placement, layout, and typography**: Pane placement (Top/Middle/Bottom), font scaling, line spacing, and max preview items;
3. **Advanced and debugging**: One-click preview cache clear, debug logging toggle;
4. **Reverse lookup & local cache**: Master feature toggle (unregisters sidebar section when disabled), copy history tracking toggle, custom directory path, entry quota (100–100,000), TTL days (7–3,650), and one-click history cache purge.

<a id="data"></a>

## Data, sync, and services

- Preview uses Zotero items and installed citation styles; it does not synchronize a library.
- Copying output is different from inserting an editable Zotero citation field in Word.
- Citation history cache is kept entirely on local disk; no external network requests or third-party telemetry.

<a id="compatibility"></a>

## Compatibility and validation

| Item | Scope |
|---|---|
| Current add-on version | 17.0.0 |
| Declared Zotero range | `10.0` through `12.*` |
| Evidence boundary | All 95 automated unit tests and 14 architecture guard rules passed 100%. Deeply decoupled into src/ modular architecture (all 17 source modules <= 360 lines, 0 debt declared), fully compatible with modern Zotero 10, 11 and 12 Gecko platforms. |

Add-on and Zotero versions are separate. Declared compatibility does not establish testing on every host, operating system or service. This patch validates the targeted behaviors listed above, not all plugin workflows or main-profile installation.

<a id="troubleshooting"></a>

## Troubleshooting

If the preview is missing, use the item pane in the main window. Some standalone reader windows do not provide that pane. For missing styles, inspect installed styles and Quick Copy settings.

For an issue, include add-on/Zotero versions, OS, steps, expected/actual results, and sanitized errors.

<a id="development"></a>

## Development and documentation

Normal installation needs no development environment. Existing developer entry points follow; use an isolated profile for native tests.

```powershell
pwsh -NoProfile -File ./test.ps1
pwsh -NoProfile -File ./build.ps1
```

`node --test tests/*.test.cjs` and `test.ps1` build and verify the current XPI in a temporary directory. They require no pre-existing `dist` installer and do not modify the published update feed. To verify an existing release artifact, use `pwsh -NoProfile -File ./test.ps1 -PackagePath <XPI-path>`. Run `pwsh -NoProfile -File ./build.ps1 -UpdateFeed` only when preparing a release and intentionally updating its installer SHA-512.

- [验证记录 / Validation](VALIDATION.md)
- [历史记录 / Changelog](CHANGELOG.md)
- [版本说明 / Release notes](docs/releases/v12.6.2.md)
- [产品简介 / Product profile](docs/brand/PRODUCT.md)
- [品牌规范 / Brand guide](docs/brand/BRAND.md)
- [README 模板 / README template](docs/brand/README-TEMPLATE.md)
- [后续提升清单 / Improvement priorities](docs/brand/IMPROVEMENTS.md)
- [Previous detailed guide · README.md](docs/reference/README.md)
- [Previous detailed guide · README.zh-CN.md](docs/reference/README.zh-CN.md)

Previous detailed guides retain feature detail, shortcuts, historical evidence, and full attribution. Their versions and test results belong to the recorded stage.

<a id="series"></a>

## The Flow series

| Product | Role |
|---|---|
| [Zotero RefFlow](https://github.com/groele/Zotero-RefFlow) | Discovery · Discover references, citing works, and related research. |
| [Zotero MetaFlow](https://github.com/groele/Zotero-MetaFlow) | Metadata · Validate, normalize, and enrich reference metadata. |
| [Zotero ViewFlow](https://github.com/groele/Zotero-ViewFlow) | Preview · Preview and copy formatted references in Zotero’s item pane. |
| [Zotero MindFlow](https://github.com/groele/Zotero-MindFlow) | Knowledge · Organize papers, annotations, and ideas into editable maps. |
| [Zotero TaskFlow](https://github.com/groele/Zotero-TaskFlow) | Tasks · Turn literature reading into trackable tasks and plans. |
| [Zotero CiteFlow](https://github.com/groele/Zotero-CiteFlow) | Citation · Track Word citations and connect them to Zotero items. |
| [Zotero PaperFlow](https://github.com/groele/Zotero-PaperFlow) | Publication · Manage manuscripts, submission rounds, and review responses. |

Each add-on installs and updates separately. A shared brand does not imply a shared database or automatic integration of every workflow.

<a id="license"></a>

## Origin and license

**Derivative notice:** Zotero ViewFlow is an independently maintained derivative of David Carter’s open-source [ZoteroPreview (dcartertod/zotero-plugins)](https://github.com/dcartertod/zotero-plugins). Original copyright and applicable notices remain in force; this project is neither an upstream nor an official Zotero release.

License: [Apache-2.0](LICENSE).

This series is independently maintained and is not an official Zotero product. Zotero and third-party names, trademarks, and materials belong to their respective rights holders.

[Release/tag policy](docs/release-tag-policy.md)


**Acknowledgements and third-party rights:** See [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md) for upstream authorship and community credits, and [THIRD_PARTY.md](THIRD_PARTY.md) for license provenance and release verification. Credits do not replace the original license, copyright statements or distribution obligations.
