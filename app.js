// ═══════════════════════════════════════════════════════
//  Mango's Library – app.js  v3
// ═══════════════════════════════════════════════════════

// ── CONFIG ──────────────────────────────────────────────
const CONFIG = {
  // Apps Script handles all writes (Add Entry, Mass Import)
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbww_FFEQy6LJZwl0voCcEkPsfMCfK1h7JC6YBQQnpCrNbPkxouJekKBqcK6O7WIEyOB/exec",

  // opensheet proxy handles reads
  SHEET_ID: "1PwWhUZr7WDYCKRusbGpM5hPUinxM9mtSG6uVECSaiuI",
  TAB_NAME: "Mappings",

  // Discord invite link — set to "" to hide the banner
  DISCORD_URL: "",
  DISCORD_SUBTEXT: "Discuss mappings, suggest corrections, and chat with other readers.",
};

// ── COLUMN KEYS ─────────────────────────────────────────
const C = {
  franchise: "Franchise (series)",
  format1:   "Content format 1",
  volume:    "volume/season",
  seq:       "sequence number",
  title:     'title (chapter, not official title, just like "chapter 2")',
  format2:   "Content format 2",
  lnVolume:  "LN volume/season",
  lnSeq:     "LN sequence number",
  lnTitle:   'LN title (chapter, not official title, just like "chapter 2")',
  notes:     "Notes",
};

// ── PALETTE ─────────────────────────────────────────────
const PALETTE = [
  "#c2410c","#0f766e","#1d4ed8","#7e22ce","#b45309",
  "#0369a1","#be123c","#15803d","#6d28d9","#b45309",
  "#0891b2","#9a3412","#065f46","#1e40af","#6b21a8",
  "#92400e","#164e63","#14532d","#1e3a8a","#581c87",
];
const groupColor = i => PALETTE[i % PALETTE.length];

// ── STATE ────────────────────────────────────────────────
const state = {
  allRows:       [],
  currentSeries: null,
  currentView:   "map",
  tableGroup:    "chapters",
  searchTerm:    "",
  focusedLnKey:  null,
  selectedRowKey: null,
};

// ── HELPERS ──────────────────────────────────────────────
const esc = str => String(str ?? "")
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

const lnKey  = row => `${row[C.lnTitle]||""}||${row[C.lnVolume]||""}`;
const $ = id => document.getElementById(id);
const uniqueSeries = rows => [...new Set(rows.map(r => r[C.franchise] || "Unknown"))].sort();

// ── DOM REFS ─────────────────────────────────────────────
const dom = {
  homeView:         $("homeView"),
  seriesView:       $("seriesView"),
  homeStatus:       $("homeStatus"),
  seriesStatus:     $("seriesStatus"),
  seriesCount:      $("seriesCount"),
  seriesGrid:       $("seriesGrid"),
  seriesSearchInput:$("seriesSearchInput"),
  breadcrumb:       $("breadcrumb"),
  homeBtn:          $("homeBtn"),
  addEntryBtn:      $("addEntryBtn"),
  seriesSelect:     $("seriesSelect"),
  viewToggle:       $("viewToggle"),
  searchInput:      $("searchInput"),
  discordBanner:    $("discordBanner"),
  discordLink:      $("discordLink"),
  discordSubtext:   $("discordSubtext"),
  // Map
  mapView:          $("mapView"),
  focusBar:         $("focusBar"),
  focusName:        $("focusName"),
  focusClear:       $("focusClear"),
  mangaItems:       $("mangaItems"),
  lnItems:          $("lnItems"),
  mangaCount:       $("mangaCount"),
  lnCount:          $("lnCount"),
  connectorSvg:     $("connectorSvg"),
  connectorArea:    $("connectorArea"),
  // Table
  tableView:        $("tableView"),
  tableHead:        $("tableHead"),
  tableBody:        $("tableBody"),
  tableGroupSel:    $("tableGroupSelect"),
  tableGroup:       $("tableGroup"),
  // Detail
  detailSidebar:    $("detailSidebar"),
  detailContent:    $("detailContent"),
  detailClose:      $("detailClose"),
  // Modal
  modalOverlay:     $("modalOverlay"),
  modalClose:       $("modalClose"),
  addForm:          $("addForm"),
  cancelBtn:        $("cancelBtn"),
  submitBtn:        $("submitBtn"),
  submitStatus:     $("submitStatus"),
  noScriptWarn:     $("noScriptWarning"),
  // Modal tabs
  tabSingle:        $("tabSingle"),
  tabMass:          $("tabMass"),
  // Mass import
  massInput:        $("massInput"),
  massParseBtn:     $("massParseBtn"),
  massPreview:      $("massPreview"),
  massPreviewCount: $("massPreviewCount"),
  massPreviewHead:  $("massPreviewHead"),
  massPreviewBody:  $("massPreviewBody"),
  massClearBtn:     $("massClearBtn"),
  massSubmitBtn:    $("massSubmitBtn"),
  massSubmitStatus: $("massSubmitStatus"),
  massCancelBtn:    $("massCancelBtn"),
};

