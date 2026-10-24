// ================= helpers =================

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fmtMoney = (v) => {
  if (v == null || Number.isNaN(v)) return "–";
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${Math.round(v / 1e3)}k`;
  return `$${Math.round(v)}`;
};
const fmtFull = (v) => (v == null ? "–" : `$${Math.round(v).toLocaleString()}`);
const fmtNum = (v) => (v == null ? "–" : Math.round(v).toLocaleString());
const fmtPsf = (v) => (v == null ? "–" : `$${Math.round(v).toLocaleString()}`);
const fmtPct = (v) => (v == null || !Number.isFinite(v) ? "–" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);
const fmtMonth = (m) => {
  if (!m) return "–";
  const [y, mo] = m.split("-");
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+mo - 1]} ${y}`;
};
const titleCase = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/(^|[\s/(-])([a-z])/g, (_, p, c) => p + c.toUpperCase());
const blockLabel = (unitId) => {
  const [block, street] = unitId.split("|");
  return `Blk ${block} ${titleCase(street)}`;
};
const deltaTag = (ratio) => {
  if (ratio == null || !Number.isFinite(ratio)) return "";
  return `<span class="delta ${ratio >= 0 ? "up" : "down"}">${ratio >= 0 ? "▲" : "▼"} ${fmtPct(ratio).replace(/^[+-]/, "")}</span>`;
};
const debounce = (fn, ms) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

// ================= otters =================

const OTTER = { fur: "#7a5236", dark: "#5e3b25", belly: "#ecd3b2", ink: "#1f1a1b" };
const OTTER_ICON = `<img src="/static/otter.svg" width="28" height="28" alt="" style="vertical-align:middle;margin-right:8px">`;

// Origin is between the otter's feet; it stands ~32 units tall at scale 1.
function standingOtter(x, y, scale = 1, cls = "otter-bob") {
  return `<g transform="translate(${x},${y}) scale(${scale})"><g class="${cls}">
    <path d="M5 -2 Q15 0 19 -7" stroke="${OTTER.fur}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="0" cy="-12" rx="7" ry="11" fill="${OTTER.fur}"/>
    <ellipse cx="0" cy="-10" rx="4.6" ry="8" fill="${OTTER.belly}"/>
    <ellipse cx="-3.2" cy="-0.8" rx="2.8" ry="1.3" fill="${OTTER.dark}"/>
    <ellipse cx="3.2" cy="-0.8" rx="2.8" ry="1.3" fill="${OTTER.dark}"/>
    <circle cx="-1.7" cy="-15.5" r="1.7" fill="${OTTER.dark}"/>
    <circle cx="1.7" cy="-15.5" r="1.7" fill="${OTTER.dark}"/>
    <circle cx="-5.6" cy="-27.6" r="1.4" fill="${OTTER.fur}"/>
    <circle cx="5.6" cy="-27.6" r="1.4" fill="${OTTER.fur}"/>
    <ellipse cx="0" cy="-24.6" rx="7" ry="6" fill="${OTTER.fur}"/>
    <ellipse cx="0" cy="-22.4" rx="4.6" ry="3" fill="${OTTER.belly}"/>
    <ellipse cx="0" cy="-23.9" rx="1.4" ry="1" fill="${OTTER.ink}"/>
    <circle cx="-2.6" cy="-26.6" r="1" fill="${OTTER.ink}"/>
    <circle cx="2.6" cy="-26.6" r="1" fill="${OTTER.ink}"/>
    <path d="M-3.5 -22.5 l-5 -1 M-3.5 -21.6 l-5 0.4 M3.5 -22.5 l5 -1 M3.5 -21.6 l5 0.4" stroke="${OTTER.dark}" stroke-width="0.45"/>
  </g></g>`;
}

// Otter floating on its back holding a pebble; origin is at the water line.
function floatingOtter(x, y, scale = 1) {
  return `<g transform="translate(${x},${y}) scale(${scale})"><g class="otter-float">
    <path d="M14 -1 Q21 1 26 -3" stroke="${OTTER.fur}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="0" cy="-2" rx="15" ry="5.5" fill="${OTTER.fur}"/>
    <ellipse cx="1" cy="-4.2" rx="11" ry="3.2" fill="${OTTER.belly}"/>
    <ellipse cx="12.5" cy="-7.5" rx="1.5" ry="2.6" transform="rotate(-20 12.5 -7.5)" fill="${OTTER.dark}"/>
    <ellipse cx="15.5" cy="-6.5" rx="1.5" ry="2.6" transform="rotate(-35 15.5 -6.5)" fill="${OTTER.dark}"/>
    <ellipse cx="-2.5" cy="-9" rx="2.4" ry="1.7" fill="#b9b0a8"/>
    <circle cx="-4.2" cy="-7.4" r="1.5" fill="${OTTER.dark}"/>
    <circle cx="-0.8" cy="-7.4" r="1.5" fill="${OTTER.dark}"/>
    <circle cx="-19.5" cy="-6.5" r="1.7" fill="${OTTER.fur}"/>
    <circle cx="-15" cy="-5" r="5.6" fill="${OTTER.fur}"/>
    <ellipse cx="-15.8" cy="-8.4" rx="3.1" ry="2.1" fill="${OTTER.belly}"/>
    <ellipse cx="-16.4" cy="-9.8" rx="1.1" ry="0.8" fill="${OTTER.ink}"/>
    <circle cx="-12.4" cy="-7" r="0.85" fill="${OTTER.ink}"/>
    <path d="M-24 1 q4 -2 8 0 M18 2 q4 -2 8 0" stroke="#fff" stroke-width="1" fill="none" opacity=".8"/>
  </g></g>`;
}

async function api(path, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
    else if (v !== "" && v != null) qs.set(k, v);
  }
  const res = await fetch(`${path}${qs.toString() ? `?${qs}` : ""}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { body });
  return body;
}

function withLoading(el, promise) {
  el.classList.add("loading");
  return promise.finally(() => el.classList.remove("loading"));
}

// ================= charts =================

const PALETTE = ["#c8102e", "#1f1a1b", "#f26b7a", "#8b0a1f", "#9a8f90", "#ff8c42", "#5b6c8f", "#f4a3ab"];
const charts = {};

Chart.defaults.font.family = '"Plus Jakarta Sans", system-ui, sans-serif';
Chart.defaults.color = "#6f6466";
Chart.defaults.borderColor = "#f3e6e8";
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.boxHeight = 10;
Chart.defaults.plugins.tooltip.backgroundColor = "#1f1a1b";
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.elements.line.borderWidth = 2.5;
Chart.defaults.elements.point.radius = 0;
Chart.defaults.elements.point.hoverRadius = 5;
Chart.defaults.interaction = { mode: "index", intersect: false };

function drawChart(id, config) {
  charts[id]?.destroy();
  charts[id] = new Chart(document.getElementById(id), config);
  return charts[id];
}

const moneyAxis = { ticks: { callback: (v) => fmtMoney(v) } };
const psfAxis = { ticks: { callback: (v) => `$${v}` } };
const metricAxis = (metric) => (metric === "count" ? {} : metric.includes("psf") ? psfAxis : moneyAxis);
const metricFmt = (metric) => (metric === "count" ? fmtNum : metric.includes("psf") ? fmtPsf : fmtFull);

// ================= routing =================

const state = { meta: null, loaded: {} };
// Page sections top to bottom; Building + Map is the hero, the rest scroll beneath it.
const SECTIONS = ["building", "overview", "towns", "livability", "insights", "explore", "model"];
const LOADERS = {
  overview: loadOverview,
  map: loadMap,
  livability: loadLivability,
  model: loadModel,
  explore: initExplore,
  towns: loadTowns,
  insights: loadInsights,
};

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function loadOnce(name) {
  if (state.loaded[name] || !LOADERS[name]) return;
  state.loaded[name] = true;
  LOADERS[name]();
}

function route() {
  let [tab, kind, ...rest] = location.hash.replace(/^#/, "").split("/");
  // Analyse sub-tabs and the Map tab used to be separate pages; keep their old links working.
  if (tab === "analyse") tab = SECTIONS.includes(kind) ? kind : "explore";
  if (tab === "map") tab = "building";
  if (tab === "correlations") tab = "insights";
  if (!SECTIONS.includes(tab)) return;

  if (tab === "building") {
    if (kind) {
      const value = decodeURIComponent(rest.join("/"));
      loadBuilding(kind === "postal" ? { postal: value } : { unit_id: value });
    }
    window.scrollTo({ top: 0 });
  } else {
    loadOnce(tab);
    jumpTo($(`#view-${tab}`));
  }
}

// Sections above the target may still be loading and growing, so keep the target
// in place while the page settles, until the user scrolls themselves.
function jumpTo(el) {
  el.scrollIntoView({ block: "start" });
  const done = new AbortController();
  const resize = new ResizeObserver(() => el.scrollIntoView({ block: "start" }));
  const stop = () => {
    resize.disconnect();
    done.abort();
  };
  resize.observe($("main"));
  ["wheel", "touchstart", "keydown", "mousedown"].forEach((ev) =>
    window.addEventListener(ev, stop, { passive: true, signal: done.signal })
  );
  setTimeout(stop, 4000);
}

// Sections load as they come near the screen.
function watchSections() {
  const lazy = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && loadOnce(e.target.id.replace(/^view-/, ""))),
    { rootMargin: "600px 0px" }
  );
  SECTIONS.forEach((name) => lazy.observe($(`#view-${name}`)));
  const toTop = $("#to-top");
  window.addEventListener("scroll", () => toTop.classList.toggle("show", window.scrollY > window.innerHeight), { passive: true });
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function syncHeaderHeight() {
  document.documentElement.style.setProperty("--header-h", `${$(".topbar").offsetHeight}px`);
}

function openBlock(unitId) {
  go(`#building/unit/${encodeURIComponent(unitId)}`);
}

function openPostal(postal) {
  go(`#building/postal/${postal}`);
}

// ================= overview =================

