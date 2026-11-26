/* Mind Map Studio — Markdown mind maps rendered with markmap.
 * Routes (hash based so it works on GitHub Pages without server config):
 *   #/                 gallery
 *   #/map/<slug>       view a published map (maps/<slug>.md)
 *   #/edit/<slug>      edit a published map (local draft until saved to GitHub)
 *   #/new              start a new map
 *   #/draft/<id>       reopen a local draft
 *   #/share/<data>     a map packed into the URL (lz-string)
 */
(() => {
  "use strict";

  const CFG = Object.assign(
    { githubOwner: "", githubRepo: "", githubBranch: "main", mapsDir: "mindmaps/maps" },
    window.MINDMAP_CONFIG || {}
  );
  const { Transformer, Markmap, deriveOptions, loadCSS, loadJS } = window.markmap;

  // Theme decorations applied after each render. Self-contained on purpose:
  // its source is also embedded in the offline HTML export.
  function mmDecorate(mm) {
    var color = mm.options.color;
    mm.g.selectAll("path.markmap-link").style("--branch", function (d) { return color(d.target); });
    var rootDepth = mm.state.data ? mm.state.data.state.depth : 0;
    mm.g.selectAll("g.markmap-node").style("--branch", function (d) { return color(d); })
      .attr("data-level", function (d) { return d.state.depth - rootDepth; }).each(function (d) {
      var g = window.d3.select(this);
      var circle = g.select(":scope > circle");
      // Keep the fold button above the node card.
      if (!circle.empty()) this.appendChild(circle.node());
      var has = d.children && d.children.length && !circle.empty();
      var cx = has ? +circle.attr("cx") : 0, cy = has ? +circle.attr("cy") : 0, folded = d.payload && d.payload.fold;
      g.selectAll(":scope > path.mm-glyph").data(has ? [d] : []).join("path")
        .attr("class", "mm-glyph")
        .each(function () { this.parentNode.appendChild(this); })
        .attr("d", "M" + (cx - 3.5) + " " + cy + "H" + (cx + 3.5) + (folded ? "M" + cx + " " + (cy - 3.5) + "V" + (cy + 3.5) : ""));
    });
  }
  const transformer = new Transformer();
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---------- storage (best effort; the app works without it) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    },
  };

  // ---------- small helpers ----------
  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg, ms = 2400) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms);
  }
  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const scratch = document.createElement("div");
  function htmlToText(html) { scratch.innerHTML = html || ""; return scratch.textContent.trim(); }
  function slugify(s) {
    return String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "untitled-map";
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove(); return ok;
    }
  }
  function download(filename, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function fmtDate(d) {
    const dt = new Date(d);
    return isNaN(dt) ? "" : dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  // ---------- theme ----------
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  function effectiveDark() {
    const t = document.documentElement.dataset.theme;
    return t ? t === "dark" : mql.matches;
  }
  function applyTheme() {
    document.documentElement.classList.toggle("markmap-dark", effectiveDark());
    const svg = document.getElementById("mindmap");
    if (svg) svg.classList.toggle("mmt-dark", effectiveDark());
  }
  const savedTheme = store.get("mm.theme", null);
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  applyTheme();
  mql.addEventListener("change", applyTheme);
  function toggleTheme() {
    const next = effectiveDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("mm.theme", next);
    applyTheme();
  }
  $("#themeBtn").addEventListener("click", toggleTheme);

  // ---------- manifest / gallery ----------
  let manifest = null;
  let activeTag = null;
  async function loadManifest() {
    if (manifest) return manifest;
    try {
      const res = await fetch("maps/index.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      manifest = Array.isArray(data) ? data : data.maps || [];
    } catch (e) {
      console.warn("Could not load maps/index.json", e);
      manifest = [];
    }
    await mergeRepoListing();
    return manifest;
  }

  // The index is rebuilt by a GitHub Action, which can lag a minute behind a
  // commit. On the live site, ask GitHub which map files exist so new maps
  // show up right away and deleted ones disappear.
  const rawUrl = (slug) =>
    `https://raw.githubusercontent.com/${CFG.githubOwner}/${CFG.githubRepo}/${CFG.githubBranch}/${CFG.mapsDir}/${encodeURIComponent(slug)}.md`;
  async function mergeRepoListing() {
    if (!CFG.githubOwner || !CFG.githubRepo || !/\.github\.io$/.test(location.hostname)) return;
    try {
      const res = await fetch(`https://api.github.com/repos/${CFG.githubOwner}/${CFG.githubRepo}/contents/${CFG.mapsDir}?ref=${CFG.githubBranch}`);
      if (!res.ok) return;
      const files = (await res.json()).filter((f) => /\.md$/i.test(f.name) && f.name.toLowerCase() !== "readme.md");
      const slugs = new Set(files.map((f) => f.name.replace(/\.md$/i, "")));
      const known = new Set(manifest.map((m) => m.slug));
      manifest = manifest.filter((m) => slugs.has(m.slug));
      const extra = await Promise.all([...slugs].filter((s) => !known.has(s)).map(async (slug) => {
        try {
          const md = await (await fetch(rawUrl(slug))).text();
          const m = metaFromMarkdown(md);
          return { slug, title: m.title, description: m.description, tags: m.tags, nodes: m.nodes, updated: null };
        } catch { return { slug, title: slug, description: "", tags: [], nodes: 0, updated: null }; }
      }));
      manifest = manifest.concat(extra).sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
    } catch (e) {
      console.warn("GitHub listing unavailable", e);
    }
  }
  async function fetchMapSource(slug) {
    const res = await fetch(`maps/${encodeURIComponent(slug)}.md`, { cache: "no-cache" });
    if (res.ok) return res.text();
    // Not deployed yet? Read it straight from the repo.
    if (CFG.githubOwner && CFG.githubRepo) {
      const raw = await fetch(rawUrl(slug), { cache: "no-cache" });
      if (raw.ok) return raw.text();
    }
    throw new Error(`maps/${slug}.md not found (${res.status})`);
  }

  function drafts() { return store.get("mm.drafts", {}); }
  function saveDraft(d) { const all = drafts(); all[d.id] = d; return store.set("mm.drafts", all); }
  function deleteDraft(id) { const all = drafts(); delete all[id]; store.set("mm.drafts", all); }

  function metaFromMarkdown(md) {
    const { root, frontmatter } = transformer.transform(md);
    let count = 0;
    (function walk(n) { count++; (n.children || []).forEach(walk); })(root);
    return {
      title: (frontmatter && frontmatter.title) || htmlToText(root.content) || "Untitled map",
      description: (frontmatter && frontmatter.description) || "",
      tags: (frontmatter && Array.isArray(frontmatter.tags)) ? frontmatter.tags : [],
      nodes: count,
      frontmatter: frontmatter || {},
    };
  }

  function cardHtml(m, href, extra = "") {
    const tags = (m.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
    const bits = [m.nodes ? `${m.nodes} nodes` : "", m.updated ? fmtDate(m.updated) : ""].filter(Boolean).join(" · ");
    return `<a class="card" href="${href}">
      <h3>${escapeHtml(m.title)}</h3>
      <p>${escapeHtml(m.description || "")}</p>
      <div class="meta">${tags}<span>${escapeHtml(bits)}</span></div>${extra}
    </a>`;
  }

  async function showGallery() {
    setView("gallery");
    $("#topbarTitle").textContent = "";
    document.title = "Mind Map Studio";
    const maps = await loadManifest();
    const q = $("#gallerySearch").value.trim().toLowerCase();

    const allTags = [...new Set(maps.flatMap((m) => m.tags || []))].sort();
    $("#tagBar").innerHTML = allTags.map((t) =>
      `<button class="tag${t === activeTag ? " on" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join("");

    const matches = (m) => {
      if (activeTag && !(m.tags || []).includes(activeTag)) return false;
      if (!q) return true;
      return [m.title, m.description, (m.tags || []).join(" "), m.slug].join(" ").toLowerCase().includes(q);
    };
    const shown = maps.filter(matches);
    $("#mapGrid").innerHTML = shown.map((m) => cardHtml(m, `#/map/${encodeURIComponent(m.slug)}`)).join("");
    $("#galleryEmpty").hidden = shown.length > 0;
    if (!maps.length) {
      $("#galleryEmpty").hidden = false;
      $("#galleryEmpty").innerHTML = "No published maps yet. Add a Markdown file to <code>mindmaps/maps/</code>, or start one with <b>New map</b>.";
    } else {
      $("#galleryEmpty").textContent = "No maps match.";
    }

    const ds = Object.values(drafts()).sort((a, b) => b.updated - a.updated)
      .map((d) => ({ ...d, ...safeMeta(d.md), updated: d.updated }))
      .filter(matches);
    $("#draftsSection").hidden = ds.length === 0;
    $("#draftGrid").innerHTML = ds.map((d) => cardHtml(
      { ...d, description: d.base ? `Unsaved edits to ${d.base}.md` : d.description || "New map (not on GitHub yet)" },
      `#/draft/${encodeURIComponent(d.id)}`,
      `<div class="row"><button class="btn small" data-del-draft="${escapeHtml(d.id)}">Delete draft</button></div>`
    )).join("");
  }
  function safeMeta(md) { try { return metaFromMarkdown(md); } catch { return { title: "Untitled map", nodes: 0 }; } }

  $("#gallerySearch").addEventListener("input", debounce(showGallery, 120));
  $("#tagBar").addEventListener("click", (e) => {
    const t = e.target.closest("[data-tag]");
    if (!t) return;
    activeTag = activeTag === t.dataset.tag ? null : t.dataset.tag;
    showGallery();
  });
  $("#draftGrid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-del-draft]");
    if (!b) return;
    e.preventDefault();
    if (confirm("Delete this local draft? This cannot be undone.")) { deleteDraft(b.dataset.delDraft); showGallery(); }
  });
  $("#importFile").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const md = await f.text();
    const id = "d-" + Date.now().toString(36);
    saveDraft({ id, slug: slugify(f.name.replace(/\.(md|markdown|txt)$/i, "")), md, updated: Date.now(), base: null });
    e.target.value = "";
    location.hash = `#/draft/${encodeURIComponent(id)}`;
  });

  const CLAUDE_PROMPT = `Create a mind map for my Mind Map Studio site.

Write ONE Markdown file and save it as mindmaps/maps/<kebab-case-name>.md in the repo ${CFG.githubOwner}/${CFG.githubRepo}.
Follow mindmaps/README.md. In short:
- Start with YAML front matter:
  ---
  title: <Map title>
  description: <one sentence>
  tags: [tag1, tag2]
  markmap:
    theme: studio   # or pastel, midnight, paper, mono, classic
    initialExpandLevel: 2
  ---
- One "# " heading = the root. "## " = main branches, "### " = sub-branches.
- Below headings, nest "- " bullets (2-space indent) for deeper detail.
- Keep each node short (a phrase, not a paragraph). Use **bold**, \`code\`, links, and $inline math$ where helpful.
- Aim for 5–9 main branches and 3–6 children each.
Then run: python3 mindmaps/build_manifest.py and commit both files to ${CFG.githubBranch}.

Topic: `;
  $("#claudePromptBtn").addEventListener("click", async () => {
    toast((await copyText(CLAUDE_PROMPT)) ? "Prompt copied. Paste it to Claude and add your topic." : "Copy failed");
  });

  // ---------- map view state ----------
  const svgEl = $("#mindmap");
  let mm = null;
  let current = null; // { kind: 'published'|'draft'|'shared', slug, md, draftId, base }
  let fmOptions = {};
  let rendered = { md: null };
  const DEFAULT_STYLE = { maxWidth: 0, spacingHorizontal: 80, spacingVertical: 5, colorFreezeLevel: 0, toggleRecursively: false };
  let userStyle = store.get("mm.style", {});

  // Themes: CSS lives in assets/themes.css (scoped to svg.mmt-<id>); these are
  // the layout defaults each theme needs. Front matter and the Style menu
  // still override them. `cards` themes attach links to the node centre.
  const CARD_LAYOUT = { anchor: "middle", paddingX: 0, spacingHorizontal: 64, spacingVertical: 14, maxWidth: 280, colorFreezeLevel: 2 };
  const THEMES = {
    studio: {
      name: "Studio", cards: true, preview: ["#fbfbf9", "#2e5c8a", "#cfe0f1", "#dcebd0", "#f6dfc8"],
      defaults: { ...CARD_LAYOUT, color: ["#2e5c8a", "#4a86c5", "#6aa84f", "#e69138", "#8e7cc3", "#45a5a0", "#d5688a", "#c9a227", "#5c6bc0"] },
    },
    pastel: {
      name: "Pastel", cards: true, preview: ["#f3eefe", "#a855f7", "#fbcfe8", "#bae6fd", "#bbf7d0"],
      defaults: { ...CARD_LAYOUT, spacingVertical: 12, maxWidth: 260, color: ["#8b5cf6", "#ec4899", "#0ea5e9", "#22c55e", "#f59e0b", "#14b8a6", "#f43f5e", "#6366f1"] },
    },
    midnight: {
      name: "Midnight", cards: true, preview: ["#0b1020", "#26306b", "#22d3ee", "#a78bfa", "#f472b6"],
      defaults: { ...CARD_LAYOUT, color: ["#7aa2ff", "#22d3ee", "#a78bfa", "#f472b6", "#34d399", "#fbbf24", "#fb7185", "#60a5fa"] },
    },
    paper: {
      name: "Paper", cards: false, preview: ["#f7f1e3", "#3a2f24", "#9a3b1f", "#3d6b4f", "#2f4f7a"],
      defaults: { spacingHorizontal: 90, spacingVertical: 8, maxWidth: 300, colorFreezeLevel: 2, color: ["#3a2f24", "#9a3b1f", "#3d6b4f", "#2f4f7a", "#8a5a12", "#6b3d6e", "#4f6b2a", "#7a2f3a"] },
    },
    mono: {
      name: "Mono", cards: true, preview: ["#ffffff", "#111111", "#ffffff", "#111111", "#ffffff"],
      defaults: { ...CARD_LAYOUT, spacingVertical: 16, maxWidth: 260, color: ["#111111"] },
    },
    classic: {
      name: "Classic", cards: false, preview: ["#ffffff", "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728"],
      defaults: {},
    },
  };
  const DEFAULT_THEME = "studio";
  function themeId() {
    const t = userStyle.theme || fmOptions.theme;
    return THEMES[t] ? t : DEFAULT_THEME;
  }
  function themeDefaults() { return THEMES[themeId()].defaults; }

  function effectiveStyle() {
    const base = { ...DEFAULT_STYLE };
    const td = themeDefaults();
    for (const k of Object.keys(base)) {
      if (td[k] != null) base[k] = td[k];
      if (fmOptions[k] != null) base[k] = fmOptions[k];
    }
    const { theme, ...rest } = userStyle;
    return { ...base, ...rest };
  }
  function buildOptions() {
    const s = effectiveStyle();
    const td = themeDefaults();
    const json = { ...td, ...fmOptions, ...s };
    // Start from markmap's defaults so switching themes never keeps stale values.
    const opts = { ...window.markmap.defaultOptions, ...deriveOptions(json) };
    opts.toggleRecursively = !!s.toggleRecursively;
    opts.duration = 350;
    opts.maxInitialScale = 1.4;
    opts.anchor = td.anchor || "bottom";
    opts.paddingX = td.paddingX != null ? td.paddingX : window.markmap.defaultOptions.paddingX;
    return opts;
  }
  function applySvgTheme() {
    const id = themeId();
    Object.keys(THEMES).forEach((t) => svgEl.classList.toggle(`mmt-${t}`, t === id));
    svgEl.classList.add("mmt");
    svgEl.classList.toggle("mmt-cards", !!THEMES[id].cards);
    svgEl.classList.toggle("mmt-dark", effectiveDark());
    $$("#themeMenu [data-theme-id]").forEach((b) => b.classList.toggle("on", b.dataset.themeId === id));
  }

  function loadAssets(features) {
    const { styles, scripts } = transformer.getUsedAssets(features);
    if (styles) loadCSS(styles);
    if (scripts) loadJS(scripts, { getMarkmap: () => window.markmap });
  }

  async function renderMap(md, { fit = true, keepFold = false } = {}) {
    const errEl = $("#mapError");
    try {
      const { root, features, frontmatter } = transformer.transform(md);
      loadAssets(features);
      fmOptions = (frontmatter && frontmatter.markmap) || {};
      applySvgTheme();
      const opts = buildOptions();
      if (!mm) {
        mm = Markmap.create(svgEl, opts);
        // After every redraw: theme decorations, and re-apply search marks
        // (markmap resets node classes).
        const render = mm.renderData.bind(mm);
        mm.renderData = async (...args) => { const r = await render(...args); mmDecorate(mm); markHits(); return r; };
      }
      if (keepFold && mm.state.data) carryFold(mm.state.data, root);
      await mm.setData(root, opts);
      if (fit) await mm.fit();
      rendered.md = md;
      errEl.hidden = true;
      const title = (frontmatter && frontmatter.title) || htmlToText(root.content) || "Untitled map";
      $("#topbarTitle").textContent = title;
      document.title = `${title} · Mind Map Studio`;
      syncStyleControls();
      if (searchState.q) runSearch(searchState.q, false);
    } catch (e) {
      console.error(e);
      errEl.textContent = "Could not render this map: " + e.message;
      errEl.hidden = false;
    }
  }

  // Keep folded branches folded while editing (matched by text path).
  function carryFold(oldRoot, newRoot) {
    const folded = new Set();
    (function walk(n, path) {
      const p = path + "/" + htmlToText(n.content);
      if (n.payload && n.payload.fold) folded.add(p);
      (n.children || []).forEach((c) => walk(c, p));
    })(oldRoot, "");
    (function walk(n, path) {
      const p = path + "/" + htmlToText(n.content);
      if (folded.has(p)) n.payload = { ...n.payload, fold: 1 };
      (n.children || []).forEach((c) => walk(c, p));
    })(newRoot, "");
  }

  function walkData(fn) {
    if (!mm || !mm.state.data) return;
    (function walk(n, depth, parents) {
      fn(n, depth, parents);
      (n.children || []).forEach((c) => walk(c, depth + 1, parents.concat(n)));
    })(mm.state.data, 0, []);
  }

  async function showLevels(levels) {
    // levels counts the root as level 1
    walkData((n, depth) => {
      const hasKids = n.children && n.children.length;
      n.payload = { ...n.payload, fold: hasKids && depth >= levels - 1 ? 1 : 0 };
    });
    await mm.renderData();
    await mm.fit();
    markHits();
  }
  async function expandAll() {
    walkData((n) => { n.payload = { ...n.payload, fold: 0 }; });
    await mm.renderData();
    await mm.fit();
    markHits();
  }

  // ---------- node search ----------
  const searchState = { q: "", hits: [], i: -1 };
  function runSearch(q, jump = true) {
    searchState.q = q;
    searchState.hits = [];
    searchState.i = -1;
    if (q) {
      const needle = q.toLowerCase();
      walkData((n, depth, parents) => {
        if (htmlToText(n.content).toLowerCase().includes(needle)) searchState.hits.push({ node: n, parents });
      });
    }
    updateSearchCount();
    if (!q) { mm && mm.setHighlight(null); markHits(); return; }
    if (jump && searchState.hits.length) gotoHit(0); else markHits();
  }
  function updateSearchCount() {
    const { q, hits, i } = searchState;
    $("#searchCount").textContent = !q ? "" : hits.length ? `${i + 1 || "–"}/${hits.length}` : "0";
  }
  async function gotoHit(i) {
    const { hits } = searchState;
    if (!hits.length) return;
    searchState.i = (i + hits.length) % hits.length;
    const { node, parents } = hits[searchState.i];
    let changed = false;
    parents.forEach((p) => { if (p.payload && p.payload.fold) { p.payload = { ...p.payload, fold: 0 }; changed = true; } });
    if (changed) await mm.renderData();
    await mm.setHighlight(node);
    markHits();
    await mm.centerNode(node);
    updateSearchCount();
  }
  function markHits() {
    if (!mm) return;
    const ids = new Set(searchState.hits.map((h) => h.node.state && h.node.state.id));
    mm.g.selectAll("g.markmap-node").classed("hit", (d) => !!d && ids.has(d.state.id));
  }
  const nodeSearch = $("#nodeSearch");
  nodeSearch.addEventListener("input", debounce(() => runSearch(nodeSearch.value.trim()), 150));
  nodeSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); gotoHit(searchState.i + (e.shiftKey ? -1 : 1)); }
    if (e.key === "Escape") { nodeSearch.value = ""; runSearch(""); nodeSearch.blur(); }
  });

  // ---------- export ----------
  function currentMd() { return editorOpen() ? editor.value : current ? current.md : ""; }
  function fileBase() { return (current && current.slug) || slugify($("#topbarTitle").textContent); }

  function buildSvg() {
    const svg = mm.svg.node();
    const g = mm.g.node();
    const box = g.getBBox();
    const pad = 32;
    const w = Math.ceil(box.width + pad * 2), h = Math.ceil(box.height + pad * 2);
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", w);
    clone.setAttribute("height", h);
    clone.setAttribute("viewBox", `${box.x - pad} ${box.y - pad} ${w} ${h}`);
    const cg = clone.querySelector(":scope > g");
    cg.removeAttribute("transform");
    cg.querySelectorAll(".markmap-highlight > *").forEach((el) => el.remove());
    cg.querySelectorAll(".hit").forEach((el) => el.classList.remove("hit"));
    // Bake theme colours into the file so it looks right outside this page.
    const cs = getComputedStyle(svg);
    const v = (name) => cs.getPropertyValue(name).trim();
    const bg = getComputedStyle(svg.parentElement).backgroundColor || "#fff";
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `.markmap{--markmap-text-color:${v("--markmap-text-color")};--markmap-circle-open-bg:${v("--markmap-circle-open-bg")};--markmap-font:${v("--markmap-font")};--markmap-code-bg:${v("--markmap-code-bg")};--markmap-code-color:${v("--markmap-code-color")};--markmap-a-color:${v("--markmap-a-color")};}`;
    clone.appendChild(style);
    const themeStyle = document.createElementNS("http://www.w3.org/2000/svg", "style");
    themeStyle.textContent = themeCss();
    clone.appendChild(themeStyle);
    const svgBg = getComputedStyle(svg);
    if (svgBg.backgroundImage === "none" && /rgba\(0, 0, 0, 0\)|transparent/.test(svgBg.backgroundColor)) {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", box.x - pad); rect.setAttribute("y", box.y - pad);
      rect.setAttribute("width", w); rect.setAttribute("height", h); rect.setAttribute("fill", bg);
      clone.insertBefore(rect, cg);
    }
    return { text: new XMLSerializer().serializeToString(clone), w, h };
  }
  function themeCss() {
    const sheet = Array.from(document.styleSheets).find((s) => s.href && /themes\.css/.test(s.href));
    try { return sheet ? Array.from(sheet.cssRules).map((r) => r.cssText).join("\n") : ""; } catch { return ""; }
  }
  function exportSvg() {
    const { text } = buildSvg();
    download(`${fileBase()}.svg`, text, "image/svg+xml");
  }
  async function exportPng() {
    const { text, w, h } = buildSvg();
    const scale = 2;
    const img = new Image();
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(text);
    try {
      await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = url; });
      const canvas = document.createElement("canvas");
      canvas.width = w * scale; canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("empty"))), "image/png"));
      download(`${fileBase()}.png`, blob);
    } catch (e) {
      console.error(e);
      toast("This browser blocked PNG export. Use SVG export instead.", 3500);
    }
  }
  const vendorCache = {};
  async function vendor(path) {
    if (!vendorCache[path]) vendorCache[path] = fetch(path).then((r) => { if (!r.ok) throw new Error(path); return r.text(); });
    return vendorCache[path];
  }
  async function exportHtml() {
    toast("Building offline HTML…");
    try {
      const [d3js, viewjs, libjs] = await Promise.all([
        vendor("vendor/d3-7.9.0.min.js"), vendor("vendor/markmap-view-0.18.12-mms.js"), vendor("vendor/markmap-lib-0.18.12.js"),
      ]);
      const inline = (s) => s.replace(/<\/script/gi, "<\\/script");
      const md = currentMd();
      const title = $("#topbarTitle").textContent || "Mind map";
      const dark = effectiveDark();
      const svgClass = svgEl.getAttribute("class").split(/\s+/).filter((c) => /^mmt/.test(c)).join(" ");
      const optsJson = JSON.stringify({ ...themeDefaults(), ...effectiveStyle() });
      const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>html,body{margin:0;height:100%;background:${dark ? "#16161d" : "#fff"}}svg{width:100%;height:100%;display:block}
.markmap{--markmap-font:400 15px/20px ui-sans-serif,system-ui,sans-serif}${dark ? ".markmap{--markmap-text-color:#ececf3;--markmap-circle-open-bg:#16161d}" : ""}
${themeCss()}</style>
</head><body${dark ? ' class="markmap-dark"' : ""}><svg id="mm" class="${svgClass}"></svg>
<script>${inline(d3js)}<\/script>
<script>${inline(viewjs)}<\/script>
<script>${inline(libjs)}<\/script>
<script>
(function(){
  var md = ${JSON.stringify(md).replace(/</g, "\\u003c")};
  var M = window.markmap, t = new M.Transformer(), r = t.transform(md);
  var a = t.getUsedAssets(r.features);
  if (a.styles) M.loadCSS(a.styles);
  if (a.scripts) M.loadJS(a.scripts, { getMarkmap: function(){ return window.markmap; } });
  var json = Object.assign({}, ${optsJson}, (r.frontmatter && r.frontmatter.markmap) || {}, ${JSON.stringify((() => { const { theme, ...u } = userStyle; return u; })())});
  var opts = M.deriveOptions(json);
  if (json.anchor) opts.anchor = json.anchor;
  if (json.paddingX != null) opts.paddingX = json.paddingX;
  var mmDecorate = ${mmDecorate.toString()};
  var mm = new M.Markmap("#mm", opts);
  var render = mm.renderData.bind(mm);
  mm.renderData = function(){ return render.apply(null, arguments).then(function(x){ mmDecorate(mm); return x; }); };
  mm.setData(r.root).then(function(){ mm.fit(); });
})();
<\/script></body></html>`;
      download(`${fileBase()}.html`, html, "text/html");
    } catch (e) {
      console.error(e);
      toast("Could not build the HTML export.");
    }
  }

  // ---------- share link ----------
  async function shareLink() {
    const packed = LZString.compressToEncodedURIComponent(currentMd());
    const url = `${location.origin}${location.pathname}#/share/${packed}`;
    const ok = await copyText(url);
    toast(ok ? (url.length > 8000 ? "Link copied (it is long; some apps may cut it off)" : "Share link copied") : "Copy failed");
  }

  // ---------- style controls ----------
  const styleInputs = {
    maxWidth: $("#optMaxWidth"), spacingHorizontal: $("#optSpacingH"), spacingVertical: $("#optSpacingV"),
    colorFreezeLevel: $("#optFreeze"), toggleRecursively: $("#optRecursive"),
  };
  function syncStyleControls() {
    const s = effectiveStyle();
    styleInputs.maxWidth.value = s.maxWidth;
    styleInputs.spacingHorizontal.value = s.spacingHorizontal;
    styleInputs.spacingVertical.value = s.spacingVertical;
    styleInputs.colorFreezeLevel.value = String(s.colorFreezeLevel || 0);
    styleInputs.toggleRecursively.checked = !!s.toggleRecursively;
    $("#maxWidthOut").textContent = s.maxWidth ? `${s.maxWidth}px` : "none";
    $("#spacingHOut").textContent = `${s.spacingHorizontal}px`;
    $("#spacingVOut").textContent = `${s.spacingVertical}px`;
  }
  const applyStyle = debounce(async () => {
    store.set("mm.style", userStyle);
    if (!mm) return;
    mm.setOptions(buildOptions());
    await mm.renderData();
    markHits();
  }, 60);
  Object.entries(styleInputs).forEach(([key, el]) => {
    el.addEventListener("input", () => {
      userStyle[key] = el.type === "checkbox" ? el.checked : Number(el.value);
      syncStyleControls();
      applyStyle();
    });
  });
  $("#resetStyle").addEventListener("click", () => { userStyle = {}; applySvgTheme(); syncStyleControls(); applyStyle(); });

  // ---------- theme picker ----------
  $("#themeMenu").innerHTML = Object.entries(THEMES).map(([id, t]) => {
    const [bg, ...dots] = t.preview;
    const pills = dots.map((c, i) => `<i style="background:${c};width:${[30, 22, 26, 18][i]}px"></i>`).join("");
    return `<button type="button" data-theme-id="${id}" title="${t.name} theme"><span class="swatch" style="background:${bg}">${pills}</span>${t.name}</button>`;
  }).join("") + `<button type="button" class="theme-default" data-theme-id="">Use the map's own theme</button>`;
  $("#themeMenu").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-theme-id]");
    if (!b) return;
    e.stopPropagation();
    // Picking a theme resets per-theme layout tweaks so its defaults apply.
    userStyle = b.dataset.themeId ? { theme: b.dataset.themeId, toggleRecursively: userStyle.toggleRecursively } : {};
    store.set("mm.style", userStyle);
    applySvgTheme();
    syncStyleControls();
    if (!mm) return;
    mm.setOptions(buildOptions());
    await mm.renderData();
    await mm.fit();
  });

  // ---------- editor ----------
  const editor = $("#editor");
  const slugInput = $("#slugInput");
  let slugTouched = false;
  function editorOpen() { return !$("#editorPane").hidden; }

  async function setEditor(open) {
    $("#editorPane").hidden = !open;
    $("#editBtn").textContent = open ? "Done" : "Edit";
    $("#editBtn").classList.toggle("primary", !open);
    if (open) {
      editor.value = current.md;
      slugInput.value = current.slug || "";
      updateSaveState();
      editor.focus();
    }
    await new Promise((r) => requestAnimationFrame(r));
    if (mm) { await mm.renderData(); await mm.fit(); }
  }

  function ensureDraft() {
    if (current.kind === "draft") return;
    // Editing a published or shared map makes a local draft.
    const id = current.kind === "published" ? `pub-${current.slug}` : "d-" + Date.now().toString(36);
    current = { kind: "draft", draftId: id, slug: current.slug, md: current.md, base: current.kind === "published" ? current.slug : null };
    history.replaceState(null, "", `#/draft/${encodeURIComponent(id)}`);
  }

  const autosave = debounce(() => {
    if (!current || current.kind !== "draft") return;
    const ok = saveDraft({ id: current.draftId, slug: current.slug, md: current.md, updated: Date.now(), base: current.base || null });
    $("#saveState").textContent = ok ? `Draft saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Draft not saved (storage blocked)";
  }, 500);
  function updateSaveState() {
    $("#saveState").textContent = current.kind === "draft" ? "Local draft" : current.kind === "published" ? "Published" : "Shared link";
  }
  const liveRender = debounce(() => renderMap(current.md, { fit: false, keepFold: true }), 250);

  editor.addEventListener("input", () => {
    ensureDraft();
    current.md = editor.value;
    if (!slugTouched && !current.base) {
      const t = safeMeta(current.md).title;
      current.slug = slugify(t);
      slugInput.value = current.slug;
    }
    liveRender();
    autosave();
  });
  slugInput.addEventListener("input", () => {
    slugTouched = true;
    ensureDraft();
    current.slug = slugify(slugInput.value) === slugInput.value ? slugInput.value : slugInput.value.replace(/[^a-zA-Z0-9_-]/g, "-");
    autosave();
  });
  slugInput.addEventListener("blur", () => { if (current) { current.slug = slugify(slugInput.value); slugInput.value = current.slug; autosave(); } });

  function lineRange(value, start, end) {
    const ls = value.lastIndexOf("\n", start - 1) + 1;
    let le = value.indexOf("\n", end > start && value[end - 1] === "\n" ? end - 1 : end);
    if (le === -1) le = value.length;
    return [ls, le];
  }
  function replaceRange(start, end, text, selStart, selEnd) {
    editor.focus();
    editor.setSelectionRange(start, end);
    if (!document.execCommand("insertText", false, text)) editor.setRangeText(text, start, end, "end");
    if (selStart != null) editor.setSelectionRange(selStart, selEnd);
    editor.dispatchEvent(new Event("input"));
  }
  editor.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault(); ensureDraft(); current.md = editor.value; autosave(); toast("Draft saved in this browser"); return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en, value } = editor;
      const [ls, le] = lineRange(value, s, en);
      const lines = value.slice(ls, le).split("\n");
      let out, delta0 = 0, total = 0;
      if (e.shiftKey) {
        out = lines.map((l, i) => { const m = l.match(/^ {1,2}|^\t/); const r = m ? m[0].length : 0; if (i === 0) delta0 = -r; total -= r; return l.slice(r); });
      } else {
        out = lines.map((l) => "  " + l); delta0 = 2; total = 2 * lines.length;
      }
      replaceRange(ls, le, out.join("\n"), Math.max(ls, s + delta0), en + total);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const { selectionStart: s, selectionEnd: en, value } = editor;
      if (s !== en) return;
      const ls = value.lastIndexOf("\n", s - 1) + 1;
      const line = value.slice(ls, s);
      const m = line.match(/^(\s*)([-*+]|\d+\.)(\s+)(\[[ x]\]\s+)?/);
      if (!m) return;
      e.preventDefault();
      if (line.trim() === m[0].trim()) { replaceRange(ls, s, ""); return; } // empty bullet ends the list
      const marker = /\d+\./.test(m[2]) ? `${parseInt(m[2], 10) + 1}.` : m[2];
      replaceRange(s, s, "\n" + m[1] + marker + m[3] + (m[4] ? "[ ] " : ""));
    }
  });

  $("#insertTpl").addEventListener("click", () => {
    if (/^---\s*\n/.test(editor.value)) { toast("This map already has front matter"); return; }
    const title = safeMeta(editor.value).title;
    const fm = `---\ntitle: ${title}\ndescription: \ntags: []\nmarkmap:\n  theme: studio\n  initialExpandLevel: 3\n---\n\n`;
    replaceRange(0, 0, fm, fm.indexOf("description: ") + 13, fm.indexOf("description: ") + 13);
  });
  $("#formatBtn").addEventListener("click", () => {
    const tidy = editor.value.replace(/\t/g, "  ").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").replace(/\s*$/, "\n");
    if (tidy !== editor.value) replaceRange(0, editor.value.length, tidy); else toast("Already tidy");
  });
  $("#downloadBtn").addEventListener("click", () => download(`${current.slug || "mind-map"}.md`, editor.value, "text/markdown"));
  $("#commitBtn").addEventListener("click", async () => {
    if (!CFG.githubOwner || !CFG.githubRepo) { toast("Set githubOwner and githubRepo in config.js first"); return; }
    const slug = slugify(slugInput.value || current.slug || "untitled-map");
    const path = `${CFG.mapsDir}/${slug}.md`;
    const repo = `https://github.com/${CFG.githubOwner}/${CFG.githubRepo}`;
    const exists = (await loadManifest()).some((m) => m.slug === slug);
    if (exists) {
      await copyText(editor.value);
      toast("Markdown copied. Paste it over the file on GitHub, then commit.", 5000);
      window.open(`${repo}/edit/${CFG.githubBranch}/${path}`, "_blank", "noopener");
      return;
    }
    const url = `${repo}/new/${CFG.githubBranch}?filename=${encodeURIComponent(path)}&value=${encodeURIComponent(editor.value)}`;
    if (url.length > 7500) {
      await copyText(editor.value);
      toast("Markdown copied (too long for a link). Paste it into GitHub, then commit.", 5000);
      window.open(`${repo}/new/${CFG.githubBranch}?filename=${encodeURIComponent(path)}`, "_blank", "noopener");
    } else {
      window.open(url, "_blank", "noopener");
      toast("GitHub opened with the file filled in. Commit it to publish.", 4000);
    }
  });

  // ---------- toolbar wiring ----------
  const actions = {
    zoomIn: () => mm && mm.rescale(1.25),
    zoomOut: () => mm && mm.rescale(0.8),
    fit: () => mm && mm.fit(),
    expandAll: () => mm && expandAll(),
    collapseAll: () => mm && showLevels(1),
    prevHit: () => gotoHit(searchState.i - 1),
    nextHit: () => gotoHit(searchState.i + 1),
    exportSvg: () => mm && exportSvg(),
    exportPng: () => mm && exportPng(),
    exportHtml: () => exportHtml(),
    exportMd: () => download(`${fileBase()}.md`, currentMd(), "text/markdown"),
    copyMd: async () => toast((await copyText(currentMd())) ? "Markdown copied" : "Copy failed"),
    share: shareLink,
    fullscreen: () => {
      const pane = $("#mapPane");
      if (document.fullscreenElement) document.exitFullscreen();
      else if (pane.requestFullscreen) pane.requestFullscreen();
    },
    toggleEdit: () => setEditor(!editorOpen()),
  };
  $("#toolbar").addEventListener("click", (e) => {
    const menuBtn = e.target.closest("[data-menu]");
    if (menuBtn) {
      const pop = document.getElementById(menuBtn.dataset.menu);
      const willOpen = pop.hidden;
      closeMenus();
      pop.hidden = !willOpen;
      e.stopPropagation();
      return;
    }
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.closest(".menu-pop")) closeMenus();
    actions[b.dataset.act] && actions[b.dataset.act]();
  });
  function closeMenus() { $$(".menu-pop").forEach((p) => (p.hidden = true)); }
  document.addEventListener("click", (e) => { if (!e.target.closest(".menu")) closeMenus(); });
  $("#levelSelect").addEventListener("change", (e) => {
    const n = Number(e.target.value);
    if (n && mm) showLevels(n);
    e.target.value = "";
  });
  document.addEventListener("fullscreenchange", () => setTimeout(() => mm && mm.fit(), 120));
  $("#helpBtn").addEventListener("click", () => $("#helpDialog").showModal());

  document.addEventListener("keydown", (e) => {
    const typing = e.target.closest("input, textarea, select, [contenteditable]");
    if (e.key === "Escape") { closeMenus(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "?") { $("#helpDialog").showModal(); return; }
    if (e.key === "t" || e.key === "T") { if (!e.shiftKey) { toggleTheme(); return; } }
    if ($("#mapView").hidden || !mm) return;
    const k = e.key;
    if (k === "f") actions.fit();
    else if (k === "F") actions.fullscreen();
    else if (k === "+" || k === "=") actions.zoomIn();
    else if (k === "-" || k === "_") actions.zoomOut();
    else if (k === "0") expandAll();
    else if (/^[1-6]$/.test(k)) showLevels(Number(k));
    else if (k === "/") { e.preventDefault(); nodeSearch.focus(); nodeSearch.select(); }
    else if (k === "e" || k === "E") actions.toggleEdit();
    else return;
    e.preventDefault();
  });

  // ---------- routing ----------
  function setView(name) {
    $("#galleryView").hidden = name !== "gallery";
    $("#mapView").hidden = name !== "map";
  }
  const NEW_TEMPLATE = `---
title: My new map
description: What this map is about
tags: [notes]
markmap:
  theme: studio
  initialExpandLevel: 3
---

# My new map

## First branch
- An idea
  - A detail under it
- Another idea

## Second branch
- Use **bold**, \`code\`, [links](https://example.com) and $E = mc^2$
- [ ] Checkboxes work too

## Third branch
### Headings make branches
- Bullets nest underneath
`;

  async function openMap(entry, { edit = false } = {}) {
    setView("map");
    current = entry;
    slugTouched = !!entry.slug && entry.kind !== "new";
    if (entry.kind === "new") { current.kind = "draft"; slugTouched = false; }
    nodeSearch.value = "";
    searchState.q = ""; searchState.hits = []; updateSearchCount();
    $("#editorPane").hidden = true;
    await renderMap(current.md, { fit: true });
    if (edit) await setEditor(true); else await setEditor(false);
  }

  async function route() {
    closeMenus();
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    const [kind, ...rest] = h.split("/");
    const arg = rest.join("/");
    if (kind === "map" || kind === "edit") {
      try {
        const md = await fetchMapSource(arg);
        const draft = drafts()[`pub-${arg}`];
        if (kind === "edit" && draft && draft.md !== md) {
          toast("Restored your unsaved local edits");
          return openMap({ kind: "draft", draftId: draft.id, slug: arg, md: draft.md, base: arg }, { edit: true });
        }
        return openMap({ kind: "published", slug: arg, md }, { edit: kind === "edit" });
      } catch (e) {
        toast(e.message, 4000);
        location.hash = "#/";
        return;
      }
    }
    if (kind === "draft") {
      const d = drafts()[arg];
      if (!d) { toast("Draft not found in this browser"); location.hash = "#/"; return; }
      if (current && current.kind === "draft" && current.draftId === arg && !$("#mapView").hidden) return;
      return openMap({ kind: "draft", draftId: d.id, slug: d.slug, md: d.md, base: d.base }, { edit: true });
    }
    if (kind === "new") {
      const id = "d-" + Date.now().toString(36);
      history.replaceState(null, "", `#/draft/${id}`);
      await openMap({ kind: "new", draftId: id, slug: "my-new-map", md: NEW_TEMPLATE, base: null }, { edit: true });
      autosave();
      return;
    }
    if (kind === "share") {
      const md = LZString.decompressFromEncodedURIComponent(location.hash.slice("#/share/".length));
      if (!md) { toast("This share link is empty or damaged"); location.hash = "#/"; return; }
      return openMap({ kind: "shared", slug: slugify(safeMeta(md).title), md });
    }
    current = null;
    showGallery();
  }

  window.addEventListener("hashchange", route);
  route();
})();