// ── INIT ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  setupDiscord();
  loadData();
});

function bindEvents() {
  dom.homeBtn.addEventListener("click", navigateHome);

  dom.seriesSearchInput.addEventListener("input", () => renderHome());

  dom.seriesSelect.addEventListener("change", () => {
    state.currentSeries = dom.seriesSelect.value;
    state.focusedLnKey  = null;
    state.selectedRowKey = null;
    updateSeriesView();
    updateBreadcrumb();
  });

  dom.viewToggle.addEventListener("click", e => {
    const btn = e.target.closest(".toggle-btn");
    if (!btn) return;
    const v = btn.dataset.view;
    if (v === state.currentView) return;
    state.currentView = v;
    dom.viewToggle.querySelectorAll(".toggle-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.view === v)
    );
    renderCurrentView();
  });

  dom.searchInput.addEventListener("input", () => {
    state.searchTerm   = dom.searchInput.value.trim().toLowerCase();
    state.focusedLnKey = null;
    renderCurrentView();
  });

  dom.tableGroup.addEventListener("change", () => {
    state.tableGroup = dom.tableGroup.value;
    renderTableView(filteredRows());
  });

  dom.focusClear.addEventListener("click", () => {
    state.focusedLnKey = null;
    dom.focusBar.classList.add("hidden");
    applyMapFocus();
    drawConnections();
  });

  dom.detailClose.addEventListener("click", closeDetail);

  // Modal open/close
  dom.addEntryBtn.addEventListener("click", openModal);
  dom.modalClose.addEventListener("click",  closeModal);
  dom.cancelBtn.addEventListener("click",   closeModal);
  dom.massCancelBtn.addEventListener("click", closeModal);
  dom.modalOverlay.addEventListener("click", e => { if (e.target === dom.modalOverlay) closeModal(); });

  // Modal tabs
  document.querySelectorAll(".modal-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".modal-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      dom.tabSingle.classList.toggle("hidden", tab !== "single");
      dom.tabMass.classList.toggle("hidden",   tab !== "mass");
    });
  });

  // Single submit
  dom.addForm.addEventListener("submit", handleSingleSubmit);

  // Mass import
  dom.massParseBtn.addEventListener("click", parseMassInput);
  dom.massClearBtn.addEventListener("click", clearMassPreview);
  dom.massSubmitBtn.addEventListener("click", handleMassSubmit);

  // Resize → redraw lines
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawConnections, 60);
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (!dom.modalOverlay.classList.contains("hidden")) closeModal();
    }
  });
}

function setupDiscord() {
  if (CONFIG.DISCORD_URL) {
    dom.discordBanner.classList.remove("hidden");
    dom.discordLink.href = CONFIG.DISCORD_URL;
    if (CONFIG.DISCORD_SUBTEXT) dom.discordSubtext.textContent = CONFIG.DISCORD_SUBTEXT;
  }
}

