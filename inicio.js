/* página inicial do ATLAS_PAINEL (18/11/2026): números de Goiás, cartões por lote de manutenção e busca.
   Lê os mesmos dados do site atual (atlas.json do mês e lotes.geojson). */
"use strict";
const DADOS = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) ? "../ATLAS_WEB/" : "https://lucianogeopro.github.io/atlas-sre-goias/";
const SIT = { PAV: ["Pavimentada", "#e31a1c"], DUP: ["Duplicada", "#7a0a0d"], EOD: ["Em obras de duplicação", "#b8494b"],
  EOP: ["Em obras de pavimentação", "#f7a8a9"], IMP: ["Implantada", "#f5bd70"], LEN: ["Leito natural", "#e88000"] };
const ORD = Object.keys(SIT);
const $ = s => document.querySelector(s);
const br = (v, d = 1) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const soma = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// tema (o mesmo guardado pelo mapa)
const escuro = () => document.documentElement.dataset.tema === "escuro";
function aplicaTema(e) {
  if (e) document.documentElement.dataset.tema = "escuro"; else delete document.documentElement.dataset.tema;
  $("#tema").textContent = e ? "☀" : "🌙"; $("#tema").title = e ? "Tema claro" : "Tema escuro";
  try { sessionStorage.setItem("painel-tema", e ? "escuro" : "claro"); } catch (x) {}   // abre sempre no claro
}
$("#tema").onclick = () => aplicaTema(!escuro());
aplicaTema(escuro());

$("#legSit").innerHTML = ORD.map(k => `<span><i style="background:${SIT[k][1]}"></i>${SIT[k][0]}</span>`).join("");

// desenho dos lotes em SVG (lon/lat com correção da latitude)
function svgLotes(fc, destaque) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const aneis = f => f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat();
  fc.features.forEach(f => aneis(f).forEach(a => a.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); })));
  const k = Math.cos((y0 + y1) / 2 * Math.PI / 180), W = (x1 - x0) * k, H = y1 - y0;
  const d = f => aneis(f).map(a => "M" + a.map(([x, y]) => ((x - x0) * k / W * 100).toFixed(2) + " " + ((y1 - y) / H * 100 * H / W).toFixed(2)).join("L") + "Z").join("");
  const alt = (100 * H / W).toFixed(2);
  return `<svg viewBox="0 0 100 ${alt}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    fc.features.map(f => { const s = destaque === undefined ? "comb" : f.properties.lote === destaque ? "sel" : "go";
      return `<path d="${d(f)}" fill="${s === "sel" ? "var(--lote-sel)" : s === "comb" ? "rgba(255,255,255,.18)" : "var(--lote-go)"}" stroke="${s === "comb" ? "rgba(255,255,255,.7)" : "var(--sup)"}" stroke-width="${s === "comb" ? .35 : .45}"/>`; }).join("") + "</svg>";
}

// busca: abre o município no mapa
function busca(lista) {
  const q = $("#q"), ul = $("#sug"); let ativo = -1, achados = [];
  const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const vai = c => { location.href = "mapa.html#" + c; };
  const mostra = () => {
    const t = norm(q.value.trim());
    if (!t) { ul.hidden = true; return; }
    achados = lista.filter(([, n]) => norm(n).includes(t)).sort((a, b) => norm(a[1]).indexOf(t) - norm(b[1]).indexOf(t)).slice(0, 12);
    ativo = achados.length ? 0 : -1;
    ul.innerHTML = achados.length ? achados.map(([c, n], i) => `<li role="option" data-c="${c}" class="${i === 0 ? "ativo" : ""}">${esc(n)}</li>`).join("")
      : `<li class="nada">Nenhum município encontrado</li>`;
    ul.hidden = false;
  };
  q.addEventListener("input", mostra);
  q.addEventListener("keydown", e => {
    if (ul.hidden || !achados.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); ativo = (ativo + (e.key === "ArrowDown" ? 1 : -1) + achados.length) % achados.length;
      ul.querySelectorAll("li").forEach((li, i) => li.classList.toggle("ativo", i === ativo)); }
    else if (e.key === "Enter") { e.preventDefault(); vai(achados[Math.max(0, ativo)][0]); }
    else if (e.key === "Escape") ul.hidden = true;
  });
  ul.addEventListener("mousedown", e => { const li = e.target.closest("li[data-c]"); if (li) vai(li.dataset.c); });
  q.addEventListener("blur", () => setTimeout(() => ul.hidden = true, 150));
}

async function carrega() {
  const meses = await fetch(DADOS + "data/meses.json", { cache: "no-cache" }).then(r => r.json());
  const MES = meses[0];
  const [A, lotes] = await Promise.all([fetch(`${DADOS}data/${MES.id}/atlas.json`).then(r => r.json()),
    fetch(DADOS + "data/lotes.geojson").then(r => r.json())]);
  const g = A.goias, ms = Object.entries(A.municipios);
  // obras e projetos: cada código uma vez só (obra que cruza a divisa aparece em mais de um município)
  const obras = new Set(), proj = new Set();
  ms.forEach(([, m]) => (m.obras || []).forEach(o => (o.natureza === "Projeto" ? proj : obras).add(o.codigo || o.mapa)));
  const [ano, mes] = MES.id.split("-");
  $("#nMun").textContent = ms.length;
  $("#nKm").textContent = br(g.total, 2) + " Km";
  $("#nIdx").textContent = br(g.idx_pav, 1) + "%";
  $("#nObra").textContent = obras.size;
  $("#nProj").textContent = proj.size;
  $("#nMes").textContent = MESES[+mes - 1] + "/" + ano;
  document.querySelectorAll(".mes-txt").forEach(e => e.textContent = MES.rotulo || MESES[+mes - 1] + "/" + ano);

  // municípios de cada lote (pelo peso: o município entra em todos os lotes por onde passa a sua malha)
  const munLote = {};
  ms.sort((a, b) => a[1].ordem - b[1].ordem).forEach(([c, m]) => Object.keys(m.peso || {}).forEach(l => (munLote[l] = munLote[l] || []).push(c)));
  const ids = Object.keys(A.lotes).sort((a, b) => a - b);
  $("#grade").innerHTML = ids.map(l => {
    const s = A.lotes[l], tot = soma(s), pav = (s.PAV || 0) + (s.DUP || 0), cods = munLote[l] || [];
    const barra = ORD.filter(k => s[k]).map(k => `<i style="flex:${s[k]};background:${SIT[k][1]}" title="${SIT[k][0]}: ${br(s[k], 2)} Km"></i>`).join("");
    return `<a class="cartao" href="mapa.html#lote=${l}" title="Abrir os ${cods.length} municípios do lote ${l} no mapa">
      <div class="foto"><span class="sigla">LOTE ${l}</span>${svgLotes(lotes, l)}</div>
      <div class="corpo"><div class="nome">Lote ${l}</div>
        <div class="total"><b>${br(tot, 2)} Km</b></div>
        <div class="idx">Pavimentação: <b>${br(100 * pav / tot, 1)}%</b></div>
        <div class="mun">${cods.length} municípios</div>
        <div class="barra">${barra}</div></div></a>`;
  }).join("");
  ["#atSvg", "#atSvgMapa", "#heroSvg"].forEach(s => $(s).innerHTML = svgLotes(lotes));
  busca(ms.map(([c, m]) => [c, m.nome]).sort((a, b) => a[1].localeCompare(b[1], "pt-BR")));
}
carrega().catch(e => { $("#grade").innerHTML = `<p class="aguarde">Não foi possível carregar os dados agora (${esc(e.message)}). Atualize a página para tentar de novo.</p>`; console.error(e); });
