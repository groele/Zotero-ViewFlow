<div align="center">

# Zotero ViewFlow

**在 Zotero 原生侧栏快速预览参考文献与正文引用。**

[English](README.md) · [简体中文](README.zh-CN.md)

![Version](https://img.shields.io/badge/version-12.3.0-blue) ![Zotero](https://img.shields.io/badge/Zotero-8.0%E2%80%9311.0.*-green) ![License](https://img.shields.io/badge/license-Apache-2.0-lightgrey)

[下载 v12.3.0](https://github.com/groele/Zotero-ViewFlow/releases/download/zotero-viewflow-v12.3.0/Zotero-ViewFlow-12.3.0.xpi) · [问题反馈](https://github.com/groele/Zotero-ViewFlow/issues) · [版本发布](https://github.com/groele/Zotero-ViewFlow/releases)

**Zotero Flow Series**

</div>

---

## 项目概述

Zotero ViewFlow 是 Zotero Flow Series 中独立维护的插件，在 Zotero 原生侧栏快速预览参考文献与正文引用。 项目侧重在 Zotero 桌面环境中提供清晰、实用的科研工作流程。

## 核心功能

- 在 Zotero 原生条目侧栏预览参考文献及正文引用。
- 根据主库条目或阅读标签页显示对应文献的预览。
- 调整预览位置、格式与显示条目上限。
- 按 Zotero 格式设置复制引用内容。

## 界面展示

界面与实现细节可参考[项目文档](https://github.com/groele/Zotero-ViewFlow/tree/main/docs)（如有）。当前版本截图将在核实实际界面后添加，避免使用过期图片。

## 兼容性

| 项目 | 说明 |
| --- | --- |
| 插件版本 | `12.3.0` |
| 插件 ID | `zotero-viewflow@groele` |
| 声明兼容范围 | `8.0–11.0.*` |
| 验证情况 | 已有 Zotero 10.0.6 桌面环境验证记录；Zotero 8/9/11 尚未完成全面实机验收。 |

兼容性声明不等于列出版本均已完成实机验证。

## 安装指南

1. [下载当前版本 XPI](https://github.com/groele/Zotero-ViewFlow/releases/download/zotero-viewflow-v12.3.0/Zotero-ViewFlow-12.3.0.xpi)（`Zotero-ViewFlow-12.3.0.xpi`）。
2. 打开 Zotero 的 **工具 → 插件**（不同版本的菜单名称可能不同）。
3. 选择 **从文件安装插件**，选中 XPI，按提示重启。

自动更新清单：[zotero-viewflow-updates.json](https://github.com/groele/Zotero-ViewFlow/blob/main/zotero-viewflow-updates.json)。

## 快速开始

1. 通过 Zotero 插件管理器安装 XPI。
2. 选择主库文献，或在主窗口打开 PDF、EPUB、网页阅读标签页。
3. 在右侧条目侧栏打开预览栏目，并在插件设置中调整样式。

## 配置与注意事项

部分 Zotero 独立阅读窗口没有插件所需的原生条目侧栏，此时请使用主窗口内的阅读标签页。

## 开发与测试

在仓库根目录运行以下命令。涉及 Zotero 桌面实机测试时，请先配置项目要求的独立测试环境。

```powershell
pwsh -NoProfile -File ./test.ps1
pwsh -NoProfile -File ./build.ps1
``

上述命令为项目提供的开发与测试入口，不表示所有系统环境或集成测试均已通过。

## 文档与支持

[Validation notes](VALIDATION.md) · [Changelog](CHANGELOG.md)

[提交问题](https://github.com/groele/Zotero-ViewFlow/issues) · [查看源码](https://github.com/groele/Zotero-ViewFlow)

## 致谢与项目来源

Zotero ViewFlow 最初基于 [dcartertod/zotero-plugins](https://github.com/dcartertod/zotero-plugins) 开源项目二次开发，原项目作者为 David Carter (ZoteroPreview)。感谢原作者及贡献者的基础工作。此 Zotero Flow Series 版本独立维护，并非上游项目或 Zotero 官方发布。原作者版权及适用的第三方声明继续有效。

## 许可证

本项目遵循 **Apache-2.0**，具体以 [LICENSE](LICENSE) 及适用的第三方版权声明为准。

Zotero 及相关商标归各自权利人所有。