// ── DATA LOADING ─────────────────────────────────────────
async function loadData() {
  dom.homeStatus.textContent = "Loading series…";
  try {
    // Always read via opensheet proxy; Apps Script is write-only
    const url = `https://opensheet.elk.sh/${CONFIG.SHEET_ID}/${encodeURIComponent(CONFIG.TAB_NAME)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.allRows = data.filter(row =>
      row[C.format1]?.toLowerCase() === "manga" && row[C.seq]
    );

    renderHome();
  } catch (err) {
    console.error(err);
    dom.homeStatus.textContent = "⚠ Failed to load data. Check console.";
  }
}

// ── NAVIGATION ───────────────────────────────────────────
function navigateHome() {
  state.currentSeries  = null;
  state.focusedLnKey   = null;
  state.selectedRowKey = null;
  state.searchTerm     = "";
  dom.searchInput.value = "";

  dom.homeView.classList.remove("hidden");
  dom.seriesView.classList.add("hidden");
  updateBreadcrumb();
}

function navigateSeries(name) {
  state.currentSeries  = name;
  state.focusedLnKey   = null;
  state.selectedRowKey = null;

  dom.homeView.classList.add("hidden");
  dom.seriesView.classList.remove("hidden");

  populateSeriesSelect();
  updateSeriesView();
  updateBreadcrumb();
}

function updateBreadcrumb() {
  if (!state.currentSeries) { dom.breadcrumb.innerHTML = ""; return; }
  dom.breadcrumb.innerHTML = `
    <span class="crumb">
      <button class="crumb-link" id="breadHome" type="button">Home</button>
    </span>
    <span class="crumb-sep">›</span>
    <span class="crumb crumb-current">${esc(state.currentSeries)}</span>
  `;
  $("breadHome")?.addEventListener("click", navigateHome);
}

// ── HOME ─────────────────────────────────────────────────
function renderHome() {
  const query = dom.seriesSearchInput.value.trim().toLowerCase();
  let names   = uniqueSeries(state.allRows);
  if (query) names = names.filter(n => n.toLowerCase().includes(query));

  dom.homeStatus.textContent = "";
  dom.seriesCount.textContent = `${names.length} series`;
  dom.seriesGrid.innerHTML = "";

  if (names.length === 0) {
    dom.homeStatus.textContent = query ? "No series match your search." : "No series found.";
    return;
  }

  for (const name of names) {
    const rows        = state.allRows.filter(r => r[C.franchise] === name);
    const mangaTitles = new Set(rows.map(r => r[C.title]).filter(Boolean));
    const lnTitles    = new Set(rows.map(r => r[C.lnTitle]).filter(Boolean));

    const card = document.createElement("article");
    card.className = "series-card";
    card.innerHTML = `
      <h3 class="card-title">${esc(name)}</h3>
      <div class="card-meta">
        <span class="card-stat"><span class="card-dot manga"></span>${mangaTitles.size} manga chapters</span>
        <span class="card-stat"><span class="card-dot ln"></span>${lnTitles.size} LN chapters</span>
        <span class="card-stat"><span class="card-dot" style="background:var(--border-2)"></span>${rows.length} mapping rows</span>
      </div>
    `;
    card.addEventListener("click", () => navigateSeries(name));
    dom.seriesGrid.appendChild(card);
  }
}

// ── SERIES VIEW ──────────────────────────────────────────
function populateSeriesSelect() {
  if (dom.seriesSelect.options.length > 0) {
    dom.seriesSelect.value = state.currentSeries;
    return;
  }
  for (const name of uniqueSeries(state.allRows)) {
    const opt = document.createElement("option");
    opt.value = opt.textContent = name;
    dom.seriesSelect.appendChild(opt);
  }
  dom.seriesSelect.value = state.currentSeries;
}

function updateSeriesView() {
  populateSeriesSelect();
  dom.tableGroupSel.classList.remove("hidden");
  closeDetail();
  renderCurrentView();
}

function filteredRows() {
  let rows = state.allRows.filter(r => r[C.franchise] === state.currentSeries);
  rows.sort((a, b) => Number(a[C.seq]||0) - Number(b[C.seq]||0));
  if (state.searchTerm) {
    rows = rows.filter(r => [C.seq, C.title, C.lnTitle, C.lnSeq].some(k =>
      String(r[k]||"").toLowerCase().includes(state.searchTerm)
    ));
  }
  return rows;
}

function renderCurrentView() {
  const rows = filteredRows();
  const isMap = state.currentView === "map";
  dom.mapView.classList.toggle("hidden", !isMap);
  dom.tableView.classList.toggle("hidden", isMap);
  if (isMap) renderMapView(rows);
  else       renderTableView(rows);
}

// ── DETAIL PANEL ─────────────────────────────────────────
function openDetail() {
  dom.detailSidebar.classList.remove("hidden");
}

function closeDetail() {
  dom.detailSidebar.classList.add("hidden");
  state.selectedRowKey = null;
  state.focusedLnKey   = null;

  // Clear active selection on map items + table rows
  document.querySelectorAll(".map-item.active, tr.selected-row").forEach(el =>
    el.classList.remove("active", "selected-row")
  );

  // Clear focus bar
  dom.focusBar.classList.add("hidden");

  // Un-fade all map items
  document.querySelectorAll(".map-item").forEach(el => {
    el.classList.remove("faded");
    el.style.opacity = "";
  });

  // Reset connection line highlights
  dom.connectorSvg.querySelectorAll(".conn-line").forEach(l =>
    l.classList.remove("highlighted", "faded")
  );
}

function showDetail(row, mangaTC, lnTC) {
  const mDup = (mangaTC[row[C.title]] || 0) > 1;
  const lDup = row[C.lnTitle] && (lnTC[row[C.lnTitle]] || 0) > 1;
  dom.detailContent.innerHTML = `
    <div class="detail-row">
      <span class="detail-label">Series</span>
      <span class="detail-value">${esc(row[C.franchise]||"—")}</span>
    </div>
    <div class="detail-divider"></div>
    <div class="detail-row">
      <span class="detail-label">Manga vol</span>
      <span class="detail-value manga-accent">${esc(row[C.volume]||"—")}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Manga seq #</span>
      <span class="detail-value manga-accent">${esc(row[C.seq]||"—")}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Manga chapter</span>
      <span class="detail-value manga-accent">
        ${esc(row[C.title]||"—")}${mDup?`<span class="dup-badge manga">×${mangaTC[row[C.title]]}</span>`:""}
      </span>
    </div>
    <div class="detail-divider"></div>
    <div class="detail-row">
      <span class="detail-label">LN vol</span>
      <span class="detail-value ln-accent">${esc(row[C.lnVolume]||"—")}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">LN seq #</span>
      <span class="detail-value ln-accent">${esc(row[C.lnSeq]||"—")}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">LN chapter</span>
      <span class="detail-value ln-accent">
        ${esc(row[C.lnTitle]||"(no LN mapping)")}${lDup?`<span class="dup-badge ln">×${lnTC[row[C.lnTitle]]}</span>`:""}
      </span>
    </div>
    ${row[C.notes]?`<div class="detail-divider"></div><div class="detail-row"><span class="detail-label">Notes</span><span class="detail-value">${esc(row[C.notes])}</span></div>`:""}
  `;
  openDetail();
}

function showLnGroupDetail(g) {
  const list = g.rows.map(r =>
    `<div class="detail-value manga-accent" style="margin:.1rem 0">Vol ${esc(r[C.volume]||"?")} #${esc(r[C.seq]||"?")} — ${esc(r[C.title]||"")}</div>`
  ).join("");
  dom.detailContent.innerHTML = `
    <div class="detail-row">
      <span class="detail-label">LN chapter</span>
      <span class="detail-value ln-accent">${esc(g.lnTitle||"(no mapping)")}${g.lnVolume?` · Vol ${esc(g.lnVolume)}`:""}${g.lnSeq?` · #${esc(String(g.lnSeq))}`:""}
      </span>
    </div>
    <div class="detail-divider"></div>
    <div class="detail-row">
      <span class="detail-label">Manga chapters mapped (${g.rows.length})</span>
      <div>${list}</div>
    </div>
  `;
  openDetail();
}

// ── MAP VIEW ─────────────────────────────────────────────
function renderMapView(rows) {
  const lnMap = new Map();
  let ci = 0;
  for (const row of rows) {
    const key = lnKey(row);
    if (!lnMap.has(key)) {
      lnMap.set(key, { key, lnTitle: row[C.lnTitle]||"", lnVolume: row[C.lnVolume]||"", lnSeq: Number(row[C.lnSeq]||0), rows:[], colorIndex: row[C.lnTitle] ? ci++ : -1 });
    }
    lnMap.get(key).rows.push(row);
  }

  const lnGroups = [...lnMap.values()].sort((a,b) => {
    if (!a.lnTitle) return 1;
    if (!b.lnTitle) return -1;
    return a.lnSeq - b.lnSeq || a.lnTitle.localeCompare(b.lnTitle);
  });

  const keyColor = {};
  lnGroups.forEach((g, i) => { keyColor[g.key] = g.lnTitle ? groupColor(i) : "#b5a898"; });

  const mangaTC = buildCounts(rows, r => r[C.title]||"");
  const lnTC    = buildCounts(rows, r => r[C.lnTitle]||"");

  // Manga column
  dom.mangaItems.innerHTML = "";
  dom.mangaCount.textContent = `${rows.length} ch.`;

  for (const row of rows) {
    const key   = lnKey(row);
    const color = keyColor[key] || "#b5a898";
    const mDup  = (mangaTC[row[C.title]]||0) > 1;

    const el = document.createElement("div");
    el.className = "map-item";
    el.dataset.key = key;
    el.dataset.seq = row[C.seq]||"";
    el.style.setProperty("--item-color", color);
    el.innerHTML = `
      <div class="item-seq">#${esc(row[C.seq]||"")}</div>
      <div class="item-title">${esc(row[C.title]||"(no title)")}${mDup?`<span class="dup-badge manga">×${mangaTC[row[C.title]]}</span>`:""}</div>
      ${row[C.volume]?`<div class="item-vol">Vol ${esc(row[C.volume])}</div>`:""}
    `;
    el.addEventListener("click", () => {
      clearMapSelection();
      el.classList.add("active");
      state.selectedRowKey = key + row[C.seq];
      showDetail(row, mangaTC, lnTC);
    });
    el.addEventListener("mouseenter", () => highlightConnections(key));
    el.addEventListener("mouseleave", resetHighlight);
    dom.mangaItems.appendChild(el);
  }

  // LN column
  dom.lnItems.innerHTML = "";
  dom.lnCount.textContent = `${lnGroups.filter(g=>g.lnTitle).length} ch.`;

  for (const g of lnGroups) {
    const color  = keyColor[g.key];
    const isNone = !g.lnTitle;
    const lDup   = (lnTC[g.lnTitle]||0) > 1;

    const el = document.createElement("div");
    el.className = `map-item ln-item${isNone?" no-mapping":""}`;
    el.dataset.key = g.key;
    el.style.setProperty("--item-color", color);
    el.innerHTML = `
      <div class="item-seq">${g.lnSeq?`#${esc(String(g.lnSeq))}`:isNone?"—":""}</div>
      <div class="item-title">${esc(g.lnTitle||"(no LN mapping)")}${lDup?`<span class="dup-badge ln">×${lnTC[g.lnTitle]}</span>`:""}</div>
      ${g.lnVolume?`<div class="item-vol">Vol ${esc(g.lnVolume)}</div>`:""}
      <div class="item-count">${g.rows.length} manga ch.</div>
    `;
    if (!isNone) {
      el.addEventListener("click", () => {
        if (state.focusedLnKey === g.key) {
          state.focusedLnKey = null;
          dom.focusBar.classList.add("hidden");
        } else {
          state.focusedLnKey = g.key;
          dom.focusName.textContent = g.lnTitle;
          dom.focusBar.classList.remove("hidden");
        }
        applyMapFocus();
        drawConnections();
        clearMapSelection();
        el.classList.add("active");
        showLnGroupDetail(g);
      });
      el.addEventListener("mouseenter", () => highlightConnections(g.key));
      el.addEventListener("mouseleave", resetHighlight);
    }
    dom.lnItems.appendChild(el);
  }

  dom.mangaItems._keyColor = keyColor;
  dom.lnItems._lnGroups    = lnGroups;

  applyMapFocus();
  requestAnimationFrame(() => requestAnimationFrame(drawConnections));
}

function clearMapSelection() {
  document.querySelectorAll(".map-item.active, tr.selected-row").forEach(el =>
    el.classList.remove("active","selected-row")
  );
}

function highlightConnections(targetKey) {
  dom.connectorSvg.querySelectorAll(".conn-line").forEach(l => {
    l.classList.toggle("highlighted", l.dataset.key === targetKey);
    l.classList.toggle("faded",       l.dataset.key !== targetKey);
  });
  document.querySelectorAll(".map-item").forEach(el => {
    el.style.opacity = el.dataset.key === targetKey ? "1" : "0.28";
  });
}

function resetHighlight() {
  dom.connectorSvg.querySelectorAll(".conn-line").forEach(l => l.classList.remove("highlighted","faded"));
  document.querySelectorAll(".map-item").forEach(el => { el.style.opacity = ""; });
}

function applyMapFocus() {
  const key = state.focusedLnKey;
  document.querySelectorAll(".map-item").forEach(el =>
    el.classList.toggle("faded", !!key && el.dataset.key !== key)
  );
}

function drawConnections() {
  const svg = dom.connectorSvg;
  svg.innerHTML = "";

  const mangaEls = dom.mangaItems.querySelectorAll(".map-item");
  const lnElMap  = {};
  dom.lnItems.querySelectorAll(".map-item.ln-item:not(.no-mapping)").forEach(el => { lnElMap[el.dataset.key] = el; });
  const keyColor = dom.mangaItems._keyColor || {};

  if (!mangaEls.length) return;

  const connRect   = dom.connectorArea.getBoundingClientRect();
  const layoutRect = $("mapLayout").getBoundingClientRect();
  const svgW       = connRect.width;
  const svgH       = layoutRect.height;

  svg.setAttribute("viewBox", `0 0 ${svgW} ${svgH}`);
  svg.setAttribute("width",  svgW);
  svg.setAttribute("height", svgH);

  mangaEls.forEach(mEl => {
    const key   = mEl.dataset.key;
    const lnEl  = lnElMap[key];
    if (!lnEl) return;

    const color  = keyColor[key] || "#b5a898";
    const mRect  = mEl.getBoundingClientRect();
    const lRect  = lnEl.getBoundingClientRect();
    const y1     = mRect.top + mRect.height / 2 - connRect.top;
    const y2     = lRect.top + lRect.height / 2 - connRect.top;
    const cp     = svgW * 0.45;
    const d      = `M 0,${y1} C ${cp},${y1} ${svgW-cp},${y2} ${svgW},${y2}`;

    const path = document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("d", d);
    path.setAttribute("stroke", color);
    path.classList.add("conn-line");
    path.dataset.key = key;
    svg.appendChild(path);
  });
}

// ── TABLE VIEW ───────────────────────────────────────────
function renderTableView(rows) {
  if ((dom.tableGroup.value || state.tableGroup) === "ln") renderLnGroupTable(rows);
  else renderChapterTable(rows);
}

function renderChapterTable(rows) {
  dom.tableHead.innerHTML = `<tr><th>#</th><th>Manga vol</th><th>Manga chapter</th><th>LN vol</th><th>LN chapter</th></tr>`;
  dom.tableBody.innerHTML = "";

  if (!rows.length) {
    dom.tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No chapters match.</td></tr>`;
    return;
  }
  const mangaTC = buildCounts(rows, r => r[C.title]||"");
  const lnTC    = buildCounts(rows, r => r[C.lnTitle]||"");

  rows.forEach(row => {
    const tr = document.createElement("tr");
    const mDup = (mangaTC[row[C.title]]||0) > 1;
    const lDup = row[C.lnTitle] && (lnTC[row[C.lnTitle]]||0) > 1;
    tr.innerHTML = `
      <td>${esc(row[C.seq])}</td>
      <td>${esc(row[C.volume]||"—")}</td>
      <td>${esc(row[C.title]||"—")}${mDup?`<span class="dup-badge manga">×${mangaTC[row[C.title]]}</span>`:""}</td>
      <td>${esc(row[C.lnVolume]||"—")}</td>
      <td>${esc(row[C.lnTitle]||"—")}${lDup?`<span class="dup-badge ln">×${lnTC[row[C.lnTitle]]}</span>`:""}</td>
    `;
    tr.addEventListener("click", () => {
      clearMapSelection();
      tr.classList.add("selected-row");
      showDetail(row, mangaTC, lnTC);
    });
    dom.tableBody.appendChild(tr);
  });
}

function renderLnGroupTable(rows) {
  dom.tableHead.innerHTML = `<tr><th>#</th><th>LN vol</th><th>LN chapter</th><th>Manga chapters</th><th>Seq range</th></tr>`;
  dom.tableBody.innerHTML = "";

  const groupsMap = new Map();
  for (const row of rows) {
    const key = lnKey(row);
    if (!groupsMap.has(key)) groupsMap.set(key, { lnTitle: row[C.lnTitle]||"", lnVolume: row[C.lnVolume]||"", lnSeq: Number(row[C.lnSeq]||0), rows: [], seqs: [] });
    const g = groupsMap.get(key);
    g.rows.push(row);
    const s = Number(row[C.seq]||0);
    if (!isNaN(s)) g.seqs.push(s);
  }

  const groups = [...groupsMap.values()].sort((a,b) => (!a.lnTitle?1:!b.lnTitle?-1:a.lnSeq-b.lnSeq));
  if (!groups.length) { dom.tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No data.</td></tr>`; return; }

  groups.forEach((g, i) => {
    g.seqs.sort((a,b)=>a-b);
    const range = !g.seqs.length?"—":g.seqs.length===1?`#${g.seqs[0]}`:`#${g.seqs[0]}–${g.seqs[g.seqs.length-1]}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td>${esc(g.lnVolume||"—")}</td><td>${esc(g.lnTitle||"(no mapping)")}</td><td>${g.rows.length}</td><td>${range}</td>`;
    tr.addEventListener("click", () => {
      clearMapSelection();
      tr.classList.add("selected-row");
      showLnGroupDetail(g);
    });
    dom.tableBody.appendChild(tr);
  });
}