async function loadOverview() {
  const data = await withLoading($("#overview-kpis"), api("/api/overview"));
  const { current: cur, previous: prev, record } = data;
  $("#overview-subtitle").textContent = `Last 12 months (${fmtMonth(data.window.from)} – ${fmtMonth(data.window.to)}) compared with the 12 months before. Latest data: ${fmtMonth(data.latest_month)}.`;

  $("#overview-kpis").innerHTML = `
    <div class="kpi hero">
      <div class="label">Median resale price</div>
      <div class="value">${fmtFull(cur.median_price)}</div>
      <div class="sub">${deltaTag(cur.median_price / prev.median_price - 1)} vs prior 12 mo</div>
    </div>
    <div class="kpi">
      <div class="label">Median $ psf</div>
      <div class="value">${fmtPsf(cur.median_psf)}</div>
      <div class="sub">${deltaTag(cur.median_psf / prev.median_psf - 1)} vs prior 12 mo</div>
    </div>
    <div class="kpi">
      <div class="label">Resales</div>
      <div class="value">${fmtNum(cur.count)}</div>
      <div class="sub">${deltaTag(cur.count / prev.count - 1)} vs prior 12 mo</div>
    </div>
    <div class="kpi">
      <div class="label">$1M+ flats</div>
      <div class="value">${fmtNum(cur.million_count)}</div>
      <div class="sub">${fmtNum(prev.million_count)} in prior 12 mo</div>
    </div>
    <div class="kpi" style="cursor:pointer" data-unit="${esc(record.unit_id)}">
      <div class="label">All-time record</div>
      <div class="value">${fmtMoney(record.resale_price)}</div>
      <div class="sub">${esc(blockLabel(record.unit_id))} · ${fmtMonth(record.month)}</div>
    </div>`;
  $("#overview-kpis [data-unit]").addEventListener("click", (e) => openBlock(e.currentTarget.dataset.unit));

  const drawMonthly = (metric) => {
    drawChart("chart-monthly", {
      type: metric === "count" ? "bar" : "line",
      data: {
        labels: data.monthly.map((r) => fmtMonth(r.month)),
        datasets: [
          {
            label: { median_price: "Median price", median_psf: "Median $ psf", count: "Resales" }[metric],
            data: data.monthly.map((r) => r[metric]),
            borderColor: "#c8102e",
            backgroundColor: metric === "count" ? "#f26b7a" : "rgba(200,16,46,0.08)",
            fill: metric !== "count",
            tension: 0.3,
            borderRadius: 3,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => metricFmt(metric)(c.parsed.y) } } },
        scales: { y: metricAxis(metric), x: { ticks: { maxTicksLimit: 10 } } },
      },
    });
  };
  bindSegmented("#overview-monthly-metric", drawMonthly);
  drawMonthly("median_price");

  const years = [...new Set(data.yearly_by_type.map((r) => r.year))];
  const types = [...new Set(data.yearly_by_type.map((r) => r.flat_type))];
  const lookup = new Map(data.yearly_by_type.map((r) => [`${r.year}|${r.flat_type}`, r]));
  drawChart("chart-by-type", {
    type: "line",
    data: {
      labels: years,
      datasets: types.map((t, i) => ({
        label: titleCase(t),
        data: years.map((y) => {
          const r = lookup.get(`${y}|${t}`);
          return r && r.count >= 10 ? r.median_price : null;
        }),
        borderColor: PALETTE[i % PALETTE.length],
        backgroundColor: PALETTE[i % PALETTE.length],
        tension: 0.3,
        spanGaps: true,
      })),
    },
    options: {
      plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtFull(c.parsed.y)}` } } },
      scales: { y: moneyAxis },
    },
  });

  drawChart("chart-volume", {
    data: {
      labels: data.yearly_volume.map((r) => r.year),
      datasets: [
        { type: "bar", label: "Resales", data: data.yearly_volume.map((r) => r.count), backgroundColor: "#f8c5cb", borderRadius: 4, yAxisID: "y" },
        { type: "line", label: "$1M+ flats", data: data.yearly_volume.map((r) => r.million_count), borderColor: "#c8102e", backgroundColor: "#c8102e", yAxisID: "y1", tension: 0.3 },
      ],
    },
    options: {
      scales: {
        y: { position: "left", title: { display: true, text: "Resales" } },
        y1: { position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "$1M+ flats" } },
      },
    },
  });

  $("#table-top-recent").innerHTML = `
    <thead><tr><th>Month</th><th>Block</th><th>Type</th><th>Storey</th><th class="num">Price</th><th class="num">$ psf</th></tr></thead>
    <tbody>${data.top_recent
      .map(
        (r) => `<tr class="clickable" data-unit="${esc(r.unit_id)}">
          <td>${fmtMonth(r.month)}</td><td>${esc(blockLabel(r.unit_id))}<div class="muted small">${esc(r.town)}</div></td>
          <td>${esc(titleCase(r.flat_type))}</td><td>${esc(r.storey_range)}</td>
          <td class="num price">${fmtFull(r.resale_price)}</td><td class="num">${fmtPsf(r.price_psf)}</td></tr>`
      )
      .join("")}</tbody>`;
  bindRowClicks("#table-top-recent");
}

function bindSegmented(selector, onChange) {
  const root = $(selector);
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    $$("button", root).forEach((b) => b.classList.toggle("active", b === btn));
    onChange(btn.dataset.value);
  });
}

function bindRowClicks(selector) {
  $(selector).addEventListener("click", (e) => {
    const row = e.target.closest("[data-unit]");
    if (row) openBlock(row.dataset.unit);
  });
}

// ================= building =================

const building = {
  period: "5",
  flatType: "",
  metric: "price",
  split: true,
  selectedBand: null,
  selectedType: null,
  noAnim: false,
  data: null,
  lastQuery: null,
};

function initBuildingSearch() {
  const form = $("#building-search");
  const input = $("#building-search-input");
  const box = $("#building-suggestions");
  let results = [];
  let active = -1;

  const render = () => {
    box.innerHTML = results
      .map(
        (r, i) => `<div data-i="${i}" class="${i === active ? "active" : ""}">
          <span>${esc(blockLabel(r.unit_id))}</span>
          <span class="muted small">${esc([r.postal_code, r.town].filter(Boolean).join(" · "))}</span></div>`
      )
      .join("");
    box.classList.toggle("open", results.length > 0);
  };

  const search = debounce(async (q) => {
    if (q.trim().length < 2) {
      results = [];
      return render();
    }
    try {
      results = (await api("/api/search", { q })).results;
    } catch {
      results = [];
    }
    active = -1;
    render();
  }, 180);

  input.addEventListener("input", () => search(input.value));
  input.addEventListener("keydown", (e) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") active = Math.min(active + 1, results.length - 1);
    else if (e.key === "ArrowUp") active = Math.max(active - 1, 0);
    else if (e.key === "Escape") results = [];
    else return;
    e.preventDefault();
    render();
  });
  input.addEventListener("blur", () => setTimeout(() => box.classList.remove("open"), 150));
  box.addEventListener("mousedown", (e) => {
    const item = e.target.closest("[data-i]");
    if (!item) return;
    const r = results[+item.dataset.i];
    box.classList.remove("open");
    input.value = blockLabel(r.unit_id);
    openBlock(r.unit_id);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    box.classList.remove("open");
    if (active >= 0 && results[active]) return openBlock(results[active].unit_id);
    if (/^\d{6}$/.test(q)) return openPostal(q);
    if (results[0]) return openBlock(results[0].unit_id);
    showBuildingError("Type a 6-digit postal code, or pick an address from the suggestions.");
  });

  $("#header-search").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#header-search-input").value.trim();
    if (/^\d{6}$/.test(q)) openPostal(q);
    else {
      go("#building");
      input.value = q;
      input.focus();
      search(q);
    }
  });
}

function showBuildingError(message, candidates = []) {
  const box = $("#building-error");
  box.innerHTML = message
    ? `<div class="error-box">${OTTER_ICON}${esc(message)}${
        candidates.length
          ? `<div class="chips" style="margin-top:10px">${candidates
              .map((u) => `<button class="chip" data-unit="${esc(u)}">${esc(blockLabel(u))}</button>`)
              .join("")}</div>`
          : ""
      }</div>`
    : "";
  box.onclick = (e) => {
    const chip = e.target.closest("[data-unit]");
    if (chip) openBlock(chip.dataset.unit);
  };
}

async function loadBuilding(query) {
  if (building.autoPeriodUnit && query.unit_id !== building.autoPeriodUnit) {
    building.period = building.periodBeforeAuto;
    building.autoPeriodUnit = null;
  }
  building.lastQuery = query;
  building.selectedBand = null;
  building.selectedType = null;
  showBuildingError("");
  const content = $("#building-content");
  try {
    const data = await withLoading(
      content,
      api("/api/block", { ...query, period: building.period, flat_type: building.flatType })
    );
    if (building.lastQuery !== query) return;
    if (!data.summary.count && data.yearly.length && building.period !== "all") {
      building.periodBeforeAuto = building.period;
      building.autoPeriodUnit = data.unit_id;
      building.period = "all";
      return loadBuilding({ unit_id: data.unit_id });
    }
    building.data = data;
    $("#building-search-input").value = query.postal || blockLabel(data.unit_id);
    renderBuilding();
  } catch (err) {
    showBuildingError(err.message, err.body?.candidates);
  }
}

function refetchBuilding() {
  if (building.data) loadBuilding({ unit_id: building.data.unit_id });
}

const COLOR_STOPS = ["#ffe3e6", "#f26b7a", "#c8102e", "#6e0618"];

function lerpColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift) => Math.round(((pa >> shift) & 255) + (((pb >> shift) & 255) - ((pa >> shift) & 255)) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function colorScale(t) {
  const x = Math.max(0, Math.min(1, t)) * (COLOR_STOPS.length - 1);
  const i = Math.min(Math.floor(x), COLOR_STOPS.length - 2);
  return lerpColor(COLOR_STOPS[i], COLOR_STOPS[i + 1], x - i);
}

function bandValue(band) {
  return building.metric === "psf" ? band.median_psf : band.median_price;
}

function renderBuilding() {
  const d = building.data;
  const info = d.info || {};
  const currentYear = +d.latest_month.slice(0, 4);
  const leaseLeft = d.listed && d.lease_commence_date ? 99 - (currentYear - d.lease_commence_date) : null;
  const psfVsTown = d.summary.median_psf && d.town_median_psf ? d.summary.median_psf / d.town_median_psf - 1 : null;
  const geo = d.geocode && d.geocode.geocode_status === "ok" ? d.geocode : null;

  const flags = [
    ["commercial", "Shops"],
    ["market_hawker", "Market / hawker"],
    ["multistorey_carpark", "MSCP"],
    ["precinct_pavilion", "Pavilion"],
  ]
    .filter(([k]) => info[k] === "Y")
    .map(([, label]) => `<span class="tag grey">${label}</span>`)
    .join("");

  const typeOptions = d.type_mix.map((t) => `<option value="${esc(t.flat_type)}" ${t.flat_type === building.flatType ? "selected" : ""}>${esc(titleCase(t.flat_type))}</option>`).join("");

  $("#building-content").innerHTML = `
    <div class="building-layout">
      <div class="card">
        <h1 class="block-title">Blk ${esc(d.block)} ${esc(titleCase(d.street_name))}</h1>
        <p class="block-sub">${esc(titleCase(d.town))}${geo?.postal_code ? ` · Singapore ${esc(geo.postal_code)}` : ""}</p>
        <div class="badges">
          ${d.listed ? "" : `<span class="tag grey">Not in current HDB register (likely redeveloped)</span>`}
          ${info.year_completed ? `<span class="tag">Built ${info.year_completed}</span>` : ""}
          ${info.max_floor_lvl ? `<span class="tag">${info.max_floor_lvl} storeys</span>` : ""}
          ${info.total_dwelling_units ? `<span class="tag">${info.total_dwelling_units} homes</span>` : ""}
          ${leaseLeft != null ? `<span class="tag">~${leaseLeft} yrs lease left</span>` : ""}
          ${flags}
        </div>
        <div class="stat-row">
          <div class="stat"><div class="label">Median price</div><div class="value">${fmtMoney(d.summary.median_price)}</div></div>
          <div class="stat"><div class="label">Median $ psf</div><div class="value">${fmtPsf(d.summary.median_psf)}</div>
            <div class="small muted">${psfVsTown == null ? "" : `${fmtPct(psfVsTown)} vs ${esc(titleCase(d.town))}`}</div></div>
          <div class="stat"><div class="label">Resales</div><div class="value">${fmtNum(d.summary.count)}</div>
            <div class="small muted">${d.period === "all" ? "all time" : `last ${d.period} yr${d.period === "1" ? "" : "s"}`}</div></div>
        </div>
        ${estimateLineHtml(d)}
        ${unitMixHtml(info)}
        ${geo ? `<p class="small" style="margin: 12px 0 0">
          <a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${geo.latitude},${geo.longitude}">Google Maps ↗</a>
          &nbsp;·&nbsp;<a class="link" target="_blank" rel="noopener" href="https://www.onemap.gov.sg/?lat=${geo.latitude}&lng=${geo.longitude}">OneMap ↗</a></p>` : ""}
      </div>
      <div class="card flush stage-card">
        <div class="stage">
          <div class="stage-controls">
            <div class="segmented" id="bld-period">
              ${["1", "3", "5", "10", "all"].map((p) => `<button data-value="${p}" class="${p === building.period ? "active" : ""}">${p === "all" ? "All" : `${p}Y`}</button>`).join("")}
            </div>
            <select class="inline" id="bld-type"><option value="">All flat types</option>${typeOptions}</select>
            <div class="segmented" id="bld-metric">
              <button data-value="price" class="${building.metric === "price" ? "active" : ""}">Price</button>
              <button data-value="psf" class="${building.metric === "psf" ? "active" : ""}">$ psf</button>
            </div>
            ${
              d.layout?.length
                ? `<div class="segmented" id="bld-split">
                    <button data-value="whole" class="${building.split ? "" : "active"}">Whole floor</button>
                    <button data-value="split" class="${building.split ? "active" : ""}">By unit type</button>
                  </div>`
                : ""
            }
          </div>
          <div id="bld-svg"></div>
          <div class="legend" id="bld-legend"></div>
        </div>
      </div>
      <div class="card flush">
        <div class="card-head" style="padding: 18px 18px 0"><h3>Price by floor</h3>
          <span class="muted small">${d.hidden_band_count ? `${d.hidden_band_count} sales in older overlapping bands hidden` : "Click a row to filter the sales below"}</span></div>
        <div class="table-wrap"><table id="bld-bands"></table></div>
      </div>
      <div class="card flush">
        <div class="card-head" style="padding: 18px 18px 0"><h3 id="bld-recent-title">Recent resales</h3>
          <button class="btn ghost" id="bld-clear-band" style="display:none">Show all floors</button></div>
        <div class="table-wrap" style="max-height: 380px; overflow-y: auto"><table id="bld-recent"></table></div>
      </div>
      ${valueCardHtml(d)}
      <div class="card" id="bld-payment"></div>
      <div class="card" id="bld-places"></div>
      <div class="card" id="bld-liv"></div>
      <div class="card">
        <div class="card-head"><h3>This block's median price by year</h3></div>
        <div class="chart" style="height: 220px"><canvas id="chart-block-trend"></canvas></div>
      </div>
      <div class="card">
        <h3>Blocks next door</h3>
        <div class="chips" id="bld-nearby">${
          d.nearby.length
            ? d.nearby.map((n) => `<button class="chip" data-unit="${esc(n.unit_id)}">${esc(blockLabel(n.unit_id))} <span class="muted">${n.distance_m}m</span></button>`).join("")
            : `<span class="muted small">Nearby blocks appear once this area has been geocoded.</span>`
        }</div>
        <h3 style="margin-top: 20px">Flat types sold here (all time)</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Type</th><th class="num">Resales</th><th class="num">Median price</th></tr></thead>
          <tbody>${d.type_mix.map((t) => `<tr><td>${esc(titleCase(t.flat_type))}</td><td class="num">${fmtNum(t.count)}</td><td class="num">${fmtFull(t.median_price)}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">No resales on record yet</td></tr>`}</tbody>
        </table></div>
      </div>
    </div>`;
  renderBlockLivability(d);
  renderPlaces(d);
  renderPayment(d, leaseLeft);
  if (geo) focusMap(+geo.latitude, +geo.longitude);

  bindSegmented("#bld-period", (v) => {
    building.period = v;
    building.autoPeriodUnit = null;
    refetchBuilding();
  });
  bindSegmented("#bld-metric", (v) => {
    building.metric = v;
    building.noAnim = true;
    drawBuildingSvg();
    renderBandTable();
  });
  if ($("#bld-split")) {
    bindSegmented("#bld-split", (v) => {
      building.split = v === "split";
      if (!building.split) building.selectedType = null;
      drawBuildingSvg();
      renderRecent();
    });
  }
  $("#bld-type").addEventListener("change", (e) => {
    building.flatType = e.target.value;
    refetchBuilding();
  });
  $("#bld-nearby").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-unit]");
    if (chip) openBlock(chip.dataset.unit);
  });
  $("#bld-clear-band").addEventListener("click", () => selectBand(null));
  $$("[data-go-model]").forEach((a) => a.addEventListener("click", () => go("#model")));
  $$("[data-go-value]").forEach((a) => a.addEventListener("click", () => $("#bld-value").scrollIntoView({ behavior: "smooth", block: "start" })));

  drawBuildingSvg();
  renderBandTable();
  renderRecent();

  drawChart("chart-block-trend", {
    type: "line",
    data: {
      labels: d.yearly.map((r) => r.year),
      datasets: [
        {
          label: "Median price",
          data: d.yearly.map((r) => r.median_price),
          borderColor: "#c8102e",
          backgroundColor: "rgba(200,16,46,0.08)",
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${fmtFull(c.parsed.y)} (${d.yearly[c.dataIndex].count} sales)` } } },
      scales: { y: moneyAxis },
    },
  });
}

// The model's estimates grouped by flat type, each with its floor bands low to high and the middle one picked out.
function estimatesByType(d) {
  const p = d.prediction;
  if (!p) return [];
  const byType = {};
  p.rows.forEach((r) => (byType[r.flat_type] = byType[r.flat_type] || []).push(r));
  return Object.entries(byType).map(([type, bands]) => ({
    type,
    bands,
    mid: bands[Math.floor((bands.length - 1) / 2)],
    low: bands[0],
    high: bands[bands.length - 1],
    recent: p.recent[type],
  }));
}

function estimateLineHtml(d) {
  const est = estimatesByType(d);
  if (!est.length) return "";
  return `<p class="estimate-line">Estimated today: ${est
    .map((e) => `<span><b>${esc(TYPE_LABELS[e.type] || titleCase(e.type))}</b> ${fmtMoney(e.mid.pred_price)}</span>`)
    .join("")}<a class="link small" data-go-value>Details ↓</a></p>`;
}

