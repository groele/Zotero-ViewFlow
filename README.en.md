> Current version: **12.6.5**. This release strengthens PDF reader sidebar refresh, cancellation and clipboard validation.

# Zotero ViewFlow


**Zotero Flow Series · Preview**

*让研究的每一步衔接起来。 / Connect each step of research.*

Preview and copy formatted references in Zotero’s item pane.

[简体中文](README.md) · [English](README.en.md)

[![Release](https://img.shields.io/badge/version-12.6.5-245ac7?style=flat-square)](https://github.com/groele/Zotero-ViewFlow/releases/tag/v12.6.5) · [Download XPI](https://github.com/groele/Zotero-ViewFlow/releases/download/v12.6.5/Zotero-ViewFlow-12.6.5.xpi) · [Report an issue](https://github.com/groele/Zotero-ViewFlow/issues)

[Overview](#overview) · [Installation and updates](#installation) · [Quick start](#quick-start) · [Key features](#features) · [Settings](#settings) · [Data, sync, and services](#data) · [Compatibility and validation](#compatibility) · [Troubleshooting](#troubleshooting) · [Development and documentation](#development) · [The Flow series](#series) · [Origin and license](#license)

<a id="overview"></a>

## Overview

For readers and writers who need a quick formatting check: display references and in-text citations in the item pane and copy the formatted output.

Install this add-on independently and combine it with other Flow products as needed.

<a id="installation"></a>

## Installation and updates

1. Download [Zotero-ViewFlow-12.6.5.xpi](https://github.com/groele/Zotero-ViewFlow/releases/download/v12.6.5/Zotero-ViewFlow-12.6.5.xpi) (add-on version **12.6.2**), not the Source code ZIP.
2. In Zotero, open **Tools → Plugins/Add-ons**, then choose **Install Add-on From File** from the gear menu.
3. Select the XPI, complete installation, and restart if requested.

Use the add-on manager to check for later updates. Automatic checking/installation depends on Zotero, per-add-on update settings, and compatibility. Back up important data before upgrades or migration.

Update feed: [zotero-viewflow-updates.json](https://github.com/groele/Zotero-ViewFlow/blob/main/zotero-viewflow-updates.json) · Add-on ID: `zotero-viewflow@groele`.

<a id="quick-start"></a>

## Quick start

1. Select an item or open a reader tab in Zotero’s main window.
2. Open the preview section in the item pane.
3. Choose style and content in settings, then review and copy the output.

<a id="features"></a>

## Key features

| Differentiator | What it does | Boundary |
|---|---|---|
| Immediate native item-pane preview | Displays the selected item’s bibliography and in-text citation in the main-library item pane, without switching to an external formatting tool. | A standalone reader window may lack the required native ItemPane; use a reader tab in the main window in that case. |
| Alignment with Zotero styles and Quick Copy | Uses an installed Zotero CSL style or follows Quick Copy settings to inspect formatted output before writing. | Output depends on installed styles and Zotero’s formatting engine; it neither installs, repairs, nor validates a CSL style. |
| Reader and library context | Shows the relevant preview for the current main-library selection or reader tab, bringing reading and citation checking into one interface. | Injects only its own container and does not alter Zotero’s other panes or another add-on’s UI. |
| Adjustable layout and information density | Adjusts pane placement, visible content, font, and item limit for different workspaces and narrow windows. | Host zoom, window size, and Zotero theme still affect layout; it does not hide overflow by shrinking critical text. |
| Text and supported rich-text copy | Copies the currently displayed formatted text and available rich-text representation for pasting into a destination. | Copy fidelity is constrained by Zotero and the destination application; it does not replace Zotero’s formal citation-insertion workflow. |

<a id="settings"></a>

## Settings

Open the add-on preference page in **Zotero → Settings → Zotero ViewFlow**.

Settings cover citation format, placement, preview content, font, and item limits. Version 12.3.4 waits for Zotero’s citation styles before populating the menu.

<a id="data"></a>

## Data, sync, and services

- Preview uses Zotero items and installed citation styles; it does not synchronize a library.
- Copying output is different from inserting an editable Zotero citation field in Word.

<a id="compatibility"></a>

## Compatibility and validation

| Item | Scope |
|---|---|
| Current add-on version | 12.6.2 |
| Declared Zotero range | `8.0` through `11.0.*` |
| Evidence boundary | 41 automated checks passed. Initial launch and restart each passed 16 targeted checks in isolated Windows Zotero 10.0.6, plus 2 panel-title recovery checks, covering real library/PDF sidebars, HTML/plain-text clipboard, retry, keyboard operation and light/dark/narrow settings. Zotero 11, other operating systems, real screen readers and main-profile installation remain unverified. |

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

`node --test tests/*.test.cjs` and `test.ps1` build and verify the current XPI in a temporary directory. They require no pre-existing `dist` installer and do not modify the published update feed. To verify an existing release artifact, use `pwsh -NoProfile -File ./test.ps1 -PackagePath <XPI-path>`. Run `pwsh -NoProfile -File ./build.ps1 -UpdateFeed` only when preparing a release and intentionally updating its installer SHA-256.

- [验证记录 / Validation](VALIDATION.md)
- [历史记录 / Changelog](CHANGELOG.md)
- [版本说明 / Release notes](docs/releases/v12.6.1.md)
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