function buildCounts(rows, fn) {
  const c = {};
  rows.forEach(r => { const k = fn(r); c[k] = (c[k]||0)+1; });
  return c;
}

// ── MODAL ────────────────────────────────────────────────
function openModal() {
  dom.noScriptWarn.classList.toggle("hidden", !!CONFIG.APPS_SCRIPT_URL);
  dom.submitStatus.textContent = "";
  dom.submitStatus.className   = "submit-status";
  dom.submitBtn.disabled       = false;

  // Pre-fill series
  const f = $("f-franchise");
  if (f && state.currentSeries && !f.value) f.value = state.currentSeries;

  dom.modalOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(() => $("f-franchise")?.focus(), 50);
}

function closeModal() {
  dom.modalOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}

// ── SINGLE SUBMIT ────────────────────────────────────────
async function handleSingleSubmit(e) {
  e.preventDefault();
  if (!dom.addForm.checkValidity()) { dom.addForm.reportValidity(); return; }

  const entry = buildEntry({
    franchise: $("f-franchise").value.trim(),
    mangaVol:  $("f-manga-vol").value.trim(),
    mangaSeq:  $("f-manga-seq").value.trim(),
    mangaTitle:$("f-manga-title").value.trim(),
    lnVol:     $("f-ln-vol").value.trim(),
    lnSeq:     $("f-ln-seq").value.trim(),
    lnTitle:   $("f-ln-title").value.trim(),
    notes:     $("f-notes").value.trim(),
  });

  if (!CONFIG.APPS_SCRIPT_URL) {
    dom.submitStatus.textContent = "⚠ No Apps Script URL. See SETUP.md.";
    dom.submitStatus.className   = "submit-status error";
    return;
  }

  dom.submitBtn.disabled       = true;
  dom.submitStatus.textContent = "Submitting…";
  dom.submitStatus.className   = "submit-status";

  const ok = await postToSheet([entry]);
  if (ok) {
    dom.submitStatus.textContent = "✓ Entry submitted! Reload to see it.";
    dom.submitStatus.className   = "submit-status success";
    dom.addForm.reset();
  } else {
    dom.submitStatus.textContent = "✗ Submission failed. Check console.";
    dom.submitStatus.className   = "submit-status error";
  }
  dom.submitBtn.disabled = false;
}