// What the block's usual flat of each type is worth now, how floor changes it, and how real sales here compare.
function valueCardHtml(d) {
  const est = estimatesByType(d);
  if (!est.length) return "";
  const p = d.prediction;
  const rows = est
    .map(({ type, bands, mid, low, high, recent }) => {
      const vs = recent ? recent.vs_model : null;
      const verdict =
        vs == null ? "" : Math.abs(vs) < 0.02 ? "in line with estimate" : `${(Math.abs(vs) * 100).toFixed(0)}% ${vs > 0 ? "above" : "below"} estimate`;
      return `<tr>
        <td><b>${esc(titleCase(type))}</b><div class="muted small">${Math.round(mid.floor_area_sqm)} sqm · ${esc(mid.flat_model)}</div></td>
        <td class="num"><b class="price value-big">${fmtMoney(mid.pred_price)}</b><div class="muted small">${fmtMoney(mid.pred_low)} – ${fmtMoney(mid.pred_high)}</div></td>
        <td class="num small">${bands.length > 1 ? `${fmtMoney(low.pred_price)} → ${fmtMoney(high.pred_price)}` : "–"}
          <div class="muted small">${bands.length > 1 ? `floor ${low.storey_low} → ${high.storey_high}` : ""}</div></td>
        <td class="num small">${
          recent
            ? `${fmtMoney(recent.median_price)} <span class="muted">· ${recent.count} sold</span><div class="${vs > 0.02 ? "above" : vs < -0.02 ? "below" : "muted"}">${verdict}</div>`
            : `<span class="muted">none</span>`
        }</td></tr>`;
    })
    .join("");
  return `<div class="card flush" id="bld-value">
    <div class="card-head" style="padding: 18px 18px 0">
      <h3>What's it worth today?</h3>
      <a class="link small" data-go-model>How estimates work →</a>
    </div>
    <p class="muted small" style="margin: 6px 18px 10px; line-height: 1.6">Estimated price of this block's usual flat of each type on a
      middle floor, at ${fmtMonth(p.month)} prices. Most sales land inside the range shown; typical miss is about
      ±${(p.mape * 100).toFixed(0)}%. Renovation, facing and view can move a flat's price beyond it.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Type</th><th class="num">Estimate</th><th class="num">Low → high floor</th><th class="num">Sold here, last 12 mo</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

// ----- monthly payment -----

const LOANS = {
  hdb: { label: "HDB", rate: 2.6, maxYears: 25, note: "With an HDB loan the 25% downpayment can come entirely from CPF." },
  bank: { label: "Bank", rate: 3.0, maxYears: 30, note: "With a bank loan at least 5% of the price must be cash; the other 20% can be CPF." },
};
const LOAN_TO_VALUE = 0.75;
const LEASE_TO_AGE = 95; // full loan and CPF use need the lease to last until the youngest buyer is 95

const monthlyPayment = (principal, ratePct, years) => {
  const r = ratePct / 100 / 12;
  const n = years * 12;
  return r ? (principal * r) / (1 - (1 + r) ** -n) : principal / n;
};

function renderPayment(d, leaseLeft) {
  const box = $("#bld-payment");
  const est = estimatesByType(d);
  const usual = est.find((e) => e.type === "4 ROOM") || est[0];
  const pay = { price: Math.round((usual ? usual.mid.pred_price : d.summary.median_price || 500000) / 1000) * 1000, loan: "hdb" };
  const youngest = leaseLeft != null ? LEASE_TO_AGE - leaseLeft : null;

  box.innerHTML = `
    <div class="card-head"><h3>Monthly payment</h3><span class="muted small">Indicative only</span></div>
    ${est.length ? `<div class="chips" id="pay-types" style="margin-bottom: 12px">${est
      .map((e) => `<button class="chip ${e === usual ? "active" : ""}" data-price="${Math.round(e.mid.pred_price / 1000) * 1000}">${esc(titleCase(e.type))} · ${fmtMoney(e.mid.pred_price)}</button>`)
      .join("")}</div>` : ""}
    <div class="pay-grid">
      <label class="field">Price<input type="number" id="pay-price" step="5000" min="0" value="${pay.price}" /></label>
      <label class="field">Loan<div class="segmented" id="pay-loan">${Object.entries(LOANS)
        .map(([k, l]) => `<button type="button" data-value="${k}" class="${k === pay.loan ? "active" : ""}">${l.label}</button>`)
        .join("")}</div></label>
      <label class="field">Interest % a year<input type="number" id="pay-rate" step="0.05" min="0" value="${LOANS[pay.loan].rate}" /></label>
      <label class="field">Years<input type="number" id="pay-years" step="1" min="5" max="30" value="25" /></label>
    </div>
    <div class="pay-result" id="pay-result"></div>
    ${
      youngest != null && youngest > 21
        ? `<p class="small lease-note">With ~${leaseLeft} years of lease left, buyers need the youngest to be <b>${youngest} or older</b>
            for the full loan and full CPF use. Younger buyers get a smaller loan and can use less CPF.</p>`
        : ""
    }`;

  const update = () => {
    const loan = LOANS[pay.loan];
    const price = +$("#pay-price").value || 0;
    const years = Math.min(loan.maxYears, Math.max(1, +$("#pay-years").value || loan.maxYears));
    const principal = price * LOAN_TO_VALUE;
    $("#pay-result").innerHTML = `
      <div><div class="label">Monthly</div><div class="value">${fmtFull(monthlyPayment(principal, +$("#pay-rate").value || 0, years))}</div>
        <div class="small muted">over ${years} years</div></div>
      <div><div class="label">Loan (75%)</div><div class="value">${fmtMoney(principal)}</div></div>
      <div><div class="label">Downpayment (25%)</div><div class="value">${fmtMoney(price - principal)}</div></div>
      <p class="small muted" style="grid-column: 1 / -1; margin: 0">${loan.note} ${loan.label} loans run up to ${loan.maxYears} years.
        Excludes stamp duty, legal fees and grants.</p>`;
  };
  bindSegmented("#pay-loan", (v) => {
    pay.loan = v;
    $("#pay-rate").value = LOANS[v].rate;
    $("#pay-years").value = Math.min(+$("#pay-years").value || 25, LOANS[v].maxYears);
    update();
  });
  $("#pay-types")?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-price]");
    if (!chip) return;
    $$("#pay-types .chip").forEach((c) => c.classList.toggle("active", c === chip));
    $("#pay-price").value = chip.dataset.price;
    update();
  });
  ["#pay-price", "#pay-rate", "#pay-years"].forEach((sel) => $(sel).addEventListener("input", update));
  update();
}

// ----- what's nearby -----

const POI_KINDS = {
  mrt: { label: "MRT / LRT stations", icon: "🚇", color: "#0e5c62" },
  hawker: { label: "Hawker centres", icon: "🍜", color: "#d9480f" },
  food_court: { label: "Food courts & coffee shops", icon: "🍱", color: "#e67700" },
  supermarket: { label: "Supermarkets", icon: "🛒", color: "#2b8a3e" },
  mall: { label: "Malls", icon: "🛍️", color: "#9c36b5" },
  primary_school: { label: "Primary schools", icon: "🏫", color: "#1971c2" },
  park: { label: "Parks", icon: "🌳", color: "#5c940d" },
  polyclinic: { label: "Polyclinics", icon: "🩺", color: "#c2255c" },
  hospital: { label: "Hospitals", icon: "🏥", color: "#c2255c" },
};

const fmtWalk = (p) => (p.distance_m <= 2000 ? `${p.walk_min} min walk` : fmtDist(p.distance_m));

function placeItem(id, name, meta, dist) {
  return `<li class="poi-item ${id != null ? "linked" : ""}" ${id != null ? `data-poi="${id}"` : ""}>
    <span class="poi-name">${name}${meta ? ` <span class="muted">· ${meta}</span>` : ""}</span><span class="poi-dist">${dist}</span></li>`;
}

function placeGroup(kind, items, empty, label = POI_KINDS[kind].label) {
  const k = POI_KINDS[kind];
  return `<div class="poi-group"><h4><span class="poi-dot" style="background:${k.color}">${k.icon}</span>${label}</h4>
    <ul>${items.join("") || `<li class="muted small">${empty}</li>`}</ul></div>`;
}

function renderPlaces(d) {
  const box = $("#bld-places");
  const a = d.amenities || {};
  const lv = d.livability;
  if (!Object.keys(a).length && !lv) {
    box.style.display = "none";
    return;
  }
  // School and park names come in capitals from MOE and NParks.
  const named = (kind, name) => (kind === "primary_school" || kind === "park" ? titleCase(name) : name);
  const list = (kind, meta = () => "") => (a[kind] || []).map((p) => placeItem(p.id, esc(named(kind, p.name)), meta(p), fmtWalk(p)));
  const stations = nearbyStations(lv).map((st) => {
    const how = st.how === "walk" ? "walk" : st.how.replace("bus", "by bus");
    return placeItem(esc(`mrt|${st.station}`), `${esc(stationName(st.station))} ${lineChips(st.lines)}`, "", `${fmtMin(st.min)} ${esc(how)}`);
  });
  const schools = list("primary_school", (p) => (p.distance_m <= 1000 ? `<span class="tag">within 1 km</span>` : ""));
  const health = [...list("polyclinic"), ...list("hospital")];
  if (lv?.nearest_gp) health.unshift(placeItem(null, esc(titleCase(lv.nearest_gp)), "nearest GP", fmtDist(lv.nearest_gp_m)));

  box.innerHTML = `
    <div class="card-head"><h3>What's nearby</h3><span class="muted small">Click a place to see it on the map</span></div>
    <div class="poi-groups">
      ${placeGroup("mrt", stations, "No station within 15 min")}
      ${placeGroup("hawker", list("hawker", (p) => (p.detail?.stalls ? `${p.detail.stalls} stalls` : "")), "None within 1.5 km")}
      ${placeGroup("supermarket", list("supermarket"), "None within 1.5 km")}
      ${placeGroup("food_court", list("food_court"), "None mapped within 1 km")}
      ${placeGroup("mall", list("mall"), "None within 3 km")}
      ${placeGroup("primary_school", schools, "None within 2 km")}
      ${placeGroup("park", list("park"), "None within 1.5 km")}
      ${placeGroup("polyclinic", health, "–", "Healthcare")}
    </div>
    <p class="muted small" style="margin: 12px 0 0">Walking times are straight-line distance plus 30% for real paths. Primary schools within 1 km
      get priority in P1 registration. Food courts, supermarkets and malls come from OpenStreetMap and may miss a few.</p>`;
  box.addEventListener("click", (e) => {
    const item = e.target.closest("[data-poi]");
    if (item) focusPoi(item.dataset.poi);
  });
}

function unitMixHtml(info) {
  const parts = [
    ["1room_sold", "1-rm", "#ffe3e6"],
    ["2room_sold", "2-rm", "#f8c5cb"],
    ["3room_sold", "3-rm", "#f26b7a"],
    ["4room_sold", "4-rm", "#c8102e"],
    ["5room_sold", "5-rm", "#8b0a1f"],
    ["exec_sold", "Exec", "#5a0614"],
    ["multigen_sold", "3Gen", "#1f1a1b"],
    ["studio_apartment_sold", "Studio", "#ff8c42"],
    ["1room_rental", "1-rm rental", "#c9c1c2"],
    ["2room_rental", "2-rm rental", "#a99fa1"],
    ["3room_rental", "3-rm rental", "#8a7f81"],
    ["other_room_rental", "Other rental", "#6f6466"],
  ].filter(([k]) => info[k] > 0);
  const total = parts.reduce((s, [k]) => s + info[k], 0);
  if (!total) return "";
  return `<div style="margin-top: 14px"><div class="small muted" style="font-weight:700">UNIT MIX</div>
    <div class="mix-bar">${parts.map(([k, , c]) => `<div style="width:${(info[k] / total) * 100}%;background:${c}" title="${info[k]}"></div>`).join("")}</div>
    <div class="mix-legend">${parts.map(([k, label, c]) => `<span><i style="background:${c}"></i>${label} ${info[k]}</span>`).join("")}</div></div>`;
}

const TYPE_LABELS = {
  "1 ROOM": "1-rm",
  "2 ROOM": "2-rm",
  "3 ROOM": "3-rm",
  "4 ROOM": "4-rm",
  "5 ROOM": "5-rm",
  EXECUTIVE: "Exec",
  "MULTI-GENERATION": "3Gen",
};
const SPLIT_EMPTY = "#f6f2f2";
const SPLIT_RENTAL = "#e4dcdd";

function typeValue(stats) {
  return building.metric === "psf" ? stats.median_psf : stats.median_price;
}

const STATION_ICON_W = 190; // drawn at this size, then scaled down
const SCENE_W = 560;
const SIGN_TEAL = "#0e5c62";
const SIGN_YELLOW = "#f2c230";

const LRT_LINES = new Set(["BPLRT", "SKLRT", "PGLRT"]);
const isLrtOnly = (st) => {
  const lines = (st.lines || "").split(",").filter(Boolean);
  return lines.length > 0 && lines.every((g) => LRT_LINES.has(g));
};

// Stations within 15 min, fastest first; of the LRT-only stops just the closest is kept.
function nearbyStations(lv) {
  if (!lv) return [];
  try {
    const list = JSON.parse(lv.stations_15min || "[]");
    const firstLrt = list.find(isLrtOnly);
    if (list.length) return list.filter((st) => !isLrtOnly(st) || st === firstLrt);
  } catch {
    // fall through to the single fastest station
  }
  return lv.rail_station
    ? [{ station: lv.rail_station, min: lv.rail_min, how: lv.rail_how, lines: lv.rail_station_lines, exit: null }]
    : [];
}

// A classic MRT entrance (canopy, stairs, handrails, hanging sign), drawn with its ground at y=0.
function mrtEntranceSvg(st) {
  const W = STATION_ICON_W;
  const cx = W / 2;
  const stairH = 18;
  const landingY = -stairH;
  const canopyY = -92;
  const lines = (st.lines || "").split(",").filter(Boolean);
  const exitLetter = st.exit ? st.exit.replace(/^exit\s*/i, "") : "";

  const signW = 128;
  const signX = cx - signW / 2;
  const signY = canopyY + 19;
  const badges = lines
    .map((g, i) => {
      const color = (LINE_INFO[g] || ["", "#6f6466"])[1];
      return `<rect x="${signX + 22 + i * 22}" y="${signY + 4}" width="18" height="9" rx="2" fill="${color}" stroke="#fff" stroke-width="0.8"/>`;
    })
    .join("");
  const steps = Array.from({ length: 5 }, (_, i) => {
    const y = landingY + i * (stairH / 5);
    const left = 34 - i * 5;
    const right = W - 34 + i * 5;
    return `<rect x="${left}" y="${y}" width="${right - left}" height="${stairH / 5}" fill="${i % 2 ? "#ddd6cd" : "#e8e2da"}"/>
      <rect x="${left}" y="${y}" width="${right - left}" height="0.8" fill="#f6f2ec"/>`;
  }).join("");
  const railing = (rx) => {
    const d = `M${rx - 5} 0 L${rx - 5} -25 Q${rx - 5} -30 ${rx} -30 Q${rx + 5} -30 ${rx + 5} -25 L${rx + 5} 0`;
    return `<path d="${d}" fill="none" stroke="#8f979e" stroke-width="2.8" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="#e4e8eb" stroke-width="1.2" stroke-linecap="round"/>`;
  };
  const gates = Array.from({ length: 4 }, (_, i) => `<rect x="${cx - 34 + i * 19}" y="${landingY - 9}" width="11" height="9" rx="1.5" fill="#a9b2b7"/>
    <rect x="${cx - 32 + i * 19}" y="${landingY - 8}" width="7" height="2" rx="1" fill="#6cc08a"/>`).join("");

  return `
    <ellipse cx="${cx}" cy="1" rx="${W / 2 + 6}" ry="5" fill="rgba(0,0,0,0.08)"/>
    <rect x="8" y="${canopyY + 12}" width="${W - 16}" height="${landingY - canopyY - 12}" fill="#efe8df"/>
    <rect x="${cx - 44}" y="${canopyY + 40}" width="88" height="${landingY - canopyY - 40}" fill="#34424a"/>
    <path d="M${cx - 30} ${canopyY + 40} L${cx - 44} ${canopyY + 56} M${cx + 20} ${canopyY + 40} L${cx} ${canopyY + 64}" stroke="#fff" stroke-width="2" opacity=".12"/>
    <rect x="${cx - 26}" y="${canopyY + 44}" width="52" height="5" rx="1" fill="#141414"/>
    <rect x="${cx - 22}" y="${canopyY + 45.8}" width="44" height="1.4" fill="#46d16b"/>
    ${gates}
    <rect x="18" y="${canopyY + 30}" width="18" height="28" fill="#ff5a3c"/>
    <rect x="${W - 36}" y="${canopyY + 30}" width="18" height="28" fill="#ff5a3c"/>
    <rect x="8" y="${landingY}" width="${W - 16}" height="${stairH}" fill="#e1d9cf"/>
    ${steps}
    ${railing(40)}${railing(cx)}${railing(W - 40)}
    <rect x="0" y="${canopyY + 12}" width="9" height="${-canopyY - 12}" fill="#f6f1ea" stroke="#e2dbd2" stroke-width="0.6"/>
    <rect x="${W - 9}" y="${canopyY + 12}" width="9" height="${-canopyY - 12}" fill="#f6f1ea" stroke="#e2dbd2" stroke-width="0.6"/>
    <rect x="-8" y="${canopyY}" width="${W + 16}" height="12" rx="2" fill="#faf8f4" stroke="#e2dbd2" stroke-width="0.8"/>
    <rect x="2" y="${canopyY + 12}" width="${W - 4}" height="3" fill="#ddd5cb"/>
    <rect x="${signX + 18}" y="${canopyY + 15}" width="1.4" height="4" fill="#8f979e"/>
    <rect x="${signX + signW - 19}" y="${canopyY + 15}" width="1.4" height="4" fill="#8f979e"/>
    <rect x="${signX}" y="${signY}" width="${signW}" height="17" rx="2" fill="${SIGN_TEAL}" stroke="#083f43" stroke-width="0.8"/>
    <rect x="${signX + 5}" y="${signY + 3}" width="11" height="11" rx="2" fill="${SIGN_YELLOW}"/>
    <path d="M${signX + 7.5} ${signY + 7} h6 M${signX + 7.5} ${signY + 10} h6" stroke="${SIGN_TEAL}" stroke-width="1.4"/>
    ${badges}
    <rect x="${signX + 24 + lines.length * 22}" y="${signY + 7.5}" width="${Math.max(10, signW - 46 - lines.length * 22)}" height="2" rx="1" fill="#fff" opacity=".85"/>
    ${
      exitLetter
        ? `<circle cx="${signX + signW - 10}" cy="${signY + 8.5}" r="6.5" fill="${SIGN_YELLOW}"/>
           <text x="${signX + signW - 10}" y="${signY + 11.8}" font-size="${exitLetter.length > 1 ? 6.5 : 9}" font-weight="800" fill="#1f1a1b" text-anchor="middle">${esc(exitLetter)}</text>`
        : ""
    }`;
}

const WIDE_SCENE_W = 1100;
const STATION_SLOT = 128;
const STATION_DRAW_W = 108;
const LABEL_ROOM = 215; // band price labels to the right of the building

// Stations west of the block go to its left, east to its right, nearest first.
function splitStationsByDirection(stations, homeLon) {
  const sides = { left: [], right: [] };
  stations.forEach((st) => sides[homeLon != null && st.lon != null && st.lon < homeLon ? "left" : "right"].push(st));
  return sides;
}

// Narrow screens: a row of small captioned entrances under the scene.
function mrtRowHtml(stations) {
  const items = stations
    .map((st, i) => {
      const how = st.how === "walk" ? `walk${st.exit ? ` · ${st.exit}` : ""}` : st.how.replace("bus", "by bus");
      return `<div class="mrt-item">
        <svg viewBox="-10 -96 ${STATION_ICON_W + 20} 100" aria-hidden="true">${mrtEntranceSvg(st)}</svg>
        <div class="mrt-name ${i === 0 ? "first" : ""}">${esc(stationName(st.station))}</div>
        <div class="mrt-detail">${esc(`${fmtMin(st.min)} ${how}`)}</div>
      </div>`;
    })
    .join("");
  return `<div class="mrt-row">${items}</div>`;
}

// A small walker or bus heading right, feet/wheels at y=0. `flip` keeps the bus number readable when mirrored.
function commuterSvg(st, flip) {
  if (st.how === "walk") {
    // Otter waddling on all fours, side on.
    const leg = (x, alt) =>
      `<line class="limb ${alt ? "alt" : ""}" x1="${x}" y1="-4.5" x2="${x}" y2="0" stroke="${OTTER.dark}" stroke-width="2.2" stroke-linecap="round"/>`;
    return `<g class="otter-waddle">
      <path d="M-8 -6 Q-14 -6 -17 -2" stroke="${OTTER.fur}" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${leg(-5, true)}${leg(5, false)}
      <ellipse cx="0" cy="-7" rx="10" ry="4.8" fill="${OTTER.fur}"/>
      <ellipse cx="1" cy="-5" rx="7" ry="2.2" fill="${OTTER.belly}"/>
      ${leg(-3, false)}${leg(7, true)}
      <circle cx="9.5" cy="-10.5" r="4.6" fill="${OTTER.fur}"/>
      <circle cx="7.5" cy="-14.6" r="1.3" fill="${OTTER.fur}"/>
      <ellipse cx="12.4" cy="-9.4" rx="2.6" ry="1.9" fill="${OTTER.belly}"/>
      <ellipse cx="14.3" cy="-10" rx="1" ry="0.8" fill="${OTTER.ink}"/>
      <circle cx="10.8" cy="-11.8" r="0.9" fill="${OTTER.ink}"/>
      <path d="M12.5 -9 l4 -0.8 M12.5 -8.3 l4 0.4" stroke="${OTTER.dark}" stroke-width="0.4"/>
    </g>`;
  }
  // Otter head peering out of a bus window.
  const passenger = (x) => `<circle cx="${x}" cy="-11.6" r="2.4" fill="${OTTER.fur}"/>
    <circle cx="${x - 1.9}" cy="-13.6" r="0.8" fill="${OTTER.fur}"/><circle cx="${x + 1.9}" cy="-13.6" r="0.8" fill="${OTTER.fur}"/>
    <ellipse cx="${x}" cy="-10.7" rx="1.4" ry="0.9" fill="${OTTER.belly}"/>
    <circle cx="${x - 0.9}" cy="-12.2" r="0.45" fill="${OTTER.ink}"/><circle cx="${x + 0.9}" cy="-12.2" r="0.45" fill="${OTTER.ink}"/>`;
  const service = st.how.replace(/^bus\s*/, "");
  return `<g class="bus-body">
      <rect x="-17" y="-17" width="34" height="14" rx="3" fill="#5aa641"/>
      <rect x="-17" y="-7" width="34" height="3" fill="#3f8a2c"/>
      ${[-14, -7, 0, 7].map((x) => `<rect x="${x}" y="-15" width="5.5" height="5" rx="1" fill="#e8f6ff"/>`).join("")}
      <svg x="-14" y="-15" width="26.5" height="5" viewBox="-14 -15 26.5 5" overflow="hidden">${passenger(-4.25)}${passenger(9.75)}</svg>
      <rect x="13" y="-15" width="3" height="8" rx="1" fill="#e8f6ff"/>
      ${service ? `<g transform="scale(${flip ? -1 : 1},1)">
        <rect x="${-Math.max(10, service.length * 5 + 4) / 2}" y="-23" width="${Math.max(10, service.length * 5 + 4)}" height="6.5" rx="1.5" fill="#1f1a1b"/>
        <text x="0" y="-18" font-size="5.5" font-weight="800" fill="#ffd34d" text-anchor="middle">${esc(service)}</text>
      </g>` : ""}
    </g>
    <circle cx="-9" cy="-2.5" r="3" fill="#1f1a1b"/><circle cx="9" cy="-2.5" r="3" fill="#1f1a1b"/>`;
}

// Entrances standing on the grass line, captioned on the grass beneath; centres are given per station.
// A walker or bus loops from the block to each station, at a pace set by the mode.
function mrtOnGrassSvg(placed, groundY) {
  const scale = STATION_DRAW_W / STATION_ICON_W;
  const commuters = placed
    .map(({ st, cx, fromX }, i) => {
      const dx = cx - fromX;
      const secs = Math.abs(dx) / (st.how === "walk" ? 45 : 110) + 1;
      return `<g transform="translate(${fromX.toFixed(1)},${groundY + 1})" pointer-events="none">
        <g class="commuter" style="--dx:${dx.toFixed(1)}px;animation-duration:${secs.toFixed(1)}s;animation-delay:${(i * 0.9).toFixed(1)}s">
          <g transform="scale(${dx < 0 ? -1 : 1},1)">${commuterSvg(st, dx < 0)}</g>
        </g>
      </g>`;
    })
    .join("");
  const entrances = placed
    .map(({ st, cx, first }) => {
      const name = stationName(st.station);
      const how = st.how === "walk" ? `walk${st.exit ? ` · ${st.exit}` : ""}` : st.how.replace("bus", "by bus");
      const detail = `${fmtMin(st.min)} ${how}`;
      const nameSize = Math.min(11.5, (STATION_SLOT - 8) / Math.max(1, name.length * 0.62));
      return `<g>
        <title>${esc(name)} · ${esc(detail)}${st.walk_m ? ` · ${st.walk_m} m` : ""}</title>
        <g transform="translate(${(cx - STATION_DRAW_W / 2).toFixed(1)},${groundY}) scale(${scale.toFixed(3)})">${mrtEntranceSvg(st)}</g>
        <text x="${cx.toFixed(1)}" y="${groundY + 15}" font-size="${nameSize.toFixed(1)}" font-weight="800" fill="${first ? "#8b0a1f" : "#1f1a1b"}" text-anchor="middle">${esc(name)}</text>
        <text x="${cx.toFixed(1)}" y="${groundY + 27}" font-size="9.5" font-weight="600" fill="#6f6466" text-anchor="middle">${esc(detail)}</text>
      </g>`;
    })
    .join("");
  // Commuters go on top so ones passing a nearer station stay visible.
  return entrances + commuters;
}

// Spread the block's unit mix across one floor's worth of columns (largest-remainder rounding).
// Types averaging under half a unit per floor can't be on every floor, so they're listed, not drawn.
function allocateColumns(fullLayout, floors) {
  const layout = fullLayout.filter((g) => g.units / floors >= 0.5);
  const minor = fullLayout.filter((g) => g.units / floors < 0.5);
  const total = layout.reduce((s, g) => s + g.units, 0);
  if (!total) return { groups: [], minor: fullLayout };
  const perFloor = Math.max(1, Math.min(20, Math.round(total / floors)));
  const exact = layout.map((g) => (g.units / total) * perFloor);
  const cols = exact.map(Math.floor);
  let remaining = perFloor - cols.reduce((a, b) => a + b, 0);
  layout.forEach((_, i) => {
    if (remaining > 0 && cols[i] === 0) {
      cols[i] = 1;
      remaining--;
    }
  });
  exact
    .map((e, i) => [e - Math.floor(e), i])
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => {
      if (remaining > 0) {
        cols[i]++;
        remaining--;
      }
    });
  return { groups: layout.map((g, i) => ({ ...g, cols: cols[i] })).filter((g) => g.cols > 0), minor };
}

function buildingGeometry() {
  const d = building.data;
  const bands = d.bands;
  const floors =
    Math.max(d.info?.max_floor_lvl || 0, Math.max(0, ...bands.map((b) => b.storey_low))) ||
    Math.max(0, ...bands.map((b) => b.storey_high)) ||
    12;
  const { groups, minor } = building.split ? allocateColumns(d.layout || [], floors) : { groups: [], minor: [] };
  return { floors, groups, minor, split: groups.length > 0 };
}

function colorDomain(bands, split, groups) {
  const groupTypes = new Set(groups.map((g) => g.flat_type));
  const values = (
    split ? bands.flatMap((b) => b.types.filter((t) => groupTypes.has(t.flat_type)).map(typeValue)) : bands.map(bandValue)
  ).filter((v) => v != null);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { values, min, max, norm: (v) => (max > min ? (v - min) / (max - min) : 0.55) };
}

function drawBuildingSvg() {
  const d = building.data;
  const bands = d.bands;
  const { floors, groups, minor, split } = buildingGeometry();
  const { values, min: vMin, max: vMax, norm } = colorDomain(bands, split, groups);
  const typeStats = (band, type) => band.types.find((t) => t.flat_type === type);

  const stations = nearbyStations(d.livability);
  const floorH = Math.max(8, Math.min(26, Math.floor(470 / floors)));
  const bw = split ? Math.max(210, Math.min(260, groups.reduce((s, g) => s + g.cols, 0) * 22)) : 210;
  // On wide screens the scene widens into a panorama so nearby stations stand either side of the block;
  // narrow screens keep the compact scene and list the stations in a row beneath it.
  const wide = $("#bld-svg").clientWidth >= 760;
  const sides = wide ? splitStationsByDirection(stations, d.livability?.longitude) : { left: [], right: [] };
  const baseX = (split ? 140 - (bw - 210) / 2 : 150) + sides.left.length * STATION_SLOT;
  const needW = Math.max(SCENE_W, baseX + bw + LABEL_ROOM + sides.right.length * STATION_SLOT + 10);
  const W = Math.max(needW, wide ? WIDE_SCENE_W : 0);
  const bx = baseX + (W - needW) / 2;
  const placedStations = [
    ...sides.left.map((st, i) => ({ st, fromX: bx - 6, cx: bx - 125 - STATION_SLOT / 2 - i * STATION_SLOT })),
    ...sides.right.map((st, i) => ({ st, fromX: bx + bw + 6, cx: bx + bw + LABEL_ROOM + STATION_SLOT / 2 + i * STATION_SLOT })),
  ].map((p) => ({ ...p, first: p.st === stations[0] }));
  const roofSpace = 78;
  const voidH = 24;
  const groundH = split ? 56 : 46;
  const H = roofSpace + floors * floorH + voidH + groundH;
  const groundY = H - groundH;
  const floorTop = (f) => groundY - voidH - f * floorH;
  const winH = Math.max(3, floorH * 0.46);
  const lit = (f, c) => ((f * 7 + c * 13) * 2654435761) % 100 < 9;

  const pad = split ? 6 : 14;
  const innerX = bx + pad;
  const innerW = bw - pad * 2;
  const perFloor = split ? groups.reduce((s, g) => s + g.cols, 0) : bw > 180 ? 7 : 6;
  const unitW = innerW / perFloor;
  let cursor = innerX;
  const segs = groups.map((g) => {
    const seg = { ...g, x: cursor, w: g.cols * unitW };
    cursor += seg.w;
    return seg;
  });

  const windowsFor = (f, x, count, t) => {
    const winW = unitW * (split ? 0.5 : 0.58);
    const dark = t != null && t > 0.45;
    let out = "";
    for (let c = 0; c < count; c++) {
      const col = Math.round((x - innerX) / unitW) + c;
      const wx = x + c * unitW + (unitW - winW) / 2;
      const wy = floorTop(f) + (floorH - winH) / 2 - 0.5;
      const isLit = lit(f, col);
      out += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${winW.toFixed(1)}" height="${winH.toFixed(1)}" rx="1.2"
        fill="${isLit ? "#ffe9a8" : dark ? "rgba(255,255,255,0.88)" : "#ffffff"}"
        stroke="${dark ? "rgba(0,0,0,0.12)" : "rgba(139,10,31,0.22)"}" stroke-width="0.6" ${isLit ? 'class="lit"' : ""}/>`;
    }
    return out;
  };

  const floorLine = (f) => `<rect x="${bx}" y="${floorTop(f) + floorH - 1.5}" width="${bw}" height="1.5" fill="rgba(0,0,0,0.08)"/>`;

  const wholeFloor = (f, fill, t) =>
    `<rect x="${bx}" y="${floorTop(f)}" width="${bw}" height="${floorH}" fill="${fill}"/>${windowsFor(f, innerX, perFloor, t)}${floorLine(f)}`;

  const splitFloor = (f, fillFor) => {
    let out = `<rect x="${bx}" y="${floorTop(f)}" width="${bw}" height="${floorH}" fill="#efe6e7"/>`;
    segs.forEach((seg, i) => {
      const { fill, t } = fillFor(seg);
      out += `<rect x="${seg.x.toFixed(1)}" y="${floorTop(f)}" width="${seg.w.toFixed(1)}" height="${floorH}" fill="${fill}"/>`;
      out += windowsFor(f, seg.x, seg.cols, t);
      if (i > 0) out += `<rect x="${(seg.x - 0.75).toFixed(1)}" y="${floorTop(f)}" width="1.5" height="${floorH}" fill="rgba(31,26,27,0.28)"/>`;
    });
    return out + floorLine(f);
  };

  const covered = new Set();
  let groupsSvg = "";
  let labels = "";
  bands.forEach((band, i) => {
    const low = Math.max(1, band.storey_low);
    const high = Math.min(floors, band.storey_high);
    if (low > floors) return;
    const top = floorTop(high);
    const bottom = floorTop(low) + floorH;
    const bandSelected = building.selectedBand === band.storey_range;
    const dim = building.selectedBand && !bandSelected;

    let rects = "";
    let hits = "";
    if (split) {
      const fillFor = (seg) => {
        if (seg.rental) return { fill: SPLIT_RENTAL, t: null };
        const stats = typeStats(band, seg.flat_type);
        if (!stats) return { fill: SPLIT_EMPTY, t: null };
        const t = norm(typeValue(stats));
        return { fill: colorScale(t), t };
      };
      for (let f = low; f <= high; f++) {
        covered.add(f);
        rects += splitFloor(f, fillFor);
      }
      hits = segs
        .map((seg) => {
          const selected = bandSelected && building.selectedType === seg.flat_type;
          return `<rect class="seg-hit ${selected ? "selected" : ""}" data-band="${esc(band.storey_range)}" data-type="${esc(seg.flat_type)}"
            x="${seg.x.toFixed(1)}" y="${top}" width="${seg.w.toFixed(1)}" height="${bottom - top}" rx="1.5"/>`;
        })
        .join("");
      if (bandSelected && !building.selectedType) {
        hits += `<rect x="${bx - 1}" y="${top}" width="${bw + 2}" height="${bottom - top}" rx="2" fill="none" stroke="#1f1a1b" stroke-width="2.5" pointer-events="none"/>`;
      }
    } else {
      const v = bandValue(band);
      const t = v == null ? 0.5 : norm(v);
      for (let f = low; f <= high; f++) {
        covered.add(f);
        rects += wholeFloor(f, colorScale(t), t);
      }
      hits = `<rect class="hit" data-band="${esc(band.storey_range)}" x="${bx - 1}" y="${top}" width="${bw + 2}" height="${bottom - top}" rx="2"/>`;
    }

    groupsSvg += `<g class="floor-group ${split ? "split" : ""} ${bandSelected ? "selected" : ""} ${dim ? "dim" : ""}"
      style="${building.noAnim ? "animation:none" : `animation-delay:${i * 45}ms`}">${rects}${hits}</g>`;

    const mid = (top + bottom) / 2;
    const lx = bx + bw + 16;
    const bandH = bottom - top;
    const priceText = building.metric === "psf" ? `${fmtPsf(band.median_psf)} psf` : fmtMoney(band.median_price);
    const typeLine =
      split && bandH >= 40
        ? segs
            .filter((s) => !s.rental && typeStats(band, s.flat_type))
            .map((s) => {
              const stats = typeStats(band, s.flat_type);
              return `${s.label} ${building.metric === "psf" ? fmtPsf(stats.median_psf) : fmtMoney(stats.median_price)}`;
            })
            .join(" · ")
        : "";
    labels += `<g class="band-label" data-band="${esc(band.storey_range)}" style="cursor:pointer">
      <line x1="${bx + bw + 3}" y1="${mid}" x2="${lx - 3}" y2="${mid}" stroke="#d9b8bd" stroke-dasharray="2 2"/>
      ${
        bandH < 24
          ? `<text x="${lx}" y="${mid + 3.5}" font-size="10.5" fill="#1f1a1b"><tspan fill="#6f6466">${low}–${band.storey_high}</tspan>  <tspan font-weight="800">${priceText}</tspan></text>`
          : `<text x="${lx}" y="${mid - (typeLine ? 9 : 2)}" font-size="10" fill="#6f6466">Floors ${low}–${band.storey_high} · ${band.count} sold</text>
             <text x="${lx}" y="${mid + (typeLine ? 5 : 12)}" font-size="13" font-weight="800" fill="#1f1a1b">${priceText}</text>
             ${typeLine ? `<text x="${lx}" y="${mid + 18}" font-size="9.5" fill="#8b0a1f">${esc(typeLine)}</text>` : ""}`
      }</g>`;
  });

  let plain = "";
  for (let f = 1; f <= floors; f++) {
    if (covered.has(f)) continue;
    plain += split ? splitFloor(f, (seg) => ({ fill: seg.rental ? SPLIT_RENTAL : SPLIT_EMPTY, t: null })) : wholeFloor(f, SPLIT_EMPTY, null);
  }

  let floorNums = "";
  const step = floors > 30 ? 10 : 5;
  for (let f = step; f <= floors; f += step) {
    floorNums += `<text x="${bx - 10}" y="${floorTop(f) + floorH / 2 + 3}" font-size="9.5" text-anchor="end" fill="#a3979a">${f}</text>`;
  }
  floorNums += `<text x="${bx - 10}" y="${floorTop(1) + floorH / 2 + 3}" font-size="9.5" text-anchor="end" fill="#a3979a">1</text>`;

  const columnLabels = split
    ? segs
        .map((seg) => {
          const cx = seg.x + seg.w / 2;
          return seg.w < 16
            ? ""
            : `<text x="${cx}" y="${groundY + 17}" font-size="9.5" font-weight="800" fill="#8b0a1f" text-anchor="middle">${esc(seg.label)}</text>
               <text x="${cx}" y="${groundY + 28}" font-size="8.5" fill="#6f6466" text-anchor="middle">×${seg.cols}/fl</text>`;
        })
        .join("")
    : "";

  const roofY = floorTop(floors) - 16;
  const pillars = Array.from({ length: 6 }, (_, i) => {
    const px = bx + 10 + i * ((bw - 26) / 5);
    return `<rect x="${px}" y="${groundY - voidH}" width="6" height="${voidH}" fill="#e9dfe0"/>`;
  }).join("");
  const tree = (x, s = 1) => `
    <g transform="translate(${x},${groundY}) scale(${s})">
      <rect x="-3" y="-26" width="6" height="26" rx="2" fill="#9b6b4f"/>
      <circle cx="0" cy="-38" r="17" fill="#5fb37c"/><circle cx="-11" cy="-30" r="11" fill="#4ea36c"/><circle cx="11" cy="-31" r="12" fill="#6cc08a"/>
    </g>`;
  const otters =
    standingOtter(bx + bw / 2 + 32, groundY - 1, 1.3) + standingOtter(bx + bw / 2 + 58, groundY - 1, 0.8, "otter-bob delay");
  const canalH = 14;
  const canalY = H - canalH;
  const canal = `
    <rect x="0" y="${canalY}" width="${W}" height="${canalH}" fill="#cfeaf5"/>
    <rect x="0" y="${canalY}" width="${W}" height="2" fill="#b3dcec"/>
    <path d="M20 ${canalY + 8} q6 -3 12 0 M150 ${canalY + 9} q6 -3 12 0 M300 ${canalY + 7} q6 -3 12 0" stroke="#fff" stroke-width="1.2" fill="none"/>
    ${floatingOtter(W - 96, canalY + 9, 1.25)}`;

  $("#bld-svg").innerHTML = `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Building with price by storey band${split ? " and unit type" : ""}">
    <circle cx="${W - 70}" cy="54" r="26" fill="#ffd0d6"/><circle cx="${W - 70}" cy="54" r="17" fill="#ffb3bc"/>
    <g class="cloud"><ellipse cx="80" cy="46" rx="34" ry="11" fill="#fff"/><ellipse cx="100" cy="38" rx="20" ry="12" fill="#fff"/></g>
    <g class="cloud slow"><ellipse cx="${W - 150}" cy="96" rx="28" ry="9" fill="#fff"/><ellipse cx="${W - 136}" cy="89" rx="15" ry="9" fill="#fff"/></g>
    <g class="bird"><path d="M0 70 q5 -6 10 0 q5 -6 10 0" stroke="#8b0a1f" stroke-width="1.6" fill="none"/></g>

    <rect x="0" y="${groundY}" width="${W}" height="${groundH}" fill="#e7f4ea"/>
    <rect x="0" y="${groundY}" width="${W}" height="4" fill="#cfe9d6"/>
    ${split ? "" : `<path d="M${bx + bw / 2 - 16} ${groundY} L${bx + bw / 2 - 40} ${canalY} L${bx + bw / 2 + 40} ${canalY} L${bx + bw / 2 + 16} ${groundY} Z" fill="#f4ecec"/>`}
    ${canal}

    <rect x="${bx + bw / 2 - 30}" y="${roofY - 18}" width="60" height="18" rx="3" fill="#efe3e4"/>
    <rect x="${bx + bw / 2 - 22}" y="${roofY - 26}" width="44" height="10" rx="2" fill="#e3d4d6"/>
    <rect x="${bx - 8}" y="${roofY}" width="${bw + 16}" height="16" rx="3" fill="#c8102e"/>
    <text x="${bx + bw / 2}" y="${roofY + 11.5}" font-size="10" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing="1.5">BLK ${esc(d.block)}</text>

    ${plain}
    ${groupsSvg}
    <rect x="${bx - 4}" y="${floorTop(floors)}" width="5" height="${floors * floorH}" fill="rgba(139,10,31,0.18)" pointer-events="none"/>
    <rect x="${bx + bw - 1}" y="${floorTop(floors)}" width="5" height="${floors * floorH}" fill="rgba(139,10,31,0.18)" pointer-events="none"/>

    <rect x="${bx}" y="${groundY - voidH}" width="${bw}" height="${voidH}" fill="#fbf7f7"/>
    ${pillars}
    <rect x="${bx + bw / 2 - 11}" y="${groundY - voidH + 4}" width="22" height="${voidH - 4}" rx="3" fill="#c8102e"/>
    <rect x="${bx + bw / 2 - 0.6}" y="${groundY - voidH + 6}" width="1.2" height="${voidH - 6}" fill="#8b0a1f"/>
    <rect x="${bx}" y="${groundY - voidH}" width="${bw}" height="2" fill="rgba(0,0,0,0.08)"/>

    ${tree(bx - 48, 1)}${tree(bx - 92, 0.75)}${tree(bx + bw + 40, 0.9)}${tree(bx + bw + 84, 0.7)}
    ${otters}
    ${mrtOnGrassSvg(placedStations, groundY)}
    ${columnLabels}
    ${floorNums}
    ${labels}
    ${bands.length ? "" : `<text x="${bx + bw / 2}" y="${floorTop(Math.ceil(floors / 2))}" text-anchor="middle" font-size="13" font-weight="700" fill="#8b0a1f">No resales in this period</text>`}
  </svg>${wide || !stations.length ? "" : mrtRowHtml(stations)}`;
  building.noAnim = false;

  const fmt = building.metric === "psf" ? (v) => `${fmtPsf(v)} psf` : fmtMoney;
  const layoutNote = split
    ? d.layout_source === "register"
      ? "Layout estimated from HDB's unit mix for this block"
      : "Layout estimated from past resales (block not in HDB register)"
    : "Median per band";
  $("#bld-legend").innerHTML = values.length
    ? `<span>${fmt(vMin)}</span><span class="bar"></span><span>${fmt(vMax)}</span>
       <span style="margin-left:12px" class="swatch"></span><span>no sales</span>
       ${split && groups.some((g) => g.rental) ? `<span class="swatch" style="background:${SPLIT_RENTAL}"></span><span>rental</span>` : ""}
       <span style="margin-left:auto">${layoutNote} · click to filter</span>
       ${split && minor.length ? `<span style="flex-basis:100%">Not drawn (under 1 per floor): ${minor.map((g) => `${g.units} ${esc(g.label)}`).join(", ")}</span>` : ""}`
    : `<span>No resales match these filters — try a longer period.</span>`;

  bindBuildingTooltips(segs);
}

