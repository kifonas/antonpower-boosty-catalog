const TABS = [
  ["films", "Фильмы"],
  ["series", "Сериалы"],
  ["games", "Игры"],
  ["streams", "Стримы и прочее"],
];
const state = { tab: "films", q: "", sort: "default" };
let catalog = null;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (ts) => {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const r1 = (n) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");

function badge(kind, label, value) {
  if (value == null) return "";
  return `<span class="badge ${kind}"><span class="lbl">${label}</span><span class="val">${r1(value)}</span></span>`;
}

function posterHtml(g) {
  const ph = esc((g.title || "?").replace(/[«»"']/g, "").slice(0, 1).toUpperCase());
  const img = g.poster
    ? `<img loading="lazy" src="${esc(g.poster)}" alt="${esc(g.title)}" onerror="this.parentNode.innerHTML='<span class=&quot;ph&quot;>${ph}</span>'">`
    : `<span class="ph">${ph}</span>`;
  const year = g.year ? `<span class="yearbadge">${g.year}</span>` : "";
  return `<div class="poster${g.fit ? " " + g.fit : ""}">${img}${year}</div>`;
}

function postsHtml(g) {
  if (!g.posts.length) return "";
  const chip = (p) => `<a class="chip${p.hasAccess === false ? " paid" : ""}" href="${esc(p.url)}" target="_blank" rel="noopener" title="${p.hasAccess === false ? "Доступ по подписке" : "Открыть запись"}">${esc(p.label)}</a>`;
  const head = `<div class="hdr">Записи (${g.posts.length})</div>`;
  if (g.posts.length <= 8) return `<div class="posts">${head}<div class="chips">${g.posts.map(chip).join("")}</div></div>`;
  return `<div class="posts">${head}<div class="chips">${g.posts.slice(0, 6).map(chip).join("")}</div>
    <details class="sum"><summary>Показать все ${g.posts.length} записей</summary><div class="chips" style="margin-top:6px">${g.posts.map(chip).join("")}</div></details></div>`;
}

function cardHtml(g) {
  const desc = g.desc ? esc(g.desc) : "";
  const long = (g.desc || "").length > 200;
  const en = g.titleEn && g.titleEn !== g.title ? `<div class="title-en">${esc(g.titleEn)}</div>` : "";
  const badges = [
    badge("kp", "КИНОПОИСК", g.ratings.kinopoisk),
    badge("imdb", "IMDb", g.ratings.imdb),
  ].join("");
  return `<article class="card">
    ${posterHtml(g)}
    <div class="body">
      <h2 class="title">${esc(g.title)}</h2>
      ${en}
      <div class="badges">${badges || '<span class="badge none"></span>'}</div>
      ${desc ? `<p class="desc">${desc}</p>${long ? '<button class="more">Показать полностью</button>' : ""}` : ""}
      ${postsHtml(g)}
    </div>
  </article>`;
}

function streamRow(s) {
  const tag = s.kind === "other" ? "стрим" : s.kind;
  return `<div class="stream-row">
    <span class="tag">${esc(tag)}</span>
    <span class="st">${esc(s.title)}</span>
    <span class="dt">${fmtDate(s.date)}</span>
    <a class="chip${s.hasAccess === false ? " paid" : ""}" href="${esc(s.url)}" target="_blank" rel="noopener">Открыть</a>
  </div>`;
}

function latestDate(g) {
  if (g.posts && g.posts.length) return Math.max(...g.posts.map((p) => p.date || 0));
  return g.date || 0;
}

function sortList(list) {
  const arr = list.slice();
  const s = state.sort;
  if (s === "year") arr.sort((a, b) => (b.year || 0) - (a.year || 0) || (a.title || "").localeCompare(b.title || "", "ru"));
  else if (s === "title") arr.sort((a, b) => (a.title || "").localeCompare(b.title || "", "ru"));
  else if (s === "rating") arr.sort((a, b) => (b.ratings.kinopoisk || 0) - (a.ratings.kinopoisk || 0));
  else if (s === "imdb") arr.sort((a, b) => (b.ratings.imdb || 0) - (a.ratings.imdb || 0));
  else if (s === "default") arr.sort((a, b) => latestDate(b) - latestDate(a));
  return arr;
}

function matches(g) {
  if (!state.q) return true;
  const q = state.q.toLowerCase();
  return (g.title || "").toLowerCase().includes(q) || (g.titleEn || "").toLowerCase().includes(q) || (g.titleRu || "").toLowerCase().includes(q);
}

function renderTabs() {
  $("#tabs").innerHTML = TABS.map(([k, label]) => {
    const n = k === "streams" ? catalog.streams.length : catalog[k].length;
    return `<button class="tab${state.tab === k ? " active" : ""}" data-tab="${k}">${label}<span class="count">${n}</span></button>`;
  }).join("");
}

function render() {
  renderTabs();
  const grid = $("#grid");
  const empty = $("#empty");
  if (state.tab === "streams") {
    grid.className = "streams-list";
    const list = catalog.streams.filter((s) => !state.q || s.title.toLowerCase().includes(state.q.toLowerCase()));
    if (state.sort === "default") list.sort((a, b) => (b.date || 0) - (a.date || 0));
    grid.innerHTML = list.map(streamRow).join("");
    empty.hidden = list.length > 0;
    return;
  }
  grid.className = "grid";
  const list = sortList(catalog[state.tab].filter(matches));
  grid.innerHTML = list.map(cardHtml).join("");
  empty.hidden = list.length > 0;
}

function wire() {
  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest(".tab");
    if (!b) return;
    state.tab = b.dataset.tab;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("#search").addEventListener("input", (e) => { state.q = e.target.value.trim(); render(); });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $("#grid").addEventListener("click", (e) => {
    const m = e.target.closest(".more");
    if (m) {
      const d = m.parentNode.querySelector(".desc");
      d.classList.toggle("open");
      m.textContent = d.classList.contains("open") ? "Свернуть" : "Показать полностью";
    }
  });
}

fetch("catalog.json").then((r) => r.json()).then((data) => {
  catalog = data;
  $("#gen").textContent = new Date(data.generatedAt).toLocaleString("ru-RU");
  wire();
  render();
}).catch(() => {
  $("#grid").innerHTML = '<div class="empty">Не удалось загрузить каталог.</div>';
});