// ── MASS IMPORT ──────────────────────────────────────────
const MASS_COL_LABELS = ["Franchise","Format1","Volume","Seq #","Chapter Title","Format2","LN Volume","LN Seq #","LN Title","Notes"];
let parsedMassRows = [];

function parseMassInput() {
  const raw   = dom.massInput.value.trim();
  if (!raw)   { alert("Paste some data first."); return; }

  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  let rows    = lines.map(l => l.split("\t"));

  // Skip header row if first row doesn't look numeric in col 3 (seq #)
  if (rows.length > 1) {
    const firstSeq = rows[0][3]?.trim() || "";
    if (isNaN(Number(firstSeq))) rows = rows.slice(1);
  }

  parsedMassRows = rows.filter(r => r.length >= 3 && r.some(c => c.trim()));

  if (!parsedMassRows.length) {
    alert("No valid rows detected. Make sure data is tab-separated.");
    return;
  }

  // Build preview table
  dom.massPreviewHead.innerHTML = `<tr>${MASS_COL_LABELS.map(l=>`<th>${l}</th>`).join("")}</tr>`;
  dom.massPreviewBody.innerHTML = parsedMassRows.map(r =>
    `<tr>${Array.from({length:10},(_,i)=>`<td>${esc(r[i]||"")}</td>`).join("")}</tr>`
  ).join("");

  dom.massPreviewCount.textContent = `${parsedMassRows.length} row${parsedMassRows.length!==1?"s":""} ready`;
  dom.massPreview.classList.remove("hidden");
  dom.massSubmitBtn.disabled = !parsedMassRows.length;
}

