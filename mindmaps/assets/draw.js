/* Mind Map Studio: Excalidraw-style drawing layer.
 * Shapes live in a <g class="mm-annot"> inside markmap's zoomed group, so they
 * pan and zoom with the map and are included in SVG / PNG exports.
 * Drawings are saved per map in this browser (localStorage).
 *
 *   const draw = MindMapDraw.create({ svg, pane, toast, hint });
 *   draw.attach(mm);           // after the Markmap instance exists
 *   draw.raise();              // after each markmap render (keeps layer on top)
 *   draw.load(key);            // when a different map opens
 *   draw.handleKey(event)      // returns true when it used the key
 */
(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const HAND_FONT = '"Virgil", "Excalifont", "Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive';

  const TOOLS = [
    { id: "hand", key: "h", label: "Hand (pan the map)", icon: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-6.5v-1a1.5 1.5 0 0 1 3 0V12m0-6.5a1.5 1.5 0 0 1 3 0V12m0-4.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a7 7 0 0 1-5-2.1l-3.6-3.7a1.6 1.6 0 0 1 2.3-2.3L8 15.5"/>' },
    { id: "select", key: "v", label: "Selection", icon: '<path d="M6 3l12 9-5.5 1.2L15.6 20l-2.4 1.1-3.1-6.8L6 18z"/>' },
    { id: "rect", key: "r", label: "Rectangle", icon: '<rect x="4" y="5" width="16" height="14" rx="2.5"/>' },
    { id: "diamond", key: "d", label: "Diamond", icon: '<path d="M12 3.5l8.5 8.5-8.5 8.5L3.5 12z"/>' },
    { id: "ellipse", key: "o", label: "Ellipse", icon: '<circle cx="12" cy="12" r="8.5"/>' },
    { id: "arrow", key: "a", label: "Arrow", icon: '<path d="M5 19L19 5M10 5h9v9"/>' },
    { id: "line", key: "l", label: "Line", icon: '<path d="M5 19L19 5"/>' },
    { id: "pen", key: "p", label: "Draw", icon: '<path d="M4 20c3-1 4.5-3.5 6-6l7.6-7.6a2.1 2.1 0 0 1 3 3L13 17c-2.5 1.5-5 3-9 3z"/><path d="M15.5 8.5l3 3"/>' },
    { id: "text", key: "t", label: "Text", icon: '<path d="M5 6V4.5h14V6M12 4.5V19.5M9 19.5h6"/>' },
    { id: "eraser", key: "e", label: "Eraser", icon: '<path d="M8.5 20H20M4.6 15.4l9.8-9.8a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L13 19.1a3 3 0 0 1-2.1.9H8.3a3 3 0 0 1-2.1-.9l-1.6-1.6a1.5 1.5 0 0 1 0-2.1z"/><path d="M9 11l5.5 5.5"/>' },
  ];
  const HINTS = {
    hand: "Drag to pan · Scroll to zoom · Click a circle to fold",
    select: "Click a drawing to select · Drag to move · Delete to remove",
    rect: "Click and drag to draw a rectangle", diamond: "Click and drag to draw a diamond",
    ellipse: "Click and drag to draw an ellipse", arrow: "Click and drag to draw an arrow",
    line: "Click and drag to draw a line", pen: "Click and drag to draw freehand",
    text: "Click anywhere to add text", eraser: "Click or drag over drawings to erase",
  };
  const STROKES = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00", "#9c36b5"];
  const FILLS = ["transparent", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99", "#eebefa"];
  const ICON = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;

  function create({ svg, pane, toast = () => {}, hint = null }) {
    const d3 = window.d3;
    const rc = window.rough ? window.rough.svg(svg) : null;
    let mm = null, layer = null, key = null;
    let tool = "hand", shapes = [], selected = null, visible = true;
    let style = loadJSON("mm.draw.style", { stroke: STROKES[0], fill: FILLS[0], fillStyle: "hachure", width: 2, rough: 1, size: 20 });
    let undoStack = [], redoStack = [];
    let drag = null; // in-progress gesture

    // ---------- storage ----------
    function loadJSON(k, fallback) {
      try { const v = localStorage.getItem(k); return v ? { ...fallback, ...JSON.parse(v) } : fallback; } catch { return fallback; }
    }
    function persist() {
      if (!key) return;
      try {
        if (shapes.length) localStorage.setItem("mm.draw." + key, JSON.stringify(shapes));
        else localStorage.removeItem("mm.draw." + key);
      } catch { /* storage blocked: drawings stay for this visit */ }
    }
    function saveStyle() { try { localStorage.setItem("mm.draw.style", JSON.stringify(style)); } catch {} }

    // ---------- history ----------
    function snapshot() {
      undoStack.push(JSON.stringify(shapes));
      if (undoStack.length > 100) undoStack.shift();
      redoStack = [];
      syncButtons();
    }
    function undo() {
      if (!undoStack.length) return;
      redoStack.push(JSON.stringify(shapes));
      shapes = JSON.parse(undoStack.pop());
      select(null); render(); persist(); syncButtons();
    }
    function redo() {
      if (!redoStack.length) return;
      undoStack.push(JSON.stringify(shapes));
      shapes = JSON.parse(redoStack.pop());
      select(null); render(); persist(); syncButtons();
    }

    // ---------- toolbar UI ----------
    const bar = document.createElement("div");
    bar.className = "dt-island dt-tools";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Drawing tools");
    bar.innerHTML = TOOLS.map((t) =>
      `<button type="button" class="dt-btn" data-tool="${t.id}" title="${t.label} — ${t.key.toUpperCase()}" aria-label="${t.label}">${ICON(t.icon)}<kbd>${t.key.toUpperCase()}</kbd></button>`
    ).join("") + `<span class="dt-sep"></span>
      <button type="button" class="dt-btn" data-cmd="undo" title="Undo — Ctrl+Z" aria-label="Undo">${ICON('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>')}</button>
      <button type="button" class="dt-btn" data-cmd="redo" title="Redo — Ctrl+Shift+Z" aria-label="Redo">${ICON('<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>')}</button>
      <button type="button" class="dt-btn" data-cmd="toggle" title="Show / hide drawings" aria-label="Show or hide drawings">${ICON('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>')}</button>
      <button type="button" class="dt-btn" data-cmd="clear" title="Delete all drawings on this map" aria-label="Delete all drawings">${ICON('<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-12M9 7V4.5h6V7"/>')}</button>`;
    pane.appendChild(bar);

    const props = document.createElement("div");
    props.className = "dt-island dt-props";
    props.hidden = true;
    props.innerHTML = `
      <div class="dt-row"><span>Stroke</span><div class="dt-swatches" data-prop="stroke">${STROKES.map((c) => `<button type="button" data-val="${c}" style="--sw:${c}" title="${c}"></button>`).join("")}</div></div>
      <div class="dt-row" data-for="fill"><span>Background</span><div class="dt-swatches" data-prop="fill">${FILLS.map((c) => `<button type="button" data-val="${c}" style="--sw:${c}" class="${c === "transparent" ? "none" : ""}" title="${c}"></button>`).join("")}</div></div>
      <div class="dt-row" data-for="fill"><span>Fill</span><div class="dt-seg" data-prop="fillStyle">
        <button type="button" data-val="hachure" title="Hachure">${ICON('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 14L14 4M8 20L20 8M4 20L20 4"/>')}</button>
        <button type="button" data-val="cross-hatch" title="Cross-hatch">${ICON('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 14L14 4M8 20L20 8M10 4l10 10M4 10l10 10"/>')}</button>
        <button type="button" data-val="solid" title="Solid">${ICON('<rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor"/>')}</button></div></div>
      <div class="dt-row"><span>Stroke width</span><div class="dt-seg" data-prop="width">
        <button type="button" data-val="1" title="Thin">${ICON('<path d="M4 12h16" stroke-width="1.2"/>')}</button>
        <button type="button" data-val="2" title="Bold">${ICON('<path d="M4 12h16" stroke-width="2.6"/>')}</button>
        <button type="button" data-val="4" title="Extra bold">${ICON('<path d="M4 12h16" stroke-width="4.5"/>')}</button></div></div>
      <div class="dt-row" data-for="rough"><span>Sloppiness</span><div class="dt-seg" data-prop="rough">
        <button type="button" data-val="0" title="Architect">${ICON('<path d="M4 16c4-6 8-6 16-8"/>')}</button>
        <button type="button" data-val="1" title="Artist">${ICON('<path d="M4 16c3-5 7-7 10-7s4 1 6-1"/>')}</button>
        <button type="button" data-val="2.5" title="Cartoonist">${ICON('<path d="M4 16c2-3 3-1 5-4s3 0 5-3 3 1 6-2"/>')}</button></div></div>
      <div class="dt-row" data-for="text"><span>Font size</span><div class="dt-seg" data-prop="size">
        <button type="button" data-val="16" title="Small">S</button><button type="button" data-val="20" title="Medium">M</button>
        <button type="button" data-val="28" title="Large">L</button><button type="button" data-val="40" title="Extra large">XL</button></div></div>
      <div class="dt-row dt-actions" data-for="selected"><button type="button" class="dt-mini" data-cmd="duplicate">Duplicate</button><button type="button" class="dt-mini" data-cmd="delete">Delete</button></div>`;
    pane.appendChild(props);

    bar.addEventListener("click", (e) => {
      const t = e.target.closest("[data-tool]");
      if (t) { setTool(t.dataset.tool); return; }
      const c = e.target.closest("[data-cmd]");
      if (c) command(c.dataset.cmd);
    });
    props.addEventListener("click", (e) => {
      const c = e.target.closest("[data-cmd]");
      if (c) { command(c.dataset.cmd); return; }
      const b = e.target.closest("[data-val]");
      if (!b) return;
      const prop = b.parentElement.dataset.prop;
      const raw = b.dataset.val;
      const val = ["width", "rough", "size"].includes(prop) ? Number(raw) : raw;
      style[prop] = val;
      saveStyle();
      if (selected) {
        const s = shapes.find((x) => x.id === selected);
        if (s && prop in s) { snapshot(); s[prop] = val; render(); persist(); }
      }
      syncProps();
    });

    function command(cmd) {
      if (cmd === "undo") undo();
      else if (cmd === "redo") redo();
      else if (cmd === "toggle") {
        visible = !visible;
        if (layer) layer.style.display = visible ? "" : "none";
        toast(visible ? "Drawings shown" : "Drawings hidden");
        syncButtons();
      } else if (cmd === "clear") {
        if (!shapes.length) { toast("No drawings on this map"); return; }
        if (!confirm("Delete all drawings on this map?")) return;
        snapshot(); shapes = []; select(null); render(); persist();
      } else if (cmd === "delete") deleteSelected();
      else if (cmd === "duplicate") duplicateSelected();
    }

    function setTool(id) {
      tool = id;
      if (id !== "select") select(null);
      pane.classList.toggle("dt-drawing", id !== "hand" && id !== "select");
      pane.dataset.tool = id;
      bar.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === id));
      if (hint) hint.textContent = HINTS[id];
      syncProps();
    }
    function syncProps() {
      const sel = selected && shapes.find((s) => s.id === selected);
      const kind = sel ? sel.type : tool;
      const show = !["hand", "select", "eraser"].includes(tool) || !!sel;
      props.hidden = !show;
      if (!show) return;
      const src = sel || style;
      const hasFill = ["rect", "diamond", "ellipse"].includes(kind);
      props.querySelectorAll("[data-for=fill]").forEach((r) => (r.hidden = !hasFill));
      props.querySelectorAll("[data-for=text]").forEach((r) => (r.hidden = kind !== "text"));
      props.querySelectorAll("[data-for=rough]").forEach((r) => (r.hidden = kind === "text" || kind === "pen"));
      props.querySelectorAll("[data-for=selected]").forEach((r) => (r.hidden = !sel));
      props.querySelectorAll("[data-prop]").forEach((g) => {
        const v = src[g.dataset.prop] ?? style[g.dataset.prop];
        g.querySelectorAll("[data-val]").forEach((b) => b.classList.toggle("on", String(v) === b.dataset.val));
      });
    }
    function syncButtons() {
      const u = bar.querySelector("[data-cmd=undo]"), r = bar.querySelector("[data-cmd=redo]");
      u.disabled = !undoStack.length; r.disabled = !redoStack.length;
      bar.querySelector("[data-cmd=toggle]").classList.toggle("on", !visible);
    }

    // ---------- geometry ----------
    const uid = () => Math.random().toString(36).slice(2, 10);
    function bbox(s) {
      if (s.type === "pen") {
        const xs = s.points.map((p) => p[0]), ys = s.points.map((p) => p[1]);
        return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      }
      if (s.type === "text") return { x: s.x1, y: s.y1, w: s.w || 10, h: s.h || s.size };
      return { x: Math.min(s.x1, s.x2), y: Math.min(s.y1, s.y2), w: Math.abs(s.x2 - s.x1), h: Math.abs(s.y2 - s.y1) };
    }
    function distToSeg(p, a, b) {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = dx || dy ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    }
    function hit(s, p, tol) {
      if (s.type === "pen") return s.points.some((q, i) => i && distToSeg(p, s.points[i - 1], q) < tol + s.width);
      if (s.type === "line" || s.type === "arrow") return distToSeg(p, [s.x1, s.y1], [s.x2, s.y2]) < tol + s.width;
      const b = bbox(s);
      const inside = p[0] >= b.x - tol && p[0] <= b.x + b.w + tol && p[1] >= b.y - tol && p[1] <= b.y + b.h + tol;
      if (!inside) return false;
      if (s.type === "text" || s.fill !== "transparent") return true;
      // Unfilled shapes are only "solid" near their outline.
      if (s.type === "ellipse") {
        const rx = b.w / 2 || 1, ry = b.h / 2 || 1, cx = b.x + rx, cy = b.y + ry;
        const r = Math.hypot((p[0] - cx) / rx, (p[1] - cy) / ry);
        return Math.abs(r - 1) * Math.min(rx, ry) < tol + 4;
      }
      if (s.type === "diamond") {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2, pts = [[cx, b.y], [b.x + b.w, cy], [cx, b.y + b.h], [b.x, cy]];
        return pts.some((q, i) => distToSeg(p, q, pts[(i + 1) % 4]) < tol + 4);
      }
      return Math.min(Math.abs(p[0] - b.x), Math.abs(p[0] - b.x - b.w), Math.abs(p[1] - b.y), Math.abs(p[1] - b.y - b.h)) < tol + 4;
    }
    function shapeAt(p) {
      const k = mm ? d3.zoomTransform(svg).k : 1;
      const tol = 6 / k;
      for (let i = shapes.length - 1; i >= 0; i--) if (hit(shapes[i], p, tol)) return shapes[i];
      return null;
    }

    // ---------- rendering ----------
    function opts(s) {
      return {
        stroke: s.stroke, strokeWidth: s.width, roughness: s.rough, seed: s.seed, bowing: 1,
        fill: s.fill && s.fill !== "transparent" ? s.fill : undefined, fillStyle: s.fillStyle,
        fillWeight: Math.max(1, s.width / 2), hachureGap: 4 + s.width * 2,
      };
    }
    function penPath(pts) {
      if (pts.length < 2) return `M${pts[0][0]} ${pts[0][1]}h0.01`;
      let d = `M${pts[0][0]} ${pts[0][1]}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        d += `Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
      }
      const last = pts[pts.length - 1];
      return d + `L${last[0]} ${last[1]}`;
    }
    function draw(s) {
      let g;
      const b = bbox(s);
      if (s.type === "pen") {
        g = document.createElementNS(NS, "g");
        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", penPath(s.points));
        p.setAttribute("fill", "none"); p.setAttribute("stroke", s.stroke);
        p.setAttribute("stroke-width", s.width * 1.5); p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
        g.appendChild(p);
      } else if (s.type === "text") {
        g = document.createElementNS(NS, "g");
        const t = document.createElementNS(NS, "text");
        t.setAttribute("x", s.x1); t.setAttribute("y", s.y1);
        t.setAttribute("fill", s.stroke); t.setAttribute("font-size", s.size);
        t.setAttribute("font-family", HAND_FONT); t.setAttribute("dominant-baseline", "hanging");
        String(s.text).split("\n").forEach((line, i) => {
          const ts = document.createElementNS(NS, "tspan");
          ts.setAttribute("x", s.x1); ts.setAttribute("dy", i ? s.size * 1.25 : 0);
          ts.textContent = line || " ";
          t.appendChild(ts);
        });
        g.appendChild(t);
      } else if (!rc) {
        g = document.createElementNS(NS, "g"); // rough.js missing: draw nothing rather than crash
      } else if (s.type === "rect") {
        g = rc.rectangle(b.x, b.y, b.w, b.h, opts(s));
      } else if (s.type === "ellipse") {
        g = rc.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, opts(s));
      } else if (s.type === "diamond") {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        g = rc.polygon([[cx, b.y], [b.x + b.w, cy], [cx, b.y + b.h], [b.x, cy]], opts(s));
      } else if (s.type === "line") {
        g = rc.line(s.x1, s.y1, s.x2, s.y2, opts(s));
      } else if (s.type === "arrow") {
        g = rc.line(s.x1, s.y1, s.x2, s.y2, opts(s));
        const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1), len = Math.min(18 + s.width * 2, Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * 0.4);
        [-0.45, 0.45].forEach((a) => {
          g.appendChild(rc.line(s.x2, s.y2, s.x2 - len * Math.cos(ang + a), s.y2 - len * Math.sin(ang + a), { ...opts(s), seed: s.seed + 1 }));
        });
      }
      g.setAttribute("data-id", s.id);
      g.classList.add("dt-shape");
      return g;
    }
    function render() {
      if (!layer) return;
      layer.textContent = "";
      shapes.forEach((s) => {
        const g = draw(s);
        if (s.hidden) g.setAttribute("opacity", "0");
        layer.appendChild(g);
        if (s.type === "text") {
          // Measure once rendered so selection and hit-testing know the size.
          try { const bb = g.getBBox(); s.w = bb.width; s.h = bb.height; } catch {}
        }
      });
      const sel = selected && shapes.find((s) => s.id === selected);
      if (sel) {
        const b = bbox(sel), pad = 6;
        const r = document.createElementNS(NS, "rect");
        r.setAttribute("class", "dt-selection");
        r.setAttribute("x", b.x - pad); r.setAttribute("y", b.y - pad);
        r.setAttribute("width", b.w + pad * 2); r.setAttribute("height", b.h + pad * 2);
        layer.appendChild(r);
      }
    }
    function select(id) { selected = id; render(); syncProps(); }

    function deleteSelected() {
      if (!selected) return;
      snapshot();
      shapes = shapes.filter((s) => s.id !== selected);
      select(null); persist();
    }
    function duplicateSelected() {
      const s = selected && shapes.find((x) => x.id === selected);
      if (!s) return;
      snapshot();
      const c = JSON.parse(JSON.stringify(s));
      c.id = uid(); c.seed = Math.floor(Math.random() * 2 ** 31);
      move(c, 16, 16);
      shapes.push(c);
      select(c.id); persist();
    }
    function move(s, dx, dy) {
      if (s.type === "pen") s.points = s.points.map((p) => [p[0] + dx, p[1] + dy]);
      else { s.x1 += dx; s.y1 += dy; if (s.x2 != null) { s.x2 += dx; s.y2 += dy; } }
    }

    // ---------- text editing ----------
    let editing = null;
    function editText(s, isNew) {
      finishText();
      const pt = svg.createSVGPoint();
      const ctm = layer.getScreenCTM();
      pt.x = s.x1; pt.y = s.y1;
      const sp = pt.matrixTransform(ctm);
      const rect = pane.getBoundingClientRect();
      const k = ctm.a;
      const ta = document.createElement("textarea");
      ta.className = "dt-textedit";
      ta.value = s.text || "";
      Object.assign(ta.style, {
        left: `${sp.x - rect.left}px`, top: `${sp.y - rect.top}px`,
        fontSize: `${s.size * k}px`, color: s.stroke, fontFamily: HAND_FONT,
      });
      pane.appendChild(ta);
      const fit = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; ta.style.width = "auto"; ta.style.width = Math.max(40, ta.scrollWidth + 8) + "px"; };
      ta.addEventListener("input", fit);
      ta.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); finishText(); }
      });
      ta.addEventListener("blur", () => finishText());
      editing = { ta, s, isNew, before: JSON.stringify(shapes) };
      if (!isNew) { s.hidden = true; layer.querySelector(`[data-id="${s.id}"]`)?.setAttribute("opacity", "0"); }
      requestAnimationFrame(() => { fit(); ta.focus(); });
    }
    function finishText() {
      if (!editing) return;
      const { ta, s, isNew, before } = editing;
      editing = null;
      const text = ta.value.replace(/\s+$/, "");
      ta.remove();
      delete s.hidden;
      if (!text) {
        if (!isNew) { undoStack.push(before); shapes = shapes.filter((x) => x.id !== s.id); }
      } else if (text !== s.text) {
        undoStack.push(before); redoStack = [];
        s.text = text;
        if (isNew) shapes.push(s);
      }
      render(); persist(); syncButtons();
      if (isNew && text) { setTool("select"); select(s.id); }
    }

    // ---------- pointer handling ----------
    function point(e) { return d3.pointer(e, layer); }

    svg.addEventListener("pointerdown", (e) => {
      if (!layer || e.button !== 0 || tool === "hand") return;
      const p = point(e);
      if (tool === "select") {
        const s = shapeAt(p);
        if (!s) { if (selected) select(null); return; } // empty space: let the map pan
        e.stopPropagation(); e.preventDefault();
        select(s.id);
        drag = { kind: "move", s, last: p, before: JSON.stringify(shapes), moved: false };
        svg.setPointerCapture(e.pointerId);
        return;
      }
      e.stopPropagation(); e.preventDefault();
      if (tool === "eraser") {
        drag = { kind: "erase", before: JSON.stringify(shapes), erased: false };
        eraseAt(p);
      } else if (tool === "text") {
        const existing = shapeAt(p);
        if (existing && existing.type === "text") { editText(existing, false); return; }
        editText({ id: uid(), type: "text", x1: p[0], y1: p[1], text: "", stroke: style.stroke, size: style.size, seed: 1 }, true);
        return;
      } else {
        const s = { id: uid(), type: tool, stroke: style.stroke, fill: style.fill, fillStyle: style.fillStyle, width: style.width, rough: style.rough, seed: Math.floor(Math.random() * 2 ** 31) };
        if (tool === "pen") s.points = [p];
        else { s.x1 = s.x2 = p[0]; s.y1 = s.y2 = p[1]; }
        drag = { kind: "create", s, before: JSON.stringify(shapes) };
        shapes.push(s);
        render();
      }
      svg.setPointerCapture(e.pointerId);
    }, true);

    svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const p = point(e);
      if (drag.kind === "create") {
        const s = drag.s;
        if (s.type === "pen") s.points.push(p);
        else {
          s.x2 = p[0]; s.y2 = p[1];
          if (e.shiftKey && ["rect", "ellipse", "diamond"].includes(s.type)) {
            const side = Math.max(Math.abs(s.x2 - s.x1), Math.abs(s.y2 - s.y1));
            s.x2 = s.x1 + Math.sign(s.x2 - s.x1 || 1) * side; s.y2 = s.y1 + Math.sign(s.y2 - s.y1 || 1) * side;
          }
        }
        render();
      } else if (drag.kind === "move") {
        move(drag.s, p[0] - drag.last[0], p[1] - drag.last[1]);
        drag.last = p; drag.moved = true;
        render();
      } else if (drag.kind === "erase") eraseAt(p);
    });

    function endDrag() {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (d.kind === "create") {
        const b = bbox(d.s);
        const tiny = d.s.type === "pen" ? d.s.points.length < 2 : b.w < 3 && b.h < 3;
        if (tiny) { shapes = shapes.filter((x) => x !== d.s); render(); return; }
        undoStack.push(d.before); redoStack = [];
        persist(); syncButtons();
        if (d.s.type !== "pen") { setTool("select"); select(d.s.id); } // like Excalidraw: back to selection
      } else if (d.kind === "move" && d.moved) {
        undoStack.push(d.before); redoStack = []; persist(); syncButtons();
      } else if (d.kind === "erase" && d.erased) {
        undoStack.push(d.before); redoStack = []; persist(); syncButtons();
      }
    }
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    svg.addEventListener("dblclick", (e) => {
      if (!layer || tool !== "select") return;
      const s = shapeAt(point(e));
      if (s && s.type === "text") { e.stopPropagation(); editText(s, false); }
    }, true);

    function eraseAt(p) {
      const s = shapeAt(p);
      if (!s) return;
      shapes = shapes.filter((x) => x !== s);
      if (drag) drag.erased = true;
      render();
    }

    // ---------- public API ----------
    function attach(instance) {
      mm = instance;
      layer = document.createElementNS(NS, "g");
      layer.setAttribute("class", "mm-annot");
      mm.g.node().appendChild(layer);
      // Map dragging only with the hand or selection tool; wheel zoom always.
      const original = mm.zoom.filter();
      mm.zoom.filter(function (event) {
        if (event.type !== "wheel" && tool !== "hand" && tool !== "select") return false;
        return original.call(this, event);
      });
      mm.svg.call(mm.zoom);
      render();
    }
    function raise() { if (layer && layer.parentNode && layer.parentNode.lastChild !== layer) layer.parentNode.appendChild(layer); }
    function load(k) {
      finishText();
      key = k;
      try { shapes = JSON.parse(localStorage.getItem("mm.draw." + k) || "[]"); } catch { shapes = []; }
      undoStack = []; redoStack = []; selected = null;
      render(); syncButtons(); syncProps();
    }
    function rename(k) { if (k === key) return; const old = key; key = k; persist(); try { if (old) localStorage.removeItem("mm.draw." + old); } catch {} }
    function handleKey(e) {
      if (!layer || editing) return false;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") { e.shiftKey ? redo() : undo(); return true; }
      if (mod && k === "y") { redo(); return true; }
      if (mod && k === "d" && selected) { duplicateSelected(); return true; }
      if (mod || e.altKey || e.shiftKey) return false;
      if ((e.key === "Delete" || e.key === "Backspace") && selected) { deleteSelected(); return true; }
      if (e.key === "Escape" && tool !== "hand") { setTool("hand"); return true; }
      const t = TOOLS.find((x) => x.key === k);
      if (t) { setTool(t.id); return true; }
      return false;
    }
    function markup() { return layer && shapes.length && visible ? layer.outerHTML : ""; }

    setTool("hand");
    syncButtons();
    return { attach, raise, load, rename, handleKey, markup, setTool, get count() { return shapes.length; } };
  }

  window.MindMapDraw = { create };
})();
