# Zotero ViewFlow

**Zotero Flow Series · Preview**

*让研究的每一步衔接起来。 / Connect each step of research.*

Preview and copy formatted references in Zotero’s item pane.

[简体中文](README.md) · [English](README.en.md)

[![Release](https://img.shields.io/badge/version-12.3.4-245ac7?style=flat-square)](https://github.com/groele/Zotero-ViewFlow/releases/tag/zotero-viewflow-v12.3.4) · [Download XPI](https://github.com/groele/Zotero-ViewFlow/releases/download/zotero-viewflow-v12.3.4/Zotero-ViewFlow-12.3.4.xpi) · [Report an issue](https://github.com/groele/Zotero-ViewFlow/issues)

[Overview](#overview) · [Installation and updates](#installation) · [Quick start](#quick-start) · [Key features](#features) · [Settings](#settings) · [Data, sync, and services](#data) · [Compatibility and validation](#compatibility) · [Troubleshooting](#troubleshooting) · [Development and documentation](#development) · [The Flow series](#series) · [Origin and license](#license)

<a id="overview"></a>

## Overview

For readers and writers who need a quick formatting check: display references and in-text citations in the item pane and copy the formatted output.

Install this add-on independently and combine it with other Flow products as needed.

<a id="installation"></a>

## Installation and updates

1. Download [Zotero-ViewFlow-12.3.4.xpi](https://github.com/groele/Zotero-ViewFlow/releases/download/zotero-viewflow-v12.3.4/Zotero-ViewFlow-12.3.4.xpi) (add-on version **12.3.4**), not the Source code ZIP.
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

| Feature | Scope |
|---|---|
| Formatted previews | Preview references and in-text citations from the library or reader tabs in the main window. |
| Citation styles | Choose an installed Zotero style or follow Quick Copy settings. |
| Placement and content | Adjust pane placement, preview content, font, and item limits. |
| Copy | Copy displayed text and supported rich-text output. |

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
| Current add-on version | 12.3.4 |
| Declared Zotero range | `8.0` through `11.0.*` |
| Evidence boundary | The 12.3.4 settings pane was checked in Windows Zotero 10.0.6, including sequential navigation and MetaFlow card palette comparison and 26 existing tests passed; this does not establish acceptance on every declared host version. |

Add-on and Zotero versions are separate. Manifest compatibility does not establish testing on every host, operating system, or service. This branding/documentation update does not rerun business workflow tests.

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

- [验证记录 / Validation](VALIDATION.md)
- [历史记录 / Changelog](CHANGELOG.md)
- [版本说明 / Release notes](RELEASE_NOTES_v12.3.4.md)
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

Independently maintained derivative of David Carter’s ZoteroPreview (dcartertod/zotero-plugins); original copyright and applicable notices remain in force.

License: [Apache-2.0](LICENSE).

This series is independently maintained and is not an official Zotero product. Zotero and third-party names, trademarks, and materials belong to their respective rights holders.