function clearMassPreview() {
  parsedMassRows = [];
  dom.massInput.value = "";
  dom.massPreview.classList.add("hidden");
  dom.massSubmitBtn.disabled = true;
  dom.massSubmitStatus.textContent = "";
}

async function handleMassSubmit() {
  if (!parsedMassRows.length) return;

  if (!CONFIG.APPS_SCRIPT_URL) {
    dom.massSubmitStatus.textContent = "⚠ No Apps Script URL. See SETUP.md.";
    dom.massSubmitStatus.className   = "submit-status error";
    return;
  }

  dom.massSubmitBtn.disabled         = true;
  dom.massSubmitStatus.textContent   = `Submitting ${parsedMassRows.length} rows…`;
  dom.massSubmitStatus.className     = "submit-status";

  // Convert raw column array to entry objects
  const entries = parsedMassRows.map(r => buildEntry({
    franchise:  r[0]||"",
    mangaVol:   r[2]||"",
    mangaSeq:   r[3]||"",
    mangaTitle: r[4]||"",
    lnVol:      r[6]||"",
    lnSeq:      r[7]||"",
    lnTitle:    r[8]||"",
    notes:      r[9]||"",
  }));

  const ok = await postToSheet(entries);
  if (ok) {
    dom.massSubmitStatus.textContent = `✓ ${entries.length} rows submitted! Reload to see them.`;
    dom.massSubmitStatus.className   = "submit-status success";
    clearMassPreview();
  } else {
    dom.massSubmitStatus.textContent = "✗ Submission failed. Check console.";
    dom.massSubmitStatus.className   = "submit-status error";
    dom.massSubmitBtn.disabled = false;
  }
}

function buildEntry({ franchise, mangaVol, mangaSeq, mangaTitle, lnVol, lnSeq, lnTitle, notes }) {
  return {
    [C.franchise]: franchise,
    [C.format1]:   "manga",
    [C.volume]:    mangaVol,
    [C.seq]:       mangaSeq,
    [C.title]:     mangaTitle,
    [C.format2]:   "LN",
    [C.lnVolume]:  lnVol,
    [C.lnSeq]:     lnSeq,
    [C.lnTitle]:   lnTitle,
    [C.notes]:     notes,
  };
}

// Post one or many entries to Apps Script
async function postToSheet(entries) {
  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST",
      mode:   "no-cors",
      body:   new URLSearchParams({ data: JSON.stringify(entries) }),
    });
    return true;
  } catch (err) {
    console.error("postToSheet error:", err);
    return false;
  }
}
