> 原详细指南，保存于 2026-10-21。历史版本与验证范围按原记录理解；当前安装入口见 [README](../../README.md)。

<div align="center">

# Zotero ViewFlow

**Preview references and citations directly inside Zotero.**

[English](../../README.md) · [简体中文](../../README.zh-CN.md)

![Version](https://img.shields.io/badge/version-12.3.3-blue) ![Zotero](https://img.shields.io/badge/Zotero-8.0%E2%80%9311.0.*-green) ![License](https://img.shields.io/badge/license-Apache-2.0-lightgrey)

[Download v12.3.3](https://github.com/groele/Zotero-ViewFlow/releases/download/v12.3.3/Zotero-ViewFlow-12.3.3.xpi) · [Report an Issue](https://github.com/groele/Zotero-ViewFlow/issues) · [Releases](https://github.com/groele/Zotero-ViewFlow/releases)

**Zotero Flow Series**

</div>

---

## Overview

Zotero ViewFlow is an independently maintained Zotero add-on that preview references and citations directly inside Zotero. It is designed for research workflows that need practical functionality within the Zotero desktop application.

## Key Features

- Preview references and in-text citations in Zotero's native item pane.
- Show context-appropriate previews for library items and reader tabs.
- Adjust preview placement, formatting and visible item limits.
- Copy the displayed references or citations using Zotero's formatting preferences.

## Screenshots

For interface examples and implementation details, see the [project documentation](https://github.com/groele/Zotero-ViewFlow/tree/main/docs) where available. Screenshots will be added only after they are verified against the current interface.

## Compatibility

| Item | Details |
| --- | --- |
| Add-on version | `12.3.3` |
| Add-on ID | `zotero-viewflow@groele` |
| Declared Zotero range | `8.0–11.0.*` |
| Verification | Zotero 10.0.6 desktop behavior has been observed; Zotero 8/9/11 full desktop acceptance remains incomplete. |

The declared compatibility range is not a guarantee that every Zotero version has been tested.

## Installation

1. [Download the v12.3.3 XPI](https://github.com/groele/Zotero-ViewFlow/releases/download/v12.3.3/Zotero-ViewFlow-12.3.3.xpi) for the current release (`Zotero-ViewFlow-12.3.3.xpi`).
2. Open Zotero → **Tools → Plugins** (or the add-on manager in your version).
3. Choose **Install Add-on From File**, select the XPI, and restart Zotero if requested.

Update feed: [zotero-viewflow-updates.json](https://github.com/groele/Zotero-ViewFlow/blob/main/zotero-viewflow-updates.json).

## Quick Start

1. Install the XPI through Zotero's add-on manager.
2. Select a library item or open its PDF/EPUB/web reader tab in the main window.
3. Open the preview section in the right-hand item pane; customize layout in add-on preferences.

## Configuration & Notes

A standalone Zotero reader window may not provide the native item pane needed for this feature. Use a reader tab in the main window where necessary.

## Development & Testing

Run the following commands from the repository root. Follow project-specific test prerequisites before running native desktop validation.

```powershell
pwsh -NoProfile -File ./test.ps1
pwsh -NoProfile -File ./build.ps1
```
These commands describe available project tasks, not a claim that every environment or integration test passes.

## Documentation & Support

[Validation notes](../../VALIDATION.md) · [Changelog](../../CHANGELOG.md)

[Open an issue](https://github.com/groele/Zotero-ViewFlow/issues) · [Browse source](https://github.com/groele/Zotero-ViewFlow)

## Acknowledgements & Attribution

Zotero ViewFlow was originally developed as a derivative of [dcartertod/zotero-plugins](https://github.com/dcartertod/zotero-plugins) by David Carter (ZoteroPreview). We acknowledge the original author and contributors for their foundational work. This Zotero Flow Series edition is independently maintained, is not an official release of the upstream project, and is not endorsed by Zotero. Original copyright and applicable third-party notices remain in force.

## License

Distributed under **Apache-2.0**. See [LICENSE](../../LICENSE) and any applicable third-party notices for details.

Zotero and associated trademarks belong to their respective owners.
