/* Zotero ViewFlow - Native item-pane lifecycle; modular decoupled runtime. */
"use strict";
(() => {
  // src/constants.ts
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

  // src/cache.ts
  var CacheManager = class {
    limit;
    byteLimit;
    ttl;
    map;
    bytes;
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
        const oldest = this.map.keys().next().value;
        if (oldest === void 0) break;
        this.delete(oldest);
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

  // src/citation-cache.ts
  var CitationCacheManager = class {
    _records = /* @__PURE__ */ new Map();
    _initialized = false;
    _loading = Promise.resolve();
    _generation = 0;
    _writing = Promise.resolve();
    _writeTimer = null;
    _config = { maxEntries: 2e3, ttlDays: 90 };
    _dirty = false;
    _lastError = null;
    _statusListeners = /* @__PURE__ */ new Set();
    constructor(config) {
      if (config) this.configure(config);
    }
    get count() {
      return this._records.size;
    }
    get config() {
      return this._config;
    }
    get dirty() {
      return this._dirty;
    }
    get lastError() {
      return this._lastError;
    }
    get saveFailed() {
      return this._lastError !== null;
    }
    onStatusChange(listener) {
      this._statusListeners.add(listener);
      return () => this._statusListeners.delete(listener);
    }
    _emitStatus() {
      for (const fn of this._statusListeners) {
        try {
          fn();
        } catch (_) {
        }
      }
    }
    /**
     * Updates cache configuration dynamically and enforces new capacity/TTL limits.
     */
    configure(config) {
      const prevDir = this._config.customDir || "";
      if (typeof config.maxEntries === "number" && Number.isFinite(config.maxEntries) && config.maxEntries > 0) {
        this._config.maxEntries = Math.max(1, Math.floor(config.maxEntries));
      }
      if (typeof config.ttlDays === "number" && Number.isFinite(config.ttlDays) && config.ttlDays > 0) {
        this._config.ttlDays = config.ttlDays;
      }
      if (config.customDir !== void 0) {
        this._config.customDir = config.customDir.trim() || void 0;
      }
      const now = Date.now();
      const ttlMs = this._config.ttlDays * 864e5;
      for (const [k, r] of this._records.entries()) {
        if (now - (r.lastAccessedAt || r.copiedAt) >= ttlMs) {
          this._records.delete(k);
        }
      }
      this._enforceEviction();
      if (this._initialized && (this._config.customDir || "") !== prevDir) {
        this._initialized = false;
        this.init().then(() => this.scheduleSave()).catch(() => {
        });
      } else if (this._initialized) {
        this.scheduleSave();
      }
    }
    /**
     * Resolves the cache directory path. Defaults to [Zotero.DataDirectory]/viewflow-cache
     */
    getDirectoryPath() {
      if (this._config.customDir) return this._config.customDir;
      if (typeof Zotero !== "undefined" && Zotero.DataDirectory?.dir) {
        return PathUtils.join(Zotero.DataDirectory.dir, "viewflow-cache");
      }
      return "viewflow-cache";
    }
    getFilePath() {
      return PathUtils.join(this.getDirectoryPath(), "viewflow-history.json");
    }
    /**
     * Loads persistent cache from disk with corruption self-healing.
     */
    init() {
      if (this._initialized || typeof IOUtils === "undefined") return this._loading;
      this._initialized = true;
      const generation = ++this._generation;
      const filePath = this.getFilePath();
      this._loading = this.load(filePath, generation);
      return this._loading;
    }
    async load(filePath, generation) {
      try {
        if (typeof IOUtils === "undefined") return;
        if (!await IOUtils.exists(filePath)) return;
        const data = JSON.parse(await IOUtils.readUTF8(filePath));
        if (generation !== this._generation || !Array.isArray(data)) return;
        const ttlMs = this._config.ttlDays * 864e5;
        for (const r of data) {
          if (!r || typeof r.text !== "string" || typeof r.itemKey !== "string" || !Number.isFinite(r.libraryID) || !Number.isFinite(r.lastAccessedAt) || !Number.isFinite(r.hitCount) || Date.now() - r.lastAccessedAt >= ttlMs) continue;
          const key = this.recordKey(r);
          const current = this._records.get(key);
          if (!current || current.lastAccessedAt < r.lastAccessedAt) this._records.set(key, r);
        }
        this._enforceEviction();
      } catch (error) {
        if (typeof Zotero !== "undefined") Zotero.debug("[ViewFlow] Cache load failed: " + error);
      }
    }
    /**
     * Records a copied citation entry, queuing debounced atomic write.
     */
    record(entry) {
      const normKey = this.recordKey(entry);
      if (!normKey) return;
      const existing = this._records.get(normKey);
      const record = {
        ...entry,
        key: normKey,
        copiedAt: existing?.copiedAt || Date.now(),
        lastAccessedAt: Date.now(),
        hitCount: existing?.hitCount || 0
      };
      this._records.delete(normKey);
      this._records.set(normKey, record);
      this._dirty = true;
      this._enforceEviction();
      this.scheduleSave();
    }
    /**
     * Looks up a record by text, updating hit count and recency.
     */
    recordKey(entry) {
      return JSON.stringify([this.normalizeKey(entry.text), entry.libraryID, entry.itemKey]);
    }
    lookup(rawText) {
      const records = this.lookupAll(rawText);
      return records.length === 1 ? records[0] : null;
    }
    lookupAll(rawText) {
      const key = this.normalizeKey(rawText);
      const records = [...this._records.values()].filter((record) => key && this.normalizeKey(record.text) === key && record.itemKey && Date.now() - record.lastAccessedAt < this._config.ttlDays * 864e5);
      for (const record of records) {
        record.lastAccessedAt = Date.now();
        record.hitCount++;
      }
      if (records.length) this.scheduleSave();
      return records;
    }
    normalizeKey(text) {
      return text.trim().replace(/^(?:\[\d+\]\s*|\(\d+\)\s*|\d{1,3}[.)]\s+|•\s*)/, "").replace(/\.+$/, "").replace(/[\u2010-\u2015\u2212]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
    }
    /**
     * Enforces capacity budget using LRU + HitCount priority.
     */
    _enforceEviction() {
      if (this._records.size <= this._config.maxEntries) return;
      const entries = Array.from(this._records.values());
      entries.sort((a, b) => {
        const scoreA = a.lastAccessedAt + a.hitCount * 864e5;
        const scoreB = b.lastAccessedAt + b.hitCount * 864e5;
        return scoreA - scoreB;
      });
      const toRemove = entries.slice(0, entries.length - this._config.maxEntries);
      for (const r of toRemove) {
        this._records.delete(this.recordKey(r));
      }
    }
    scheduleSave() {
      if (this._writeTimer) clearTimeout(this._writeTimer);
      this._writeTimer = setTimeout(() => {
        this.flush().catch((err) => {
          if (typeof Zotero !== "undefined") Zotero.debug(`[ViewFlow] Flush error: ${err}`);
        });
      }, 1e3);
    }
    /**
     * Atomically flushes cache to disk. Rejects on disk write errors while keeping records in memory for retry.
     */
    flush() {
      const loading = this._loading;
      const run = this._writing.catch(() => {
      }).then(async () => {
        await loading;
        await this.writeSnapshot();
      });
      this._writing = run.catch(() => {
      });
      return run;
    }
    retrySave() {
      return this.flush();
    }
    async writeSnapshot() {
      if (this._writeTimer) clearTimeout(this._writeTimer);
      this._writeTimer = null;
      if (typeof IOUtils === "undefined") {
        this._dirty = false;
        this._lastError = null;
        this._emitStatus();
        return;
      }
      try {
        const dirPath = this.getDirectoryPath();
        if (!await IOUtils.exists(dirPath)) {
          await IOUtils.makeDirectory(dirPath, { ignoreExisting: true });
        }
        const filePath = PathUtils.join(dirPath, "viewflow-history.json");
        const tmpPath = filePath + ".tmp";
        const data = Array.from(this._records.values());
        const json = JSON.stringify(data, null, 2);
        await IOUtils.writeUTF8(tmpPath, json, { tmpPath: tmpPath + ".bak" });
        await IOUtils.move(tmpPath, filePath, { noOverwrite: false });
        this._dirty = false;
        this._lastError = null;
        this._emitStatus();
      } catch (error) {
        this._dirty = true;
        this._lastError = error instanceof Error ? error : new Error(String(error));
        this._emitStatus();
        if (typeof Zotero !== "undefined") {
          Zotero.debug(`[ViewFlow] Atomic cache write failed: ${error}`);
        }
        throw this._lastError;
      }
    }
    async clear() {
      if (this._writeTimer) clearTimeout(this._writeTimer);
      this._writeTimer = null;
      this._generation++;
      await this._loading;
      await this._writing;
      this._records.clear();
      try {
        if (typeof IOUtils !== "undefined") {
          const filePath = this.getFilePath();
          if (await IOUtils.exists(filePath)) await IOUtils.remove(filePath);
        }
        this._dirty = false;
        this._lastError = null;
      } catch (error) {
        this._dirty = true;
        this._lastError = error instanceof Error ? error : new Error(String(error));
        throw this._lastError;
      } finally {
        this._emitStatus();
      }
    }
  };

  // src/lookup-feedback.ts
  var setLookupMessage = (el, id, fallback, args) => {
    el.setAttribute("data-l10n-id", id);
    if (args) el.setAttribute("data-l10n-args", JSON.stringify(args));
    else el.removeAttribute("data-l10n-args");
    el.textContent = fallback;
  };
  function clearLookupResult(element) {
    element.removeAttribute("data-l10n-id");
    element.removeAttribute("data-l10n-args");
    element.innerHTML = "";
  }

  // src/lookup-title.ts
  function renderLookupTitle(target, title) {
    const doc = target.ownerDocument;
    const Parser = doc?.defaultView?.DOMParser;
    target.textContent = "";
    if (!doc || !Parser) {
      target.textContent = title.replace(/<[^>]*>/g, "");
      return;
    }
    const parsed = new Parser().parseFromString(title, "text/html");
    const allowed = /* @__PURE__ */ new Set(["sub", "sup", "i", "b", "em", "strong", "span"]);
    const append = (source, parent) => {
      if (source.nodeType === 3) {
        parent.appendChild(doc.createTextNode(source.textContent || ""));
        return;
      }
      if (source.nodeType !== 1) return;
      const tag = source.localName;
      if (["script", "style", "iframe", "object"].includes(tag)) return;
      const next = allowed.has(tag) ? doc.createElementNS("http://www.w3.org/1999/xhtml", tag) : parent;
      if (next !== parent) parent.appendChild(next);
      for (const child of Array.from(source.childNodes)) if (child) append(child, next);
    };
    for (const child of Array.from(parsed.body.childNodes)) append(child, target);
  }

  // src/citation-lookup.ts
  function extractIdentifier(input) {
    const doiMatch = input.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/i);
    const arxivMatch = input.match(/\b(?:arXiv:\s*|arxiv\.org\/(?:abs|pdf)\/)(\d{4}\.\d{4,5}(?:v\d+)?)\b/i) || input.trim().match(/^(\d{4}\.\d{4,5}(?:v\d+)?)$/i);
    return {
      doi: doiMatch ? doiMatch[1].replace(/[.,;)]+$/, "") : void 0,
      arxiv: arxivMatch ? arxivMatch[1] : void 0
    };
  }
  function stripAuthorPrefix(text) {
    const quoteMatch = text.match(/^(.+?)[,.\s]+["\u201c].+?["\u201d][,.\s]+(.+)$/);
    if (quoteMatch) {
      return { authors: quoteMatch[1].trim(), rest: quoteMatch[2].replace(/^in\s+/i, "").trim() };
    }
    const gbtMatch = text.match(/^([^.]+?)\.\s*.+?\[J\][.,\s]+(.+)$/i);
    if (gbtMatch) {
      return { authors: gbtMatch[1].trim(), rest: gbtMatch[2].trim() };
    }
    const etAlMatch = text.match(/^(.+?\bet\s+al\.?),?\s+(.+)$/i);
    if (etAlMatch) {
      return { authors: etAlMatch[1].trim(), rest: etAlMatch[2].trim() };
    }
    const semiMatch = text.match(/^([^;]+(?:;\s*[^;]+)+)[,;]\s+([A-Z].+)$/);
    if (semiMatch) {
      return { authors: semiMatch[1].trim(), rest: semiMatch[2].trim() };
    }
    return { rest: text };
  }
  function normalizeJournal(name) {
    return name.toLowerCase().replace(/&/g, "and").replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
  }
  function parseCompactCitation(input) {
    if (!input || typeof input !== "string") return null;
    const clean = input.replace(/\s+/g, " ").trim().replace(/^(?:\[\d+\]\s*|\(\d+\)\s*|\d{1,3}[.)]\s+|•\s*)/, "").replace(/\.+$/, "").replace(/[\u2010-\u2015\u2212]/g, "-");
    const ids = extractIdentifier(clean);
    let stripped = clean;
    if (ids.doi) {
      stripped = stripped.replace(/(?:doi:?\s*|https?:\/\/(?:dx\.)?doi\.org\/)?10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i, "").trim().replace(/[.,;:]+$/, "");
    }
    if (ids.arxiv) {
      stripped = stripped.replace(/(?:https?:\/\/)?(?:arXiv:\s*|arxiv\.org\/(?:abs|pdf)\/)?\b\d{4}\.\d{4,5}(?:v\d+)?\b/i, "").trim().replace(/[.,;:]+$/, "");
    }
    const { authors, rest: target } = stripAuthorPrefix(stripped);
    const m1 = target.match(/^(.+?)[,\s;:]+(\d{4})[,\s;:]+(?:vol\.?\s*)?(\d+)(?:\s*\(([\w-]+)\))?[,\s;:]+(?:pp?\.?\s*)?([A-Za-z]*\d+)(?:-([A-Za-z]*\d+))?$/i);
    if (m1) {
      return {
        raw: input,
        journalText: m1[1].trim(),
        year: parseInt(m1[2], 10),
        volume: m1[3].trim(),
        issue: m1[4] || void 0,
        firstPage: m1[5].trim(),
        lastPage: m1[6] ? m1[6].trim() : void 0,
        pages: m1[6] ? `${m1[5].trim()}-${m1[6].trim()}` : m1[5].trim(),
        authorPrefix: authors,
        ...ids
      };
    }
    const m2 = target.match(/^(.+?)[,\s]+(?:vol\.?\s*)?(\d+)(?:\s*\(([\w-]+)\))?\s*\((\d{4})\)[,\s;:]+(?:pp?\.?\s*)?([A-Za-z]*\d+)(?:-([A-Za-z]*\d+))?$/i);
    if (m2) {
      return {
        raw: input,
        journalText: m2[1].trim(),
        volume: m2[2].trim(),
        issue: m2[3] || void 0,
        year: parseInt(m2[4], 10),
        firstPage: m2[5].trim(),
        lastPage: m2[6] ? m2[6].trim() : void 0,
        pages: m2[6] ? `${m2[5].trim()}-${m2[6].trim()}` : m2[5].trim(),
        authorPrefix: authors,
        ...ids
      };
    }
    const m3 = target.match(/^(.+?)[,\s]+(?:vol\.?\s*)?(\d+)(?:(?:\s*\(([\w-]+)\))|[,\s]+(?:no\.?|issue)\s*([\w-]+))?[,\s;:]+(?:pp?\.?\s*)?([A-Za-z]*\d+)(?:-([A-Za-z]*\d+))?(?:\s*\((\d{4})\)|[,\s]+(?:[A-Za-z]+\.?\s+)?(\d{4}))$/i);
    if (m3) {
      return {
        raw: input,
        journalText: m3[1].trim(),
        volume: m3[2].trim(),
        issue: m3[3] || m3[4] || void 0,
        year: parseInt(m3[7] || m3[8], 10),
        firstPage: m3[5].trim(),
        lastPage: m3[6] ? m3[6].trim() : void 0,
        pages: m3[6] ? `${m3[5].trim()}-${m3[6].trim()}` : m3[5].trim(),
        authorPrefix: authors,
        ...ids
      };
    }
    if (ids.doi || ids.arxiv) {
      return {
        raw: input,
        journalText: "",
        year: 0,
        authorPrefix: authors,
        ...ids
      };
    }
    return null;
  }
  function isJournalMatch(queryJournal, pubTitle, abbr) {
    const qNorm = normalizeJournal(queryJournal);
    const pubNorm = normalizeJournal(pubTitle);
    const abbrNorm = normalizeJournal(abbr);
    if (pubNorm === qNorm || abbrNorm === qNorm) return true;
    if (!qNorm) return false;
    const stopwords = /* @__PURE__ */ new Set(["of", "the", "and", "for", "in", "on", "a", "an"]);
    const pubAcronym = pubNorm.split(" ").filter((w) => !stopwords.has(w)).map((w) => w[0]).join("");
    if (pubAcronym && pubAcronym === qNorm) return true;
    const abbrAcronym = abbrNorm.split(" ").filter((w) => !stopwords.has(w)).map((w) => w[0]).join("");
    if (abbrAcronym && abbrAcronym === qNorm) return true;
    const qTokens = qNorm.split(" ").filter((t) => t.length > 0 && !stopwords.has(t));
    if (!qTokens.length) return false;
    const lastToken = qTokens[qTokens.length - 1];
    if (lastToken && lastToken.length === 1 && /[a-z]/i.test(lastToken)) {
      const pubLast = pubNorm.split(" ").pop();
      const abbrLast = abbrNorm.split(" ").pop();
      if (pubLast !== lastToken && abbrLast !== lastToken) return false;
    }
    const matchTokens = (targetNorm) => {
      if (!targetNorm) return false;
      const tokens = targetNorm.split(" ").filter((token) => token.length > 0 && !stopwords.has(token));
      return tokens.length === qTokens.length && qTokens.every((token, index) => tokens[index].startsWith(token));
    };
    return matchTokens(pubNorm) || matchTokens(abbrNorm);
  }
  async function queryPhysicalCandidates(parsed, libraryID) {
    if (typeof Zotero === "undefined") return [];
    const runSearch = async (libID) => {
      const s = new Zotero.Search(libID !== void 0 ? { libraryID: libID } : void 0);
      if (parsed.doi) {
        s.addCondition("DOI", "is", parsed.doi);
      } else if (parsed.arxiv && !parsed.journalText) {
        s.addCondition("quicksearch-everything", "contains", parsed.arxiv.replace(/v\d+$/, ""));
      } else {
        s.addCondition("itemType", "is", "journalArticle");
        if (parsed.year) s.addCondition("date", "contains", String(parsed.year));
        if (parsed.volume) s.addCondition("volume", "is", parsed.volume);
      }
      return await s.search() || [];
    };
    let ids = await runSearch(libraryID);
    if (!ids.length && libraryID !== void 0) ids = await runSearch(void 0);
    return ids.length ? Zotero.Items.getAsync(ids) : [];
  }
  function expandEndPage(first, last) {
    if (!first || !last) return last;
    if (/^\d+$/.test(first) && /^\d+$/.test(last) && first.length > last.length) {
      const expanded = first.slice(0, first.length - last.length) + last;
      if (parseInt(expanded, 10) > parseInt(first, 10)) return expanded;
    }
    return last;
  }
  function verifyAndFilterCandidates(candidates, parsed) {
    const matched = candidates.filter((item) => {
      if (item.deleted || !item.isRegularItem()) return false;
      if (parsed.doi) {
        const itemDoi = (item.getField("DOI") || "").trim().toLowerCase();
        return itemDoi === parsed.doi.toLowerCase();
      }
      if (parsed.arxiv && !parsed.journalText) {
        const [, qBase = "", qVer] = parsed.arxiv.toLowerCase().match(/^(\d{4}\.\d{4,5})(?:v(\d+))?$/) || [
          "",
          parsed.arxiv.toLowerCase().replace(/v\d+$/, ""),
          void 0
        ];
        const fields = ["archiveID", "extra", "DOI", "url", "callNumber"].map((f) => String(item.getField(f) || "").toLowerCase());
        return fields.some((val) => {
          for (const m of val.matchAll(/(?:^|[^0-9])(\d{4}\.\d{4,5})(?:v(\d+))?(?=$|[^0-9])/g)) {
            if (m[1] === qBase && (!qVer || !m[2] || m[2] === qVer)) return true;
          }
          return false;
        });
      }
      const rawPages = (item.getField("pages") || "").replace(/[\u2010-\u2015\u2212]/g, "-").trim();
      const [first, last] = rawPages.split("-");
      const normItemLast = expandEndPage(first, last);
      const normParsedLast = expandEndPage(parsed.firstPage, parsed.lastPage);
      if (parsed.firstPage && first !== parsed.firstPage) return false;
      if (normParsedLast && normItemLast !== normParsedLast) return false;
      if (parsed.issue) {
        const itemIssue = item.getField("issue") || "";
        if (itemIssue !== parsed.issue) return false;
      }
      const pubTitle = item.getField("publicationTitle") || "";
      const abbr = item.getField("journalAbbreviation") || "";
      return isJournalMatch(parsed.journalText, pubTitle, abbr);
    });
    if (matched.length > 1 && parsed.authorPrefix) {
      const surname = parsed.authorPrefix.replace(/\bet\s+al\.?/i, "").trim().split(/[,;\s]+/)[0]?.toLowerCase();
      if (surname && surname.length >= 2) {
        const byAuthor = matched.filter((it) => {
          const creators = it.getCreators?.() || [];
          const firstCreator = String(it.getField("firstCreator") || "").toLowerCase();
          return firstCreator.includes(surname) || creators.some((c) => (c.lastName || c.name || "").toLowerCase().includes(surname));
        });
        if (byAuthor.length > 0) return byAuthor;
      }
    }
    return matched;
  }
  async function locateItemInZotero(item) {
    if (typeof Zotero === "undefined") return false;
    const win = Zotero.getMainWindow();
    if (!win || !win.ZoteroPane) return false;
    try {
      if (item.deleted) return false;
      win.Zotero_Tabs?.select?.("zotero-pane");
      const selected = await win.ZoteroPane.selectItem(item.id);
      if (selected === false) return false;
      const itemsView = win.document.getElementById("zotero-items-tree");
      if (itemsView && itemsView.ensureRowIsVisible && itemsView.selection) {
        itemsView.ensureRowIsVisible(itemsView.selection.currentIndex);
      }
      return true;
    } catch (e) {
      Zotero.debug(`[ViewFlow] Locate item failed: ${e}`);
      return false;
    }
  }
  async function openItemAttachment(item) {
    if (typeof Zotero === "undefined") return false;
    try {
      const attachmentIDs = item.getAttachments();
      for (const id of attachmentIDs) {
        const att = await Zotero.Items.getAsync(id);
        if (att && att.isPDFAttachment && att.isPDFAttachment()) {
          const reader = Zotero.Reader;
          if (reader?.open) {
            await reader.open(att.id);
            return true;
          }
        }
      }
    } catch (e) {
      Zotero.debug(`[ViewFlow] Open attachment failed: ${e}`);
    }
    return false;
  }

  // src/lookup-section.ts
  var cleanups = /* @__PURE__ */ new WeakMap();
  function buildLookupSectionDOM(doc, context, body) {
    cleanups.get(body)?.();
    doc.defaultView?.MozXULElement?.insertFTLIfNeeded?.("zotero-preview.ftl");
    body.innerHTML = "";
    body.className = "zotero-viewflow-lookup-body";
    const sheet = doc.createElementNS("http://www.w3.org/1999/xhtml", "link");
    sheet.setAttribute("rel", "stylesheet");
    sheet.setAttribute("href", context.stylesheetURI);
    body.appendChild(sheet);
    const container = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    container.className = "viewflow-lookup-container";
    const input = doc.createElementNS("http://www.w3.org/1999/xhtml", "input");
    input.type = "text";
    input.className = "viewflow-lookup-input";
    input.setAttribute("data-l10n-id", "zotero-preview-lookup-input");
    const btnRow = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    btnRow.className = "viewflow-lookup-actions";
    const searchBtn = doc.createElementNS("http://www.w3.org/1999/xhtml", "button");
    searchBtn.className = "viewflow-lookup-search";
    searchBtn.setAttribute("data-l10n-id", "zotero-preview-lookup-search");
    const clipBtn = doc.createElementNS("http://www.w3.org/1999/xhtml", "button");
    clipBtn.setAttribute("data-l10n-id", "zotero-preview-lookup-clipboard");
    btnRow.appendChild(searchBtn);
    btnRow.appendChild(clipBtn);
    const statusDiv = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    statusDiv.setAttribute("role", "status");
    statusDiv.setAttribute("aria-live", "polite");
    statusDiv.className = "viewflow-lookup-status";
    const cacheNotice = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    cacheNotice.className = "viewflow-lookup-cache-error";
    cacheNotice.hidden = true;
    const cacheMsg = doc.createElementNS("http://www.w3.org/1999/xhtml", "span");
    const retryBtn = doc.createElementNS("http://www.w3.org/1999/xhtml", "button");
    retryBtn.type = "button";
    retryBtn.className = "viewflow-lookup-cache-retry";
    cacheNotice.appendChild(cacheMsg);
    cacheNotice.appendChild(retryBtn);
    container.appendChild(input);
    container.appendChild(btnRow);
    container.appendChild(cacheNotice);
    container.appendChild(statusDiv);
    body.appendChild(container);
    let request = 0;
    let pasteTimer;
    const cancelPendingPaste = () => {
      if (pasteTimer !== void 0) clearTimeout(pasteTimer);
      pasteTimer = void 0;
    };
    setLookupMessage(retryBtn, "zotero-preview-cache-retry", "重试保存缓存");
    const syncCacheStatus = () => {
      if (!body.isConnected) return;
      if (context.cacheManager?.saveFailed || context.cacheManager?.lastError) {
        cacheNotice.hidden = false;
        setLookupMessage(cacheMsg, "zotero-preview-cache-save-failed", "历史缓存写入失败，记录暂存于内存，请点击重试保存。");
      } else {
        cacheNotice.hidden = true;
        cacheMsg.textContent = "";
      }
    };
    const offCacheStatus = context.cacheManager?.onStatusChange?.(syncCacheStatus);
    retryBtn.onclick = async () => {
      try {
        await (context.cacheManager?.retrySave ? context.cacheManager.retrySave() : context.cacheManager?.flush?.());
      } catch (_) {
      }
      syncCacheStatus();
    };
    syncCacheStatus();
    input.oninput = () => {
      request++;
      clearLookupResult(statusDiv);
      if (!input.value.trim()) cancelPendingPaste();
    };
    cleanups.set(body, () => {
      request++;
      cancelPendingPaste();
      offCacheStatus?.();
    });
    const executeLookup = async (textToSearch) => {
      const current = ++request;
      const active = () => current === request && body.isConnected && input.value.trim() === textToSearch.trim();
      if (!active()) return;
      try {
        if (!textToSearch.trim()) {
          clearLookupResult(statusDiv);
          return;
        }
        setLookupMessage(statusDiv, "zotero-preview-lookup-status-searching", "正在反查本地文献库...");
        const renderItemResult = (target, labelPrefix, l10nId = "zotero-preview-lookup-state-matched") => {
          statusDiv.removeAttribute("data-l10n-id");
          statusDiv.removeAttribute("data-l10n-args");
          statusDiv.innerHTML = "";
          const card = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
          card.className = "viewflow-lookup-card";
          const head = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
          head.className = "viewflow-lookup-card-head";
          const status = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
          status.className = "viewflow-lookup-result-state";
          setLookupMessage(status, l10nId, labelPrefix.replace(/🎯|：/g, "").trim());
          card.appendChild(status);
          renderLookupTitle(head, String(target.getField("title")));
          card.appendChild(head);
          const meta = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
          meta.className = "viewflow-lookup-card-meta";
          const journal = target.getField("publicationTitle") || target.getField("journalAbbreviation") || "";
          const year = target.getField("year") || target.getField("date") || "";
          meta.textContent = `${journal} (${year}) · Vol.${target.getField("volume") || "-"} · pp.${target.getField("pages") || "-"}`;
          card.appendChild(meta);
          const actRow = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
          const locateBtn = doc.createElementNS("http://www.w3.org/1999/xhtml", "button");
          locateBtn.setAttribute("data-l10n-id", "zotero-preview-lookup-locate");
          locateBtn.onclick = async () => {
            const located = await locateItemInZotero(target);
            if (active()) {
              setLookupMessage(
                status,
                located ? "zotero-preview-lookup-status-located" : "zotero-preview-lookup-status-locate-failed",
                located ? "已定位" : "定位失败，请重试"
              );
            }
          };
          actRow.className = "viewflow-lookup-actions";
          actRow.appendChild(locateBtn);
          const pdfBtn = doc.createElementNS("http://www.w3.org/1999/xhtml", "button");
          pdfBtn.setAttribute("data-l10n-id", "zotero-preview-lookup-open-pdf");
          pdfBtn.onclick = async () => {
            const opened = await openItemAttachment(target);
            if (active() && !opened) {
              setLookupMessage(status, "zotero-preview-lookup-status-no-pdf", "No PDF attachment found");
            }
          };
          actRow.appendChild(pdfBtn);
          card.appendChild(actRow);
          statusDiv.appendChild(card);
        };
        const renderCandidatesList = (items, headingText, l10nId = "zotero-preview-lookup-candidates-heading") => {
          statusDiv.removeAttribute("data-l10n-id");
          statusDiv.removeAttribute("data-l10n-args");
          statusDiv.innerHTML = "";
          const msg = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
          setLookupMessage(msg, l10nId, headingText, { count: items.length });
          statusDiv.appendChild(msg);
          const list = doc.createElementNS("http://www.w3.org/1999/xhtml", "ul");
          for (const m of items) {
            const li = doc.createElementNS("http://www.w3.org/1999/xhtml", "button");
            const j = m.getField("journalAbbreviation") || m.getField("publicationTitle") || "";
            const y = m.getField("year") || m.getField("date") || "";
            const suffix = j || y ? ` (${[j, y].filter(Boolean).join(", ")})` : "";
            renderLookupTitle(li, String(m.getField("title")));
            li.appendChild(doc.createTextNode(suffix));
            li.onclick = () => {
              renderItemResult(m, "候选文献，请核对后定位：", "zotero-preview-lookup-state-candidate");
            };
            const row = doc.createElementNS("http://www.w3.org/1999/xhtml", "li");
            row.appendChild(li);
            list.appendChild(row);
          }
          statusDiv.appendChild(list);
        };
        if (context.pref("lookupHistoryEnabled") !== false) {
          const histRecords = context.cacheManager.lookupAll ? context.cacheManager.lookupAll(textToSearch) : context.cacheManager.lookup(textToSearch) ? [context.cacheManager.lookup(textToSearch)] : [];
          if (histRecords.length > 0) {
            const liveItems = [];
            const seenIDs = /* @__PURE__ */ new Set();
            for (const histRecord of histRecords) {
              const item = Zotero.Items.getByLibraryAndKeyAsync ? await Zotero.Items.getByLibraryAndKeyAsync(histRecord.libraryID, histRecord.itemKey) : await Zotero.Items.getAsync(histRecord.itemID);
              if (!active()) return;
              if (item && !item.deleted && item.isRegularItem() && !seenIDs.has(item.id)) {
                seenIDs.add(item.id);
                liveItems.push(item);
              }
            }
            if (liveItems.length === 1) {
              renderItemResult(liveItems[0], "匹配文献，请核对后定位：");
              return;
            } else if (liveItems.length > 1) {
              renderCandidatesList(liveItems, `找到 ${liveItems.length} 篇可能匹配的文献，请点击选择：`);
              return;
            }
          }
        }
        const parsed = parseCompactCitation(textToSearch);
        if (!parsed) {
          setLookupMessage(statusDiv, "zotero-preview-lookup-status-unrecognized", "无法识别引文结构，请提供包含期刊、年份、卷号与页码（或 DOI/arXiv）的引文。");
          return;
        }
        const pane = doc.defaultView?.ZoteroPane;
        let libraryID;
        for (const getLib of [
          () => pane?.getSelectedLibraryIDs?.()?.[0],
          () => typeof Zotero !== "undefined" ? Zotero.Libraries?.userLibraryID : void 0
        ]) {
          try {
            const val = getLib();
            if (typeof val === "number" && Number.isFinite(val)) {
              libraryID = val;
              break;
            }
          } catch (_) {
          }
        }
        const candidates = await queryPhysicalCandidates(parsed, libraryID);
        if (!active()) return;
        const matches = verifyAndFilterCandidates(candidates, parsed);
        if (matches.length === 1) {
          const target = matches[0];
          if (!await locateItemInZotero(target)) throw new Error("Item selection failed");
          if (!active()) return;
          renderItemResult(target, "🎯 已定位文献：", "zotero-preview-lookup-state-located");
        } else if (matches.length > 1) {
          renderCandidatesList(matches, `找到 ${matches.length} 篇可能匹配的文献，请点击选择：`, "zotero-preview-lookup-candidates-heading");
        } else {
          const targetLabel = parsed.journalText || parsed.doi || parsed.arxiv || "-";
          const yearLabel = String(parsed.year || "-");
          setLookupMessage(
            statusDiv,
            "zotero-preview-lookup-status-not-found",
            `未在当前文库中找到匹配项 (解析: ${targetLabel}, ${yearLabel})`,
            { journal: targetLabel, year: yearLabel }
          );
        }
      } catch (error) {
        if (active()) setLookupMessage(statusDiv, "zotero-preview-lookup-status-error", "查询失败，请重试或重新粘贴引文。");
        context.log(String(error));
      }
    };
    searchBtn.onclick = () => executeLookup(input.value);
    input.onpaste = () => {
      cancelPendingPaste();
      pasteTimer = setTimeout(() => {
        pasteTimer = void 0;
        if (input.value.trim()) executeLookup(input.value);
      }, 0);
    };
    input.onkeydown = (e) => {
      const key = e.key;
      if (key === "Enter") {
        cancelPendingPaste();
        executeLookup(input.value);
      } else if (key === "Escape") {
        cancelPendingPaste();
        request++;
        input.value = "";
        clearLookupResult(statusDiv);
      }
    };
    clipBtn.onclick = () => {
      try {
        const clip = Services.clipboard;
        const trans = Cc["@mozilla.org/widget/transferable;1"].createInstance(Ci.nsITransferable);
        trans.init(null);
        trans.addDataFlavor("text/plain");
        clip.getData(trans, Ci.nsIClipboard.kGlobalClipboard);
        const str = {};
        trans.getTransferData("text/plain", str);
        const text = str.value?.data;
        if (text) {
          input.value = text;
          executeLookup(text);
          return;
        }
      } catch (_) {
      }
      setLookupMessage(statusDiv, "zotero-preview-lookup-status-clipboard-fallback", "无法直接读取剪贴板，请手动在输入框中粘贴 (Ctrl+V)。");
      input.focus();
    };
  }
  function registerLookupSection(facade) {
    if (typeof Zotero === "undefined" || !Zotero.ItemPaneManager?.registerSection) return false;
    const title = { l10nID: "zotero-preview-lookup-pane-title", icon: facade.rootURI + "lookup.svg" };
    return Zotero.ItemPaneManager.registerSection({
      paneID: "zotero-preview-lookup",
      pluginID: facade.id,
      header: title,
      sidenav: { ...title, orderable: true },
      onRender: ({ body, setEnabled }) => {
        setEnabled(true);
        facade._queuePosition(body.closest("item-details"));
      },
      onInit: ({ body }) => {
        buildLookupSectionDOM(body.ownerDocument, {
          stylesheetURI: facade.rootURI + "style.css",
          cacheManager: facade._citationCache,
          log: (msg) => facade.log(msg),
          pref: (n) => facade.pref(n)
        }, body);
      },
      onDestroy: ({ body }) => {
        cleanups.get(body)?.();
        cleanups.delete(body);
      }
    });
  }
  function unregisterLookupSection(sectionID) {
    if (typeof Zotero === "undefined" || !sectionID || !Zotero.ItemPaneManager?.unregisterSection) return;
    try {
      Zotero.ItemPaneManager.unregisterSection(sectionID);
    } catch (_) {
    }
  }

  // src/csl.ts
  var host = Zotero;
  function normalizeItem(item) {
    const seen = /* @__PURE__ */ new Set();
    while (item?.id && !seen.has(item.id)) {
      seen.add(item.id);
      if (item.deleted) return null;
      if (item.isRegularItem()) return item;
      if (!item.parentID) return null;
      item = host.Items.get(item.parentID);
    }
    return null;
  }
  function resolveItems(state, normalize = normalizeItem) {
    if (state.tabType === "library") {
      const pane = state.doc.defaultView?.ZoteroPane || host.getActiveZoteroPane?.();
      const selection = pane?.getSelectedItems?.() || [];
      const items = [
        ...new Map(
          selection.map((item2) => normalize(item2)).filter((item2) => item2 !== null).map((item2) => [item2.id, item2])
        ).values()
      ];
      return items.some((item2) => item2.id === state.item?.id) ? items : [];
    }
    const item = normalize(state.item);
    return item ? [item] : [];
  }
  function resolveConfig(item, { getPref, layoutConfig, parseNum = parseNumber, createError = createPreviewError }) {
    const qc = host.QuickCopy;
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
        rawSetting = host.Prefs.get("export.quickCopy.setting") || "";
      }
      format = { ...qc.unserializeSetting(rawSetting) };
    } catch (error) {
      if (!override) throw createError("no-style", error instanceof Error ? error.message : String(error));
      format = {};
    }
    if (override) Object.assign(format, { id: override, mode: "bibliography" });
    if (format.mode !== "bibliography" || !format.id) {
      throw createError("no-style", "No bibliography style configured");
    }
    if (host.Styles?.get && !host.Styles.get(format.id)) {
      throw createError("style-missing", "Citation style is not installed");
    }
    format.locale = format.locale || host.Prefs.get("export.quickCopy.locale");
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
        parseNum(host.Prefs.get("export.quickCopy.dragLimit"), 100, 1, 1e4)
      )
    };
  }
  function getPreviewKey(items, config) {
    return JSON.stringify([
      items.map((item) => [item.id, item.getField("dateModified")]),
      config.format,
      config.show,
      (config.format.id ? host.Styles?.get?.(config.format.id) : void 0)?.updated || ""
    ]);
  }
  function generateCSL(items, { format, show }, createError = createPreviewError) {
    const payload = {};
    for (const [kind, enabled, citation] of [
      ["bibliography", show !== "zpintext", false],
      ["citation", show !== "zpbib", true]
    ]) {
      if (!enabled) continue;
      const result = host.QuickCopy.getContentFromItems(items, format, null, citation);
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
        if (!settled) return host.Styles?.init?.();
      }).then(
        () => finish(true),
        (error) => finish(false, error)
      );
    });
  }

  // src/position.ts
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
  async function applyPreviewPosition(plugin, owner) {
    if (!plugin.initialized) return;
    const lifecycle = plugin._lifecycle;
    const sectionID = plugin._sectionID;
    if (!sectionID) return;
    const panes = owner.getPanes();
    const current = panes.findIndex((pane) => pane.dataset.pane === plugin._sectionID);
    if (current < 0 || owner.skipRender) return;
    const position = plugin.getPosition();
    if (position === "zotero-editpane-related" && current === panes.length - 2 && panes.at(-1)?.dataset.pane === plugin._lookupSectionID) return;
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
        sectionID,
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
  async function applyPosition(plugin, owner) {
    const lifecycle = plugin._lifecycle;
    await applyPreviewPosition(plugin, owner);
    if (!plugin.initialized || lifecycle !== plugin._lifecycle || owner.skipRender) return;
    const lookupID = plugin._lookupSectionID;
    if (!lookupID) return;
    const panes = owner.getPanes();
    const preview2 = panes.findIndex((pane) => pane.dataset.pane === plugin._sectionID);
    const lookup = panes.findIndex((pane) => pane.dataset.pane === lookupID);
    if (preview2 < 0 || lookup < 0) return;
    const sidenav = owner.sidenav;
    const wrappers = Array.from(sidenav?.querySelectorAll?.(".inherit-flex > .pin-wrapper") || []);
    const navIDs = wrappers.map((wrapper) => wrapper.querySelector(".btn[data-pane]")?.dataset.pane);
    const navPreview = navIDs.indexOf(plugin._sectionID || "");
    const navLookup = navIDs.indexOf(lookupID);
    if (lookup === preview2 + 1 && (navPreview < 0 || navLookup === navPreview + 1)) return;
    if (sidenav?.container === owner && navPreview >= 0) {
      await sidenav.changePaneOrder(lookupID, navPreview + 1, { persist: false, render: false });
    }
    if (!plugin.initialized || lifecycle !== plugin._lifecycle) return;
    const updated = owner.getPanes();
    const eye = updated.findIndex((pane) => pane.dataset.pane === plugin._sectionID);
    const magnifier = updated.findIndex((pane) => pane.dataset.pane === lookupID);
    if (eye >= 0 && magnifier >= 0 && magnifier !== eye + 1) {
      await owner.changePaneOrder?.(lookupID, eye + 1, { render: false });
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

  // src/view.ts
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
    const { body } = state;
    const config = state.config;
    body.style.setProperty("--zotero-preview-font-size", config.font + "em");
    body.style.setProperty("--zotero-preview-line-height", String(config.spacing));
    const wrapped = `<div class="zotero-preview-content">${html}</div>`;
    if (state.lastHTML !== wrapped) {
      plugin._setHTML(state, wrapped);
      state.lastHTML = wrapped;
    }
    plugin._fitWidth(state);
  }
  function escapeHTML(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function renderMessage(plugin, state, id, fallback, error = false, detail = "") {
    const cleanDetail = error ? detail.trim().slice(0, 240) : "";
    const detailHtml = cleanDetail ? `<div class="zotero-preview-message-detail">${escapeHTML(cleanDetail)}</div>` : "";
    const html = `<div class="zotero-preview-message${error ? " zotero-preview-message-error" : ""}" role="status" data-l10n-id="${id}">${fallback}</div>` + detailHtml + (error ? '<button type="button" class="zotero-preview-retry" data-preview-retry="" data-l10n-id="zotero-preview-retry">Retry preview</button>' : "");
    if (state.lastHTML === html) return;
    plugin._setHTML(state, html);
    state.lastHTML = html;
  }

  // src/section.ts
  var PROGRESSIVE_BATCH_SIZE = 20;
  function waitDelay(state, ms) {
    return new Promise((resolve) => {
      state.resolve = resolve;
      state.timer = setTimeout(() => {
        state.timer = null;
        state.resolve = null;
        resolve();
      }, ms);
    });
  }
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
      destroyed: false,
      controller: new (doc.defaultView?.AbortController || AbortController)()
    };
    state.handler = (event) => {
      const keyboard = event;
      const button = event.target?.closest?.("[data-copy-citation], [data-preview-retry]");
      if (!button || !body.contains(button)) return;
      if (event.type === "keydown" && !["Enter", " "].includes(keyboard.key)) return;
      if (keyboard.repeat) return;
      if ("previewRetry" in button.dataset && event.type === "keydown" && button.localName === "button") return;
      event.preventDefault();
      if ("previewRetry" in button.dataset) {
        plugin._cancelRender(state);
        plugin._message(state, "zotero-preview-loading", "Loading preview…");
        plugin._scheduleRefresh(state);
      } else {
        plugin.copyCitation(button.dataset.copyCitation === "true", body, button);
      }
    };
    body.addEventListener("click", state.handler, { signal: state.controller.signal });
    body.addEventListener("keydown", state.handler, { signal: state.controller.signal });
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
      setEnabled(!!state.item);
      if (state.item && !state.renderTask && (!state.payload || state.refreshAgain)) {
        plugin._scheduleRefresh(state);
      }
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
      plugin._message(state, "zotero-preview-loading", "Loading preview…");
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
    const stale = () => state.destroyed || generation !== state.generation || !plugin.initialized;
    await waitDelay(state, 40);
    if (stale()) return;
    try {
      if (!await plugin._waitForStyles(state)) return;
      if (stale()) return;
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
        const layoutChanged = state.config?.font !== config.font || state.config?.spacing !== config.spacing;
        state.config = config;
        if (layoutChanged) plugin._renderPayload(state, state.payload, omitted);
        return;
      }
      let payload = plugin._cacheGet ? plugin._cacheGet(key) : plugin._cacheManager?.get(key);
      if (payload) {
        plugin._stats.cacheHits++;
      } else {
        const started = Date.now();
        if (items.length > PROGRESSIVE_BATCH_SIZE) {
          const head = items.slice(0, PROGRESSIVE_BATCH_SIZE);
          state.config = config;
          plugin._renderPayload(state, plugin._generate(head, config), allItems.length - head.length);
          await waitDelay(state, 0);
          if (stale()) return;
          if (config.show === "zpboth") {
            const bib = plugin._generate(items, { ...config, show: "zpbib" });
            await waitDelay(state, 0);
            if (stale()) return;
            payload = { ...bib, ...plugin._generate(items, { ...config, show: "zpintext" }) };
          } else {
            payload = plugin._generate(items, config);
          }
          await waitDelay(state, 0);
          if (stale()) return;
        } else {
          payload = plugin._generate(items, config);
        }
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
      if (stale()) return;
      state.payload = null;
      state.failed = true;
      plugin.log(error instanceof Error ? error.stack || error : error);
      const code = error?.previewCode;
      const mapped = code && code in ERROR_MESSAGES ? ERROR_MESSAGES[code] : null;
      const [id, fallback] = mapped || DEFAULT_ERROR_MESSAGE;
      const detail = mapped ? "" : typeof error === "string" ? error : error && typeof error.message === "string" ? error.message : "";
      plugin._message(state, id, fallback, true, detail);
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
        state.refreshAgain = true;
        return;
      }
      state.refreshAgain = false;
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
    plugin._cleanup(() => state.controller.abort());
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
      state.body.style.setProperty("--zotero-preview-line-height", String(state.config.spacing));
    }
  }

  // src/clipboard.ts
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
  function writeToXPCOMClipboard(content, _asHTML = false) {
    const transferable = Cc["@mozilla.org/widget/transferable;1"].createInstance(Ci.nsITransferable);
    transferable.init(null);
    for (const [flavor, value] of [
      ["text/html", content.html],
      ["text/plain", content.text]
    ]) {
      const str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
      str.data = value;
      transferable.addDataFlavor(flavor);
      transferable.setTransferData(flavor, str, value.length * 2);
    }
    Services.clipboard.setData(transferable, null, Ci.nsIClipboard.kGlobalClipboard);
  }
  function renderCopyError(state, body, _log) {
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

  // src/preview-actions.ts
  var previewActions = {
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
    _message(state, id, fallback, error = false, detail = "") {
      renderMessage(this, state, id, fallback, error, detail);
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
        const rawText = content.text.trim();
        const canRecord = !asCitations || rawText.length >= 8 && !/^\[?\d+(?:[,\s\u2010-\u2015-]+\d+)*\]?$/.test(rawText);
        if (this._citationCache && state.item && ids.length === 1 && canRecord && this.pref("lookupHistoryEnabled") !== false) {
          try {
            const rawItem = this._items(state)[0];
            const rawCfg = state.config;
            this._citationCache.record({
              text: content.text,
              libraryID: rawItem.libraryID || 1,
              itemKey: rawItem.key || "",
              itemID: rawItem.id,
              title: String(rawItem.getField?.("title") || ""),
              style: rawCfg?.style || ""
            });
          } catch (_) {
          }
        }
        return true;
      } catch (error) {
        this.log(`Clipboard: ${error}`);
        renderCopyError(state, body, (msg) => this.log(msg));
        return false;
      }
    }
  };

  // src/index.ts
  var core = {
    id: "",
    version: "",
    rootURI: "",
    _states: /* @__PURE__ */ new Map(),
    _cacheManager: new CacheManager(),
    _cache: /* @__PURE__ */ new Map(),
    _prefObservers: [],
    _prefPaneCleanups: /* @__PURE__ */ new Set(),
    _stylesheets: /* @__PURE__ */ new Map(),
    _positionTimers: /* @__PURE__ */ new Map(),
    _positionObservers: /* @__PURE__ */ new Map(),
    _positionRuns: /* @__PURE__ */ new Map(),
    _lifecycle: null,
    _stats: { generations: 0, cacheHits: 0 },
    _sectionID: null,
    _lookupSectionID: null,
    _notifierID: null,
    _citationCache: new CitationCacheManager(),
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
      this._cacheManager = new CacheManager({ limit: this._cacheLimit, byteLimit: this._cacheByteLimit, ttl: this._cacheTTL });
      this._cache = this._cacheManager.map;
      this._citationCache = new CitationCacheManager();
      this._syncCacheConfig();
      this._citationCache.init().catch((err) => this.log(err));
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
      if (!Zotero.ItemPaneManager?.registerSection) throw new Error("Native ItemPaneManager API required");
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
          if (state && (!state.payload || state.refreshAgain)) this._scheduleRefresh(state);
        }
      });
      if (!this._sectionID) throw new Error("Could not register ZoteroPreview section");
      this._syncLookupSection();
      this._notifierID = Zotero.Notifier.registerObserver(this, ["item", "tab"], "zoteropreview");
      this._prefObservers.push(
        Zotero.Prefs.registerObserver(this._prefPrefix + "position", () => {
          for (const state of this._states.values()) {
            this._queuePosition(state.body.closest("item-details"));
          }
        }, true)
      );
      for (const name of ["fontsize", "spacing"]) {
        this._prefObservers.push(Zotero.Prefs.registerObserver(this._prefPrefix + name, () => this._updateLayout(), true));
      }
      for (const name of ["citationstyle", "whatToShow", "maxPreviewItems"]) {
        this._prefObservers.push(Zotero.Prefs.registerObserver(this._prefPrefix + name, () => this._queueAllPreviews(), true));
      }
      this._prefObservers.push(Zotero.Prefs.registerObserver(this._prefPrefix + "lookupEnabled", () => this._syncLookupSection(), true));
      for (const name of ["cacheDirectory", "cacheMaxEntries", "cacheTtlDays"]) {
        this._prefObservers.push(Zotero.Prefs.registerObserver(this._prefPrefix + name, () => this._syncCacheConfig(), true));
      }
      for (const name of ["export.quickCopy.setting", "export.quickCopy.locale", "export.quickCopy.dragLimit"]) {
        this._prefObservers.push(Zotero.Prefs.registerObserver(name, () => this._queueAllPreviews()));
      }
    },
    _syncCacheConfig() {
      if (!this._citationCache) return;
      const customDir = String(this.pref("cacheDirectory") || "").trim();
      const maxEntries = Math.round(this._number(this.pref("cacheMaxEntries"), 2e3, 100, 1e5));
      const ttlDays = Math.round(this._number(this.pref("cacheTtlDays"), 90, 7, 3650));
      this._citationCache.configure({ customDir, maxEntries, ttlDays });
    },
    _syncLookupSection() {
      const enabled = this.pref("lookupEnabled") !== false;
      if (enabled && !this._lookupSectionID) {
        this._lookupSectionID = registerLookupSection(this);
        if (!this._lookupSectionID) Zotero.logError(new Error("ViewFlow citation lookup section registration failed"));
      } else if (!enabled && this._lookupSectionID) {
        unregisterLookupSection(this._lookupSectionID);
        this._lookupSectionID = null;
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
      return { font: this._number(this.pref("fontsize"), 1, 0.2, 3), spacing: this._number(this.pref("spacing"), 1.5, 1, 3) };
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
    notify(event, type, ids) {
      if (this.initialized && type === "tab" && event === "select") {
        for (const state of this._states.values()) {
          this._queuePosition(state.body.closest("item-details"));
          if (!state.payload || state.refreshAgain) this._scheduleRefresh(state);
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
      const bounds = {
        [this._prefPrefix + "fontsize"]: [1, 0.2, 3],
        [this._prefPrefix + "spacing"]: [1.5, 1, 3],
        [this._prefPrefix + "maxPreviewItems"]: [100, 1, 500, true],
        [this._prefPrefix + "cacheMaxEntries"]: [2e3, 100, 1e5, true],
        [this._prefPrefix + "cacheTtlDays"]: [90, 7, 3650, true]
      };
      if (pref in bounds) {
        const [fallback, min, max, integer] = bounds[pref];
        const num = this._number(value, fallback, min, max);
        value = integer ? Math.round(num) : num;
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
      if (this._lookupSectionID) {
        cleanup(() => unregisterLookupSection(this._lookupSectionID));
      }
      if (this._citationCache) {
        this._citationCache.flush().catch(() => {
        });
      }
      for (const body of [...this._states.keys()]) cleanup(() => this._destroySection(body));
      for (const { link } of this._stylesheets.values()) cleanup(() => link.remove());
      this._stylesheets.clear();
      this._cacheManager.clear();
      this._sectionID = null;
      this._lookupSectionID = null;
      this._notifierID = null;
      this._prefObservers = [];
    }
  };
  var actionDescriptors = Object.getOwnPropertyDescriptors(previewActions);
  for (const name of Reflect.ownKeys(actionDescriptors)) {
    if (Object.hasOwn(core, name)) throw new Error(`Duplicate preview facade method: ${String(name)}`);
  }
  var preview = Object.defineProperties(core, actionDescriptors);
  if (typeof Zotero !== "undefined") {
    Zotero.zoteropreview = preview;
  }
})();
