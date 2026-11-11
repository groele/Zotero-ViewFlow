# The title of the pane element
zotero-preview-pane-title =
    .label = Zotero ViewFlow
    .tooltiptext = Zotero ViewFlow

######
# these are all in the Settings
zotero-preview-settings-heading = Zotero ViewFlow settings
zotero-preview-settings-intro = Fine-tune citation previews to fit your reading and writing workflow.
zotero-preview-settings-title = Pick Preview Style
zotero-preview-card-content-heading = Citation and preview content
zotero-preview-settings-style-heading = Citation style
zotero-preview-settings-style-description = Choose the bibliography style used to format previews. Follow Zotero Quick Copy to use its current style.

zotero-preview-card-layout-heading = Layout and typography
zotero-preview-settings-position = Preview position
zotero-preview-settings-position-description = Choose where the preview section appears in Zotero's item sidebar. You can also reorder it from the sidebar.
zotero-preview-settings-position-top =
    .label = Top
zotero-preview-settings-position-afterinfo =
    .label = After Info
zotero-preview-settings-position-bottom =
    .label = Bottom

zotero-preview-settings-display = Preview content
zotero-preview-settings-display-description = Show the formatted reference, the in-text citation, or both for each selected item.
zotero-preview-settings-whatToShow-both =
    .label = Both
zotero-preview-settings-whatToShow-bib =
    .label = Bibliography Only
zotero-preview-settings-whatToShow-intext =
    .label = In-text Citation Only

zotero-preview-settings-display-space = Text and preview size
zotero-preview-settings-layout-description = Adjust text scale and spacing, and set how many selected items can appear in the preview.
zotero-preview-settings-display-fontsize = Relative Font Size
zotero-preview-settings-display-linespacing = Line Spacing
zotero-preview-settings-display-max-items = Maximum items in preview

zotero-preview-card-advanced-heading = Interaction and maintenance
zotero-preview-settings-debug-label =
    .label = Enable verbose debug logging
zotero-preview-settings-debug-description = Output verbose ViewFlow rendering and cache diagnostic messages in Zotero's debug console.
zotero-preview-settings-cache-heading = Preview cache management
zotero-preview-settings-cache-description = Clear in-memory citation caches and regenerate previews across all active sidebars.
zotero-preview-settings-clear-cache-btn =
    .label = Clear Cache & Refresh
zotero-preview-select-items = Select one or more items to preview citation.
zotero-preview-copy-unavailable = Copy unavailable. Try Zotero copy shortcuts or select the item again.
zotero-preview-quickcopy-unavailable = QuickCopy format is unavailable. Check Quick Copy settings and try again.
zotero-preview-no-style = No bibliography style is chosen in the settings for QuickCopy. Set Preview preference in Settings.
zotero-preview-unavailable = Preview unavailable. Try selecting the item again.

zotero-preview-loading = Loading preview…
zotero-preview-native-position = Preview is available in library and reader sidebars. Drag its sidebar icon to reorder, or right-click to pin the section.
zotero-preview-truncated = { $count } additional items omitted.
zotero-preview-follow-quickcopy =
    .label = Follow Zotero Quick Copy settings
zotero-preview-copy-bibliography =
    .title = Copy bibliography
    .aria-label = Copy bibliography
zotero-preview-copy-citation =
    .title = Copy in-text citation
    .aria-label = Copy in-text citation

zotero-preview-style-missing = The selected citation style is not installed. Install it in Zotero or choose another style in Zotero ViewFlow settings.
zotero-preview-retry = Retry preview
zotero-preview-settings-missing-style =
    .label = Saved style is not installed — choose another style
zotero-preview-release-heading = Version information
zotero-preview-release-notes-label = Changes
zotero-preview-release-notes = Added compact citation reverse lookup, dedicated sidebar panel, preference toggle, and local history cache eviction.
zotero-preview-release-date = Build date
zotero-preview-release-download = Installer
zotero-preview-release-download-link = Download ViewFlow 16.1.10 installer
zotero-preview-release-repository = Repository

