"use strict";
(() => {
  // src/cache-preferences.ts
  function setupCachePreferences(preview, doc, listen) {
    const field = doc.getElementById("zotero-preview-cache-dir");
    const status = doc.getElementById("zotero-preview-cache-status");
    const stats = doc.getElementById("zotero-preview-cache-stats");
    const retryBtn = doc.getElementById("zotero-preview-cache-retry");
    const message = (id) => status?.setAttribute("data-l10n-id", id);
    const refresh = () => {
      const cache = preview._citationCache;
      const failed = !!(cache?.saveFailed || cache?.lastError);
      const historyEnabled = preview.pref("lookupEnabled") !== false && preview.pref("lookupHistoryEnabled") !== false;
      if (field) {
        field.value = cache?.getFilePath() || "";
        field.placeholder = cache?.getDirectoryPath() || "";
      }
      if (failed) {
        message("zotero-preview-cache-save-failed");
      }
      if (retryBtn) {
        retryBtn.disabled = !historyEnabled || !failed;
      }
      if (stats) {
        stats.setAttribute("data-l10n-id", "zotero-preview-cache-usage");
        stats.setAttribute("data-l10n-args", JSON.stringify({
          count: cache?.count || 0,
          limit: Number(preview.pref("cacheMaxEntries") || 2e3)
        }));
      }
    };
    let applying = false;
    const applyDirectory = async (value) => {
      if (applying) return;
      applying = true;
      try {
        let path = value.trim();
        if (/\.json$/i.test(path)) {
          if (!/(?:^|[\\/])viewflow-history\.json$/i.test(path)) throw new Error("Unsupported cache filename");
          const parent = PathUtils.parent(path);
          if (!parent) throw new Error("Parent directory required");
          path = parent;
        }
        if (path && !PathUtils.isAbsolute(path)) throw new Error("Absolute path required");
        if (path) {
          await IOUtils.makeDirectory(path, { ignoreExisting: true });
          const probe = PathUtils.join(path, ".viewflow-write-check-" + Date.now());
          await IOUtils.writeUTF8(probe, "");
          await IOUtils.remove(probe);
        }
        preview.setPref(preview._prefPrefix + "cacheDirectory", path);
        message("zotero-preview-cache-path-saved");
      } catch {
        message("zotero-preview-cache-path-failed");
      } finally {
        applying = false;
        refresh();
      }
    };
    listen(field, "change", () => {
      void applyDirectory(field?.value || "");
    });
    listen(doc.getElementById("zotero-preview-cache-default"), "command", () => {
      void applyDirectory("");
    });
    listen(doc.getElementById("zotero-preview-cache-browse"), "command", async () => {
      try {
        const module = ChromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs");
        const picker = new module.FilePicker();
        const localized = await doc.l10n?.formatValue("zotero-preview-cache-choose");
        picker.init(doc.defaultView, localized || "ViewFlow", picker.modeGetFolder);
        if (await picker.show() === picker.returnOK) await applyDirectory(picker.file);
      } catch {
        message("zotero-preview-cache-path-failed");
      }
    });
    listen(doc.getElementById("zotero-preview-cache-recommend"), "command", () => {
      preview.setPref(preview._prefPrefix + "cacheMaxEntries", 2e3);
      preview.setPref(preview._prefPrefix + "cacheTtlDays", 90);
      for (const [id, value] of [["zotero-preview-cache-quota", "2000"], ["zotero-preview-cache-ttl", "90"]]) {
        const input = doc.getElementById(id);
        if (input) input.value = value;
      }
      refresh();
    });
    listen(retryBtn, "command", async () => {
      try {
        const cache = preview._citationCache;
        await (cache?.retrySave ? cache.retrySave() : cache?.flush?.());
        message("zotero-preview-cache-path-saved");
      } catch {
        message("zotero-preview-cache-save-failed");
      } finally {
        refresh();
      }
    });
    const unsubscribe = preview._citationCache?.onStatusChange?.(refresh);
    listen(doc, "change", refresh);
    listen(doc, "command", refresh);
    refresh();
    return () => {
      unsubscribe?.();
    };
  }

  // src/preferences.ts
  (() => {
    const host = Zotero;
    const xulDocument = document;
    const preview = host.zoteropreview;
    const initializedRoots = /* @__PURE__ */ new WeakSet();
    const initializingRoots = /* @__PURE__ */ new WeakSet();
    let disposed = false;
    const cacheCleanups = [];
    const prefObservers = [];
    const controller = new AbortController();
    const listen = (target, type, handler, capture = false) => {
      if (!target) return;
      target.addEventListener(type, handler, { capture, signal: controller.signal });
    };
    const prefs = {
      async init() {
        const root = document.getElementById("zotero-prefpane-zotero-preview");
        if (disposed || !preview.initialized || !root || initializedRoots.has(root) || initializingRoots.has(root)) return;
        initializingRoots.add(root);
        try {
          await host.Styles.init();
          if (disposed || !root.isConnected || !preview.initialized) return;
          if (preview.version) {
            const badge = document.getElementById("viewflow-version-badge");
            if (badge) {
              badge.setAttribute("data-l10n-args", JSON.stringify({ version: preview.version }));
              badge.textContent = `v${preview.version}`;
            }
            const downloadLink = document.getElementById("viewflow-release-download-link");
            if (downloadLink) {
              downloadLink.setAttribute("data-l10n-args", JSON.stringify({ version: preview.version }));
              downloadLink.setAttribute(
                "href",
                `https://github.com/groele/Zotero-ViewFlow/releases/download/v${preview.version}/Zotero-ViewFlow-${preview.version}.xpi`
              );
            }
          }
          const popup = document.querySelector("#zotero-preview-style-menulist menupopup");
          if (popup) {
            popup.replaceChildren();
            const automatic = xulDocument.createXULElement("menuitem");
            automatic.setAttribute("value", "");
            automatic.setAttribute("data-l10n-id", "zotero-preview-follow-quickcopy");
            popup.appendChild(automatic);
            const styles = host.Styles.getVisible();
            const selectedStyle = preview.pref("citationstyle") || "";
            if (selectedStyle && !styles.some((style) => style.styleID === selectedStyle)) {
              const missing = xulDocument.createXULElement("menuitem");
              missing.setAttribute("value", selectedStyle);
              missing.setAttribute("data-l10n-id", "zotero-preview-settings-missing-style");
              popup.appendChild(missing);
            }
            for (const style of styles) {
              const entry = xulDocument.createXULElement("menuitem");
              entry.setAttribute("value", style.styleID);
              entry.setAttribute("label", style.title);
              popup.appendChild(entry);
            }
            const menu = document.getElementById("zotero-preview-style-menulist");
            if (menu) {
              menu.value = selectedStyle;
              listen(menu, "command", () => preview.setPref(preview._prefPrefix + "citationstyle", menu.value));
            }
          }
          const position = document.getElementById("extensions-zoteropreview-position");
          if (position) {
            position.value = preview.getPosition();
            listen(position, "command", () => preview.setPref(preview._prefPrefix + "position", position.value));
          }
          const display = document.getElementById("extensions-zoteropreview-whatToShow");
          if (display) {
            display.value = preview.pref("whatToShow") || "zpboth";
            listen(display, "command", () => preview.setPref(preview._prefPrefix + "whatToShow", display.value));
          }
          for (const [id, name, fallback] of [
            ["zotero-preview-fontsize", "fontsize", 1],
            ["zotero-preview-spacing", "spacing", 1.5],
            ["zotero-preview-max-items", "maxPreviewItems", 100],
            ["zotero-preview-cache-quota", "cacheMaxEntries", 2e3],
            ["zotero-preview-cache-ttl", "cacheTtlDays", 90]
          ]) {
            const input = document.getElementById(id);
            if (input) {
              input.value = preview.pref(name) ?? fallback;
              listen(input, "change", () => {
                preview.setPref(preview._prefPrefix + name, input.value);
                input.value = String(preview.pref(name) ?? "");
              });
            }
          }
          const debug = document.getElementById("extensions-zoteropreview-debug");
          if (debug) {
            debug.checked = !!preview.pref("debug");
            listen(debug, "command", () => preview.setPref(preview._prefPrefix + "debug", debug.checked));
          }
          const clearBtn = document.getElementById("zotero-preview-clear-cache-btn");
          if (clearBtn) {
            listen(clearBtn, "command", () => preview._queueAllPreviews());
          }
          const updateDependencies = () => {
            const lookupEnabled = preview.pref("lookupEnabled") !== false;
            const historyPref = preview.pref("lookupHistoryEnabled") !== false;
            const historyEnabled = lookupEnabled && historyPref;
            const lookupEl = document.getElementById("extensions-zoteropreview-lookupEnabled");
            if (lookupEl) lookupEl.checked = lookupEnabled;
            const histEl = document.getElementById("extensions-zoteropreview-lookupHistoryEnabled");
            if (histEl) {
              histEl.checked = historyPref;
              histEl.disabled = !lookupEnabled;
            }
            for (const did of [
              "zotero-preview-cache-dir",
              "zotero-preview-cache-browse",
              "zotero-preview-cache-default",
              "zotero-preview-cache-recommend",
              "zotero-preview-cache-quota",
              "zotero-preview-cache-ttl",
              "zotero-preview-clear-history-btn"
            ]) {
              const el = document.getElementById(did);
              if (el) el.disabled = !historyEnabled;
            }
            const retryEl = document.getElementById("zotero-preview-cache-retry");
            if (retryEl) {
              const failed = !!(preview._citationCache?.saveFailed || preview._citationCache?.lastError);
              retryEl.disabled = !historyEnabled || !failed;
            }
          };
          for (const checkId of ["extensions-zoteropreview-lookupEnabled", "extensions-zoteropreview-lookupHistoryEnabled"]) {
            const checkEl = document.getElementById(checkId);
            if (checkEl) {
              listen(checkEl, "command", () => {
                setTimeout(updateDependencies, 0);
              });
            }
          }
          for (const name of ["lookupEnabled", "lookupHistoryEnabled"]) {
            const id = host.Prefs?.registerObserver?.(preview._prefPrefix + name, () => {
              if (!disposed) updateDependencies();
            }, true);
            if (id !== void 0) prefObservers.push(id);
          }
          updateDependencies();
          const resetBtn = document.getElementById("zotero-preview-reset-defaults-btn");
          if (resetBtn) {
            listen(resetBtn, "command", () => {
              const defaults = {
                citationstyle: "",
                position: "zotero-item-pane-header",
                whatToShow: "zpboth",
                fontsize: "1",
                spacing: "1.5",
                debug: false,
                maxPreviewItems: 100,
                lookupEnabled: true,
                lookupHistoryEnabled: true,
                cacheDirectory: "",
                cacheMaxEntries: 2e3,
                cacheTtlDays: 90
              };
              for (const [name, value] of Object.entries(defaults)) {
                preview.setPref(preview._prefPrefix + name, value);
              }
              const menu = document.getElementById("zotero-preview-style-menulist");
              if (menu) menu.value = "";
              if (position) position.value = "zotero-item-pane-header";
              if (display) display.value = "zpboth";
              if (debug) debug.checked = false;
              for (const [id, value] of [
                ["zotero-preview-fontsize", "1"],
                ["zotero-preview-spacing", "1.5"],
                ["zotero-preview-max-items", "100"],
                ["zotero-preview-cache-quota", "2000"],
                ["zotero-preview-cache-ttl", "90"]
              ]) {
                const input = document.getElementById(id);
                if (input) input.value = value;
              }
              updateDependencies();
              preview._queueAllPreviews();
            });
          }
          const clearHistoryBtn = document.getElementById("zotero-preview-clear-history-btn");
          if (clearHistoryBtn) {
            listen(clearHistoryBtn, "command", async () => {
              if (preview._citationCache) {
                try {
                  await preview._citationCache.clear();
                } catch (error) {
                  document.getElementById("zotero-preview-cache-status")?.setAttribute("data-l10n-id", "zotero-preview-cache-clear-failed");
                  host.logError(error);
                  return;
                }
                const statsDesc = document.getElementById("zotero-preview-cache-stats");
                if (statsDesc) {
                  statsDesc.setAttribute("data-l10n-id", "zotero-preview-cache-usage");
                  statsDesc.setAttribute("data-l10n-args", JSON.stringify({ count: 0, limit: Number(preview.pref("cacheMaxEntries") || 2e3) }));
                }
              }
            });
          }
          cacheCleanups.push(setupCachePreferences(preview, document, listen));
          initializedRoots.add(root);
        } catch (error) {
          if (!disposed) host.logError(error);
        } finally {
          initializingRoots.delete(root);
        }
      }
    };
    listen(document, "load", (event) => {
      if (event.target?.id === "zotero-prefpane-zotero-preview") prefs.init();
    }, true);
    const dispose = () => {
      disposed = true;
      controller.abort();
      for (const id of prefObservers.splice(0)) host.Prefs?.unregisterObserver?.(id);
      for (const cleanup of cacheCleanups.splice(0)) cleanup();
      preview._prefPaneCleanups.delete(dispose);
    };
    preview._prefPaneCleanups.add(dispose);
    listen(document, "unload", (event) => {
      if (event.target?.id === "zotero-prefpane-zotero-preview") dispose();
    }, true);
    listen(window, "unload", dispose);
    prefs.init();
  })();
})();
