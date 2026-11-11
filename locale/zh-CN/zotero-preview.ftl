# The title of the pane element
zotero-preview-pane-title =
    .label = Zotero ViewFlow
    .tooltiptext = Zotero ViewFlow

######
# these are all in the Settings
zotero-preview-settings-heading = Zotero ViewFlow 设置
zotero-preview-settings-intro = 调整引用预览的格式与显示方式，让预览适合你的阅读和写作流程。
zotero-preview-settings-title = 选择参考文献预览样式
zotero-preview-card-content-heading = 引用格式与预览内容
zotero-preview-settings-style-heading = 引用格式
zotero-preview-settings-style-description = 选择预览所用的参考文献格式。启用“跟随 Zotero Quick Copy 设置”后，将使用 Quick Copy 当前格式。

zotero-preview-card-layout-heading = 界面位置与版式排版
zotero-preview-settings-position = 预览位置
zotero-preview-settings-position-description = 选择预览栏目在 Zotero 条目侧栏中的位置；也可以直接在侧栏中拖动栏目排序。
zotero-preview-settings-position-top =
    .label = 侧边栏顶部
zotero-preview-settings-position-afterinfo =
    .label = 侧边信息栏后
zotero-preview-settings-position-bottom =
    .label = 侧边栏底部

zotero-preview-settings-display = 预览内容
zotero-preview-settings-display-description = 为每个选中条目显示参考文献格式、正文引用，或同时显示两者。
zotero-preview-settings-whatToShow-both =
    .label = 以下两者都展示
zotero-preview-settings-whatToShow-bib =
    .label = 仅展示参考文献样式
zotero-preview-settings-whatToShow-intext =
    .label = 仅展示正文内引用样式

zotero-preview-settings-display-space = 字体与预览数量
zotero-preview-settings-layout-description = 调整字体缩放和行间距，并设置预览中最多显示多少个选中条目。
zotero-preview-settings-display-fontsize = 字体大小
zotero-preview-settings-display-linespacing = 行间距
zotero-preview-settings-display-max-items = 预览的最大条目数

zotero-preview-card-advanced-heading = 交互与维护选项
zotero-preview-settings-debug-label =
    .label = 启用详细调试日志
zotero-preview-settings-debug-description = 在 Zotero 调试控制台中输出 ViewFlow 的详细渲染与缓存诊断信息。
zotero-preview-settings-cache-heading = 预览缓存管理
zotero-preview-settings-cache-description = 清空当前内存中的引文渲染缓存，并在所有活动侧栏中重新生成最新预览。
zotero-preview-settings-clear-cache-btn =
    .label = 清空缓存并重新生成
zotero-preview-select-items = 请选择一个或多个条目以预览引用。
zotero-preview-copy-unavailable = 复制不可用。请尝试 Zotero 复制快捷键，或重新选择条目。
zotero-preview-quickcopy-unavailable = QuickCopy 格式不可用。请检查 Quick Copy 设置后重试。
zotero-preview-no-style = QuickCopy 未选择参考文献样式。请在设置中配置预览样式。
zotero-preview-unavailable = 预览不可用。请重新选择条目。

zotero-preview-loading = 正在生成预览…
zotero-preview-native-position = 主库和阅读页均使用原生侧栏。可在 Zotero 侧栏拖动预览图标排序，或右键固定本栏目。
zotero-preview-truncated = 另有 { $count } 个条目未显示。
zotero-preview-follow-quickcopy =
    .label = 跟随 Zotero Quick Copy 设置
zotero-preview-copy-bibliography =
    .title = 复制参考文献
    .aria-label = 复制参考文献
zotero-preview-copy-citation =
    .title = 复制正文引用
    .aria-label = 复制正文引用

zotero-preview-style-missing = 所选引用样式尚未安装。请在 Zotero 中安装，或在 Zotero ViewFlow 设置中选择其他样式。
zotero-preview-retry = 重新生成预览
zotero-preview-settings-missing-style =
    .label = 已保存的样式未安装，请选择其他样式
zotero-preview-release-heading = 版本信息
zotero-preview-release-notes-label = 版本说明
zotero-preview-release-notes = 新增紧凑参考文献反向逆查功能、独立侧边栏查询入口、偏好设置开关及本地历史缓存淘汰机制。
zotero-preview-release-date = 构建日期
zotero-preview-release-download = 安装包
zotero-preview-release-download-link = 下载 ViewFlow 16.1.10 安装包
zotero-preview-release-repository = 项目仓库