zotero-preview-lookup-pane-title =
    .label = Zotero ViewFlow Citation Lookup
    .tooltiptext = Reverse Citation Lookup

zotero-preview-card-lookup-heading = Reverse Citation Lookup & Local Cache
zotero-preview-settings-lookup-enable-label =
    .label = Enable compact citation reverse lookup
zotero-preview-settings-lookup-enable-desc = Registers a dedicated lookup section in the item pane to locate items from compact citation strings.
zotero-preview-settings-lookup-history-label =
    .label = Track local copy history for instant provenance
zotero-preview-settings-lookup-history-desc = Automatically saves citation mappings on copy to enable immediate reverse lookup.
zotero-preview-settings-cache-dir-label = Local cache file path
zotero-preview-settings-cache-dir-desc = Edit the full path or choose a folder. The filename is viewflow-history.json.
zotero-preview-settings-cache-quota-label = Maximum Cache Entries (LRU)
zotero-preview-settings-cache-ttl-label = Cache Retention TTL (Days)
zotero-preview-settings-cache-clear-label = Clear local citation history cache
zotero-preview-settings-cache-stats-desc = Clears cached citation history records from local disk and memory.

zotero-preview-lookup-input =
    .title = Supports compact references, DOI, arXiv IDs with prefix or links, and local copy history. Enter to search; Esc to clear.
    .placeholder = Paste a reference or DOI
    .aria-label = Reference to look up
zotero-preview-lookup-search = Find reference
zotero-preview-lookup-clipboard = Read clipboard

zotero-preview-lookup-locate = Locate item
zotero-preview-lookup-open-pdf = Open PDF

zotero-preview-cache-choose =
    .label = Choose folder…

zotero-preview-cache-default =
    .label = Use default folder

zotero-preview-cache-file-label = Current cache file (select to copy the full path)

zotero-preview-cache-location-help = Enter the full file path or an absolute folder; leave blank for the default. Legacy history files are read automatically. Changing folders merges history and retains previous files.

zotero-preview-cache-path-saved = Folder applied. History will be saved to the new location in the background.

zotero-preview-cache-path-failed = Folder unavailable. Enter a writable absolute path or choose another folder.
zotero-preview-cache-save-failed = Failed to write history cache to disk. Records remain in memory; click Retry to save.
zotero-preview-cache-retry =
    .label = Retry saving cache

zotero-preview-cache-usage = { $count } history mappings cached / limit { $limit }

zotero-preview-cache-recommendation = Recommended: 2,000 mappings and 90 days. Use 5,000 for frequent cross-document lookup or 10,000 for heavy use. Allowed: 100–100,000. Different formats of one paper may count separately. Low-priority history is evicted at the limit.

zotero-preview-cache-recommend =
    .label = Use recommended limits (2,000 / 90 days)

zotero-preview-lookup-scope = Supports compact references, DOI, arXiv IDs with prefix or links, and local copy history. Enter to search; Esc to clear.
zotero-preview-lookup-status-empty = Please enter or paste a citation
zotero-preview-lookup-status-searching = Searching local library...
zotero-preview-lookup-status-located = Located
zotero-preview-lookup-status-locate-failed = Failed to locate item, please try again
zotero-preview-lookup-status-unrecognized = Unrecognized citation format. Please provide a citation with journal, year, volume, and pages (or DOI/arXiv).
zotero-preview-lookup-status-not-found = No matching item found in library (Parsed: { $journal }, { $year })
zotero-preview-lookup-status-error = Lookup failed. Please retry or paste the citation again.
zotero-preview-lookup-status-clipboard-fallback = Unable to read clipboard directly. Please paste into the input box (Ctrl+V).
zotero-preview-lookup-state-matched = Matched reference
zotero-preview-lookup-state-located = Located reference
zotero-preview-lookup-state-history = Matched from copy history; verify and locate
zotero-preview-lookup-state-candidate = Candidate reference; verify and locate
zotero-preview-lookup-candidates-heading = Found { $count } matching references, click to select:
zotero-preview-lookup-history-candidates = Copy history matched { $count } references, click to select:
