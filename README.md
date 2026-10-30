> 本地开发候选：**12.6.5**（尚未发布）。下方稳定版下载及其既有验收说明仍对应 **12.6.2**；本候选增强 PDF 阅读侧栏的刷新、取消与复制校验稳定性，不更新在线安装包或更新源。

# Zotero ViewFlow


**Zotero Flow Series · 阅读预览**

*让研究的每一步衔接起来。 / Connect each step of research.*

在 Zotero 侧栏预览并复制格式化引文。

[简体中文](README.md) · [English](README.en.md)

[![当前版本](https://img.shields.io/badge/version-12.6.2-245ac7?style=flat-square)](https://github.com/groele/Zotero-ViewFlow/releases/tag/v12.6.2) · [下载 XPI](https://github.com/groele/Zotero-ViewFlow/releases/download/v12.6.2/Zotero-ViewFlow-12.6.2.xpi) · [问题反馈](https://github.com/groele/Zotero-ViewFlow/issues)

[产品定位](#overview) · [安装与更新](#installation) · [快速开始](#quick-start) · [核心功能](#features) · [设置与使用](#settings) · [数据、同步与外部服务](#data) · [兼容性与验证范围](#compatibility) · [常见问题](#troubleshooting) · [开发与详细文档](#development) · [系列产品](#series) · [项目来源与许可](#license)

<a id="overview"></a>

## 产品定位

面向阅读和写作时需要快速查看引用格式的用户，在条目侧栏展示参考文献与文内引文，并提供复制操作。

本插件可以独立安装，按需与系列其他插件组合使用。

<a id="installation"></a>

## 安装与更新

1. 下载 [Zotero-ViewFlow-12.6.2.xpi](https://github.com/groele/Zotero-ViewFlow/releases/download/v12.6.2/Zotero-ViewFlow-12.6.2.xpi)（插件版本 **12.6.2**），不要安装 Source code ZIP。
2. 在 Zotero 打开 **工具 → 插件／附加组件**，从齿轮菜单选择 **从文件安装插件**。
3. 选择 XPI，完成安装；按提示重启 Zotero。

后续可在插件管理器中检查更新。自动检查／安装取决于 Zotero 与该插件的更新设置和兼容范围。升级或迁移前备份重要数据。

更新清单: [zotero-viewflow-updates.json](https://github.com/groele/Zotero-ViewFlow/blob/main/zotero-viewflow-updates.json) · 插件 ID: `zotero-viewflow@groele`.

<a id="quick-start"></a>

## 快速开始

1. 选择文献，或在 Zotero 主窗口打开阅读标签页。
2. 打开条目侧栏中的预览栏目。
3. 在设置中选择样式与内容，检查预览后复制。

<a id="features"></a>

## 核心功能

| 特色能力 | 能解决什么问题 | 实际边界 |
|---|---|---|
| 原生条目侧栏即时预览 | 在主库窗口的条目侧栏直接预览所选文献的参考文献与文内引文，无需切换到外部格式化工具。 | 独立阅读器窗口可能没有所需的原生 ItemPane；此时应在主窗口的阅读标签页使用。 |
| 与 Zotero 样式/Quick Copy 对齐 | 选用 Zotero 已安装的 CSL 样式，或跟随 Quick Copy 设置，以便在写作前检查格式化结果。 | 显示结果依赖已安装样式与 Zotero 格式化引擎；不负责安装、修复或验证 CSL 样式本身。 |
| 阅读器与文献库上下文 | 依据当前主库选择或主窗口阅读标签页展示相应预览，将阅读和引文核对放在同一界面。 | 只注入插件自己的容器，不改变 Zotero 其他面板或其他插件的 UI。 |
| 可调布局与信息密度 | 调整预览位置、显示内容、字体与条目数量，适配不同工作区和窄窗口。 | 宿主缩放、窗口尺寸与 Zotero 主题仍会影响最终布局；不会用缩小关键文字掩盖溢出。 |
| 文本与支持的富文本复制 | 复制当前显示的格式化文本及可用富文本，以便粘贴到目标文档。 | 复制能力受目标应用与 Zotero 提供的格式限制；不代替 Zotero 的正式引文插入流程。 |

<a id="settings"></a>

## 设置与使用

在 **Zotero → 设置 → Zotero ViewFlow** 中查看插件偏好页。

设置分为引用格式、预览位置、预览内容、字体与预览数量。12.3.4 会等待 Zotero 引用样式初始化后再填充菜单。

<a id="data"></a>

## 数据、同步与外部服务

- 预览读取 Zotero 条目和已安装引用样式；预览操作不承担文献库同步。
- 复制结果不等于在 Word 中插入可编辑的 Zotero 引用域。

<a id="compatibility"></a>

## 兼容性与验证范围

| 项目 | 范围 |
|---|---|
| 当前插件版本 | 12.6.2 |
| 清单声明的 Zotero 范围 | `8.0` 至 `11.0.*` |
| 当前说明 | 41 项自动检查通过；隔离 Windows Zotero 10.0.6 首次启动及重启各通过 16 项定向检查，并通过 2 项面板标题恢复检查，覆盖真实主库/PDF 侧栏、HTML/纯文本剪贴板、错误重试、键盘操作及亮暗主题/窄窗设置。未覆盖 Zotero 11、其他操作系统、真实读屏软件或主 profile 安装。 |

插件版本与 Zotero 版本分别管理。兼容声明不等于已验证所有宿主、系统和外部服务；本轮仅验证上述定向行为，未覆盖所有业务流程或主环境安装。

<a id="troubleshooting"></a>

## 常见问题

找不到预览栏目时，先使用主窗口内的条目侧栏。部分独立阅读窗口没有所需侧栏；样式缺失时先检查 Zotero 已安装的样式与 Quick Copy 设置。

反馈时提供插件与 Zotero 版本、系统、操作步骤、预期／实际结果和脱敏错误。

<a id="development"></a>

## 开发与详细文档

普通安装无需开发环境。以下为仓库已有开发入口，涉及原生测试时使用独立配置。

```powershell
pwsh -NoProfile -File ./test.ps1
pwsh -NoProfile -File ./build.ps1
```

`node --test tests/*.test.cjs` 和 `test.ps1` 会在临时目录构建并校验当前版本的 XPI，无需预先存在 `dist` 安装包，也不会修改正式更新清单。校验已有发布包时使用 `pwsh -NoProfile -File ./test.ps1 -PackagePath <XPI路径>`。只有准备发布并需要更新安装包 SHA-256 时才使用 `pwsh -NoProfile -File ./build.ps1 -UpdateFeed`。

- [验证记录 / Validation](VALIDATION.md)
- [历史记录 / Changelog](CHANGELOG.md)
- [版本说明 / Release notes](docs/releases/v12.6.1.md)
- [产品简介 / Product profile](docs/brand/PRODUCT.md)
- [品牌规范 / Brand guide](docs/brand/BRAND.md)
- [README 模板 / README template](docs/brand/README-TEMPLATE.md)
- [后续提升清单 / Improvement priorities](docs/brand/IMPROVEMENTS.md)
- [原详细指南 · README.md](docs/reference/README.md)
- [原详细指南 · README.zh-CN.md](docs/reference/README.zh-CN.md)

原详细指南保留功能细节、快捷键、历史验证与完整致谢；其中版本和测试结果属于各自记录时间。

<a id="series"></a>

## 系列产品

| 产品 | 定位 |
|---|---|
| [Zotero RefFlow](https://github.com/groele/Zotero-RefFlow) | 文献发现 · 检索参考文献、被引文献与相关研究。 |
| [Zotero MetaFlow](https://github.com/groele/Zotero-MetaFlow) | 元数据整理 · 校验、规范并补全文献元数据。 |
| [Zotero ViewFlow](https://github.com/groele/Zotero-ViewFlow) | 阅读预览 · 在 Zotero 侧栏预览并复制格式化引文。 |
| [Zotero MindFlow](https://github.com/groele/Zotero-MindFlow) | 知识组织 · 将文献、批注与思路组织为可编辑导图。 |
| [Zotero TaskFlow](https://github.com/groele/Zotero-TaskFlow) | 任务推进 · 将文献研读转化为可追踪的任务与计划。 |
| [Zotero CiteFlow](https://github.com/groele/Zotero-CiteFlow) | 写作引用 · 追踪 Word 文档引用，并连接 Zotero 文献操作。 |
| [Zotero PaperFlow](https://github.com/groele/Zotero-PaperFlow) | 投稿审稿 · 管理手稿、投稿轮次与审稿回复。 |

各插件分别安装和更新；同属一个系列不意味着共享数据库或已自动联通所有流程。

<a id="license"></a>

## 项目来源与许可

**二次开发声明：** Zotero ViewFlow 基于 David Carter 的开源插件 [ZoteroPreview（dcartertod/zotero-plugins）](https://github.com/dcartertod/zotero-plugins) 二次开发并独立维护。原作者版权与适用声明继续有效；本项目不是上游项目或 Zotero 官方发布。

许可: [Apache-2.0](LICENSE).

本系列独立维护，并非 Zotero 官方产品。Zotero 及第三方名称、商标与材料归各自权利人所有。

[Release/tag policy](docs/release-tag-policy.md)
