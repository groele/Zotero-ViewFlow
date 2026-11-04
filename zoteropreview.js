/* Zotero ViewFlow - Native item-pane lifecycle; modular decoupled runtime. */
(() => {
  // src/constants.js
  var PREF_PREFIX = "extensions.zoteropreview.";
  var CACHE_LIMIT = 64;
  var CACHE_BYTE_LIMIT = 2 * 1024 * 1024;
  var CACHE_TTL = 6e4;
  var STYLE_INIT_TIMEOUT = 1e4;
  var CLIPBOARD_ICON_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3V0H1V13H4V16H15V3H12ZM2 1H11V12H2V1ZM14 15H5V13H12V4H14V15Z" fill="#cc9200"/></svg>';
  var SUCCESS_ICON_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 1L5.5 9.5L2 6" stroke="#009900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ERROR_MESSAGES = {
    "no-style": ["zotero-preview-no-style", "Choose a bibliography style in ViewFlow or Zotero Quick Copy settings."],
    "style-missing": ["zotero-preview-style-missing", "This citation style is not installed. Install it or choose another style in ViewFlow settings."],
    "quickcopy-unavailable": ["zotero-preview-quickcopy-unavailable", "Quick Copy could not format these items. Check the style and try again."]
  };
  var DEFAULT_ERROR_MESSAGE = [
    "zotero-preview-unavailable",
    "Preview unavailable. Check the selected citation style and retry."
  ];
  function parseNumber(value, fallback, min, max) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
  }
  function createPreviewError(code, message) {
    return Object.assign(new Error(message), { previewCode: code });
  }

  // src/cache.js
  var CacheManager = class {
    constructor({ limit = CACHE_LIMIT, byteLimit = CACHE_BYTE_LIMIT, ttl = CACHE_TTL } = {}) {
      this.limit = limit;
      this.byteLimit = byteLimit;
      this.ttl = ttl;
      this.map = /* @__PURE__ */ new Map();
      this.bytes = 0;
    }
    /**
     * Retrieve payload by key if not expired.
     * Touches the entry for LRU reordering.
     */
    get(key) {
      const entry = this.map.get(key);
      if (!entry) return null;
      if (Date.now() - entry.created > this.ttl) {
        this.delete(key);
        return null;
      }
      this.map.delete(key);
      this.map.set(key, entry);
      return entry.payload;
    }
    /**
     * Insert a payload into cache with item IDs.
     * Evicts oldest entries if limit or byteLimit exceeded.
     */
    put(key, payload, ids) {
      const bytes = JSON.stringify(payload).length * 2;
      if (bytes > this.byteLimit) return false;
      this.delete(key);
      while (this.map.size && (this.map.size >= this.limit || this.bytes + bytes > this.byteLimit)) {
        this.delete(this.map.keys().next().value);
      }
      this.map.set(key, { payload, ids, bytes, created: Date.now() });
      this.bytes += bytes;
      return true;
    }
    /**
     * Delete entry by key and update byte accounting.
     */
    delete(key) {
      const entry = this.map.get(key);
      if (!entry) return;
      this.bytes -= entry.bytes || 0;
      this.map.delete(key);
    }
    /**
     * Clear all entries and reset byte counter.
     */
    clear() {
      this.map.clear();
      this.bytes = 0;
    }
    /**
     * Invalidate entries referencing specific item IDs, or all if changedIds is null.
     */
    invalidate(changedIds) {
      for (const [key, entry] of this.map) {
        if (!changedIds || entry.ids.some((id) => changedIds.has(id))) {
          this.delete(key);
        }
      }
    }
  };

  // src/csl.js
  function normalizeItem(item) {
    const seen = /* @__PURE__ */ new Set();
    while (item?.id && !seen.has(item.id)) {
      seen.add(item.id);
      if (item.deleted) return null;
      if (item.isRegularItem()) return item;
      if (!item.parentID) return null;
      item = Zotero.Items.get(item.parentID);
    }
    return null;
  }
  function resolveItems(state, normalize = normalizeItem) {
    if (state.tabType === "library") {
      const pane = state.doc.defaultView?.ZoteroPane || Zotero.getActiveZoteroPane?.();
      const selection = pane?.getSelectedItems?.() || [];
      const items = [
        ...new Map(
          selection.map((item2) => normalize(item2)).filter(Boolean).map((item2) => [item2.id, item2])
        ).values()
      ];
      return items.some((item2) => item2.id === state.item?.id) ? items : [];
    }
    const item = normalize(state.item);
    return item ? [item] : [];
  }
  function resolveConfig(item, { getPref, layoutConfig, parseNum = parseNumber, createError = createPreviewError }) {
    const qc = Zotero.QuickCopy;
    const override = getPref("citationstyle");
    let format;
    try {
      let url = "";
      if (item?.isField?.("url")) {
        try {
          url = item.getField("url", true, true) || "";
        } catch {
          url = "";
        }
      }
      let rawSetting;
      try {
        rawSetting = qc.getFormatFromURL(url);
      } catch {
        rawSetting = Zotero.Prefs.get("export.quickCopy.setting") || "";
      }
      format = { ...qc.unserializeSetting(rawSetting) };
    } catch (error) {
      if (!override) throw createError("no-style", error.message);
      format = {};
    }
    if (override) Object.assign(format, { id: override, mode: "bibliography" });
    if (format.mode !== "bibliography" || !format.id) {
      throw createError("no-style", "No bibliography style configured");
    }
    if (Zotero.Styles?.get && !Zotero.Styles.get(format.id)) {
      throw createError("style-missing", "Citation style is not installed");
    }
    format.locale = format.locale || Zotero.Prefs.get("export.quickCopy.locale");
    const asHTML = format.contentType === "html";
    format.contentType = "text";
    const show = getPref("whatToShow");
    return {
      format,
      asHTML,
      show: ["zpboth", "zpbib", "zpintext"].includes(show) ? show : "zpboth",
      ...layoutConfig(),
      limit: Math.min(
        parseNum(getPref("maxPreviewItems"), 100, 1, 500),
        parseNum(Zotero.Prefs.get("export.quickCopy.dragLimit"), 100, 1, 1e4)
      )
    };
  }
  function getPreviewKey(items, config) {
    return JSON.stringify([
      items.map((item) => [item.id, item.getField("dateModified")]),
      config.format,
      config.show,
      Zotero.Styles?.get(config.format.id)?.updated || ""
    ]);
  }
  function generateCSL(items, { format, show }, createError = createPreviewError) {
    const payload = {};
    for (const [kind, enabled, citation] of [
      ["bibliography", show !== "zpintext", false],
      ["citation", show !== "zpbib", true]
    ]) {
      if (!enabled) continue;
      const result = Zotero.QuickCopy.getContentFromItems(items, format, null, citation);
      if (!result?.html || typeof result.html !== "string" || typeof result.text !== "string") {
        throw createError("quickcopy-unavailable", `QuickCopy returned incomplete ${kind}`);
      }
      payload[kind] = { html: result.html, text: result.text };
    }
    return payload;
  }
  function waitForStyles(state, timeout = STYLE_INIT_TIMEOUT) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (ready, error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (state.cancelStyles === cancel) state.cancelStyles = null;
        if (error) reject(error);
        else resolve(ready);
      };
      const cancel = () => finish(false);
      const timer = setTimeout(
        () => finish(false, new Error("Citation style initialization timed out")),
        timeout
      );
      state.cancelStyles = cancel;
      Promise.resolve().then(() => {
        if (!settled) return Zotero.Styles?.init?.();
      }).then(
        () => finish(true),
        (error) => finish(false, error)
      );
    });
  }

  // src/clipboard.js
  function showCopyFeedback(state, button, successSvg = SUCCESS_ICON_SVG, clipboardSvg = CLIPBOARD_ICON_SVG) {
    if (state.destroyed) return;
    for (const timer of state.copyFeedback.get(button) || []) {
      clearTimeout(timer);
      state.feedbackTimers.delete(timer);
    }
    button.classList.add("zotero-preview-copy-success");
    button.innerHTML = successSvg;
    const scaleTimer = setTimeout(() => {
      state.feedbackTimers.delete(scaleTimer);
      button.classList.remove("zotero-preview-copy-success");
    }, 300);
    const iconTimer = setTimeout(() => {
      state.feedbackTimers.delete(iconTimer);
      state.copyFeedback.delete(button);
      button.innerHTML = clipboardSvg;
    }, 1e3);
    state.feedbackTimers.add(scaleTimer);
    state.feedbackTimers.add(iconTimer);
    state.copyFeedback.set(button, [scaleTimer, iconTimer]);
  }
  function writeToXPCOMClipboard(content, asHTML) {
    const { classes: Cc, interfaces: Ci } = Components;
    const transferable = Cc["@mozilla.org/widget/transferable;1"].createInstance(Ci.nsITransferable);
    transferable.init(null);
    for (const [flavor, value] of [
      ["text/html", content.html],
      ["text/plain", asHTML ? content.html : content.text]
    ]) {
      const str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
      str.data = value;
      transferable.addDataFlavor(flavor);
      transferable.setTransferData(flavor, str);
    }
    Services.clipboard.setData(transferable, null, Ci.nsIClipboard.kGlobalClipboard);
  }
  function renderCopyError(state, body, log) {
    let status = body.querySelector(".zotero-preview-copy-status");
    if (!status) {
      status = state.doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
      status.className = "zotero-preview-copy-status";
      status.setAttribute("role", "status");
      body.appendChild(status);
    }
    status.setAttribute("data-l10n-id", "zotero-preview-copy-unavailable");
    status.textContent = "Copy unavailable. Please try again.";
  }

  // src/position.js
  function resolvePosition(prefValue) {
    return ["zotero-item-pane-header", "zotero-editpane-item-box", "zotero-editpane-related"].includes(prefValue) ? prefValue : "zotero-item-pane-header";
  }
  function observePosition(plugin, owner, state) {
    if (state.positionOwner === owner) return;
    if (!owner?.getPanes) return;
    const parent = owner.getPanes().find((pane) => pane.contains?.(state.body))?.parentNode;
    const Observer = state.doc.defaultView?.MutationObserver;
    if (!parent || !Observer) return;
    let entry = plugin._positionObservers.get(owner);
    if (!entry) {
      const observer = new Observer(() => plugin._queuePosition(owner));
      observer.observe(parent, { childList: true });
      entry = { observer, count: 0 };
      plugin._positionObservers.set(owner, entry);
    }
    entry.count++;
    state.positionOwner = owner;
  }
  function queuePosition(plugin, owner) {
    if (!plugin.initialized || !owner?.getPanes || plugin._positionTimers.has(owner)) return;
    const run = plugin._positionRuns.get(owner);
    if (run) {
      run.dirty = true;
      return;
    }
    const lifecycle = plugin._lifecycle;
    const timer = setTimeout(() => {
      plugin._positionTimers.delete(owner);
      if (!plugin.initialized || lifecycle !== plugin._lifecycle) return;
      const task = { dirty: false };
      plugin._positionRuns.set(owner, task);
      plugin._applyPosition(owner).catch((error) => plugin.log(error)).finally(() => {
        if (plugin._positionRuns.get(owner) !== task) return;
        plugin._positionRuns.delete(owner);
        if (task.dirty && plugin.initialized && lifecycle === plugin._lifecycle) {
          plugin._queuePosition(owner);
        }
      });
    }, 0);
    plugin._positionTimers.set(owner, timer);
  }
  async function applyPosition(plugin, owner) {
    if (!plugin.initialized) return;
    const lifecycle = plugin._lifecycle;
    const sectionID = plugin._sectionID;
    const panes = owner.getPanes();
    const current = panes.findIndex((pane) => pane.dataset.pane === plugin._sectionID);
    if (current < 0 || owner.skipRender) return;
    const position = plugin.getPosition();
    let index = position === "zotero-editpane-related" ? panes.length : 0;
    if (position === "zotero-editpane-item-box") {
      const info = panes.findIndex((pane) => pane.dataset.pane === "info");
      index = info < 0 ? 0 : info + 1;
    }
    if (current === index || current === index - 1) return;
    const sidenav = owner.sidenav;
    if (sidenav?.container === owner && sidenav.changePaneOrder) {
      const wrappers = Array.from(sidenav.querySelectorAll?.(".inherit-flex > .pin-wrapper") || []);
      const targetID = panes[index]?.dataset.pane;
      const targetIndex = targetID ? wrappers.findIndex((wrapper) => wrapper.querySelector(".btn[data-pane]")?.dataset.pane === targetID) : wrappers.length;
      await sidenav.changePaneOrder(
        plugin._sectionID,
        wrappers.length && targetIndex >= 0 ? targetIndex : index,
        { persist: false, render: false }
      );
      if (!plugin.initialized || lifecycle !== plugin._lifecycle) return;
      const updated = owner.getPanes();
      const actual = updated.findIndex((pane) => pane.dataset.pane === plugin._sectionID);
      const target = targetID ? updated.findIndex((pane) => pane.dataset.pane === targetID) : updated.length;
      if (actual >= 0 && target >= 0 && actual !== target && actual !== target - 1) {
        await owner.changePaneOrder?.(sectionID, target, { render: false });
      }
    } else if (owner.changePaneOrder) {
      await owner.changePaneOrder(sectionID, index, { render: false });
    }
    if (!plugin.initialized || lifecycle !== plugin._lifecycle) return;
    for (const state of plugin._states.values()) {
      if (state.body.closest("item-details") === owner && !state.payload) {
        plugin._scheduleRefresh(state);
      }
    }
  }
  function fitWidth(state) {
    if (!state.sizingOwner || state.destroyed || state.body?.isConnected === false) return;
    const bounds = state.sizingOwner.getBoundingClientRect();
    if (!bounds.width) return;
    const width = Math.max(0, Math.min(bounds.width, bounds.right - state.body.getBoundingClientRect().left - 8));
    const maxWidth = `${width}px`;
    if (state.body.style.maxWidth !== maxWidth) state.body.style.maxWidth = maxWidth;
  }

  // src/view.js
  function ensureSectionHeader(body) {
    const section = body.closest("collapsible-section");
    if (section?.getAttribute && !section.getAttribute("label")?.trim()) {
      section.setAttribute("label", "Zotero ViewFlow");
    }
  }
  function buildBlock(kind, content, clipboardSvg = CLIPBOARD_ICON_SVG) {
    const label = kind === "citation" ? "Copy in-text citation" : "Copy bibliography";
    return `<section class="zotero-preview-block"><div class="zotero-preview-block-row"><div class="zotero-preview-block-body">${content.html}</div><div class="zotero-preview-block-toolbar"><span class="zotero-preview-copy" role="button" tabindex="0" title="${label}" aria-label="${label}" data-l10n-id="zotero-preview-copy-${kind}" data-copy-citation="${kind === "citation"}">${clipboardSvg}</span></div></div></section>`;
  }
  function setHTML(state, html) {
    if (state.destroyed || state.body?.isConnected === false) return;
    for (const timer of state.feedbackTimers) clearTimeout(timer);
    state.feedbackTimers.clear();
    state.copyFeedback.clear();
    const win = state.doc?.defaultView || globalThis;
    const Parser = win?.DOMParser || globalThis.DOMParser;
    if (!Parser) return;
    const parsed = new Parser().parseFromString(html, "text/html");
    if (!parsed?.body) return;
    state.body.replaceChildren(
      ...Array.from(parsed.body.childNodes, (node) => state.doc.importNode(node, true))
    );
  }
  function renderPayload(plugin, state, payload, omitted) {
    let html = Object.entries(payload).map(([kind, content]) => plugin._block(kind, content)).join('<hr class="zotero-preview-separator"/>');
    if (omitted) {
      html += `<div class="zotero-preview-message" data-l10n-id="zotero-preview-truncated" data-l10n-args='${JSON.stringify({ count: omitted })}'>${omitted} additional items omitted.</div>`;
    }
    const { body, config } = state;
    body.style.setProperty("--zotero-preview-font-size", config.font + "em");
    body.style.setProperty("--zotero-preview-line-height", config.spacing);
    const wrapped = `<div class="zotero-preview-content">${html}</div>`;
    if (state.lastHTML !== wrapped) {
      plugin._setHTML(state, wrapped);
      state.lastHTML = wrapped;
    }
    plugin._fitWidth(state);
  }
  function renderMessage(plugin, state, id, fallback, error = false) {
    const html = `<div class="zotero-preview-message${error ? " zotero-preview-message-error" : ""}" role="status" data-l10n-id="${id}">${fallback}</div>` + (error ? '<button type="button" class="zotero-preview-retry" data-preview-retry="" data-l10n-id="zotero-preview-retry">Retry preview</button>' : "");
    if (state.lastHTML === html) return;
    plugin._setHTML(state, html);
    state.lastHTML = html;
  }

  // src/section.js
  function initSection(plugin, { doc, body, refresh }) {
    if (plugin._states.has(body)) return;
    doc.defaultView?.MozXULElement?.insertFTLIfNeeded?.("zotero-preview.ftl");
    plugin._ensureSectionHeader(body);
    let sheet = plugin._stylesheets.get(doc);
    if (!sheet) {
      const link = doc.createElementNS("http://www.w3.org/1999/xhtml", "link");
      Object.assign(link, { rel: "stylesheet", href: plugin.rootURI + "style.css" });
      doc.documentElement.appendChild(link);
      sheet = { link, count: 0 };
      plugin._stylesheets.set(doc, sheet);
    }
    sheet.count++;
    body.classList.add("zotero-preview-root");
    const state = {
      doc,
      body,
      refresh,
      item: null,
      tabType: null,
      ids: [],
      generation: 0,
      key: null,
      payload: null,
      timer: null,
      resolve: null,
      refreshTimer: null,
      feedbackTimers: /* @__PURE__ */ new Set(),
      copyFeedback: /* @__PURE__ */ new Map(),
      destroyed: false
    };
    state.handler = (event) => {
      const button = event.target?.closest?.("[data-copy-citation], [data-preview-retry]");
      if (!button || !body.contains(button)) return;
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      if (event.repeat) return;
      if ("previewRetry" in button.dataset && event.type === "keydown" && button.localName === "button") return;
      event.preventDefault();
      if ("previewRetry" in button.dataset) {
        plugin._cancelRender(state);
        plugin._message(state, "zotero-preview-loading", "Loading preview\u2026");
        plugin._scheduleRefresh(state);
      } else {
        plugin.copyCitation(button.dataset.copyCitation === "true", body, button);
      }
    };
    body.addEventListener("click", state.handler);
    body.addEventListener("keydown", state.handler);
    plugin._states.set(body, state);
    const owner = body.closest("item-details");
    plugin._observePosition(owner, state);
    plugin._queuePosition(owner);
    const RO = doc.defaultView?.ResizeObserver || globalThis.ResizeObserver;
    if (owner && RO) {
      state.sizingOwner = owner;
      state.widthObserver = new RO(() => plugin._fitWidth(state));
      state.widthObserver.observe(owner);
    }
  }
  function changeItem(plugin, { body, item, tabType, setEnabled }) {
    const state = plugin._states.get(body);
    if (!state) return;
    const normalized = plugin._normalizeItem(item);
    if (state.item?.id === normalized?.id && state.tabType === tabType) {
      state.item = normalized;
      state.setEnabled = setEnabled;
      return;
    }
    plugin._cancelRender(state);
    state.item = normalized;
    state.tabType = tabType;
    state.setEnabled = setEnabled;
    state.ids = state.item ? [state.item.id] : [];
    state.key = null;
    state.payload = null;
    state.lastHTML = null;
    setEnabled(!!state.item);
  }
  function prepareRender(plugin, props) {
    const state = plugin._states.get(props.body);
    if (!state) return;
    plugin._ensureSectionHeader(props.body);
    plugin._queuePosition(props.body.closest("item-details"));
    if (state.item?.id !== plugin._normalizeItem(props.item)?.id || state.tabType !== props.tabType) {
      plugin._changeItem(props);
    }
    if (!state.payload && !state.lastHTML) {
      plugin._message(state, "zotero-preview-loading", "Loading preview\u2026");
    }
  }
  function cancelRender(state) {
    state.generation++;
    state.failed = false;
    state.renderTask = null;
    state.cancelStyles?.();
    if (state.timer !== null) clearTimeout(state.timer);
    state.timer = null;
    state.resolve?.();
    state.resolve = null;
  }
  function renderSection(plugin, { body }) {
    const state = plugin._states.get(body);
    if (!plugin.initialized || !state || state.destroyed || !state.item || state.failed) {
      return Promise.resolve();
    }
    if (state.renderTask) return state.renderTask;
    const task = plugin._runRender(state).finally(() => {
      if (state.renderTask === task) state.renderTask = null;
    });
    state.renderTask = task;
    return task;
  }
  async function runRender(plugin, state) {
    state.item = plugin._normalizeItem(state.item);
    if (!state.item) {
      state.payload = null;
      state.setEnabled?.(false);
      return;
    }
    const generation = state.generation;
    await new Promise((resolve) => {
      state.resolve = resolve;
      state.timer = setTimeout(() => {
        state.timer = null;
        state.resolve = null;
        resolve();
      }, 40);
    });
    if (state.destroyed || generation !== state.generation || !plugin.initialized) return;
    try {
      if (!await plugin._waitForStyles(state)) return;
      if (state.destroyed || generation !== state.generation || !plugin.initialized) return;
      const allItems = plugin._items(state);
      state.ids = allItems.map((item) => item.id);
      if (!allItems.length) {
        state.payload = null;
        plugin._message(state, "zotero-preview-select-items", "Select one or more items to preview.");
        return;
      }
      const config = plugin._config(state.item);
      const items = allItems.slice(0, Math.floor(config.limit));
      const key = plugin._previewKey(items, config);
      const omitted = allItems.length - items.length;
      if (state.payload && state.key === key && state.omitted === omitted) {
        const layoutChanged = state.config.font !== config.font || state.config.spacing !== config.spacing;
        state.config = config;
        if (layoutChanged) plugin._renderPayload(state, state.payload, omitted);
        return;
      }
      let payload = plugin._cacheGet ? plugin._cacheGet(key) : plugin._cacheManager?.get(key);
      if (payload) {
        plugin._stats.cacheHits++;
      } else {
        const started = Date.now();
        payload = plugin._generate(items, config);
        plugin._stats.generations++;
        plugin._cachePut(key, payload, items.map((item) => item.id));
        plugin.log(`CSL ${Date.now() - started}ms, ${items.length} items`);
      }
      if (state.destroyed || generation !== state.generation) return;
      state.key = key;
      state.payload = payload;
      state.config = config;
      state.omitted = omitted;
      plugin._renderPayload(state, payload, omitted);
    } catch (error) {
      if (state.destroyed || generation !== state.generation || !plugin.initialized) return;
      state.payload = null;
      state.failed = true;
      plugin.log(error.stack || error);
      const [id, fallback] = ERROR_MESSAGES[error.previewCode] || DEFAULT_ERROR_MESSAGE;
      plugin._message(state, id, fallback, true);
    }
  }
  function scheduleRefresh(plugin, state) {
    if (!plugin.initialized || state.destroyed || state.failed || state.refreshTimer !== null) return;
    if (state.refreshTask) {
      state.refreshAgain = true;
      return;
    }
    state.refreshTimer = setTimeout(() => {
      state.refreshTimer = null;
      if (!plugin.initialized || state.destroyed) return;
      if (!state.body.getClientRects().length || state.body.closest("collapsible-section")?.open === false) {
        return;
      }
      const task = Promise.resolve().then(() => {
        if (plugin.initialized && !state.destroyed) return state.refresh();
      }).catch((error) => plugin.log(error)).finally(() => {
        if (state.refreshTask !== task) return;
        state.refreshTask = null;
        if (state.refreshAgain) {
          state.refreshAgain = false;
          plugin._scheduleRefresh(state);
        }
      });
      state.refreshTask = task;
    }, 80);
  }
  function destroySection(plugin, body) {
    const state = plugin._states.get(body);
    if (!state) return;
    state.destroyed = true;
    plugin._cancelRender(state);
    state.refreshAgain = false;
    state.refreshTask = null;
    plugin._cleanup(() => state.widthObserver?.disconnect());
    const positionEntry = plugin._positionObservers.get(state.positionOwner);
    if (positionEntry && --positionEntry.count === 0) {
      plugin._cleanup(() => positionEntry.observer.disconnect());
      plugin._positionObservers.delete(state.positionOwner);
      const timer = plugin._positionTimers.get(state.positionOwner);
      if (timer !== void 0) clearTimeout(timer);
      plugin._positionTimers.delete(state.positionOwner);
    }
    if (state.refreshTimer !== null) clearTimeout(state.refreshTimer);
    for (const timer of state.feedbackTimers) clearTimeout(timer);
    state.copyFeedback.clear();
    plugin._cleanup(() => body.removeEventListener("click", state.handler));
    plugin._cleanup(() => body.removeEventListener("keydown", state.handler));
    plugin._states.delete(body);
    const sheet = plugin._stylesheets.get(state.doc);
    if (sheet && --sheet.count === 0) {
      plugin._cleanup(() => sheet.link.remove());
      plugin._stylesheets.delete(state.doc);
    }
  }
  function queueAllPreviews(plugin) {
    if (typeof plugin._cacheClear === "function") {
      plugin._cacheClear();
    } else if (plugin._cacheManager) {
      plugin._cacheManager.clear();
    } else {
      plugin._cache?.clear();
      plugin._cacheBytes = 0;
    }
    for (const state of plugin._states.values()) {
      state.payload = null;
      plugin._cancelRender(state);
      plugin._scheduleRefresh(state);
    }
  }
  function updateLayout(plugin) {
    for (const state of plugin._states.values()) {
      if (!state.config || state.destroyed) continue;
      Object.assign(state.config, plugin._layoutConfig());
      state.body.style.setProperty("--zotero-preview-font-size", state.config.font + "em");
      state.body.style.setProperty("--zotero-preview-line-height", state.config.spacing);
    }
  }

  // src/index.js
  var preview = {
    initialized: false,
    _prefPrefix: PREF_PREFIX,
    _cacheLimit: CACHE_LIMIT,
    _cacheByteLimit: CACHE_BYTE_LIMIT,
    _cacheTTL: CACHE_TTL,
    _styleInitTimeout: STYLE_INIT_TIMEOUT,
    init({ id, version, rootURI }) {
      if (this.initialized) return;
      Object.assign(this, { id, version, rootURI });
      this._states = /* @__PURE__ */ new Map();
      this._cacheManager = new CacheManager({
        limit: this._cacheLimit,
        byteLimit: this._cacheByteLimit,
        ttl: this._cacheTTL
      });
      this._cache = this._cacheManager.map;
      this._prefObservers = [];
      this._prefPaneCleanups = /* @__PURE__ */ new Set();
      this._stylesheets = /* @__PURE__ */ new Map();
      this._positionTimers = /* @__PURE__ */ new Map();
      this._positionObservers = /* @__PURE__ */ new Map();
      this._positionRuns = /* @__PURE__ */ new Map();
      this._lifecycle = Symbol("preview-lifecycle");
      this._stats = { generations: 0, cacheHits: 0 };
      this.initialized = true;
    },
    get _cacheBytes() {
      return this._cacheManager?.bytes || 0;
    },
    set _cacheBytes(val) {
      if (this._cacheManager) this._cacheManager.bytes = val;
    },
    log(message) {
      if (this.pref("debug")) Zotero.debug(`ZoteroPreview: ${message}`);
    },
    pref(name) {
      return Zotero.Prefs.get(this._prefPrefix + name, true);
    },
    start() {
      if (!Zotero.ItemPaneManager?.registerSection) {
        throw new Error("Native ItemPaneManager API required");
      }
      if (this.pref("positionPolicyVersion") !== 1) {
        this.setPref(this._prefPrefix + "position", "zotero-item-pane-header");
        this.setPref(this._prefPrefix + "positionPolicyVersion", 1);
      }
      const title = { l10nID: "zotero-preview-pane-title", icon: this.rootURI + "view.svg" };
      this._sectionID = Zotero.ItemPaneManager.registerSection({
        paneID: "zotero-preview",
        pluginID: this.id,
        header: title,
        sidenav: { ...title, orderable: true },
        onInit: (props) => this._initSection(props),
        onDestroy: ({ body }) => this._destroySection(body),
        onItemChange: (props) => this._changeItem(props),
        onRender: (props) => this._prepareRender(props),
        onAsyncRender: (props) => this._renderSection(props),
        onToggle: ({ body }) => {
          const state = this._states.get(body);
          if (state && !state.payload) this._scheduleRefresh(state);
        }
      });
      if (!this._sectionID) throw new Error("Could not register ZoteroPreview section");
      this._notifierID = Zotero.Notifier.registerObserver(this, ["item", "tab"], "zoteropreview");
      this._prefObservers.push(
        Zotero.Prefs.registerObserver(
          this._prefPrefix + "position",
          () => {
            for (const state of this._states.values()) {
              this._queuePosition(state.body.closest("item-details"));
            }
          },
          true
        )
      );
      for (const name of ["fontsize", "spacing"]) {
        this._prefObservers.push(
          Zotero.Prefs.registerObserver(
            this._prefPrefix + name,
            () => this._updateLayout(),
            true
          )
        );
      }
      for (const name of ["citationstyle", "whatToShow", "maxPreviewItems"]) {
        this._prefObservers.push(
          Zotero.Prefs.registerObserver(
            this._prefPrefix + name,
            () => this._queueAllPreviews(),
            true
          )
        );
      }
      for (const name of [
        "export.quickCopy.setting",
        "export.quickCopy.locale",
        "export.quickCopy.dragLimit"
      ]) {
        this._prefObservers.push(
          Zotero.Prefs.registerObserver(name, () => this._queueAllPreviews())
        );
      }
    },
    _initSection(props) {
      initSection(this, props);
    },
    getPosition() {
      return resolvePosition(this.pref("position"));
    },
    _observePosition(owner, state) {
      observePosition(this, owner, state);
    },
    _queuePosition(owner) {
      queuePosition(this, owner);
    },
    _applyPosition(owner) {
      return applyPosition(this, owner);
    },
    _fitWidth(state) {
      fitWidth(state);
    },
    _normalizeItem(item) {
      return normalizeItem(item);
    },
    _changeItem(props) {
      changeItem(this, props);
    },
    _items(state) {
      return resolveItems(state, (item) => this._normalizeItem(item));
    },
    _config(item) {
      return resolveConfig(item, {
        getPref: (n) => this.pref(n),
        layoutConfig: () => this._layoutConfig(),
        parseNum: (v, fb, min, max) => this._number(v, fb, min, max),
        createError: (c, m) => this._previewError(c, m)
      });
    },
    _previewError(code, message) {
      return createPreviewError(code, message);
    },
    _layoutConfig() {
      return {
        font: this._number(this.pref("fontsize"), 1, 0.2, 3),
        spacing: this._number(this.pref("spacing"), 1.5, 1, 3)
      };
    },
    _updateLayout() {
      updateLayout(this);
    },
    _number(value, fallback, min, max) {
      return parseNumber(value, fallback, min, max);
    },
    _ensureSectionHeader(body) {
      ensureSectionHeader(body);
    },
    _prepareRender(props) {
      prepareRender(this, props);
    },
    _cancelRender(state) {
      cancelRender(state);
    },
    _renderSection(props) {
      return renderSection(this, props);
    },
    _waitForStyles(state) {
      return waitForStyles(state, this._styleInitTimeout);
    },
    _runRender(state) {
      return runRender(this, state);
    },
    _previewKey(items, config) {
      return getPreviewKey(items, config);
    },
    _generate(items, config) {
      return generateCSL(items, config, (c, m) => this._previewError(c, m));
    },
    _cacheGet(key) {
      return this._cacheManager.get(key);
    },
    _cachePut(key, payload, ids) {
      this._cacheManager.put(key, payload, ids);
    },
    _cacheDelete(key) {
      this._cacheManager.delete(key);
    },
    _cacheClear() {
      this._cacheManager.clear();
    },
    _clipboardIconSVG() {
      return CLIPBOARD_ICON_SVG;
    },
    _successIconSVG() {
      return SUCCESS_ICON_SVG;
    },
    _showCopyFeedback(state, button) {
      showCopyFeedback(state, button, this._successIconSVG(), this._clipboardIconSVG());
    },
    _block(kind, content) {
      return buildBlock(kind, content, this._clipboardIconSVG());
    },
    _renderPayload(state, payload, omitted) {
      renderPayload(this, state, payload, omitted);
    },
    _setHTML(state, html) {
      setHTML(state, html);
    },
    _message(state, id, fallback, error = false) {
      renderMessage(this, state, id, fallback, error);
    },
    copyCitation(asCitations, body, button) {
      const state = this._states.get(body);
      const content = state?.payload?.[asCitations ? "citation" : "bibliography"];
      if (!content) return false;
      const ids = this._items(state).map((item) => item.id);
      if (state.destroyed || !this.initialized || !ids.length || ids.length !== state.ids.length || ids.some((id, index) => id !== state.ids[index])) {
        state.payload = null;
        this._cancelRender(state);
        this._scheduleRefresh(state);
        return false;
      }
      try {
        const config = this._config(state.item);
        const items = this._items(state).slice(0, Math.floor(config.limit));
        if (this._previewKey(items, config) !== state.key || config.asHTML !== state.config.asHTML) {
          throw new Error("Preview inputs changed");
        }
      } catch (error) {
        state.payload = null;
        this._cancelRender(state);
        this._scheduleRefresh(state);
        return false;
      }
      try {
        writeToXPCOMClipboard(content, state.config.asHTML);
        body.querySelector?.(".zotero-preview-copy-status")?.remove();
        if (button) this._showCopyFeedback(state, button);
        return true;
      } catch (error) {
        this.log(`Clipboard: ${error}`);
        renderCopyError(state, body, (msg) => this.log(msg));
        return false;
      }
    },
    notify(event, type, ids) {
      if (this.initialized && type === "tab" && event === "select") {
        for (const state of this._states.values()) {
          this._queuePosition(state.body.closest("item-details"));
          if (!state.payload) this._scheduleRefresh(state);
        }
        return;
      }
      if (!this.initialized || type !== "item" || !["modify", "delete", "trash", "refresh", "add"].includes(event)) {
        return;
      }
      const changed = event === "refresh" && !ids?.length ? null : new Set((ids || []).map(Number));
      if (changed && event === "add") return;
      this._cacheManager.invalidate(changed);
      for (const state of this._states.values()) {
        if (!changed || state.ids.some((id) => changed.has(id))) {
          state.payload = null;
          this._cancelRender(state);
          this._scheduleRefresh(state);
          if (!this._normalizeItem(state.item)) state.setEnabled?.(false);
        }
      }
    },
    _scheduleRefresh(state) {
      scheduleRefresh(this, state);
    },
    _queueAllPreviews() {
      queueAllPreviews(this);
    },
    setPref(pref, value) {
      const name = pref.replace(this._prefPrefix, "");
      const bounds = {
        fontsize: [1, 0.2, 3],
        spacing: [1.5, 1, 3],
        maxPreviewItems: [100, 1, 500]
      };
      if (bounds[name]) {
        value = this._number(value, ...bounds[name]);
        if (name === "maxPreviewItems") value = Math.floor(value);
      }
      Zotero.Prefs.set(pref, value, true);
    },
    _destroySection(body) {
      destroySection(this, body);
    },
    _cleanup(action) {
      try {
        action();
      } catch (error) {
        Zotero.logError?.(error);
      }
    },
    shutdown() {
      if (!this.initialized) return;
      this.initialized = false;
      this._lifecycle = null;
      for (const timer of this._positionTimers.values()) clearTimeout(timer);
      this._positionTimers.clear();
      for (const { observer } of this._positionObservers.values()) {
        this._cleanup(() => observer.disconnect());
      }
      this._positionObservers.clear();
      this._positionRuns.clear();
      const cleanup = (action) => this._cleanup(action);
      for (const dispose of [...this._prefPaneCleanups]) cleanup(dispose);
      this._prefPaneCleanups.clear();
      if (this._notifierID != null) {
        cleanup(() => Zotero.Notifier.unregisterObserver(this._notifierID));
      }
      for (const observer of this._prefObservers) {
        cleanup(() => Zotero.Prefs.unregisterObserver(observer));
      }
      if (this._sectionID) {
        cleanup(() => Zotero.ItemPaneManager.unregisterSection(this._sectionID));
      }
      for (const body of [...this._states.keys()]) cleanup(() => this._destroySection(body));
      for (const { link } of this._stylesheets.values()) cleanup(() => link.remove());
      this._stylesheets.clear();
      this._cacheManager.clear();
      this._sectionID = null;
      this._notifierID = null;
      this._prefObservers = [];
    }
  };
  if (typeof Zotero !== "undefined") {
    Zotero.zoteropreview = preview;
  }
})();