function bindBuildingTooltips(segs) {
  const d = building.data;
  const tooltip = $("#tooltip");
  const bandByRange = new Map(d.bands.map((b) => [b.storey_range, b]));
  const segByType = new Map(segs.map((s) => [s.flat_type, s]));

  const place = (e, html) => {
    tooltip.style.display = "block";
    tooltip.style.left = `${Math.min(e.clientX + 14, window.innerWidth - 240)}px`;
    tooltip.style.top = `${e.clientY + 14}px`;
    tooltip.innerHTML = html;
  };
  const bandHtml = (band) => `<div style="font-weight:800;margin-bottom:6px">Floors ${band.storey_low}–${band.storey_high}</div>
    <div class="row"><span>Median</span><b>${fmtFull(band.median_price)}</b></div>
    <div class="row"><span>Median $ psf</span><b>${fmtPsf(band.median_psf)}</b></div>
    <div class="row"><span>Range</span><span>${fmtMoney(band.min_price)} – ${fmtMoney(band.max_price)}</span></div>
    <div class="row"><span>Resales</span><span>${band.count}</span></div>
    ${band.latest ? `<div class="row"><span>Latest</span><span>${fmtMoney(band.latest.resale_price)} · ${fmtMonth(band.latest.month)}</span></div>` : ""}`;

  $$("#bld-svg [data-band]").forEach((el) => {
    const band = bandByRange.get(el.dataset.band);
    const type = el.dataset.type;
    el.addEventListener("mousemove", (e) => {
      if (!type) return place(e, bandHtml(band));
      const seg = segByType.get(type);
      const stats = band.types.find((t) => t.flat_type === type);
      const head = `<div style="font-weight:800;margin-bottom:6px">${esc(seg.label)} · floors ${band.storey_low}–${band.storey_high}</div>`;
      if (seg.rental) return place(e, `${head}<div>HDB rental flats — not sold on the resale market</div>`);
      if (!stats)
        return place(e, `${head}<div>No ${esc(titleCase(type))} resales on these floors in this period</div>
          <div class="row" style="margin-top:6px"><span>Est. units / floor</span><span>${seg.cols}</span></div>`);
      place(
        e,
        `${head}
        <div class="row"><span>Median</span><b>${fmtFull(stats.median_price)}</b></div>
        <div class="row"><span>Median $ psf</span><b>${fmtPsf(stats.median_psf)}</b></div>
        <div class="row"><span>Resales</span><span>${stats.count}</span></div>
        <div class="row"><span>Est. units / floor</span><span>${seg.cols}</span></div>
        <div class="row" style="margin-top:6px;opacity:.75"><span>All types, these floors</span><span>${fmtMoney(band.median_price)}</span></div>`
      );
    });
    el.addEventListener("mouseleave", () => (tooltip.style.display = "none"));
    el.addEventListener("click", () => {
      const same = building.selectedBand === band.storey_range && (building.selectedType || null) === (type || null);
      selectBand(same ? null : band.storey_range, same ? null : type || null);
    });
  });
}

