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

const state = { meta: null, loaded: {}, analyseSub: "explore" };
const TABS = ["overview", "building", "analyse", "livability", "map"];
const ANALYSE_SUBS = ["explore", "towns", "insights", "correlations"];
const LOADERS = {
  overview: loadOverview,
  building: () => {},
  map: loadMap,
  livability: loadLivability,
  explore: initExplore,
  towns: loadTowns,
  insights: loadInsights,
  correlations: loadCorrelations,
};

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function showTab(name) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
}

function showSubTab(sub) {
  $$(".subtab").forEach((t) => t.classList.toggle("active", t.dataset.sub === sub));
  $$(".subview").forEach((v) => v.classList.toggle("active", v.id === `view-${sub}`));
}

function loadOnce(name) {
  if (state.loaded[name]) return;
  state.loaded[name] = true;
  LOADERS[name]();
}

function route() {
  let [tab, kind, ...rest] = location.hash.replace(/^#/, "").split("/");
  // Explore/Towns/Insights used to be top-level tabs; keep their old links working.
  if (ANALYSE_SUBS.includes(tab)) [tab, kind] = ["analyse", tab];
  const name = TABS.includes(tab) ? tab : "overview";
  showTab(name);

  if (name === "building" && kind) {
    const value = decodeURIComponent(rest.join("/"));
    loadBuilding(kind === "postal" ? { postal: value } : { unit_id: value });
  }
  if (name === "analyse") {
    if (ANALYSE_SUBS.includes(kind)) state.analyseSub = kind;
    showSubTab(state.analyseSub);
    loadOnce(state.analyseSub);
  } else {
    loadOnce(name);
  }
  if (name === "map" && mapState.map) setTimeout(() => mapState.map.invalidateSize(), 50);
}

function openBlock(unitId) {
  go(`#building/unit/${encodeURIComponent(unitId)}`);
}

function openPostal(postal) {
  go(`#building/postal/${postal}`);
}

// ================= overview =================

function renderHero(h) {
  const stats = [
    [h.transaction_count, "Resales recorded"],
    [h.residential_blocks, "HDB blocks"],
    [h.homes, "HDB homes"],
    [h.towns, "Towns"],
  ];
  $("#hero").innerHTML = `
    <div class="hero-stats">
      ${stats.map(([v, label]) => `<div><div class="hero-num" data-count="${v}">0</div><div class="hero-label">${label}</div></div>`).join("")}
      <div><div class="hero-num">${esc(h.month_max)}</div><div class="hero-label">Data snapshot · since ${esc(h.month_min.slice(0, 4))}</div></div>
    </div>
    <div class="hero-highlights">
      <span>Priciest town: <b>${esc(titleCase(h.priciest_town.town))} · ${fmtMoney(h.priciest_town.median_price)} median</b></span>
      <span>Busiest town: <b>${esc(titleCase(h.busiest_town.town))} · ${fmtNum(h.busiest_town.count)} resales</b></span>
      <span>Tallest block: <a class="hero-link" data-unit="${esc(h.tallest.unit_id)}">${esc(blockLabel(h.tallest.unit_id))} · ${h.tallest.max_floor_lvl} storeys</a></span>
      <img class="hero-otter otter-bob" src="/static/otter.svg" width="34" height="34" alt="">
    </div>
    <div class="hero-foot">
      Contains information from data.gov.sg and OneMap, Singapore Land Authority · Town figures are medians of the last 12 months of resales ·
      Estimates, not valuations · snapshot ${esc(h.month_max)}.
    </div>`;
  $("#hero .hero-link").addEventListener("click", (e) => openBlock(e.currentTarget.dataset.unit));

  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / 900);
    const eased = 1 - (1 - t) ** 3;
    $$("#hero [data-count]").forEach((el) => (el.textContent = Math.round(+el.dataset.count * eased).toLocaleString()));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function loadOverview() {
  const data = await withLoading($("#overview-kpis"), api("/api/overview"));
  const { current: cur, previous: prev, record } = data;
  renderHero(data.hero);
  $("#overview-subtitle").textContent = `Last 12 months: ${fmtMonth(data.window.from)} – ${fmtMonth(data.window.to)}, compared with the 12 months before.`;

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
      <div class="card flush">
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
      <div class="grid">
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
              <div class="small muted">${psfVsTown == null ? "" : `${fmtPct(psfVsTown)} vs town`}</div></div>
            <div class="stat"><div class="label">Resales</div><div class="value">${fmtNum(d.summary.count)}</div>
              <div class="small muted">${d.period === "all" ? "all time" : `last ${d.period} yr${d.period === "1" ? "" : "s"}`}</div></div>
          </div>
          ${unitMixHtml(info)}
          ${geo ? `<p class="small" style="margin: 12px 0 0">
            <a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${geo.latitude},${geo.longitude}">Google Maps ↗</a>
            &nbsp;·&nbsp;<a class="link" target="_blank" rel="noopener" href="https://www.onemap.gov.sg/?lat=${geo.latitude}&lng=${geo.longitude}">OneMap ↗</a></p>` : ""}
        </div>
        <div class="card flush">
          <div class="card-head" style="padding: 18px 18px 0"><h3>Price per storey band</h3>
            <span class="muted small">${d.hidden_band_count ? `${d.hidden_band_count} sales in older overlapping bands hidden` : ""}</span></div>
          <div class="table-wrap"><table id="bld-bands"></table></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Block median price by year</h3></div>
          <div class="chart" style="height: 220px"><canvas id="chart-block-trend"></canvas></div>
        </div>
      </div>
    </div>
    <div class="grid cols-2" style="margin-top: 16px">
      <div class="card flush">
        <div class="card-head" style="padding: 18px 18px 0"><h3 id="bld-recent-title">Recent resales</h3>
          <button class="btn ghost" id="bld-clear-band" style="display:none">Show all floors</button></div>
        <div class="table-wrap" style="max-height: 420px; overflow-y: auto"><table id="bld-recent"></table></div>
      </div>
      <div class="card">
        <h3>Nearby blocks</h3>
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
    </div>
    <div class="card" id="bld-liv" style="margin-top: 16px"></div>`;
  renderBlockLivability(d);

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

const STATION_W = 140;

// A little MRT station at the right of the scene, plus the trip from the block's door to it.
function mrtSceneSvg({ lv, W, groundY, canalY, fromX }) {
  const lines = (lv.rail_station_lines || "").split(",").filter(Boolean);
  const mainColor = (LINE_INFO[lines[0]] || ["", "#c8102e"])[1];
  const name = stationName(lv.rail_station);
  const x = W - STATION_W - 16;
  const trackY = groundY - 128;
  const roofY = groundY - 72;
  const byBus = lv.rail_how !== "walk";
  const tripText = byBus
    ? `${titleCase(lv.rail_how)} · ${fmtMin(lv.rail_min)}`
    : `${fmtDist(lv.nearest_exit_m)} · ${fmtMin(lv.rail_min)} walk`;
  const nameSize = Math.min(10, 112 / Math.max(1, name.length * 0.6));
  const pathY = groundY + 11;
  const pathFrom = fromX + 8;
  const pathTo = x + STATION_W / 2;
  const travel = pathTo - pathFrom - 24;
  const pillW = tripText.length * 5.6 + 18;
  const pillX = Math.min(Math.max((pathFrom + pathTo) / 2, pathFrom + pillW / 2 + 4), x - pillW / 2 - 4);

  const chips = lines
    .map((g, i) => {
      const [label, color] = LINE_INFO[g] || [g, "#6f6466"];
      const cx = x + STATION_W / 2 - (lines.length * 26) / 2 + i * 26;
      return `<rect x="${cx}" y="${roofY + 34}" width="22" height="12" rx="3" fill="${color}"/>
        <text x="${cx + 11}" y="${roofY + 43}" font-size="8" font-weight="800" fill="#fff" text-anchor="middle">${esc(label)}</text>`;
    })
    .join("");

  const trainWindows = Array.from({ length: 6 }, (_, i) => `<rect x="${12 + i * 17}" y="5" width="11" height="8" rx="2" fill="#cfe4f2"/>`).join("");
  const traveller = byBus
    ? `<g transform="translate(0,-13)">
         <rect x="-14" y="0" width="28" height="12" rx="3" fill="#c8102e"/>
         <rect x="-11" y="2" width="6" height="4" rx="1" fill="#fff"/><rect x="-3" y="2" width="6" height="4" rx="1" fill="#fff"/><rect x="5" y="2" width="6" height="4" rx="1" fill="#fff"/>
         <circle cx="-8" cy="12" r="2.6" fill="#1f1a1b"/><circle cx="8" cy="12" r="2.6" fill="#1f1a1b"/></g>`
    : standingOtter(0, 0, 0.5, "");

  return `
  <g class="mrt-scene">
    <title>${esc(name)} · ${esc(tripText)}</title>
    <rect x="${x - 60}" y="${trackY}" width="${W - x + 60}" height="7" rx="2" fill="#b9aeb0"/>
    <rect x="${x - 40}" y="${trackY + 7}" width="8" height="${roofY - trackY - 7}" fill="#d9cfd0"/>
    <rect x="${x + STATION_W + 8}" y="${trackY + 7}" width="8" height="${roofY - trackY - 7}" fill="#d9cfd0"/>
    <g transform="translate(${x - 20},${trackY - 22})"><g class="mrt-train">
      <rect x="0" y="0" width="118" height="21" rx="8" fill="#fff" stroke="#d9cfd0"/>
      ${trainWindows}
      <rect x="0" y="15" width="118" height="4" fill="${mainColor}"/>
      <rect x="2" y="3" width="6" height="11" rx="2" fill="#cfe4f2"/>
    </g></g>

    <path d="M${x - 4} ${roofY + 4} Q${x + STATION_W / 2} ${roofY - 22} ${x + STATION_W + 4} ${roofY + 4} Z" fill="${mainColor}"/>
    <rect x="${x}" y="${roofY + 2}" width="${STATION_W}" height="${groundY - roofY - 2}" rx="4" fill="#fff" stroke="#e3d6d8"/>
    <rect x="${x + 10}" y="${roofY + 10}" width="${STATION_W - 20}" height="18" rx="4" fill="#1f1a1b"/>
    <text x="${x + STATION_W / 2}" y="${roofY + 22.5}" font-size="${nameSize.toFixed(1)}" font-weight="800" fill="#fff" text-anchor="middle">${esc(name)}</text>
    ${chips}
    <rect x="${x + STATION_W / 2 - 24}" y="${groundY - 22}" width="22" height="22" rx="2" fill="#cfe4f2" stroke="#b3cfe0"/>
    <rect x="${x + STATION_W / 2 + 2}" y="${groundY - 22}" width="22" height="22" rx="2" fill="#cfe4f2" stroke="#b3cfe0"/>

    <path class="mrt-path" d="M${pathFrom} ${pathY} L${pathTo} ${pathY}" stroke="#8b0a1f" stroke-width="2" stroke-dasharray="5 5" fill="none"/>
    <circle cx="${pathTo}" cy="${pathY}" r="3.5" fill="#8b0a1f"/>
    <g transform="translate(${pathFrom + 12},${pathY})"><g class="mrt-traveller" style="--travel:${Math.max(0, travel).toFixed(0)}px">${traveller}</g></g>
    <g transform="translate(${pillX},${groundY - 16})">
      <rect x="${-pillW / 2}" y="-11" width="${pillW}" height="20" rx="10" fill="#fff" stroke="#f0dfe1"/>
      <text x="0" y="3" font-size="10" font-weight="800" fill="#8b0a1f" text-anchor="middle">${esc(tripText)}</text>
    </g>
  </g>`;
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

  const station = d.livability?.rail_station ? d.livability : null;
  const W = station ? 760 : 560;
  const floorH = Math.max(8, Math.min(26, Math.floor(470 / floors)));
  const bw = split ? Math.max(210, Math.min(260, groups.reduce((s, g) => s + g.cols, 0) * 22)) : 210;
  const bx = split ? 140 - (bw - 210) / 2 : 150;
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
    ${station ? mrtSceneSvg({ lv: station, W, groundY, canalY, fromX: bx + bw }) : ""}
    ${columnLabels}
    ${floorNums}
    ${labels}
    ${bands.length ? "" : `<text x="${bx + bw / 2}" y="${floorTop(Math.ceil(floors / 2))}" text-anchor="middle" font-size="13" font-weight="700" fill="#8b0a1f">No resales in this period</text>`}
  </svg>`;
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

  drawChart("chart-lease", {
    type: "line",
    data: {
      labels: d.lease_decay.map((r) => `${r.lease_bucket}–${r.lease_bucket + 4} yrs`),
      datasets: [{ data: d.lease_decay.map((r) => r.median_psf), borderColor: "#c8102e", backgroundColor: "rgba(200,16,46,0.08)", fill: true, tension: 0.3, pointRadius: 3 }],
    },
    options: { ...barOpts(fmtPsf), scales: { y: psfAxis, x: { title: { display: true, text: "Remaining lease at sale" } } } },
  });

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

  drawChart("chart-age", {
    data: {
      labels: d.by_age.map((r) => `${r.age_bucket}–${r.age_bucket + 4}`),
      datasets: [
        { type: "bar", label: "Median price", data: d.by_age.map((r) => r.median_price), backgroundColor: "#f8c5cb", borderRadius: 4, yAxisID: "y" },
        { type: "line", label: "Median sqm", data: d.by_age.map((r) => r.median_area), borderColor: "#1f1a1b", backgroundColor: "#1f1a1b", yAxisID: "y1", tension: 0.3, pointRadius: 2 },
      ],
    },
    options: {
      scales: {
        y: moneyAxis,
        y1: { position: "right", grid: { drawOnChartArea: false }, ticks: { callback: (v) => `${v} sqm` } },
        x: { title: { display: true, text: "Flat age at sale (years)" } },
      },
    },
  });

  drawChart("chart-season", {
    type: "bar",
    data: {
      labels: d.seasonality.map((r) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][r.month_num - 1]),
      datasets: [{ data: d.seasonality.map((r) => r.avg_count), backgroundColor: "#f26b7a", hoverBackgroundColor: "#c8102e", borderRadius: 4 }],
    },
    options: { ...barOpts(fmtNum), plugins: { legend: { display: false }, subtitle: { display: true, text: "All flat types, last 10 years" } } },
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

// ================= correlations =================

const corr = { data: null, group: "score" };

function corrColor(r) {
  if (r == null) return "#f3efef";
  const [R, G, B] = r >= 0 ? [200, 16, 46] : [47, 109, 181];
  return `rgba(${R},${G},${B},${(0.06 + 0.88 * Math.min(1, Math.abs(r))).toFixed(2)})`;
}

const fmtRho = (r) => (r == null ? "–" : `${r < 0 ? "−" : ""}${Math.abs(r).toFixed(2)}`);
const rhoStrength = (r) => {
  const a = Math.abs(r ?? 0);
  return a < 0.1 ? "negligible" : a < 0.3 ? "weak" : a < 0.5 ? "moderate" : "strong";
};

async function loadCorrelations() {
  const d = (corr.data = await withLoading($("#view-correlations"), api("/api/correlations")));
  if (!d.factors.length) {
    $("#corr-subtitle").textContent = "Livability scores haven't been built yet. Run build_livability.py, then reload.";
    return;
  }
  $("#corr-subtitle").textContent = `${fmtNum(d.blocks)} scored HDB blocks, ${fmtNum(d.priced_blocks)} with resales in the last 3 years. Correlation shows what moves together, not what causes what.`;

  drawChart("chart-drivers", {
    type: "bar",
    data: {
      labels: d.drivers.map((f) => f.label),
      datasets: [
        { label: "Within the same town", data: d.drivers.map((f) => f.within_town), backgroundColor: "#c8102e", borderRadius: 3 },
        { label: "Across Singapore", data: d.drivers.map((f) => f.overall), backgroundColor: "#f4a3ab", borderRadius: 3 },
      ],
    },
    options: {
      indexAxis: "y",
      interaction: { mode: "index", intersect: false, axis: "y" },
      scales: { x: { suggestedMin: -0.6, suggestedMax: 0.6, title: { display: true, text: "Spearman ρ with $ psf" } } },
      plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ρ = ${fmtRho(c.parsed.x)}` } } },
    },
  });

  bindSegmented("#corr-group", (g) => {
    corr.group = g;
    renderCorrMatrix();
  });
  renderCorrMatrix();

  const options = d.factors.map((f) => `<option value="${esc(f.key)}">${esc(f.label)}</option>`).join("");
  $("#corr-x").innerHTML = options;
  $("#corr-y").innerHTML = options;
  $("#corr-x").value = "cbd_min";
  $("#corr-y").value = "median_psf";
  fillSelect($("#corr-town"), state.meta.towns.filter((t) => t !== "LIM CHU KANG"));
  ["#corr-x", "#corr-y", "#corr-town"].forEach((sel) => $(sel).addEventListener("change", loadScatter));
  $("#corr-matrix").addEventListener("click", (e) => {
    const cell = e.target.closest("[data-x]");
    if (!cell || cell.dataset.x === cell.dataset.y) return;
    $("#corr-x").value = cell.dataset.x;
    $("#corr-y").value = cell.dataset.y;
    loadScatter();
    $("#corr-scatter-card").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  loadScatter();
}

function renderCorrMatrix() {
  const d = corr.data;
  const factors = d.factors.filter((f) => f.group === corr.group || f.key === "median_psf");
  const short = (f) => f.label.replace(/ score$/, "").replace(/ \((m|min|years|block median)\)$/, "");
  $("#corr-matrix").innerHTML = `
    <thead><tr><th></th>${factors.map((f) => `<th class="corr-col" title="${esc(f.label)}"><span>${esc(short(f))}</span></th>`).join("")}</tr></thead>
    <tbody>${factors
      .map(
        (row) => `<tr><th class="corr-row">${esc(row.label)}</th>${factors
          .map((col) => {
            const r = d.matrix[row.key][col.key];
            const strong = r != null && Math.abs(r) > 0.5;
            return `<td class="corr-cell ${row.key === col.key ? "diag" : ""}" data-x="${esc(col.key)}" data-y="${esc(row.key)}"
              title="${esc(row.label)} vs ${esc(col.label)}: ρ = ${fmtRho(r)}"
              style="background:${row.key === col.key ? "#f6f2f2" : corrColor(r)};color:${strong ? "#fff" : "var(--ink)"}">${row.key === col.key ? "" : fmtRho(r)}</td>`;
          })
          .join("")}</tr>`
      )
      .join("")}</tbody>`;
}

async function loadScatter() {
  const x = $("#corr-x").value;
  const y = $("#corr-y").value;
  const town = $("#corr-town").value;
  const d = await withLoading($("#corr-scatter-card"), api("/api/correlations/scatter", { x, y, town }));
  const label = (key) => corr.data.factors.find((f) => f.key === key).label;
  const xs = d.points.map((p) => p[0]);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const datasets = [
    {
      type: "scatter",
      label: town ? titleCase(town) : "All blocks",
      data: d.points.map((p) => ({ x: p[0], y: p[1] })),
      backgroundColor: "rgba(200,16,46,0.28)",
      pointRadius: town ? 3 : 1.6,
      pointHoverRadius: 5,
    },
  ];
  if (d.slope != null) {
    datasets.push({
      type: "line",
      label: "Linear trend",
      data: [
        { x: lo, y: d.intercept + d.slope * lo },
        { x: hi, y: d.intercept + d.slope * hi },
      ],
      borderColor: "#1f1a1b",
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 0,
    });
  }
  drawChart("chart-scatter", {
    data: { datasets },
    options: {
      animation: false,
      interaction: { mode: "nearest", intersect: true },
      scales: {
        x: { type: "linear", title: { display: true, text: label(x) } },
        y: { title: { display: true, text: label(y) } },
      },
      plugins: {
        tooltip: {
          filter: (item) => item.datasetIndex === 0,
          callbacks: {
            label: (c) => {
              const p = d.points[c.dataIndex];
              return `${blockLabel(p[2])} (${titleCase(p[3])}): ${p[0]}, ${p[1]}`;
            },
          },
        },
      },
      onClick: (_e, items) => {
        const item = items.find((i) => i.datasetIndex === 0);
        if (item) openBlock(d.points[item.index][2]);
      },
    },
  });
  $("#corr-scatter-stats").textContent = d.rho == null
    ? "Not enough blocks to compare."
    : `ρ = ${fmtRho(d.rho)} (${rhoStrength(d.rho)}) across ${fmtNum(d.n)} blocks${town ? ` in ${titleCase(town)}` : ""}. Click a dot to open that block.`;
}

// ================= livability =================

const liv = { meta: null, persona: "balanced", town: "", sort: "overall", minLease: "", maxPsf: "", rows: [], total: 0 };

const PERSONA_BLURBS = {
  balanced: "Every pillar counts equally",
  family: "Schools, parks and clinics count most",
  commuter: "MRT access and CBD distance count most",
  retiree: "Clinics, hawker food and parks count most",
  budget: "Value and lease left count most",
};
const PILLAR_SHORT = { transport: "MRT", cbd: "CBD", food: "Food", health: "Clinic", green: "Green", schools: "School", value: "Value", lease: "Lease" };

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
    <ul class="pillar-list">${m.pillars.map((p) => `<li><b>${esc(p.label)}</b><span>${esc(p.desc)}</span></li>`).join("")}</ul>
    <div class="table-wrap" style="margin-top: 14px"><table class="weights">
      <thead><tr><th>Weights</th>${m.pillars.map((p) => `<th class="num">${PILLAR_SHORT[p.key]}</th>`).join("")}</tr></thead>
      <tbody>${m.personas
        .map((per) => `<tr><td>${esc(per.label)}</td>${m.pillars.map((p) => `<td class="num">${per.weights[p.key] || "–"}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></div>
    <p class="muted small" style="margin: 14px 0 0; line-height: 1.6">
      Each pillar blends several measures, ranks every block against all other scored HDB blocks, and maps that to 1–10,
      so 10 means top of the pack and 5.5 is the middle.</p>
    <p class="muted small" style="margin: 10px 0 0; line-height: 1.6">
      <b>Transport and CBD times are modelled:</b> walking at 4.8 km/h with a 1.3× detour; buses on their real routes at
      19 km/h, with a wait that shrinks the more services a stop has; trains between stations at 45 km/h (LRT 28 km/h)
      plus a 3 min wait and 4 min per line change. Your trip uses whichever is fastest, walking or bus to a station.
      They're consistent estimates for comparing blocks, not timetabled journeys. Other distances are straight-line.</p>
    <p class="muted small" style="margin: 10px 0 0; line-height: 1.6">
      Sources: LTA station exits and codes, bus routes via busrouter.sg (LTA DataMall), NEA hawker centres, MOH CHAS GPs and
      dentists, HPB polyclinics (list last updated 2023), a curated list of acute and community hospitals, NParks parks,
      MOE primary schools, HDB resale prices. Supermarkets aren't included because data.gov.sg no longer publishes them.
      Blocks appear once they've been geocoded.</p>`;

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
    box.innerHTML = `<h3>Livability</h3><p class="muted">${
      d.listed ? "Not scored yet. Scores appear once this block has been geocoded." : "Only blocks in HDB's current register are scored."
    }</p>`;
    return;
  }
  const pillars = [
    ["transport", "Transport"],
    ["cbd", "CBD commute"],
    ["food", "Hawker food"],
    ["health", "Healthcare"],
    ["green", "Green space"],
    ["schools", "Schools"],
    ["value", "Value"],
    ["lease", "Lease"],
  ];
  const personaLabels = { balanced: "Balanced", family: "Young family", commuter: "Commuter", retiree: "Retiree", budget: "Budget" };
  box.innerHTML = `
    <div class="card-head"><h3>Livability</h3>
      <a class="link small" data-go-liv>See town rankings →</a></div>
    <div class="liv-block">
      <div class="chart" style="height: 300px"><canvas id="chart-block-liv"></canvas></div>
      <div>
        <div class="liv-overall">${Object.entries(lv.overall)
          .map(([k, v]) => `<div><div class="small muted">${personaLabels[k] || k}</div>${scoreCell(v, true)}</div>`)
          .join("")}</div>
        <p class="small muted" style="margin: 10px 0 14px">Balanced score beats ${Math.round(lv.better_than * 100)}% of scored HDB blocks.</p>
        <table class="nearby-table"><tbody>
          <tr class="group"><td colspan="4">Transport</td></tr>
          <tr><td>Rail</td><td><b>${esc(stationName(lv.rail_station))}</b> ${lineChips(lv.rail_station_lines)}</td>
            <td class="num">${fmtMin(lv.rail_min)}</td><td class="muted small">${lv.rail_how === "walk" ? "walk" : esc(lv.rail_how.replace("bus", "by bus"))}</td></tr>
          <tr><td>Interchange</td><td>${lv.interchange_via ? `via ${esc(stationName(lv.interchange_via))}` : "–"}</td>
            <td class="num">${fmtMin(lv.interchange_min)}</td><td class="muted small">to a 2+ line station</td></tr>
          <tr><td>Lines ≤15 min</td><td>${lineChips(lv.lines_15min_list) || "–"}</td><td class="num">${lv.lines_15min}</td><td class="muted small">LRT counts ½</td></tr>
          <tr><td>Buses</td><td>${lv.bus_services_400m} services</td><td class="num"></td><td class="muted small">stops within 400 m</td></tr>
          <tr><td>CBD</td><td>Raffles Place${lv.cbd_via && lv.cbd_via !== "walk" ? ` · board at ${esc(stationName(lv.cbd_via))}` : ""}</td>
            <td class="num"><b>${fmtMin(lv.cbd_min)}</b></td><td class="muted small">door to door, est.</td></tr>
          <tr class="group"><td colspan="4">Healthcare</td></tr>
          <tr><td>GP</td><td><b>${esc(titleCase(lv.nearest_gp))}</b></td><td class="num">${fmtDist(lv.nearest_gp_m)}</td>
            <td class="muted small">${lv.gps_1km} GPs · ${lv.dentists_1km} dentists ≤1 km</td></tr>
          <tr><td>Polyclinic</td><td><b>${esc(lv.nearest_polyclinic)}</b></td><td class="num">${fmtDist(lv.nearest_polyclinic_m)}</td><td></td></tr>
          <tr><td>Hospital</td><td><b>${esc(lv.nearest_hospital)}</b></td><td class="num">${fmtDist(lv.nearest_hospital_m)}</td><td class="muted small">acute</td></tr>
          <tr><td>Community</td><td><b>${esc(lv.nearest_community_hospital)}</b></td><td class="num">${fmtDist(lv.nearest_community_hospital_m)}</td><td class="muted small">community hospital</td></tr>
          <tr class="group"><td colspan="4">Everyday</td></tr>
          <tr><td>Hawker</td><td><b>${esc(lv.nearest_hawker)}</b></td><td class="num">${fmtDist(lv.nearest_hawker_m)}</td><td class="muted small">${lv.hawkers_1km} ≤1 km</td></tr>
          <tr><td>Park</td><td><b>${esc(titleCase(lv.nearest_park))}</b></td><td class="num">${fmtDist(lv.nearest_park_m)}</td><td class="muted small">${lv.parks_1km} ≤1 km</td></tr>
          <tr><td>Primary school</td><td><b>${esc(titleCase(lv.nearest_primary))}</b></td><td class="num">${fmtDist(lv.nearest_primary_m)}</td><td class="muted small">${lv.primary_1km} ≤1 km · ${lv.primary_2km} ≤2 km</td></tr>
        </tbody></table>
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
        ? `${fmtPsf(p.median_psf)} psf actual · <b>${fmtPsf(p.adjusted_psf)} psf</b> at ${reference} yrs lease<br>
           ~${p.lease_years} yrs left at sale${premium != null && Math.abs(premium) >= 0.005 ? ` (${fmtPct(premium)} adjustment)` : ""}<br>
           ${fmtMoney(p.median_price)} median · ${p.count} sales`
        : "No recent resales"
    }<br>
    ${p.max_floor_lvl ? `${p.max_floor_lvl} storeys · built ${p.year_completed}` : ""}<br>
    <a class="link popup-open" data-unit="${esc(p.unit_id)}">Open building →</a>`;
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

// ================= boot =================

async function boot() {
  $$(".tab").forEach((t) => t.addEventListener("click", () => go(`#${t.dataset.tab}`)));
  $$(".subtab").forEach((t) => t.addEventListener("click", () => go(`#analyse/${t.dataset.sub}`)));
  $(".brand").addEventListener("click", () => go("#overview"));
  initBuildingSearch();
  state.meta = await api("/api/meta");
  renderBuildingExamples();
  $("#empty-otter").innerHTML = standingOtter(122, 117, 2.4, "");
  window.addEventListener("hashchange", route);
  route();
}

boot();