zotero-preview-lookup-pane-title =
    .label = Zotero ViewFlow 引文反查
    .tooltiptext = 紧凑参考文献反向逆查定位

zotero-preview-card-lookup-heading = 紧凑引文反向逆查与本地缓存
zotero-preview-settings-lookup-enable-label =
    .label = 启用紧凑引文反向逆查功能
zotero-preview-settings-lookup-enable-desc = 在条目侧栏中注册独立的引文反查入口，支持通过简写引文反查定位原始文献条目。
zotero-preview-settings-lookup-history-label =
    .label = 记录本机复制历史以支持快速溯源
zotero-preview-settings-lookup-history-desc = 复制引文时自动保存映射关系，可对本机曾复制的引文实现精准快速反查。
zotero-preview-settings-cache-dir-label = 本地缓存文件路径
zotero-preview-settings-cache-dir-desc = 显示完整缓存文件路径，可直接编辑或选择目录。文件名固定为 viewflow-history.json。
zotero-preview-settings-cache-quota-label = 缓存条目容量上限 (LRU)
zotero-preview-settings-cache-ttl-label = 缓存保留生命周期 (天数)
zotero-preview-settings-cache-clear-label = 清空本地引文历史缓存
zotero-preview-settings-cache-stats-desc = 清空本地磁盘与内存中已缓存的引文历史记录。

zotero-preview-lookup-input =
    .title = 支持紧凑引文、DOI、arXiv:编号或链接，以及本机复制历史。Enter 查找，Esc 清空。
    .placeholder = 粘贴完整参考文献或 DOI
    .aria-label = 反查引文
zotero-preview-lookup-search = 查找原文献
zotero-preview-lookup-clipboard = 读取剪贴板

zotero-preview-lookup-locate = 定位条目
zotero-preview-lookup-open-pdf = 打开 PDF

zotero-preview-cache-choose =
    .label = 选择目录…

zotero-preview-cache-default =
    .label = 使用默认目录

zotero-preview-cache-file-label = 当前缓存文件（可选择并复制完整路径）

zotero-preview-cache-location-help = 支持输入完整文件路径或绝对目录，留空恢复默认位置。历史缓存文件会自动兼容读取；切换目录时合并历史，保留原文件。

zotero-preview-cache-path-saved = 目录已应用，历史将在后台保存到新位置。

zotero-preview-cache-path-failed = 无法使用该目录。请输入可写的绝对路径，或重新选择文件夹。
zotero-preview-cache-save-failed = 历史缓存写入失败，记录暂存于内存，请点击重试保存。
zotero-preview-cache-retry =
    .label = 重试保存缓存

zotero-preview-cache-usage = 已缓存 { $count } 条历史映射 / 上限 { $limit } 条

zotero-preview-cache-recommendation = 建议 2,000 条、90 天。经常跨文稿回查可设 5,000 条，重度使用可设 10,000 条。允许 100–100,000 条；同篇文献的不同格式可能占多条。达到上限后自动淘汰低优先级历史。

zotero-preview-cache-recommend =
    .label = 采用建议值（2,000 条 / 90 天）

zotero-preview-lookup-scope = 支持紧凑引文、DOI、arXiv:编号或链接，以及本机复制历史。Enter 查找，Esc 清空。
zotero-preview-lookup-status-empty = 请输入或粘贴引文
zotero-preview-lookup-status-searching = 正在反查本地文献库...
zotero-preview-lookup-status-located = 已定位
zotero-preview-lookup-status-locate-failed = 定位失败，请重试
zotero-preview-lookup-status-unrecognized = 无法识别引文结构，请提供包含期刊、年份、卷号与页码（或 DOI/arXiv）的引文。
zotero-preview-lookup-status-not-found = 未在当前文库中找到匹配项 (解析: { $journal }, { $year })
zotero-preview-lookup-status-error = 查询失败，请重试或重新粘贴引文。
zotero-preview-lookup-status-clipboard-fallback = 无法直接读取剪贴板，请手动在输入框中粘贴 (Ctrl+V)。
zotero-preview-lookup-state-matched = 已匹配文献
zotero-preview-lookup-state-located = 已定位文献
zotero-preview-lookup-state-history = 复制历史匹配，请核对后定位
zotero-preview-lookup-state-candidate = 候选文献，请核对后定位
zotero-preview-lookup-candidates-heading = 找到 { $count } 篇可能匹配的文献，请点击选择：
zotero-preview-lookup-history-candidates = 复制历史关联到 { $count } 篇文献，请点击选择：