function selectBand(range, type = null) {
  building.selectedBand = range;
  building.selectedType = range ? type : null;
  building.noAnim = true;
  drawBuildingSvg();
  renderBandTable();
  renderRecent();
}

function renderBandTable() {
  const d = building.data;
  const bands = [...d.bands].reverse();
  const order = new Map((d.layout || []).map((g, i) => [g.flat_type, i]));
  const byType = (b) =>
    [...b.types]
      .sort((x, y) => (order.get(x.flat_type) ?? 99) - (order.get(y.flat_type) ?? 99))
      .map((t) => `${TYPE_LABELS[t.flat_type] || titleCase(t.flat_type)} ${building.metric === "psf" ? fmtPsf(t.median_psf) : fmtMoney(t.median_price)}`)
      .join(" · ");
  $("#bld-bands").innerHTML = `
    <thead><tr><th>Floors</th><th class="num">Median</th><th class="num">$ psf</th><th>By type</th><th class="num">Sold</th><th>Latest</th></tr></thead>
    <tbody>${
      bands
        .map(
          (b) => `<tr class="clickable" data-band="${esc(b.storey_range)}" style="${building.selectedBand === b.storey_range ? "background:var(--red-soft)" : ""}">
            <td><span style="display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:8px;background:${swatchFor(b)}"></span>${b.storey_low}–${b.storey_high}</td>
            <td class="num price">${fmtMoney(b.median_price)}</td><td class="num">${fmtPsf(b.median_psf)}</td>
            <td class="muted small">${esc(byType(b))}</td>
            <td class="num">${b.count}</td><td class="muted">${fmtMonth(b.latest_month)}</td></tr>`
        )
        .join("") || `<tr><td colspan="6" class="muted">No resales in this period</td></tr>`
    }</tbody>`;
  $$("#bld-bands tr[data-band]").forEach((tr) =>
    tr.addEventListener("click", () => selectBand(building.selectedBand === tr.dataset.band && !building.selectedType ? null : tr.dataset.band))
  );
}

function swatchFor(band) {
  const values = building.data.bands.map(bandValue).filter((v) => v != null);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return colorScale(max > min ? (bandValue(band) - min) / (max - min) : 0.55);
}

function renderRecent() {
  const d = building.data;
  const range = building.selectedBand;
  const type = building.selectedType;
  const band = range && d.bands.find((b) => b.storey_range === range);
  const rows = d.recent.filter((r) => {
    if (type && r.flat_type !== type) return false;
    if (!band) return true;
    const [lo, hi] = r.storey_range.split(" TO ").map(Number);
    return lo >= band.storey_low && hi <= band.storey_high;
  });
  const typeText = type ? `${titleCase(type)} ` : "";
  $("#bld-recent-title").textContent = range ? `${typeText}resales on floors ${range.replace(" TO ", "–")}` : "Recent resales";
  $("#bld-clear-band").style.display = range ? "" : "none";
  $("#bld-recent").innerHTML = `
    <thead><tr><th>Month</th><th>Type</th><th>Floors</th><th class="num">Sqm</th><th>Model</th><th class="num">Price</th><th class="num">$ psf</th></tr></thead>
    <tbody>${
      rows
        .map(
          (r) => `<tr><td>${fmtMonth(r.month)}</td><td>${esc(titleCase(r.flat_type))}</td><td>${esc(r.storey_range.replace(" TO ", "–"))}</td>
            <td class="num">${r.floor_area_sqm}</td><td>${esc(r.flat_model)}</td>
            <td class="num price">${fmtFull(r.resale_price)}</td><td class="num">${fmtPsf(r.price_psf)}</td></tr>`
        )
        .join("") || `<tr><td colspan="7" class="muted">No resales in this period</td></tr>`
    }</tbody>`;
}

function renderBuildingExamples() {
  const ex = state.meta.examples || [];
  $("#building-examples").innerHTML = [
    `<button class="chip" data-postal="560174">560174 · Ang Mo Kio</button>`,
    ...ex.map((e) => `<button class="chip" data-unit="${esc(e.unit_id)}">${esc(e.label)}: ${esc(blockLabel(e.unit_id))}</button>`),
  ].join("");
  $("#building-examples").addEventListener("click", (e) => {
    const chip = e.target.closest("button");
    if (!chip) return;
    if (chip.dataset.postal) openPostal(chip.dataset.postal);
    else openBlock(chip.dataset.unit);
  });
}

// ================= explore =================

const explore = { page: 1, pageSize: 50, sort: "month", dir: "desc", metric: "median_price", summary: null };

const EXPLORE_COLUMNS = [
  ["month", "Month", (r) => fmtMonth(r.month)],
  ["town", "Town", (r) => esc(titleCase(r.town))],
  ["flat_type", "Type", (r) => esc(titleCase(r.flat_type))],
  ["block", "Blk", (r) => esc(r.block)],
  ["street_name", "Street", (r) => esc(titleCase(r.street_name))],
  ["storey_low", "Floors", (r) => esc(r.storey_range.replace(" TO ", "–"))],
  ["floor_area_sqm", "Sqm", (r) => r.floor_area_sqm, true],
  ["flat_model", "Model", (r) => esc(r.flat_model)],
  ["lease_commence_date", "Lease from", (r) => r.lease_commence_date, true],
  ["remaining_lease_months", "Lease left", (r) => `${Math.floor(r.remaining_lease_months / 12)}y ${r.remaining_lease_months % 12}m`, true],
  ["resale_price", "Price", (r) => `<span class="price">${fmtFull(r.resale_price)}</span>`, true],
  ["price_psf", "$ psf", (r) => fmtPsf(r.price_psf), true],
];

function fillSelect(select, values, format = titleCase) {
  select.insertAdjacentHTML("beforeend", values.map((v) => `<option value="${esc(v)}">${esc(format(v))}</option>`).join(""));
}

function exploreParams() {
  const params = Object.fromEntries(new FormData($("#explore-filters")).entries());
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== ""));
}

function initExplore() {
  const form = $("#explore-filters");
  fillSelect(form.town, state.meta.towns);
  fillSelect(form.flat_type, state.meta.flat_types);
  fillSelect(form.flat_model, state.meta.flat_models, (v) => v);
  form.month_from.min = form.month_to.min = state.meta.month_min;
  form.month_from.max = form.month_to.max = state.meta.month_max;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    explore.page = 1;
    loadExplore(true);
  });
  $("#explore-reset").addEventListener("click", () => {
    form.reset();
    explore.page = 1;
    loadExplore(true);
  });
  $("#explore-page-size").addEventListener("change", (e) => {
    explore.pageSize = +e.target.value;
    explore.page = 1;
    loadExplore(false);
  });
  $("#explore-prev").addEventListener("click", () => {
    explore.page = Math.max(1, explore.page - 1);
    loadExplore(false);
  });
  $("#explore-next").addEventListener("click", () => {
    explore.page += 1;
    loadExplore(false);
  });
  $("#explore-table").addEventListener("click", (e) => {
    const th = e.target.closest("th[data-sort]");
    if (th) {
      explore.dir = explore.sort === th.dataset.sort && explore.dir === "desc" ? "asc" : "desc";
      explore.sort = th.dataset.sort;
      explore.page = 1;
      return loadExplore(false);
    }
    const row = e.target.closest("[data-unit]");
    if (row) openBlock(row.dataset.unit);
  });
  bindSegmented("#explore-year-metric", (m) => {
    explore.metric = m;
    drawExploreYear();
  });
  loadExplore(true);
}

async function loadExplore(withSummary) {
  const params = exploreParams();
  $("#explore-export").href = `/api/transactions?${new URLSearchParams({ ...params, sort: explore.sort, dir: explore.dir, format: "csv" })}`;

  const tableCard = $("#explore-table").closest(".card");
  const tableReq = withLoading(
    tableCard,
    api("/api/transactions", { ...params, page: explore.page, page_size: explore.pageSize, sort: explore.sort, dir: explore.dir })
  ).then((data) => {
    const pages = Math.max(1, Math.ceil(data.total / data.page_size));
    $("#explore-count").textContent = fmtNum(data.total);
    $("#explore-page").textContent = `Page ${data.page.toLocaleString()} of ${pages.toLocaleString()}`;
    $("#explore-prev").disabled = data.page <= 1;
    $("#explore-next").disabled = data.page >= pages;
    $("#explore-table").innerHTML = `
      <thead><tr>${EXPLORE_COLUMNS.map(
        ([key, label, , num]) =>
          `<th data-sort="${key}" class="${num ? "num" : ""} ${explore.sort === key ? "sorted" : ""}">${label}${explore.sort === key ? (explore.dir === "asc" ? " ↑" : " ↓") : ""}</th>`
      ).join("")}</tr></thead>
      <tbody>${data.rows
        .map((r) => `<tr class="clickable" data-unit="${esc(r.unit_id)}">${EXPLORE_COLUMNS.map(([, , fmt, num]) => `<td class="${num ? "num" : ""}">${fmt(r)}</td>`).join("")}</tr>`)
        .join("") || `<tr><td colspan="${EXPLORE_COLUMNS.length}" class="muted">No transactions match these filters</td></tr>`}</tbody>`;
  });

  if (withSummary) {
    const summary = await withLoading($("#explore-kpis"), api("/api/summary", params));
    explore.summary = summary;
    const s = summary.stats;
    $("#explore-kpis").innerHTML = `
      <div class="kpi hero"><div class="label">Matching resales</div><div class="value">${fmtNum(s.count)}</div></div>
      <div class="kpi"><div class="label">Median price</div><div class="value">${fmtFull(s.median_price)}</div></div>
      <div class="kpi"><div class="label">Median $ psf</div><div class="value">${fmtPsf(s.median_psf)}</div></div>
      <div class="kpi"><div class="label">Price range</div><div class="value" style="font-size:1.2rem">${fmtMoney(s.min_price)} – ${fmtMoney(s.max_price)}</div></div>
      <div class="kpi"><div class="label">Average size</div><div class="value">${s.avg_area ? `${Math.round(s.avg_area)} sqm` : "–"}</div>
        <div class="sub">${s.avg_area ? `${fmtNum(s.avg_area * 10.7639)} sqft` : ""}</div></div>`;
    drawExploreYear();
    drawChart("chart-explore-hist", {
      type: "bar",
      data: {
        labels: summary.histogram.map((h) => fmtMoney(h.bucket)),
        datasets: [{ label: "Resales", data: summary.histogram.map((h) => h.count), backgroundColor: "#f26b7a", hoverBackgroundColor: "#c8102e", borderRadius: 3 }],
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: (c) => `${fmtMoney(summary.histogram[c[0].dataIndex].bucket)} – ${fmtMoney(summary.histogram[c[0].dataIndex].bucket + 50000)}` } },
        },
        scales: { x: { ticks: { maxTicksLimit: 12 } } },
      },
    });
  }
  await tableReq;
}

function drawExploreYear() {
  const s = explore.summary;
  if (!s) return;
  const m = explore.metric;
  drawChart("chart-explore-year", {
    type: m === "count" ? "bar" : "line",
    data: {
      labels: s.by_year.map((r) => r.year),
      datasets: [{ label: m, data: s.by_year.map((r) => r[m]), borderColor: "#c8102e", backgroundColor: m === "count" ? "#f26b7a" : "rgba(200,16,46,0.08)", fill: m !== "count", tension: 0.3, borderRadius: 3 }],
    },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => metricFmt(m)(c.parsed.y) } } }, scales: { y: metricAxis(m) } },
  });
}

// ================= towns =================

const towns = { data: null, sort: "median_price", dir: "desc", compare: ["BISHAN", "PUNGGOL", "WOODLANDS"], metric: "price", flatType: "" };

const TOWN_COLUMNS = [
  ["town", "Town", (r) => `<b>${esc(titleCase(r.town))}</b>`],
  ["median_price", "Median price", (r) => `<span class="price">${fmtFull(r.median_price)}</span>`, true],
  ["yoy_change", "YoY", (r) => deltaTag(r.yoy_change), true],
  ["median_psf", "$ psf", (r) => fmtPsf(r.median_psf), true],
  ["count", "Resales (12m)", (r) => fmtNum(r.count), true],
  ["max_price", "Top sale", (r) => fmtMoney(r.max_price), true],
  ["avg_lease_years", "Avg lease left", (r) => (r.avg_lease_years ? `${r.avg_lease_years.toFixed(0)} yrs` : "–"), true],
  ["blocks", "HDB blocks", (r) => fmtNum(r.blocks), true],
  ["dwelling_units", "Homes", (r) => fmtNum(r.dwelling_units), true],
  ["avg_year_completed", "Avg built", (r) => (r.avg_year_completed ? Math.round(r.avg_year_completed) : "–"), true],
  ["tallest", "Tallest", (r) => (r.tallest ? `${r.tallest} fl` : "–"), true],
];

async function loadTowns() {
  if (!$("#towns-flat-type").options.length || $("#towns-flat-type").options.length === 1) {
    fillSelect($("#towns-flat-type"), state.meta.flat_types);
    $("#towns-flat-type").addEventListener("change", (e) => {
      towns.flatType = e.target.value;
      loadTownsData();
      drawCompare();
    });
    bindSegmented("#compare-metric", (m) => {
      towns.metric = m;
      drawCompare();
    });
    $("#towns-table").addEventListener("click", (e) => {
      const th = e.target.closest("th[data-sort]");
      if (th) {
        towns.dir = towns.sort === th.dataset.sort && towns.dir === "desc" ? "asc" : "desc";
        towns.sort = th.dataset.sort;
        return renderTownsTable();
      }
      const row = e.target.closest("[data-town]");
      if (row) toggleCompare(row.dataset.town);
    });
    $("#compare-chips").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-town]");
      if (chip) toggleCompare(chip.dataset.town);
    });
  }
  loadTownsData();
  drawCompare();
}

async function loadTownsData() {
  const data = await withLoading($("#towns-table").closest(".card"), api("/api/towns", { flat_type: towns.flatType }));
  towns.data = data;
  $("#towns-subtitle").textContent = `Resales ${fmtMonth(data.window.from)} – ${fmtMonth(data.window.to)}${towns.flatType ? ` (${titleCase(towns.flatType)})` : ""}, plus every HDB block on record. YoY compares with the prior 12 months.`;
  renderTownsTable();
}

function renderTownsTable() {
  const rows = [...towns.data.towns].sort((a, b) => {
    const av = a[towns.sort];
    const bv = b[towns.sort];
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
    return towns.dir === "asc" ? cmp : -cmp;
  });
  $("#towns-table").innerHTML = `
    <thead><tr><th></th>${TOWN_COLUMNS.map(
      ([key, label, , num]) => `<th data-sort="${key}" class="${num ? "num" : ""} ${towns.sort === key ? "sorted" : ""}">${label}${towns.sort === key ? (towns.dir === "asc" ? " ↑" : " ↓") : ""}</th>`
    ).join("")}</tr></thead>
    <tbody>${rows
      .map(
        (r) => `<tr class="clickable" data-town="${esc(r.town)}">
          <td>${towns.compare.includes(r.town) ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${PALETTE[towns.compare.indexOf(r.town) % PALETTE.length]}"></span>` : ""}</td>
          ${TOWN_COLUMNS.map(([, , fmt, num]) => `<td class="${num ? "num" : ""}">${fmt(r)}</td>`).join("")}</tr>`
      )
      .join("")}</tbody>`;
}

function toggleCompare(town) {
  if (towns.compare.includes(town)) towns.compare = towns.compare.filter((t) => t !== town);
  else if (towns.compare.length < 8) towns.compare.push(town);
  drawCompare();
  if (towns.data) renderTownsTable();
}

async function drawCompare() {
  $("#compare-chips").innerHTML = towns.compare.length
    ? towns.compare
        .map((t, i) => `<button class="chip" data-town="${esc(t)}" style="border-color:${PALETTE[i % PALETTE.length]}"><span style="color:${PALETTE[i % PALETTE.length]}">●</span> ${esc(titleCase(t))}<span class="x">×</span></button>`)
        .join("")
    : `<span class="muted small">No towns selected</span>`;
  const data = await api("/api/compare", { town: towns.compare, flat_type: towns.flatType, metric: towns.metric });
  const years = [...new Set(data.series.flatMap((s) => s.points.map((p) => p.year)))].sort();
  const isPsf = towns.metric === "psf";
  drawChart("chart-compare", {
    type: "line",
    data: {
      labels: years,
      datasets: data.series.map((s, i) => {
        const byYear = new Map(s.points.map((p) => [p.year, p]));
        return {
          label: titleCase(s.town),
          data: years.map((y) => (byYear.get(y)?.count >= 5 ? byYear.get(y).value : null)),
          borderColor: PALETTE[i % PALETTE.length],
          backgroundColor: PALETTE[i % PALETTE.length],
          tension: 0.3,
          spanGaps: true,
        };
      }),
    },
    options: {
      plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${isPsf ? fmtPsf(c.parsed.y) : fmtFull(c.parsed.y)}` } } },
      scales: { y: isPsf ? psfAxis : moneyAxis },
    },
  });
}

// ================= insights =================

const insights = { flatType: "4 ROOM" };

function loadInsights() {
  $("#insights-types").innerHTML = state.meta.flat_types
    .map((t) => `<button class="chip ${t === insights.flatType ? "active" : ""}" data-type="${esc(t)}">${esc(titleCase(t))}</button>`)
    .join("");
  $("#insights-types").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-type]");
    if (!chip) return;
    insights.flatType = chip.dataset.type;
    $$("#insights-types .chip").forEach((c) => c.classList.toggle("active", c === chip));
    loadInsightsData();
  });
  bindRowClicks("#table-priciest");
  bindRowClicks("#table-value");
  loadInsightsData();
}

async function loadInsightsData() {
  const d = await withLoading($("#view-insights .grid"), api("/api/insights", { flat_type: insights.flatType }));
  $("#insights-subtitle").textContent = `${titleCase(d.flat_type)} resales, ${fmtMonth(d.window.from)} – ${fmtMonth(d.window.to)}.`;

  const barOpts = (fmt) => ({ plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fmt(c.parsed.y ?? c.parsed.x) } } } });

  drawChart("chart-storey", {
    type: "bar",
    data: {
      labels: d.storey_premium.map((r) => r.storey_range.replace(" TO ", "–")),
      datasets: [{ data: d.storey_premium.map((r) => r.median_psf), backgroundColor: d.storey_premium.map((_, i, a) => colorScale(i / Math.max(1, a.length - 1))), borderRadius: 4 }],
    },
    options: { ...barOpts(fmtPsf), scales: { y: psfAxis, x: { title: { display: true, text: "Floors" } } } },
  });

  drawChart("chart-model", {
    type: "bar",
    data: {
      labels: d.by_model.map((r) => r.flat_model),
      datasets: [{ data: d.by_model.map((r) => r.median_psf), backgroundColor: "#f26b7a", hoverBackgroundColor: "#c8102e", borderRadius: 4 }],
    },
    options: { ...barOpts(fmtPsf), indexAxis: "y", scales: { x: psfAxis } },
  });

  const blockTable = (rows, extra) => `
    <thead><tr><th>#</th><th>Block</th><th>Town</th><th class="num">$ psf</th><th class="num">Median</th>${extra ? `<th class="num">Lease left</th>` : ""}<th class="num">Sales</th></tr></thead>
    <tbody>${rows
      .map(
        (r, i) => `<tr class="clickable" data-unit="${esc(r.unit_id)}"><td class="muted">${i + 1}</td><td>${esc(blockLabel(r.unit_id))}</td>
          <td>${esc(titleCase(r.town))}</td><td class="num price">${fmtPsf(r.median_psf)}</td><td class="num">${fmtMoney(r.median_price)}</td>
          ${extra ? `<td class="num">${r.lease_years.toFixed(0)} yrs</td>` : ""}<td class="num">${r.count}</td></tr>`
      )
      .join("")}</tbody>`;
  $("#table-priciest").innerHTML = blockTable(d.priciest_blocks, false);
  $("#table-value").innerHTML = blockTable(d.best_value, true);
}

// ================= model =================

async function loadModel() {
  const m = await withLoading($("#model-kpis"), api("/api/model"));
  if (!m.summary) {
    $("#model-subtitle").textContent = "The model hasn't been trained yet. Run build_price_model.py, then reload.";
    return;
  }
  const s = m.summary;
  const mm = s.model;
  const pct = (v, digits = 0) => `${(v * 100).toFixed(digits)}%`;
  $("#model-subtitle").textContent = `Learned from ${fmtNum(s.n_total)} resales (${fmtMonth(s.window.from)} – ${fmtMonth(s.window.to)}), then checked against ${fmtNum(s.n_test)} newer sales it hadn't seen.`;

  $("#model-kpis").innerHTML = `
    <div class="kpi hero"><div class="label">Typical miss</div><div class="value">±${pct(mm.mape, 1)}</div>
      <div class="sub">vs ±${pct(s.baseline.mape, 1)} using the town's median price</div></div>
    <div class="kpi"><div class="label">Within 5% of the real price</div><div class="value">${pct(mm.within_5pct)}</div><div class="sub">of sales</div></div>
    <div class="kpi"><div class="label">Within 10%</div><div class="value">${pct(mm.within_10pct)}</div><div class="sub">of sales</div></div>
    <div class="kpi"><div class="label">Inside the estimate range</div><div class="value">${pct(mm.interval_coverage)}</div><div class="sub">of sales</div></div>`;

  drawChart("chart-model-importance", {
    type: "bar",
    data: {
      labels: m.importance.map((r) => r.factor),
      datasets: [{ data: m.importance.map((r) => r.share * 100), backgroundColor: m.importance.map((_, i, a) => colorScale(1 - i / Math.max(1, a.length - 1))), borderRadius: 4 }],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.parsed.x.toFixed(0)}% of what the model relies on` } } },
      scales: { x: { ticks: { callback: (v) => `${v}%` } } },
    },
  });

  $("#model-method").innerHTML = `
    <p style="margin-top:0"><b>What it learns from.</b> Every HDB resale in the last 3 years: the flat's type, model, size, floor
      and lease left, and the block's location, MRT and bus access, CBD commute, nearby food, clinics, parks and schools.</p>
    <p><b>How we check it.</b> It learns only from sales before ${fmtMonth(s.test_from)}, then prices the ${fmtNum(s.n_test)} sales
      since. Its typical miss is ±${pct(mm.mape, 1)}, against ±${pct(s.baseline.mape, 1)} if you just used the town's median
      price for that flat type.</p>
    <p><b>The range.</b> Each estimate comes with a low–high range that ${pct(mm.interval_coverage)} of real sales fell inside.</p>
    <p><b>Block estimates.</b> For each block, it prices the block's usual flat of each type on every floor band, at
      ${fmtMonth(s.predicted_month)} prices.</p>
    <p style="margin-bottom:0"><b>What it can't see.</b> Renovation, facing, view, noise or the exact unit, so a particular flat can
      sell well above or below. It also doesn't forecast. Treat it as a reference point, not a valuation.</p>`;

  $("#model-towns").innerHTML = `
    <thead><tr><th>Town</th><th class="num">Typical miss</th><th class="num">Sales checked</th></tr></thead>
    <tbody>${m.town_errors
      .map((t) => `<tr><td>${esc(titleCase(t.town))}</td><td class="num"><b>±${pct(t.mape, 1)}</b></td><td class="num muted">${fmtNum(t.n)}</td></tr>`)
      .join("")}</tbody>`;
}

// ================= livability =================

const liv = { meta: null, persona: "balanced", town: "", sort: "overall", minLease: "", maxPsf: "", rows: [], total: 0 };

const PERSONA_BLURBS = {
  balanced: "Every pillar counts equally",
  family: "Schools, parks and clinics count most",
  commuter: "MRT access and CBD distance count most",
  retiree: "Clinics, food, shops and parks count most",
  budget: "Value and lease left count most",
};
const PILLAR_SHORT = {
  transport: "MRT",
  cbd: "CBD",
  food: "Food",
  shopping: "Shops",
  health: "Clinic",
  green: "Green",
  schools: "School",
  value: "Value",
  lease: "Lease",
};

const fmtDist = (m) => (m == null ? "–" : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const fmtMin = (m) => (m == null ? "–" : `${Math.round(m)} min`);

const LINE_INFO = {
  NSL: ["NS", "#d42e12"],
  EWL: ["EW", "#009645"],
  NEL: ["NE", "#9900aa"],
  CCL: ["CC", "#fa9e0d"],
  DTL: ["DT", "#005ec4"],
  TEL: ["TE", "#9d5b25"],
  BPLRT: ["BP", "#748477"],
  SKLRT: ["SK", "#748477"],
  PGLRT: ["PG", "#748477"],
};
const lineChips = (csvLines) =>
  (csvLines || "")
    .split(",")
    .filter(Boolean)
    .map((g) => {
      const [label, color] = LINE_INFO[g] || [g, "#6f6466"];
      return `<span class="line-chip" style="background:${color}" title="${esc(g)}">${label}</span>`;
    })
    .join("");
const stationName = (s) => titleCase(s || "");

function scoreCell(v, big = false) {
  if (v == null) return `<span class="score empty">–</span>`;
  const t = (v - 1) / 9;
  return `<span class="score ${big ? "big" : ""}" style="background:${colorScale(t)};color:${t > 0.4 ? "#fff" : "#5a0614"}">${v.toFixed(1)}</span>`;
}

async function loadLivability() {
  const m = (liv.meta = await api("/api/livability/meta"));
  if (!m.scored_blocks) {
    $("#liv-subtitle").textContent = "Livability scores haven't been built yet. Run build_livability.py, then reload.";
    return;
  }
  $("#liv-subtitle").textContent = `${fmtNum(m.scored_blocks)} of ${fmtNum(m.residential_blocks)} residential HDB blocks, each scored 1–10 on ${m.pillars.length} pillars. Pick who's moving in.`;

  $("#liv-personas").innerHTML = m.personas
    .map(
      (p) => `<button class="persona ${p.key === liv.persona ? "active" : ""}" data-persona="${esc(p.key)}">
        <b>${esc(p.label)}</b><span>${esc(PERSONA_BLURBS[p.key] || "")}</span></button>`
    )
    .join("");
  $("#liv-personas").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-persona]");
    if (!btn) return;
    liv.persona = btn.dataset.persona;
    $$("#liv-personas .persona").forEach((b) => b.classList.toggle("active", b === btn));
    loadLivTowns();
    loadLivBlocks(true);
  });

  $("#liv-method").innerHTML = `
    <p class="small" style="margin: 0 0 12px; line-height: 1.6">Each block is compared with every other HDB block:
      <b>10</b> means top of the pack, <b>5.5</b> is the middle. Pick who's moving in above and the overall score
      weighs what matters to them.</p>
    <ul class="pillar-list">${m.pillars.map((p) => `<li><b>${esc(p.label)}</b><span>${esc(p.desc)}</span></li>`).join("")}</ul>
    <details class="more" style="margin-top: 14px">
      <summary>Weights and data sources</summary>
      <div class="table-wrap" style="margin-top: 10px"><table class="weights">
        <thead><tr><th>Weights</th>${m.pillars.map((p) => `<th class="num">${PILLAR_SHORT[p.key]}</th>`).join("")}</tr></thead>
        <tbody>${m.personas
          .map((per) => `<tr><td>${esc(per.label)}</td>${m.pillars.map((p) => `<td class="num">${per.weights[p.key] || "–"}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>
      <p class="muted small" style="margin: 10px 0 0; line-height: 1.6">
        Travel times are estimates from walking speed, real bus routes and train speeds, for comparing blocks rather than
        planning trips. Other distances are straight-line.</p>
      <p class="muted small" style="margin: 10px 0 0; line-height: 1.6">
        Sources: LTA (MRT stations), busrouter.sg (bus routes), NEA (hawker centres), MOH (GPs, dentists), HPB (polyclinics),
        NParks (parks), MOE (primary schools), HDB (resale prices), and OpenStreetMap (supermarkets, malls, food courts and
        coffee shops, as mapped by volunteers).</p>
    </details>`;

  fillSelect($("#liv-town"), state.meta.towns.filter((t) => t !== "LIM CHU KANG"));
  $("#liv-sort").insertAdjacentHTML("beforeend", m.pillars.map((p) => `<option value="${esc(p.key)}">Sort: ${esc(p.label)}</option>`).join(""));
  const onFilter = () => {
    liv.town = $("#liv-town").value;
    liv.sort = $("#liv-sort").value;
    liv.minLease = $("#liv-lease").value;
    liv.maxPsf = $("#liv-psf").value;
    highlightLivTown();
    loadLivBlocks(true);
  };
  ["#liv-town", "#liv-sort", "#liv-lease", "#liv-psf"].forEach((sel) => $(sel).addEventListener("change", onFilter));
  $("#liv-more").addEventListener("click", () => loadLivBlocks(false));
  $("#liv-towns").addEventListener("click", (e) => {
    const row = e.target.closest("[data-town]");
    if (!row) return;
    $("#liv-town").value = liv.town === row.dataset.town ? "" : row.dataset.town;
    onFilter();
  });
  bindRowClicks("#liv-blocks");

  await loadLivTowns();
  loadLivBlocks(true);
}

async function loadLivTowns() {
  const data = await withLoading($("#liv-towns").closest(".card"), api("/api/livability/towns", { persona: liv.persona }));
  const pillars = liv.meta.pillars;
  $("#liv-towns").innerHTML = `
    <thead><tr><th>#</th><th>Town</th><th class="num">Score</th><th class="num" title="Median modelled commute to Raffles Place">To CBD</th>
      ${pillars.map((p) => `<th class="num" title="${esc(p.label)}">${PILLAR_SHORT[p.key]}</th>`).join("")}</tr></thead>
    <tbody>${data.towns
      .map(
        (t, i) => `<tr class="clickable" data-town="${esc(t.town)}"><td class="muted">${i + 1}</td>
          <td><b>${esc(titleCase(t.town))}</b><div class="muted small">${fmtNum(t.blocks)} blocks</div></td>
          <td class="num">${scoreCell(t.overall, true)}</td><td class="num small">${fmtMin(t.cbd_min)}</td>
          ${pillars.map((p) => `<td class="num">${scoreCell(t[`score_${p.key}`])}</td>`).join("")}</tr>`
      )
      .join("")}</tbody>`;
  highlightLivTown();

  const top = data.towns[0];
  const fastest = data.towns.reduce((a, b) => (b.cbd_min < a.cbd_min ? b : a));
  const persona = liv.meta.personas.find((p) => p.key === liv.persona);
  $("#liv-kpis").innerHTML = `
    <div class="kpi hero"><div class="label">Best town · ${esc(persona.label)}</div>
      <div class="value">${esc(titleCase(top.town))}</div><div class="sub">Median block scores ${top.overall.toFixed(1)} / 10</div></div>
    <div class="kpi" id="liv-top-block"><div class="label">Best block · ${esc(persona.label)}</div><div class="value">–</div></div>
    <div class="kpi"><div class="label">Shortest commute</div>
      <div class="value">${esc(titleCase(fastest.town))}</div><div class="sub">~${Math.round(fastest.cbd_min)} min median to Raffles Place</div></div>
    <div class="kpi"><div class="label">Blocks scored</div><div class="value">${fmtNum(liv.meta.scored_blocks)}</div>
      <div class="sub">of ${fmtNum(liv.meta.residential_blocks)} residential blocks</div></div>`;
}

function highlightLivTown() {
  $$("#liv-towns tr[data-town]").forEach((tr) => (tr.style.background = tr.dataset.town === liv.town ? "var(--red-soft)" : ""));
}

async function loadLivBlocks(reset) {
  if (reset) liv.rows = [];
  const data = await withLoading(
    $("#liv-blocks").closest(".card"),
    api("/api/livability/blocks", {
      persona: liv.persona,
      town: liv.town,
      sort: liv.sort,
      min_lease: liv.minLease,
      max_psf: liv.maxPsf,
      limit: 50,
      offset: liv.rows.length,
    })
  );
  liv.rows = liv.rows.concat(data.rows);
  liv.total = data.total;
  const pillars = liv.meta.pillars;
  $("#liv-blocks").innerHTML = `
    <thead><tr><th>#</th><th>Block</th><th class="num">Score</th><th class="num" title="Modelled commute to Raffles Place">To CBD</th>
      ${pillars.map((p) => `<th class="num" title="${esc(p.label)}">${PILLAR_SHORT[p.key]}</th>`).join("")}
      <th class="num">$ psf</th><th class="num">Lease left</th></tr></thead>
    <tbody>${
      liv.rows
        .map(
          (r, i) => `<tr class="clickable" data-unit="${esc(r.unit_id)}"><td class="muted">${i + 1}</td>
            <td>${esc(blockLabel(r.unit_id))}<div class="muted small">${esc(titleCase(r.town))}</div></td>
            <td class="num">${scoreCell(r.overall, true)}</td><td class="num small">${fmtMin(r.cbd_min)}</td>
            ${pillars.map((p) => `<td class="num">${scoreCell(r[`score_${p.key}`])}</td>`).join("")}
            <td class="num"${r.median_psf == null ? ` title="No resales in the last 3 years, so Value is 5.0"` : ""}>${fmtPsf(r.median_psf)}</td>
            <td class="num">${r.lease_left_years != null ? `${r.lease_left_years} yrs` : "–"}</td></tr>`
        )
        .join("") || `<tr><td colspan="${pillars.length + 6}" class="muted">No blocks match these filters</td></tr>`
    }</tbody>`;
  $("#liv-count").textContent = `Showing ${fmtNum(liv.rows.length)} of ${fmtNum(liv.total)} blocks · $ psf "–" means no resales in 3 years (Value set to 5.0)`;
  $("#liv-more").style.display = liv.rows.length < liv.total ? "" : "none";

  if (reset && !liv.town && liv.sort === "overall" && !liv.minLease && !liv.maxPsf && liv.rows[0]) {
    const best = liv.rows[0];
    $("#liv-top-block").innerHTML = `<div class="label">Best block · ${esc(liv.meta.personas.find((p) => p.key === liv.persona).label)}</div>
      <div class="value" style="font-size:1.25rem">${esc(blockLabel(best.unit_id))}</div>
      <div class="sub">${esc(titleCase(best.town))} · ${best.overall.toFixed(1)} / 10</div>`;
    $("#liv-top-block").style.cursor = "pointer";
    $("#liv-top-block").onclick = () => openBlock(best.unit_id);
  }
}

function renderBlockLivability(d) {
  const box = $("#bld-liv");
  const lv = d.livability;
  if (!lv) {
    box.innerHTML = `<h3>Neighbourhood score</h3><p class="muted">${
      d.listed ? "Not scored yet. Scores appear once this block has been geocoded." : "Only blocks in HDB's current register are scored."
    }</p>`;
    return;
  }
  const pillars = [
    ["transport", "Transport"],
    ["cbd", "CBD commute"],
    ["food", "Food"],
    ["shopping", "Shopping"],
    ["health", "Healthcare"],
    ["green", "Green space"],
    ["schools", "Schools"],
    ["value", "Value"],
    ["lease", "Lease"],
  ];
  const personaLabels = { balanced: "Balanced", family: "Young family", commuter: "Commuter", retiree: "Retiree", budget: "Budget" };
  box.innerHTML = `
    <div class="card-head"><h3>Neighbourhood score</h3>
      <a class="link small" data-go-liv>Compare neighbourhoods →</a></div>
    <div class="liv-overall">${Object.entries(lv.overall)
      .map(([k, v]) => `<div><div class="small muted">${personaLabels[k] || k}</div>${scoreCell(v, true)}</div>`)
      .join("")}</div>
    <p class="small muted" style="margin: 10px 0 0">Scores out of 10 for each kind of buyer. The balanced score beats
      ${Math.round(lv.better_than * 100)}% of HDB blocks.</p>
    <div class="liv-block" style="margin-top: 8px">
      <div class="chart" style="height: 300px"><canvas id="chart-block-liv"></canvas></div>
      <div class="liv-facts">
        <div><span class="label">To Raffles Place</span><b>${fmtMin(lv.cbd_min)}</b><span class="muted small">door to door by public transport</span></div>
        <div><span class="label">Rail lines within 15 min</span><b>${lineChips(lv.lines_15min_list) || "None"}</b></div>
        <div><span class="label">Bus services</span><b>${lv.bus_services_400m}</b><span class="muted small">at stops within 400 m</span></div>
        <div><span class="label">Hawker stalls within 1 km</span><b>${fmtNum(lv.hawker_stalls_1km)}</b></div>
        <div><span class="label">Supermarkets within 1 km</span><b>${fmtNum(lv.supermarkets_1km)}</b></div>
        <div><span class="label">GPs within 1 km</span><b>${fmtNum(lv.gps_1km)}</b></div>
      </div>
    </div>`;
  box.querySelector("[data-go-liv]").addEventListener("click", () => go("#livability"));

  drawChart("chart-block-liv", {
    type: "radar",
    data: {
      labels: pillars.map(([, label]) => label),
      datasets: [
        {
          label: "This block",
          data: pillars.map(([k]) => lv[`score_${k}`]),
          borderColor: "#c8102e",
          backgroundColor: "rgba(200,16,46,0.15)",
          pointBackgroundColor: "#c8102e",
          pointRadius: 3,
        },
        {
          label: `${titleCase(lv.town)} median`,
          data: pillars.map(([k]) => lv.town_scores[k]),
          borderColor: "#9a8f90",
          borderDash: [4, 4],
          backgroundColor: "transparent",
          pointRadius: 0,
        },
      ],
    },
    options: {
      interaction: { mode: "nearest", intersect: false },
      scales: { r: { min: 0, max: 10, ticks: { stepSize: 2, backdropColor: "transparent" }, pointLabels: { font: { size: 11, weight: "600" } } } },
      plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.r.toFixed(1)}` } } },
    },
  });
}

// ================= map =================

const mapState = { map: null, markers: [], points: [], metric: "median_psf", legend: null, data: null, cluster: null, binFor: null };
const MAP_BINS = ["#ffd0d6", "#f8a1ac", "#f26b7a", "#c8102e", "#6e0618"];
const MAP_NO_DATA = "#bdb3b5";
const MAP_METRICS = {
  median_psf: "Median $ psf",
  adjusted_psf: "Lease-adjusted $ psf",
};

function mapBins(metric) {
  const values = mapState.points.map((p) => p[metric]).filter((v) => v != null).sort((a, b) => a - b);
  const q = (p) => values[Math.floor(p * (values.length - 1))];
  const cuts = values.length ? [q(0.2), q(0.4), q(0.6), q(0.8)] : [];
  return { cuts, edges: [values[0], ...cuts, values[values.length - 1]], binFor: (v) => (v == null ? -1 : cuts.filter((c) => v > c).length) };
}

// Group bubble: coloured by the median of its blocks' values on the same scale as single dots.
function clusterIcon(cluster) {
  const children = cluster.getAllChildMarkers();
  const values = children.map((m) => m.mapValue).filter((v) => v != null).sort((a, b) => a - b);
  const median = values.length ? values[Math.floor(values.length / 2)] : null;
  const bin = mapState.binFor ? mapState.binFor(median) : -1;
  const size = Math.round(36 + Math.min(28, Math.log2(children.length) * 3));
  const light = bin < 2;
  return L.divIcon({
    className: "cluster-icon",
    iconSize: L.point(size, size),
    html: `<div class="cluster-bubble" style="width:${size}px;height:${size}px;background:${bin < 0 ? MAP_NO_DATA : MAP_BINS[bin]};color:${light ? "#5a0614" : "#fff"}">
      <b>${median != null ? fmtPsf(median) : "–"}</b><span>${fmtNum(children.length)}</span></div>`,
  });
}

function colourMap() {
  const metric = mapState.metric;
  const { edges, binFor } = mapBins(metric);
  mapState.binFor = binFor;
  mapState.markers.forEach((marker, i) => {
    marker.mapValue = mapState.points[i][metric];
    const bin = binFor(marker.mapValue);
    marker.setStyle({ fillColor: bin < 0 ? MAP_NO_DATA : MAP_BINS[bin] });
  });
  // refreshClusters throws until the group has been added to the map.
  if (mapState.cluster && mapState.map.hasLayer(mapState.cluster)) mapState.cluster.refreshClusters();
  if (mapState.legend) mapState.legend.remove();
  mapState.legend = L.control({ position: "bottomright" });
  mapState.legend.onAdd = () => {
    const div = L.DomUtil.create("div", "map-legend");
    div.innerHTML = `<b>${MAP_METRICS[metric]}</b><br>${MAP_BINS.map(
      (c, i) => `<i style="background:${c}"></i>${fmtPsf(edges[i])} – ${fmtPsf(edges[i + 1])}`
    ).join("<br>")}<br><i style="background:${MAP_NO_DATA}"></i>No recent sales`;
    return div;
  };
  mapState.legend.addTo(mapState.map);
}

function mapPopup(p, reference) {
  const priced = p.median_psf != null;
  const premium = priced && p.adjusted_psf ? p.adjusted_psf / p.median_psf - 1 : null;
  return `<b>${esc(blockLabel(p.unit_id))}</b><br>${esc(titleCase(p.town || ""))} ${p.postal_code ? `· ${esc(p.postal_code)}` : ""}<br>
    ${
      priced
        ? `<b>${fmtPsf(p.median_psf)} psf</b> · ${fmtMoney(p.median_price)} median · ${p.count} sales<br>
           ~${p.lease_years} yrs lease left${
             premium != null && Math.abs(premium) >= 0.005 ? ` · ${fmtPsf(p.adjusted_psf)} psf if it had ${reference} yrs` : ""
           }`
        : "No resales in the last 3 years"
    }<br>
    ${p.max_floor_lvl ? `${p.max_floor_lvl} storeys · built ${p.year_completed}` : ""}<br>
    <a class="link popup-open" data-unit="${esc(p.unit_id)}">Open this block →</a>`;
}

function drawLeaseCurve(data) {
  const curve = data.lease_curve.filter((r) => r.n >= 30);
  if (!curve.length) return;
  const pct = (factor) => 100 / factor;
  const at = (yrs) => curve.reduce((a, b) => (Math.abs(b.lease_years - yrs) < Math.abs(a.lease_years - yrs) ? b : a));
  $("#map-curve-note").innerHTML = `Estimated from ${fmtNum(curve.reduce((s, r) => s + r.n, 0))} resales since ${fmtMonth(data.since)},
    holding town, flat type, floor level and month equal. A flat with <b>60 years</b> left sells at about
    <b>${Math.round(pct(at(60).factor))}%</b> of the $ psf of one with ${data.reference_years} years, and <b>80 years</b> at about
    <b>${Math.round(pct(at(80).factor))}%</b>. Lease-adjusted $ psf scales each sale up (or down) to its ${data.reference_years}-year
    equivalent, so you can compare locations without old leases looking like bargains.`;
  drawChart("chart-lease-curve", {
    type: "line",
    data: {
      labels: curve.map((r) => r.lease_years),
      datasets: [
        {
          label: `% of ${data.reference_years}-year $ psf`,
          data: curve.map((r) => pct(r.factor)),
          borderColor: "#c8102e",
          backgroundColor: "rgba(200,16,46,0.08)",
          fill: true,
          tension: 0.25,
          pointRadius: 0,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (c) => `${c[0].label} years left`, label: (c) => `${c.parsed.y.toFixed(0)}% of a ${data.reference_years}-year flat` } } },
      scales: {
        x: { title: { display: true, text: "Years of lease left at sale" }, ticks: { maxTicksLimit: 12 } },
        y: { suggestedMin: 50, max: 105, ticks: { callback: (v) => `${v}%` } },
      },
    },
  });
}

async function loadMap() {
  const map = L.map("map", { preferCanvas: true }).setView([1.3521, 103.8198], 12);
  mapState.map = map;
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  const data = (mapState.data = await api("/api/map"));
  mapState.points = data.points.map((row) => Object.fromEntries(data.columns.map((c, i) => [c, row[i]])));
  const hasAdjusted = mapState.points.some((p) => p.adjusted_psf != null);
  if (!hasAdjusted) mapState.metric = "median_psf";

  $("#map-subtitle").textContent = `${fmtNum(mapState.points.length)} of ${fmtNum(state.meta.block_count)} HDB blocks, coloured by resales since ${fmtMonth(data.since)}.`;

  mapState.markers = mapState.points.map((p) =>
    L.circleMarker([p.latitude, p.longitude], { radius: 5, weight: 1, color: "#fff", fillColor: MAP_NO_DATA, fillOpacity: 0.9 }).bindPopup(
      () => mapPopup(p, data.reference_years)
    )
  );
  mapState.cluster = L.markerClusterGroup({
    chunkedLoading: true,
    showCoverageOnHover: false,
    maxClusterRadius: 55,
    disableClusteringAtZoom: 16,
    spiderfyOnMaxZoom: false,
    iconCreateFunction: clusterIcon,
  });
  colourMap();
  mapState.cluster.addLayers(mapState.markers);
  map.addLayer(mapState.cluster);

  if (hasAdjusted) {
    const toggle = L.control({ position: "topright" });
    toggle.onAdd = () => {
      const div = L.DomUtil.create("div", "segmented map-toggle");
      div.innerHTML = Object.entries(MAP_METRICS)
        .map(([k, label]) => `<button data-value="${k}" class="${k === mapState.metric ? "active" : ""}">${label}</button>`)
        .join("");
      L.DomEvent.disableClickPropagation(div);
      div.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        mapState.metric = btn.dataset.value;
        $$("button", div).forEach((b) => b.classList.toggle("active", b === btn));
        colourMap();
      });
      return div;
    };
    toggle.addTo(map);
    drawLeaseCurve(data);
  } else {
    $("#map-curve-card").style.display = "none";
  }

  loadPois(map);

  L.marker([1.3624, 103.8433], {
    icon: L.divIcon({ className: "otter-marker", html: `<img src="/static/otter.svg" width="34" height="34" alt="">`, iconSize: [34, 34], iconAnchor: [17, 17] }),
    zIndexOffset: 1000,
  })
    .bindPopup("<b>The Bishan otter family</b><br>Singapore's most famous residents.<br>Resale price paid: $0.")
    .addTo(map);

  $("#map").addEventListener("click", (e) => {
    const link = e.target.closest(".popup-open");
    if (link) openBlock(link.dataset.unit);
  });
}

// Centre the map on the open building and ring it.
function focusMap(lat, lon) {
  const map = mapState.map;
  if (!map) return;
  map.setView([lat, lon], Math.max(map.getZoom(), 16));
  if (mapState.focus) mapState.focus.setLatLng([lat, lon]);
  else mapState.focus = L.circleMarker([lat, lon], { radius: 11, weight: 3, color: "#111", fill: false, interactive: false }).addTo(map);
}

// ----- places layers (hawkers, supermarkets, malls, ...) -----

const POI_MIN_ZOOM = 14; // below this the places would bury the price dots
const poiState = { layers: {}, markers: {}, byName: {}, shown: new Set(["mrt", "hawker", "supermarket", "mall"]), control: null };

function poiPopup(kind, name, detail, lat, lon) {
  const k = POI_KINDS[kind];
  const shown = kind === "mrt" || kind === "primary_school" || kind === "park" ? titleCase(name) : name;
  const lines = [`<b>${k.icon} ${esc(shown)}</b>`];
  if (kind === "mrt" && detail?.lines) lines.push(lineChips(detail.lines));
  else lines.push(`<span class="muted">${esc(k.label.replace(/s( &|$)/, "$1"))}</span>`);
  if (detail?.stalls) lines.push(`${detail.stalls} cooked food stalls`);
  if (detail?.address) lines.push(`<span class="muted">${esc(detail.address)}</span>`);
  const query = kind === "mrt" ? `${stationName(name)} MRT station` : `${name} Singapore`;
  lines.push(`<a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}">Reviews on Google Maps ↗</a>`);
  return lines.join("<br>");
}

async function loadPois(map) {
  const data = await api("/api/amenities");
  for (const [kind, rows] of Object.entries(data.kinds)) {
    const k = POI_KINDS[kind];
    if (!k) continue;
    const icon = L.divIcon({ className: "poi-icon", html: `<span style="background:${k.color}">${k.icon}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
    const layer = L.layerGroup();
    rows.forEach(([id, lat, lon, name, detail]) => {
      const marker = L.marker([lat, lon], { icon, keyboard: false, zIndexOffset: 400 }).bindPopup(() => poiPopup(kind, name, detail, lat, lon));
      layer.addLayer(marker);
      poiState.markers[id] = { marker, kind };
      poiState.byName[`${kind}|${name}`] = id;
    });
    poiState.layers[kind] = layer;
  }

  poiState.control = L.control({ position: "bottomleft" });
  poiState.control.onAdd = () => {
    const div = L.DomUtil.create("div", "poi-control");
    div.innerHTML = `<span class="poi-control-head">Places</span>${Object.entries(POI_KINDS)
      .filter(([kind]) => poiState.layers[kind])
      .map(
        ([kind, k]) => `<button type="button" class="poi-toggle ${poiState.shown.has(kind) ? "on" : ""}" data-kind="${kind}" title="${k.label}"
          aria-pressed="${poiState.shown.has(kind)}"><span class="poi-dot" style="background:${k.color}">${k.icon}</span></button>`
      )
      .join("")}<span class="poi-control-hint">Zoom in to see places</span>`;
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    div.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-kind]");
      if (!btn) return;
      const kind = btn.dataset.kind;
      if (poiState.shown.has(kind)) poiState.shown.delete(kind);
      else poiState.shown.add(kind);
      syncPoiLayers();
    });
    return div;
  };
  poiState.control.addTo(map);
  map.on("zoomend", syncPoiLayers);
  syncPoiLayers();
}

function syncPoiLayers() {
  const map = mapState.map;
  const zoomedIn = map.getZoom() >= POI_MIN_ZOOM;
  for (const [kind, layer] of Object.entries(poiState.layers)) {
    const want = zoomedIn && poiState.shown.has(kind);
    if (want && !map.hasLayer(layer)) map.addLayer(layer);
    else if (!want && map.hasLayer(layer)) map.removeLayer(layer);
  }
  const box = poiState.control?.getContainer();
  if (!box) return;
  box.classList.toggle("zoomed-out", !zoomedIn);
  $$("[data-kind]", box).forEach((b) => {
    b.classList.toggle("on", poiState.shown.has(b.dataset.kind));
    b.setAttribute("aria-pressed", poiState.shown.has(b.dataset.kind));
  });
}

// Show one place from a nearby list: switch its layer on, centre on it and open its popup.
function focusPoi(key) {
  const entry = poiState.markers[key] || poiState.markers[poiState.byName[key]];
  if (!entry) return;
  poiState.shown.add(entry.kind);
  const map = mapState.map;
  map.setView(entry.marker.getLatLng(), Math.max(map.getZoom(), 16));
  syncPoiLayers();
  entry.marker.openPopup();
  const rect = $("#map").getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight) $("#map").scrollIntoView({ behavior: "smooth", block: "center" });
}

// ================= boot =================

async function boot() {
  $(".brand").addEventListener("click", () => go("#building"));
  syncHeaderHeight();
  window.addEventListener("resize", syncHeaderHeight);
  initBuildingSearch();
  state.meta = await api("/api/meta");
  renderBuildingExamples();
  $("#empty-otter").innerHTML = standingOtter(122, 117, 2.4, "");
  loadOnce("map");
  watchSections();
  window.addEventListener("hashchange", route);
  route();
}

boot();
