/* Atlas web do SRE por município — mesmo conteúdo do layout 04 (caderno), interativo. */
/* ATLAS_PAINEL (18/11/2026): cópia do app.js do ATLAS_WEB com 3 mudanças marcadas "PAINEL":
   dados lidos do site atual (DADOS), e ganchos PAINEL.restaura()/PAINEL.monta() no modo apresentação
   (a folha montada usa a página no arranjo original; fora dela, painel.js monta o arranjo de painéis). */
"use strict";
// PAINEL: os dados (data/<mês>, caderno, geojson) vêm do site atual — a atualização mensal vale para os dois
const DADOS = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) ? "../ATLAS_WEB/" : "https://lucianogeopro.github.io/atlas-sre-goias/";

const SIT = {                                   // cores dos gráficos (graficos_municipios.py)
  PAV: ["Pavimentada", "#e31a1c"], DUP: ["Duplicada", "#7a0a0d"], EOD: ["Em obras de duplicação", "#b8494b"],
  EOP: ["Em obras de pavimentação", "#f7a8a9"], IMP: ["Implantada", "#f5bd70"], LEN: ["Leito natural", "#e88000"],
  PLA: ["Planejada", "#000000"]
};
const ORD = Object.keys(SIT);
const BRANCO = new Set(["PAV", "DUP", "EOD", "PLA"]);
// 19/11/2026: padrão OFICIAL das legendas da DOR e da DPJ (SIPLAWEB) — cores medidas nas legendas oficiais.
// Mesma cor por intervenção nas obras e nos projetos; a etapa muda o traço (ver tracoLinha):
//   Obra = faixa cheia · Licitação / Estudo Técnico Preliminar = faixa com tracejado branco · Projeto = linha dupla
const INT_COR = { "Duplicação": "#3303f7", "Melhoria Funcional": "#fc9a2e", "Pavimentação": "#da2216", "PRAD": "#666666",
  "Restauração": "#009f25", "Sinalização": "#666666" };
const DOR_COR = INT_COR, PJ_COR = INT_COR;
// legenda fixa = classes da legenda oficial, nesta ordem (sempre todas)
const DOR_CLASSES = [["Duplicação", "Licitação"], ["Duplicação", "Obra"], ["Pavimentação", "Licitação"], ["Pavimentação", "Obra"],
  ["Restauração", "Obra"]];
const PJ_CLASSES = [["Duplicação", "Estudo Técnico Preliminar"], ["Duplicação", "Licitação"], ["Duplicação", "Projeto"],
  ["Melhoria Funcional", "Projeto"], ["Pavimentação", "Estudo Técnico Preliminar"], ["Pavimentação", "Licitação"],
  ["Pavimentação", "Obra"], ["Pavimentação", "Projeto"], ["PRAD", "Estudo Técnico Preliminar"],
  ["Restauração", "Estudo Técnico Preliminar"], ["Restauração", "Projeto"], ["Sinalização", "Estudo Técnico Preliminar"]];
// placas: [ícone, cor da tarja no quadro, cor do texto da tarja]
const PLACA = { "OAE em planejamento": ["img/placaoaeplanejamento.svg", "#b5b5b5", "#111"],
  "OAE em projeto": ["img/placaoaeprojeto.svg", "#37f8f9", "#111"], "OAE em obra": ["img/placaoaeobra.svg", "#f7fc55", "#111"],
  "OAC em obra": ["img/placaoacobra.svg", "#f7fc55", "#111"], "Em planejamento": ["img/placaplanejamento.svg", "#c6ad47", "#fff"] };
const DOR_PLACAS = ["OAE em obra", "OAC em obra"];
const PJ_PLACAS = ["OAE em planejamento", "OAE em projeto", "OAE em obra", "Em planejamento"];
const OAE = new Set(["Ponte", "Viaduto", "OAE"]);
// categoria da placa (o dado já traz "cat"; o cálculo aqui cobre dado antigo)
function catPlaca(p, projeto) {
  if (PLACA[p.cat]) return p.cat;
  if (!projeto) return p.intervencao === "Bueiro" ? "OAC em obra" : "OAE em obra";
  if (!OAE.has(p.intervencao)) return "Em planejamento";
  return /Planejamento|Estudo/.test(p.etapa || "") ? "OAE em planejamento" : p.etapa === "Projeto" ? "OAE em projeto" : "OAE em obra";
}
const etapaTraco = et => et === "Projeto" ? "projeto" : (!et || et === "Obra") ? "obra" : "escada";
const DOR_PONT = PLACA["OAE em obra"][1];
const PLURAL = { "Ponte": "pontes", "Viaduto": "viadutos", "Bueiro": "bueiros", "Duplicação": "duplicações", "PRAD": "PRADs", "OAE": "OAEs" };
const SINGULAR = { "OAE": "OAE" };                 // 18/11/2026: sigla da DPJ (ponte/viaduto), sem minúscula
const km2 = v => br(v, 2) + " Km";                 // Km sempre com 2 casas (layout 04)
const T_MU = "#7b3fa0", T_LT = "#138a72", T_GO = "#2f6db5";

const $ = s => document.querySelector(s);
const br = (v, d = 1) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const soma = o => Object.values(o || {}).reduce((a, b) => a + b, 0);

let A, GEO = {}, LISTA = [], atual = null, mapa, camadas = {}, AREA = [];
// seleção de vários municípios (13/11/2026): SEL = códigos selecionados (o 1º é o "principal"), BBOX = caixa da seleção,
// COMB = modo "Combinar" (clique no mapa adiciona/remove), M = dados somados da seleção
let SEL = [], BBOX = null, COMB = false, M = null, MES_SITE = "";
// 20/11/2026: lote de onde veio a seleção (cartão da página inicial, #lote=11); null = seleção comum de municípios
let LOTE_SEL = null;

/* ---------------- dica (tooltip) para gráficos ---------------- */
const dica = $("#dica");
function mostraDica(ev, html) {
  dica.innerHTML = html; dica.style.display = "block";
  const x = ev.clientX ?? ev.touches?.[0]?.clientX, y = ev.clientY ?? ev.touches?.[0]?.clientY;
  const w = dica.offsetWidth, h = dica.offsetHeight;
  dica.style.left = Math.min(window.innerWidth - w - 8, x + 14) + "px";
  dica.style.top = (y + h + 20 > window.innerHeight ? y - h - 10 : y + 16) + "px";
}
document.addEventListener("mousemove", ev => {
  const t = ev.target.closest?.("[data-tip]");
  if (t) mostraDica(ev, t.dataset.tip); else dica.style.display = "none";
});
document.addEventListener("click", ev => {
  const t = ev.target.closest?.("[data-tip]");
  if (APRES && !IMG) {                       // apresentação: o clique abre um balão que fica até fechar
    if (ev === BAL_EV) return;               // é o clique que acabou de abrir o balão de um elemento do mapa
    if (t) abreBalao(ev, t.dataset.tip); else fechaBalao();
    return;
  }
  if (t) mostraDica(ev, t.dataset.tip); else dica.style.display = "none";
});

/* ---------------- balão de informações no modo apresentação (16/11/2026) ---------------- */
const balao = document.createElement("div"); balao.className = "balao"; balao.hidden = true; document.body.appendChild(balao);
balao.addEventListener("click", e => e.stopPropagation());
let BAL_EV = null;
function abreBalao(ev, html) {
  balao.innerHTML = `<button type="button" class="bx" title="Fechar" aria-label="Fechar">✕</button>${html}`;
  balao.querySelector(".bx").onclick = fechaBalao;
  balao.hidden = false; dica.style.display = "none"; BAL_EV = ev;
  const w = balao.offsetWidth, h = balao.offsetHeight, x = ev.clientX, y = ev.clientY;
  balao.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x + 12)) + "px";
  balao.style.top = Math.max(8, y + h + 20 > window.innerHeight ? y - h - 10 : y + 14) + "px";
}
function fechaBalao() { balao.hidden = true; }
// elemento do mapa: no modo apresentação, o clique mostra as informações em vez de trocar o município
// 25/11/2026: obra/projeto (sel) = na apresentação, a mesma seleção do painel (destaque + caixa), não o balão
function balaoMapa(l, html, sel) {
  l.on("click", e => {
    if (!APRES || IMG) return;
    L.DomEvent.stopPropagation(e);
    if (sel) { fechaBalao(); if (!(COTA && pertoDoDestaque(e.containerPoint, l.getLatLng ? 2 : 10))) sel(e); return; }
    abreBalao(e.originalEvent, html());
  });
}
const linB = (k, v) => (v === undefined || v === null || v === "") ? "" : `<tr><td>${k}</td><td>${v}</td></tr>`;
const tabB = ls => `<table>${ls.join("")}</table>`;
const kmB = v => (v === undefined || v === null || v === "" || isNaN(+v)) ? "" : km2(+v);
function htmlSRE(p) {
  const ts = (M?.trechos || []).filter(t => t.sre === p.sre);
  let h = `<div class="bt">GO-${esc(p.go)} · ${esc(p.sre)}</div>` +
    tabB([linB("Situação", SIT[p.sit]?.[0] || esc(p.sit)), linB("Jurisdição", esc(p.jur))]);
  ts.forEach(t => {
    h += (t._mun ? `<div class="bs">${esc(t._mun)}</div>` : "") + tabB([
      linB("Início", esc(t.inicio)), linB("Fim", esc(t.fim)),
      linB("Km inicial – final", t.km_ini !== undefined ? num(t.km_ini, 2) + " – " + num(t.km_fim, 2) : ""),
      linB("Extensão do trecho", kmB(t.ext)),
      linB("Extensão no município", kmB(t.ext_mun) + (t.pct_mun !== undefined && t.pct_mun !== "" ? ` (${num(t.pct_mun, 1)}%)` : "")),
      linB("Classe", esc(t.classe)), linB("Perímetro urbano", ({ s: "Sim", n: "Não" })[String(t.perim_urb).toLowerCase()] || esc(t.perim_urb))]);
  });
  return h;
}
function htmlSNV(p) {
  return `<div class="bt">BR-${esc(p.br)}</div>` + tabB([linB("Superfície", SIT[p.leg]?.[0] || esc(p.leg))]);
}
// obra (DOR) ou projeto (DPJ): dados do quadro "Obras e projetos" da seleção, pelo código
function htmlObra(p, projeto) {
  const os = (M?.obras || []).filter(o => o.codigo === p.codigo), o = os[0] || {};
  const tit = projeto ? `Projeto – ${esc(p.intervencao)}` : `Obra – ${esc(p.intervencao)}`;
  return `<div class="bt">${tit}</div>` + tabB([
    linB("Natureza", projeto ? "<b>Projeto</b>" : "Obra"), linB("Código", esc(p.codigo)), linB("Rodovia", esc(p.rodovia)),
    linB("Tipo", esc(o.tipo)), linB("Categoria", esc(p.cat)), linB("Etapa", esc(o.etapa || p.etapa)), linB("Situação", esc(o.situacao)),
    ...os.filter(x => x.km_mun !== undefined && x.km_mun !== "" && x.km_mun !== null)
      .map(x => linB("Km " + (x._mun ? "em " + esc(x._mun) : "no município"), kmB(x.km_mun))),
    linB("Km contratado", kmB(o.km_contrato))]);
}
// elemento do mapa mais perto do clique (em px), por prioridade: o polígono do município é desenhado por cima das
// rodovias no mesmo canvas e "ganharia" o clique; aqui a rodovia/obra/projeto/localidade vem antes do município
function elementoEm(e) {
  return maisPerto(e, [[camadas.loc, htmlLoc, 9], [camadas.projP, f => htmlObra(f, true), 13], [camadas.dorP, f => htmlObra(f, false), 11],
    [camadas.dorL, f => htmlObra(f, false), 8], [camadas.projL, f => htmlObra(f, true), 8], [camadas.sre, htmlSRE, 7], [camadas.snv, htmlSNV, 7]]);
}
function maisPerto(e, grupos) {
  const p = e.layerPoint;
  for (const [g, fn, tol] of grupos) {
    if (!g || !mapa.hasLayer(g)) continue;
    let ach = null, melhor = tol;
    const testa = l => {
      if (l.eachLayer && !l.feature) { if (l.options?.interactive !== false) l.eachLayer(testa); return; }
      if (!l.feature) return;
      let d = Infinity;
      if (l.getLatLng) d = mapa.latLngToLayerPoint(l.getLatLng()).distanceTo(p);
      else if (l._parts) l._parts.forEach(pts => { for (let i = 1; i < pts.length; i++) d = Math.min(d, L.LineUtil.pointToSegmentDistance(p, pts[i - 1], pts[i])); });
      if (d <= melhor) { melhor = d; ach = l.feature.properties; }
    };
    g.eachLayer(testa);
    if (ach) return fn(ach);
  }
  return null;
}
function htmlLoc(p) { return `<div class="bt">${esc(p.n)}</div>` + tabB([linB("Tipo", esc(p.t))]); }
function htmlMun(c) {
  const m = A.municipios[c], s = m.situacao || {}, tot = soma(s);
  return `<div class="bt">${esc(m.nome)}/GO</div>` + tabB([
    linB("Na seleção", SEL.includes(c) ? "Sim" : "Não"), linB("Extensão SRE", km2(tot)),
    ...ORD.filter(k => s[k]).map(k => linB(SIT[k][0], km2(s[k]) + ` (${br(s[k] / tot * 100, 1)}%)`))]);
}

/* ---------------- popup do elemento ao clicar no mapa (18/11/2026) ---------------- */
// fora da apresentação: clique em trecho do SRE, obra ou projeto abre o popup; em área vazia troca o município
const ppL = (k, v) => (v === undefined || v === null || v === "") ? "" : `<div class="pp-l"><b>${k}:</b> ${v}</div>`;
const simNao = v => ({ s: "Sim", n: "Não" })[String(v ?? "").toLowerCase()] || esc(v);
const temV = v => v !== undefined && v !== null && v !== "";
function popSRE(p) {
  const ts = (M?.trechos || []).filter(t => t.sre === p.sre), t0 = ts[0] || {}, g = k => temV(p[k]) ? p[k] : t0[k];
  const mun = ts.filter(t => temV(t.ext_mun)).map(t => ppL("No município" + (t._mun ? " (" + esc(t._mun) + ")" : ""),
    km2(+t.ext_mun) + (temV(t.pct_mun) ? ` (${num(t.pct_mun, 1)}%)` : "")));
  return { cab: "Malha estadual · SRE", tit: `GO-${esc(p.go)}`, sub: `SRE ${esc(p.sre)}`, q: ts.length ? "sre" : null, cod: p.sre, lin: [
    ppL("Trecho", temV(g("inicio")) || temV(g("fim")) ? `${esc(g("inicio"))} – ${esc(g("fim"))}` : ""),
    ppL("Situação", `${esc(p.sit)} – ${SIT[p.sit]?.[0] || ""}`),
    ppL("Km", temV(g("km_ini")) ? `${num(g("km_ini"), 2)} a ${num(g("km_fim"), 2)}` : ""),
    ppL("Extensão", kmB(g("ext"))), ...mun,
    ppL("Classe", esc(g("classe"))), ppL("Perímetro urbano", temV(g("perim_urb")) ? simNao(g("perim_urb")) : ""),
    ppL("Faixa de domínio", +p.faixa ? br(+p.faixa, 0) + " m" : ""), ppL("Decreto da faixa", esc(p.decreto)),
    ppL("Região de manutenção", esc(p.lote)), ppL("Jurisdição", esc(p.jur || g("jurisdicao")))] };
}
// obra ou projeto: dados do quadro "Obras e projetos" (se estiver na seleção) + os do mapa; projeto sempre "Projeto"
function popObra(p, projeto, pontual) {
  const os = (M?.obras || []).filter(o => o.codigo === p.codigo), o = os[0] || {};
  return { cab: projeto ? "Projeto" : "Obra", tit: esc(p.intervencao || o.intervencao), sub: esc(p.codigo), q: os.length ? "obras" : null,
    cod: p.codigo, lin: [
    ppL("Natureza", projeto ? "<b>Projeto</b>" : "Obra"), ppL("Rodovia", esc(p.rodovia || o.rodovia)),
    ppL("Tipo", esc(o.tipo || (pontual ? "Pontual" : "Trecho"))), ppL("Categoria", esc(p.cat)),
    ppL("Etapa", esc(o.etapa || p.etapa)), ppL("Situação", esc(o.situacao)),
    ...os.filter(x => temV(x.km_mun)).map(x => ppL("Km no município" + (x._mun ? " (" + esc(x._mun) + ")" : ""), kmB(x.km_mun))),
    ppL("Km contratado", kmB(o.km_contrato))] };
}
function popupEm(e) {
  return maisPerto(e, [[camadas.projP, f => popObra(f, true, true), 13], [camadas.dorP, f => popObra(f, false, true), 11],
    [camadas.dorL, f => popObra(f, false, false), 8], [camadas.projL, f => popObra(f, true, false), 8], [camadas.sre, popSRE, 7]]);
}
function abrePop(ll, d) {
  const h = `<div class="pp-cab">${d.cab}</div><div class="pp-tit">${d.tit}</div>${d.sub ? `<div class="pp-sub">${d.sub}</div>` : ""}` +
    `<div class="pp-ls">${d.lin.join("")}</div>` + (d.q ? `<button type="button" class="pp-bt"><span aria-hidden="true">▦</span> Ver no quadro: ${
      d.q === "sre" ? "Malha Estadual (SRE)" : "Obras e projetos"}</button>` : "");
  // os controles do mapa ficam acima dos popups no Leaflet: o mapa desloca para o popup abrir fora da faixa deles
  const c = mapa.getContainer(), cr = c.getBoundingClientRect(), fx = (sel, f) => Math.max(10, ...[...c.querySelectorAll(sel)]
    .map(e => e.getBoundingClientRect()).filter(r => r.width).map(f).map(v => v + 8));
  let pl = fx(".leaflet-top.leaflet-left .leaflet-control", r => r.right - cr.left), pr = fx(".leaflet-top.leaflet-right .leaflet-control", r => cr.right - r.left);
  let pb = fx(".leaflet-bottom .leaflet-control", r => cr.bottom - r.top);
  // PAINEL (23/11/2026): os botões do mapa viraram uma barra no alto — o popup abre abaixo dela (pt)
  let pt = fx(".leaflet-top.leaflet-left .leaflet-control", r => r.bottom - cr.top);
  if (document.documentElement.classList.contains("modo-painel")) pl = 10;
  if (cr.width - pl - pr < 280) pl = pr = 10;
  if (cr.height - pb < 260) pb = 10;
  if (cr.height - pt - pb < 220) pt = 10;
  const pop = L.popup({ className: "pp", maxWidth: 360, minWidth: 250, autoPanPaddingTopLeft: [pl, pt], autoPanPaddingBottomRight: [pr, pb] })
    .setLatLng(ll).setContent(h).openOn(mapa);
  const b = pop.getElement()?.querySelector(".pp-bt"); if (b) b.onclick = () => verNoQuadro(d.q, d.cod);
}
// rola até o quadro e destaca a(s) linha(s) do código (abre o painel/seção recolhidos do site em painéis)
function verNoQuadro(q, cod) {
  const tb = $(q === "sre" ? "#t-sre" : "#t-obras"); if (!tb) return;
  if (q === "sre" && tSRE && $("#filtro").value) { $("#filtro").value = ""; tSRE.filtra(""); }
  if (document.documentElement.classList.contains("dir-fechado") && $("#rec-dir")) $("#rec-dir").click();
  const sp = tb.closest(".sp.fechada"); if (sp) sp.querySelector(".sp-tit").click();
  const trs = [...tb.querySelectorAll("tbody tr[data-i]")].filter(tr => [...tr.cells].some(td => td.textContent.trim() === cod));
  tb.querySelectorAll("tr.sel").forEach(x => x.classList.remove("sel"));
  trs.forEach(tr => { tr.classList.add("sel"); tr.classList.remove("pisca"); void tr.offsetWidth; tr.classList.add("pisca"); });
  if (trs[0]) setTimeout(() => trs[0].scrollIntoView({ behavior: "smooth", block: "center" }), 280);
}

/* ---------------- tema claro / escuro ---------------- */
const escuro = () => document.documentElement.dataset.tema === "escuro";
const estiloMascara = () => escuro() ? "rgba(22,24,26,0.8)" : "rgba(238,238,234,0.82)";
function aplicaTema(esc_) {
  if (esc_) document.documentElement.dataset.tema = "escuro"; else delete document.documentElement.dataset.tema;
  $("#tema").textContent = esc_ ? "☀ Tema claro" : "🌙 Tema escuro";
  try { sessionStorage.setItem("painel-tema", esc_ ? "escuro" : "claro"); } catch (e) {}   // PAINEL: abre sempre no claro
  if (camadas.mascara) camadas.mascara.redesenha();
}
$("#tema").onclick = () => aplicaTema(!escuro());
aplicaTema(escuro());

/* ---------------- capa (13/11/2026) ---------------- */
// o atlas carrega por trás enquanto a capa está aberta
// 16/11/2026: a aba guarda (sessionStorage) se a capa está aberta e o município da tela, para o F5 manter a página
const guarda = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };
const lembra = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
function fechaCapa() {
  document.documentElement.classList.remove("capa-aberta"); guarda("atlas-capa", "0");
  if (mapa) setTimeout(() => { mapa.invalidateSize(); if (atual) enquadra(); }, 50);
}
$("#capa-entrar").onclick = fechaCapa;
// 16/11/2026: ir à capa reinicia o atlas no 1º município (sem modo Combinar); o F5 com o mapa aberto não passa por aqui
$("#ver-capa").onclick = () => { document.documentElement.classList.add("capa-aberta"); guarda("atlas-capa", "1");
  if (A && LISTA.length) { COMB = false; selecionaLista([LISTA[0]], false); barraSelecao(); }
  window.scrollTo(0, 0); $(".capa").scrollTop = 0; $("#capa-entrar").focus(); };
// resumo da página inicial: números do atlas.json do mês
function resumoCapa() {
  const g = A.goias, n = Object.keys(A.municipios).length, l = Object.keys(A.lotes).length;
  $("#capa-numeros").innerHTML = `Situação da malha rodoviária estadual nos <b>${n}</b> municípios goianos: <b>${km2(g.total)}</b>
    de rodovias estaduais, índice de pavimentação de <b>${br(g.idx_pav, 1)}%</b>, em ${l} lotes de manutenção.`;
  resumoSobre();
}

/* ---------------- sobre os dados (16/11/2026) ---------------- */
// página por cima da capa e do atlas; F5 com ela aberta mantém aberta (sessionStorage, como a capa)
const SIT_TXT = {
  DUP: "pista duplicada (duas pistas separadas), pavimentada.",
  PAV: "pista simples com revestimento asfáltico.",
  EOD: "trecho pavimentado em obras de duplicação.",
  EOP: "trecho sem pavimento em obras de pavimentação; quando concluídas, passa a Pavimentada.",
  IMP: "estrada implantada (plataforma, greide e drenagem construídos), ainda sem pavimento.",
  LEN: "estrada de terra sem implantação técnica, no leito natural do terreno."
};
const sobreAberto = () => document.documentElement.classList.contains("sobre-aberto");
function abreSobre() {
  const s = $("#sobre"); s.hidden = false; document.documentElement.classList.add("sobre-aberto"); guarda("atlas-sobre", "1");
  s.scrollTop = 0; $("#sobre-voltar").focus();
}
function fechaSobre() {
  $("#sobre").hidden = true; document.documentElement.classList.remove("sobre-aberto"); guarda("atlas-sobre", "0");
}
document.querySelectorAll(".abre-sobre").forEach(b => b.onclick = abreSobre);
$("#sobre-voltar").onclick = fechaSobre;
document.querySelectorAll(".sobre-entrar").forEach(b => b.onclick = () => { fechaSobre(); fechaCapa(); });
document.querySelectorAll(".sobre-indice [data-ir]").forEach(b => b.onclick = () => {
  const alvo = document.getElementById(b.dataset.ir), s = $("#sobre");
  s.scrollTo({ top: alvo.offsetTop - $(".sobre-barra").offsetHeight - 8, behavior: "smooth" });
});
if (window.ATLAS_RECARGA && lembra("atlas-sobre") === "1") abreSobre(); else guarda("atlas-sobre", "0");
function resumoSobre() {
  const g = A.goias, ms = Object.values(A.municipios), n = ms.length, l = Object.keys(A.lotes).length;
  const cad = ((ms[0] && ms[0].notas || "").match(/cadastros de (\d\d\/\d\d\/\d{4})/) || [])[1] || "–";
  const fx = ms.reduce((a, m) => a + (m.faixa_ha || 0), 0);
  const ip = br(g.idx_pav, 1) + "%", dens = br(g.dens, 1) + " Km/1.000 Km²";
  const pav = (g.situacao.PAV || 0) + (g.situacao.DUP || 0), eop = g.situacao.EOP || 0;
  document.querySelectorAll(".sb-mun").forEach(e => e.textContent = n);
  document.querySelectorAll(".sb-cad").forEach(e => e.textContent = cad);
  document.querySelectorAll(".sb-ip").forEach(e => e.textContent = ip);
  document.querySelectorAll(".sb-dens").forEach(e => e.textContent = dens);
  const c = [["Malha estadual", km2(g.total), `${n} municípios · ${l} lotes`],
    ["Índice de pavimentação", ip, `${km2(pav)} pavimentados ou duplicados`],
    ["Após as obras de pavimentação", pcS(100 * (pav + eop) / g.total), `${km2(eop)} em obras de pavimentação`],
    ["Densidade rodoviária", br(g.dens, 1), `Km por 1.000 Km² · área ${br(g.area_km2, 0)} Km²`],
    ["Faixa de domínio", br(fx, 0) + " ha", "soma dos municípios"]];
  $("#sobre-cartoes").innerHTML = c.map(([t, v, s]) => `<div class="sobre-cartao"><span class="t">${t}</span><b>${v}</b><span class="s">${s}</span></div>`).join("");
  const sits = ORD.filter(k => k !== "PLA" && g.situacao[k]);
  $("#sobre-sit").innerHTML = `<thead><tr><th>Situação</th><th>Extensão</th><th>% da malha</th></tr></thead><tbody>` +
    sits.map(k => `<tr><td><i class="sb-cor" style="background:${SIT[k][1]}"></i>${SIT[k][0]}</td><td>${km2(g.situacao[k])}</td>` +
      `<td>${pcS(100 * g.situacao[k] / g.total)}</td></tr>`).join("") +
    `<tr class="tot"><td>Total</td><td>${km2(g.total)}</td><td>100,0%</td></tr></tbody>`;
  $("#sobre-sit-lista").innerHTML = ORD.filter(k => k !== "PLA").map(k =>
    `<li><i class="sb-cor" style="background:${SIT[k][1]}"></i><b>${SIT[k][0]}:</b> ${SIT_TXT[k]}</li>`).join("");
}
const pcS = v => br(v, 1) + "%";

/* ---------------- copiar o link do município aberto (16/11/2026) ---------------- */
// o endereço da barra fica no link principal; este botão monta o link com #código(s) para enviar a alguém
function linkAtual() {
  const p = new URLSearchParams(location.search); p.delete("capa"); p.delete("tema");
  return location.origin + location.pathname + (p.toString() ? "?" + p : "") + "#" + SEL.join(",");
}
async function copiaTexto(txt, rotulo) {   // área de transferência, com reserva para navegador sem permissão
  let ok = false;
  try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) {
    const t = document.createElement("textarea"); t.value = txt; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select(); try { ok = document.execCommand("copy"); } catch (e2) {} t.remove();
  }
  if (!ok) window.prompt(rotulo || "Copie:", txt);
  return ok;
}
$("#copiar").onclick = async () => {
  const b = $("#copiar"), url = linkAtual();
  if (!await copiaTexto(url, "Copie o link:")) return;
  b.textContent = "✓ Link copiado"; b.classList.add("ok");
  clearTimeout(b._t); b._t = setTimeout(() => { b.textContent = "🔗 Copiar link"; b.classList.remove("ok"); }, 2200);
};
/* ---------------- modo apresentação (16/11/2026) ---------------- */
// a #folha (cabeçalho, página e rodapé) vira uma página A3 deitada de tamanho fixo, como o caderno exportado do QGIS,
// e é escalada para caber na tela; sempre no tema claro (papel); ← → trocam o município, Esc sai
const FOLHA_W = 1680, FOLHA_H = Math.round(1680 / Math.SQRT2);   // proporção A3 (420 × 297 mm)
/* ---------------- copiar coordenadas do mapa, graus decimais (16/11/2026) ---------------- */
let COORD = false;
// SIRGAS 2000 (EPSG:4674), graus decimais. Transformação oficial WGS 84 -> SIRGAS 2000 = EPSG:15894
// (parâmetros 0,0,0: mesmos valores numéricos), então a conversão é a identidade.
const paraSirgas = ll => ({ lat: ll.lat, lng: ll.lng });
const fmtCoord = ll => { const s = paraSirgas(ll); return s.lat.toFixed(6) + ", " + s.lng.toFixed(6); };   // "lat, lon" (ponto decimal, aceito por Google Maps/QGIS)
function mostraCoord(ll, copiaJa) {
  const s = paraSirgas(ll), txt = fmtCoord(ll), d = document.createElement("div"); d.className = "pop-coord";
  d.innerHTML = `<div class="pc-tit">Coordenada (graus decimais, SIRGAS 2000)</div>
    <div class="pc-lin">Lat <code>${s.lat.toFixed(6)}</code> · Lon <code>${s.lng.toFixed(6)}</code></div><button type="button">📋 Copiar</button>`;
  const b = d.querySelector("button");
  const vai = async () => { if (await copiaTexto(txt, "Copie a coordenada:")) { b.textContent = "✓ Copiado"; b.classList.add("ok"); } };
  b.onclick = e => { e.stopPropagation(); vai(); };
  L.popup({ className: "popup-coord", autoPan: false, closeButton: true }).setLatLng(ll).setContent(d).openOn(mapa);
  if (copiaJa) vai();
}
let APRES = false, temaAntes = null, ctlTimer = null;
// zoom da folha montada (vários municípios, 16/11/2026): ZF = zoom sobre o "caber na tela"; TX/TY = posição na tela
let ZF = 1, TX = 0, TY = 0;
// 19/11/2026: o mesmo zoom vale para a imagem da página de um município (IMG)
const alvoZoom = () => IMG ? $("#apres-img img") : $("#folha");
const dimZoom = () => { const im = $("#apres-img img");
  return IMG && im.naturalWidth ? [im.naturalWidth, im.naturalHeight] : [FOLHA_W, FOLHA_H]; };
const escBase = () => { const [w, h] = dimZoom(); return Math.min(window.innerWidth / w, window.innerHeight / h); };
function escalaFolha() {
  const [fw, fh] = dimZoom();
  const s = escBase() * ZF, W = fw * s, H = fh * s, vw = window.innerWidth, vh = window.innerHeight;
  // menor que a tela: centraliza; maior: não deixa sobrar borda vazia
  TX = W <= vw ? (vw - W) / 2 : Math.min(0, Math.max(vw - W, TX));
  TY = H <= vh ? (vh - H) / 2 : Math.min(0, Math.max(vh - H, TY));
  alvoZoom().style.transform = `translate(${TX}px, ${TY}px) scale(${s})`;
  document.documentElement.classList.toggle("folha-zoom", ZF > 1.001);
  const z = $("#apres-zval"); if (z) z.textContent = Math.round(ZF * 100) + "%";
}
// f > 1 aproxima, f < 1 afasta, f = 0 volta a caber na tela; (cx, cy) = ponto da tela que fica parado
function zoomFolha(f, cx = window.innerWidth / 2, cy = window.innerHeight / 2) {
  if (!APRES) return;
  const s = escBase() * ZF, nz = f === 0 ? 1 : Math.min(6, Math.max(1, ZF * f)), s2 = escBase() * nz;
  TX = cx - (cx - TX) * s2 / s; TY = cy - (cy - TY) * s2 / s; ZF = nz;
  fechaBalao(); escalaFolha(); mostraCtl();
}
// encolhe (zoom) os blocos de cada coluna até tudo caber na folha; o mapa não encolhe
function ajustaFolha() {
  if (!APRES || IMG) return;
  const sobra = col => col.scrollHeight > col.clientHeight + 1;
  const encolhe = (col, alvos, min) => {
    const els = alvos.flatMap(s => [...col.querySelectorAll(s)]);
    for (let z = 1; sobra(col) && z > min + 0.001; ) { z = Math.max(min, z - 0.04); els.forEach(e => e.style.zoom = z); }
  };
  const esq = $(".col-esq"), dir = $(".col-dir");
  document.querySelectorAll("#t-sre tr.apres-mais").forEach(tr => tr.remove());      // desfaz o ajuste anterior
  document.querySelectorAll("#t-sre tbody tr").forEach(tr => tr.style.display = "");
  [esq, dir].forEach(c => c.querySelectorAll("[style*=zoom]").forEach(e => e.style.zoom = ""));
  // tabelas: primeiro cabem na largura da coluna (como no caderno, sem cortar colunas)
  document.querySelectorAll("#folha .tab-rolagem > table").forEach(t => {
    const z = t.parentElement.clientWidth / t.scrollWidth; if (z < 1) t.style.zoom = z;
  });
  encolhe(esq, [".b-notas", ".b-legenda"], 0.6);                  // 1º notas e legenda, depois o quadro de obras junto
  encolhe(esq, [".b-obras", ".b-notas", ".b-legenda"], 0.45);
  encolhe(dir, [".b-sre .tab-rolagem"], 0.55);                    // 1º o quadro de trechos
  encolhe(dir, [".b-graf", ".b-peso", ".b-comp"], 0.7);            // depois os gráficos
  encolhe(dir, [".b-sre .tab-rolagem"], 0.4);
  // seleção grande demais para uma folha: mostra os trechos que cabem e avisa quantos ficaram de fora
  const baixo = dir.getBoundingClientRect().bottom, linhas = [...document.querySelectorAll("#t-sre tbody tr")];
  const fora = linhas.filter(tr => tr.getBoundingClientRect().bottom > baixo + 1);
  if (fora.length) {
    const n = fora.length + 1; linhas.slice(-n).forEach(tr => tr.style.display = "none");
    const tr = document.createElement("tr"); tr.className = "apres-mais";
    tr.innerHTML = `<td colspan="99">… e mais ${n} trechos — a lista completa está no site, fora do modo apresentação</td>`;
    $("#t-sre tbody").appendChild(tr);
  }
  if (mapa) { mapa.invalidateSize(); enquadra(); }
}
function mostraCtl() {
  const c = $("#apres-ctl"); c.classList.add("vis");
  clearTimeout(ctlTimer); ctlTimer = setTimeout(() => c.classList.remove("vis"), 2500);
}
function entraApres() {
  if (APRES) return;
  APRES = true;
  if ($("#mapa").classList.contains("mapa-cheio")) expandeMapa(false);
  temaAntes = escuro();
  if (temaAntes) { delete document.documentElement.dataset.tema; if (camadas.mascara) camadas.mascara.redesenha(); }
  if (mapa) mapa.keyboard.disable();                 // ← → trocam o município em vez de arrastar o mapa
  $("#apres-ctl").hidden = false; mostraCtl();
  if (window.PAINEL) PAINEL.restaura();              // PAINEL: a folha montada usa o arranjo original da página
  if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  modoApres();
  setTimeout(() => { escalaFolha(); if (!IMG) ajustaFolha(); }, 300);     // depois de entrar na tela cheia
}
// 16/11/2026: um município = imagem da página do caderno exportada do QGIS (layout 04, data/<mês>/caderno/<código>.jpg);
// vários municípios = a folha montada no site (não há imagem de combinação)
let IMG = false;
const SEM_IMG = new Set();                            // municípios cuja imagem não carregou: usam a folha montada
function modoApres() {
  if (!APRES) return;
  ZF = 1; fechaBalao();                               // outro município: volta a caber na tela
  const cod = SEL[0];
  IMG = false;                                        // 25/11/2026: um município também usa a folha montada (interativa), como os combinados
  document.documentElement.classList.toggle("apres", !IMG);
  document.documentElement.classList.toggle("apres-img", IMG);
  const caixa = $("#apres-img");
  caixa.hidden = !IMG;
  if (IMG) {
    $("#folha").style.transform = "";
    const im = $("#apres-img img");
    im.onerror = () => { SEM_IMG.add(cod); modoApres(); };
    im.onload = () => { if (IMG) { ZF = 1; escalaFolha(); } };
    im.src = `${DADOS}data/${MES_SITE}/caderno/${cod}.jpg`;
    im.alt = `Página do caderno – ${A.municipios[cod].nome}/GO`;
    escalaFolha();
  } else { $("#apres-img img").style.transform = ""; escalaFolha(); ajustaFolha(); }
}
// clique na imagem: tamanho real (para ler as tabelas), no ponto clicado; com zoom, o clique volta a caber na tela
$("#apres-img").addEventListener("click", ev => {
  if (!IMG) return;
  if (ZF > 1.001) zoomFolha(0); else zoomFolha(Math.max(2, 1 / escBase()), ev.clientX, ev.clientY);
});
function saiApres() {
  if (!APRES) return;
  APRES = false; IMG = false; ZF = 1; fechaBalao();
  document.documentElement.classList.remove("apres", "apres-img", "folha-zoom");
  $("#apres-img").hidden = true; $("#apres-img img").style.transform = "";
  $("#apres-ctl").hidden = true;
  const f = $("#folha"); f.style.transform = "";
  f.querySelectorAll("[style*=zoom]").forEach(e => e.style.zoom = "");
  if (temaAntes) { document.documentElement.dataset.tema = "escuro"; if (camadas.mascara) camadas.mascara.redesenha(); }
  if (mapa) mapa.keyboard.enable();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  if (window.PAINEL) PAINEL.monta();                 // PAINEL: volta ao arranjo de painéis
  if (SEL.length) selecionaLista(SEL, false);          // redesenha os quadros (volta as linhas escondidas na folha)
  if (mapa) setTimeout(() => { mapa.invalidateSize(); enquadra(); }, 50);
}
$("#apres").onclick = entraApres;
$("#apres-sair").onclick = saiApres;
$("#apres-ant").onclick = () => $("#ant").click();
$("#apres-prox").onclick = () => $("#prox").click();
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) saiApres(); else { escalaFolha(); if (!IMG) ajustaFolha(); } });
window.addEventListener("resize", () => { if (APRES) { ZF = 1; escalaFolha(); if (!IMG) ajustaFolha(); } });
document.addEventListener("mousemove", () => { if (APRES) mostraCtl(); });
// botão clicado não fica marcado (senão, ao usar o teclado depois, ele não some mais com o mouse parado)
$("#apres-ctl").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setTimeout(() => b.blur(), 0); });
$("#apres-zmais").onclick = () => zoomFolha(1.25);
$("#apres-zmenos").onclick = () => zoomFolha(0.8);
$("#apres-zajusta").onclick = () => zoomFolha(0);
// imprimir (19/11/2026): fecha o balão, volta o zoom a 100%, espera o mapa (ou a imagem do caderno) terminar de carregar
// e abre a janela de impressão do navegador (lá também dá "Salvar como PDF"); o style.css (@media print) deixa só a folha
let IMPRIMINDO = false;
// página A3 deitada sem margem só enquanto imprime no modo apresentação (fora dele, o Ctrl+P do site fica como era)
function pagA3(liga) {
  let st = document.getElementById("pag-a3");
  if (liga && !st) { st = document.createElement("style"); st.id = "pag-a3"; st.textContent = "@page { size: A3 landscape; margin: 0; }"; document.head.appendChild(st); }
  if (!liga && st) st.remove();
}
window.addEventListener("beforeprint", () => pagA3(APRES));
window.addEventListener("afterprint", () => pagA3(false));
async function imprimeFolha() {
  if (!APRES || IMPRIMINDO) return;
  IMPRIMINDO = true;
  const b = $("#apres-impr"), txt = b.textContent;
  fechaBalao();
  if (ZF > 1.001) zoomFolha(0);
  b.textContent = "⏳ Preparando…"; b.disabled = true;
  const pronto = () => {
    if (IMG) return $("#apres-img img").complete;
    let carregando = false;
    if (mapa) mapa.eachLayer(l => { if (l.isLoading && l.isLoading()) carregando = true; });
    return !carregando;
  };
  for (let t = 0; t < 100 && !pronto(); t++) await new Promise(r => setTimeout(r, 150));    // espera até 15 s
  await new Promise(r => setTimeout(r, 300));
  b.textContent = txt; b.disabled = false;
  pagA3(true);
  try { window.print(); } finally { IMPRIMINDO = false; mostraCtl(); }
}
$("#apres-impr").onclick = imprimeFolha;
// Ctrl + roda do mouse: zoom no ponto do cursor (também sobre o mapa); com zoom, a roda sozinha rola a folha
window.addEventListener("wheel", e => {
  if (!APRES) return;
  if (e.ctrlKey) { e.preventDefault(); e.stopPropagation(); zoomFolha(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY); return; }
  if (ZF > 1.001 && !e.target.closest?.(".mapa")) {
    e.preventDefault(); fechaBalao();
    TX -= e.shiftKey ? e.deltaY : e.deltaX; TY -= e.shiftKey ? 0 : e.deltaY; escalaFolha();
  }
}, { capture: true, passive: false });
// com zoom, arrastar a folha (fora do mapa, que tem o próprio arraste) move a visão
let ARR = null, ARRASTOU = false;
const iniArraste = e => {
  if (!APRES || ZF <= 1.001 || e.button !== 0 || e.target.closest(".mapa")) return;
  if (IMG) e.preventDefault();                       // não arrastar a imagem como arquivo
  ARR = { x: e.clientX, y: e.clientY, tx: TX, ty: TY }; ARRASTOU = false;
};
$("#folha").addEventListener("pointerdown", e => { if (!IMG) iniArraste(e); });
$("#apres-img").addEventListener("pointerdown", e => { if (IMG) iniArraste(e); });
window.addEventListener("pointermove", e => {
  if (!ARR) return;
  const dx = e.clientX - ARR.x, dy = e.clientY - ARR.y;
  if (!ARRASTOU && Math.hypot(dx, dy) < 5) return;
  if (!ARRASTOU) { ARRASTOU = true; fechaBalao(); document.documentElement.classList.add("arrastando"); }
  TX = ARR.tx + dx; TY = ARR.ty + dy; escalaFolha();
});
window.addEventListener("pointerup", () => {
  if (!ARR) return; ARR = null; document.documentElement.classList.remove("arrastando");
  if (ARRASTOU) setTimeout(() => { ARRASTOU = false; }, 0);
});
window.addEventListener("click", e => { if (ARRASTOU) { e.stopPropagation(); e.preventDefault(); } }, true);   // soltar o arraste não é clique
document.addEventListener("keydown", e => {
  if (!APRES || e.target.closest?.("input, select, textarea")) return;
  if (e.key === "Escape" && !balao.hidden) fechaBalao();
  else if (e.key === "+" || e.key === "=") zoomFolha(1.25);
  else if (e.key === "-") zoomFolha(0.8);
  else if (e.key === "0") zoomFolha(0);
  else if (e.key === "Escape") saiApres();
  else if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); $("#prox").click(); }
  else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); $("#ant").click(); }
});
const limpaHash = () => { if (location.hash) history.replaceState(null, "", location.pathname + location.search); };
document.addEventListener("keydown", e => { if (e.key !== "Escape" || APRES) return;
  if (sobreAberto()) fechaSobre(); else if (document.documentElement.classList.contains("capa-aberta")) fechaCapa(); });

/* ---------------- carga ---------------- */
// cada mês fica em data/<AAAA-MM>/ (atlas.json, sre, obras DOR); as bases fixas ficam em data/
const MENSAIS = new Set(["sre", "dor_linhas", "dor_pontos", "dpj_linhas", "dpj_pontos"]);
const VAZIO = { type: "FeatureCollection", features: [] };
async function carrega() {
  const meses = await fetch(DADOS + "data/meses.json", { cache: "no-cache" }).then(r => r.json());
  const pedido = new URLSearchParams(location.search).get("mes");
  const MES = (meses.find(m => m.id === pedido) || meses[0]).id; MES_SITE = MES;
  const nomes = ["municipios", "sre", "dor_linhas", "dor_pontos", "dpj_linhas", "dpj_pontos", "perimetro_urbano", "localidades", "snv_federal", "lotes"];
  const [atlas, ...geos] = await Promise.all([fetch(`${DADOS}data/${MES}/atlas.json`).then(r => r.json()),
    ...nomes.map(n => fetch(DADOS + (MENSAIS.has(n) ? `data/${MES}/${n}.geojson` : `data/${n}.geojson`))
      .then(r => r.ok ? r.json() : VAZIO).catch(() => VAZIO))]);   // mês sem projetos: camada vazia
  A = atlas; nomes.forEach((n, i) => GEO[n] = geos[i]);
  textosDoMes(meses, MES); resumoCapa();
  LISTA = Object.entries(A.municipios).sort((a, b) => a[1].ordem - b[1].ordem).map(([cod]) => cod);
  autocompleta($("#q"), c => COMB ? alterna(c, true) : seleciona(c));
  iniciaMapa(); legenda();
  // link com #código abre esse(s) município(s); F5 volta ao da tela; abertura nova começa no 1º
  let { cods: ini, lote } = codsDoHash();
  if (!ini.length && window.ATLAS_RECARGA) {
    const lr = lembra("atlas-lote");
    if (lr && A.lotes[lr]) { ini = codsDoLote(lr); lote = lr; }
    else ini = (lembra("atlas-sel") || "").split(",").filter(c => A.municipios[c]);
  }
  selecionaLista(ini.length ? ini : [LISTA[0]], false, lote);
  limpaHash();                                  // a barra fica no link principal: reabrir o site cai na página inicial
  $("#carregando").remove();
}
// #5200050 ou #5200050,5209200 (link de uma seleção) ou #lote=11 (municípios do lote, com o lote em destaque)
// municípios do lote: todos por onde passa a malha do lote (mesma regra dos cartões da página inicial)
const codsDoLote = l => LISTA.filter(c => (A.municipios[c].peso || {})[l]);
const hashDaSel = () => LOTE_SEL ? "lote=" + LOTE_SEL : SEL.join(",");
function codsDoHash() {
  const h = decodeURIComponent(location.hash.slice(1)).trim(), ml = h.match(/^lote=(\w+)$/i);
  if (ml) return A.lotes[ml[1]] ? { cods: codsDoLote(ml[1]), lote: ml[1] } : { cods: [], lote: null };
  return { cods: h.split(",").map(s => s.trim()).filter(c => A.municipios[c]), lote: null };
}

/* ---------------- mês da base ---------------- */
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function textosDoMes(meses, MES) {
  const rot = A.rotulo;                                   // "novembro/2026"
  document.querySelectorAll(".mes-up").forEach(e => e.textContent = rot.toUpperCase());
  document.querySelectorAll(".mes-cap").forEach(e => e.textContent = cap(rot));
  document.querySelectorAll(".mes-min").forEach(e => e.textContent = rot);
  if (A.elaboracao) $("#elab").textContent = A.elaboracao;
  const sel = $("#mes");
  sel.innerHTML = meses.map(m => `<option value="${m.id}"${m.id === MES ? " selected" : ""}>SRE ${cap(m.rotulo)}</option>`).join("");
  sel.hidden = meses.length < 2;                          // com um mês só, não precisa do seletor
  sel.onchange = () => {
    const p = new URLSearchParams(location.search);
    sel.value === meses[0].id ? p.delete("mes") : p.set("mes", sel.value);
    location.href = location.pathname + (p.toString() ? "?" + p : "") + "#" + hashDaSel();
  };
}

/* ---------------- busca ---------------- */
const semAcento = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
function procura(txt) {
  const t = semAcento(txt);
  return LISTA.find(c => semAcento(A.municipios[c].nome) === t) ||
         LISTA.find(c => semAcento(A.municipios[c].nome).startsWith(t));
}
$("#ant").onclick = () => seleciona(LISTA[(LISTA.indexOf(atual) - 1 + LISTA.length) % LISTA.length]);
$("#prox").onclick = () => seleciona(LISTA[(LISTA.indexOf(atual) + 1) % LISTA.length]);
window.addEventListener("hashchange", () => { const { cods: c, lote } = codsDoHash();
  if (c.length && (c.join() !== SEL.join() || lote !== LOTE_SEL)) selecionaLista(c, false, lote);
  if (c.length) { fechaSobre(); fechaCapa(); limpaHash(); } });

/* ---------------- mapa ---------------- */
function estiloSRE(f) {
  const s = f.properties.sit;
  const cor = (s === "IMP" || s === "LEN") ? "#e88000" : s === "PLA" ? "#000000" : "#e31a1c";
  return { color: cor, weight: s === "DUP" || s === "EOD" ? 5 : 3, dashArray: s === "EOP" ? "8 5" : null, opacity: 1 };
}
function iniciaMapa() {
  mapa = L.map("mapa", { preferCanvas: true, zoomSnap: 0.25, attributionControl: true, zoomControl: false });
  mapa.attributionControl.setPrefix(false);   // 23/11/2026: crédito só do fundo em uso, sem "Leaflet"
  // 13/11/2026: sem filtro CSS nas imagens de satélite (o filtro em cada imagem deixava o arrasto pesado)
  const satelite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 18, attribution: "Esri"
  }).addTo(mapa);
  // 23/11/2026: outros fundos (um por vez, escolhidos na faixa abaixo do mapa); o satélite é sempre o padrão ao abrir
  const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
  camadas.fundos = {
    satelite: satelite,
    satNomes: L.layerGroup([satelite, L.tileLayer(ESRI + "Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 18, zIndex: 2 })]),
    osm: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      { maxZoom: 18, attribution: "© OpenStreetMap" }),
    // 23/11/2026: CARTO passou a pedir chave (API key) no site publicado → cinza claro da Esri, sem chave
    claro: L.layerGroup([L.tileLayer(ESRI + "Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 18, maxNativeZoom: 16, attribution: "Esri" }),
      L.tileLayer(ESRI + "Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 18, maxNativeZoom: 16, zIndex: 2 })]),
    topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      { maxZoom: 18, maxNativeZoom: 17, subdomains: "abc", attribution: "© OpenTopoMap" })
  };
  camadas.fundo = "satelite";
  mapa.createPane("rotulos").style.zIndex = 620;
  mapa.getPane("rotulos").style.pointerEvents = "none";
  mapa.createPane("mascara").style.zIndex = 390;
  // 19/11/2026: destaque do clique no quadro fica POR BAIXO das linhas — entre a máscara (390) e o canvas único onde
  // SRE, obras e projetos são desenhados (overlayPane, 400)
  mapa.createPane("realce").style.zIndex = 395;
  mapa.getPane("realce").style.pointerEvents = "none";
  // 23/11/2026: seleção do quadro — véu (foco), etiquetas (cota, sem clique) e caixa do resumo por cima dos rótulos (arrastável)
  mapa.createPane("foco").style.zIndex = 430;            // véu do holofote: acima das linhas, abaixo das placas
  mapa.getPane("foco").style.pointerEvents = "none";
  mapa.createPane("cota").style.zIndex = 615;
  mapa.getPane("cota").style.pointerEvents = "none";
  mapa.createPane("cotaCx").style.zIndex = 650;
  mapa.on("zoomend resize", desenhaCota);              // resize: o painel muda o tamanho do mapa (abas, janela)
  // registrado antes de qualquer popup: roda antes do preclick que fecha o popup
  mapa.on("preclick", () => { POP_ANTES = !!mapa.getContainer().querySelector(".leaflet-popup"); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && COTA && !APRES && !COORD &&
    !$("#mapa").classList.contains("mapa-cheio")) limpaDestaque(); });
  mapa.createPane("vias").style.zIndex = 420;
  mapa.createPane("projetos").style.zIndex = 425;   // obra tem mais peso: projetos ficam por baixo das obras
  mapa.createPane("obras").style.zIndex = 430;
  mapa.createPane("projP").style.zIndex = 436;
  mapa.createPane("topo").style.zIndex = 440;
  // 13/11/2026: painéis só de desenho não podem "engolir" o clique (o clique tem que chegar ao município)
  ["mascara", "vias", "topo"].forEach(p => mapa.getPane(p).style.pointerEvents = "none");
  const rnd = L.canvas({ padding: 0.3 });
  divisasEstaduais();

  // 13/11/2026: as camadas nascem vazias e recebem só a área do município selecionado (preencheArea)
  camadas.perimetro = L.geoJSON(null, { renderer: rnd,
    style: { color: "#f4f4ef", weight: 1, fillColor: "#f4f4ef", fillOpacity: 0.18 } });   // 19/11/2026: esbranquiçado (antes amarelo)
  camadas.municipios = L.geoJSON(null, { renderer: rnd,
    style: { color: "#ffffff", weight: 1, opacity: 0.8, fillOpacity: 0 },
    onEachFeature: (f, l) => {
      l.bindTooltip(() => f.properties.nome + (SEL.includes(f.properties.cod) ? " (selecionado)" : COMB ? " — clique para somar" : ""), { sticky: true });
    } });
  // lotes só desenhados (o nome já aparece no mapa); clicável, o lote ficaria por cima e travaria o clique no município
  camadas.lotes = L.geoJSON(GEO.lotes, { renderer: rnd, interactive: false,
    style: { color: T_LT, weight: 2, fillColor: T_LT, fillOpacity: 0.08, dashArray: "6 4" } });
  camadas.snv = L.geoJSON(null, { renderer: rnd, pane: "vias",
    style: { color: "#33a02c", weight: 3 },
    onEachFeature: (f, l) => { l.bindTooltip(`BR-${esc(f.properties.br)}`, { sticky: true }); balaoMapa(l, () => htmlSNV(f.properties)); } });
  camadas.sre = L.geoJSON(null, { renderer: rnd, pane: "vias", style: estiloSRE,
    onEachFeature: (f, l) => { l.bindTooltip(`<b>GO-${esc(f.properties.go)}</b> · ${esc(f.properties.sre)}<br>${SIT[f.properties.sit]?.[0] || esc(f.properties.sit)}`, { sticky: true });
      balaoMapa(l, () => htmlSRE(f.properties)); } });
  // obras (DOR) e projetos (DPJ), padrão oficial (19/11/2026): faixa na cor da intervenção + traço branco por cima
  // conforme a etapa — Obra = cheia; Licitação/ETP = tracejado branco no meio; Projeto = linha branca contínua (linha dupla)
  const base = f => ({ color: INT_COR[f.properties.intervencao] || "#666666", weight: etapaTraco(f.properties.etapa) === "obra" ? 6 : 8,
    opacity: 1, lineCap: "butt" });
  const topo = f => { const t = etapaTraco(f.properties.etapa);
    return t === "obra" ? { opacity: 0, weight: 0 } : { color: "#ffffff", opacity: 1, lineCap: "butt",
      weight: t === "projeto" ? 3 : 4.5, dashArray: t === "projeto" ? null : "6 3" }; };
  // 23/11/2026: dica ao passar o mouse no mesmo modelo da caixa de seleção — "Intervenção - Obra/Projeto" (natureza uma
  // vez só), "Etapa: …" com o nome do campo (fase do processo), rodovia · código
  const dica = (nat, p) => `<b>${esc(p.intervencao)} - ${nat}</b>${p.etapa ? `<br>Etapa: ${esc(p.etapa)}` : ""}` +
    `<br>${esc(p.rodovia || "")} · ${esc(p.codigo || "")}`;
  const dicaPlaca = (p, projeto) => dica(projeto ? "Projeto" : "Obra", p);
  const dorCasco = L.geoJSON(null, { renderer: rnd, pane: "obras", style: base,
      onEachFeature: (f, l) => { l.bindTooltip(dica("Obra", f.properties), { sticky: true }); balaoMapa(l, () => htmlObra(f.properties, false), e => destacaObraMapa(f.properties, false, false, e.latlng)); } });
  const dorCor = L.geoJSON(null, { renderer: rnd, pane: "obras", interactive: false, style: topo });
  camadas.dorL = L.layerGroup([dorCasco, dorCor]);
  const placa = (f, projeto) => L.icon({ iconUrl: PLACA[catPlaca(f.properties, projeto)][0], iconSize: [22, 22], iconAnchor: [11, 11] });
  camadas.dorP = L.geoJSON(null, { pane: "projP",
    pointToLayer: (f, ll) => L.marker(ll, { pane: "projP", icon: placa(f, false) }),
    onEachFeature: (f, l) => { l.bindTooltip(dicaPlaca(f.properties, false));
      balaoMapa(l, () => htmlObra(f.properties, false), () => destacaObraMapa(f.properties, false, true, l.getLatLng()));
      l.on("click", e => clicaPlaca(e, f, false)); } });
  const pjBase = L.geoJSON(null, { renderer: rnd, pane: "projetos", style: base,
      onEachFeature: (f, l) => { l.bindTooltip(dica("Projeto", f.properties), { sticky: true }); balaoMapa(l, () => htmlObra(f.properties, true), e => destacaObraMapa(f.properties, true, false, e.latlng)); } });
  const pjTopo = L.geoJSON(null, { renderer: rnd, pane: "projetos", interactive: false, style: topo });
  dorCor._topo = pjTopo._topo = true;              // traço branco: não é desenhado com zoom afastado (preencheArea)
  camadas.projL = L.layerGroup([pjBase, pjTopo]);
  camadas.projP = L.geoJSON(null, { pane: "projP",
    pointToLayer: (f, ll) => L.marker(ll, { pane: "projP", icon: placa(f, true) }),
    onEachFeature: (f, l) => { l.bindTooltip(dicaPlaca(f.properties, true));
      balaoMapa(l, () => htmlObra(f.properties, true), () => destacaObraMapa(f.properties, true, true, l.getLatLng()));
      l.on("click", e => clicaPlaca(e, f, true)); } });
  camadas.loc = L.geoJSON(null, {
    pointToLayer: (f, ll) => L.circleMarker(ll, { renderer: rnd, radius: /Sede|Capital/.test(f.properties.t) ? 4 : 2.5, color: "#222",
      weight: 1, fillColor: "#fff", fillOpacity: 1 }),
    onEachFeature: (f, l) => { l.bindTooltip(esc(f.properties.n), { permanent: /Sede|Capital/.test(f.properties.t),
      direction: "right", offset: [5, 0], className: "rot-loc" }); balaoMapa(l, () => htmlLoc(f.properties)); } });
  // [camada, fonte] que só recebem a área do município selecionado
  AREA = [[camadas.perimetro, "perimetro_urbano"], [camadas.municipios, "municipios"], [camadas.snv, "snv_federal"],
    [camadas.sre, "sre"], [pjBase, "dpj_linhas"], [pjTopo, "dpj_linhas"], [dorCasco, "dor_linhas"], [dorCor, "dor_linhas"],
    [camadas.dorP, "dor_pontos"], [camadas.projP, "dpj_pontos"], [camadas.loc, "localidades"]];   // ordem = ordem de desenho
  AREA.forEach(([, n]) => GEO[n].features.forEach(f => f._bb = f._bb || caixa(f.geometry)));

  // clique em qualquer ponto do mapa (também sobre rodovia, obra ou área ainda não carregada): acha o município
  // pelo ponto, entre os 246. Modo Combinar (ou Ctrl/Shift + clique): soma/tira da seleção; senão abre só ele
  mapa.on("click", e => {
    if (COORD) { mostraCoord(e.latlng, true); return; }   // modo coordenadas: o clique copia, não troca município
    const f = municipioEm(e.latlng);
    // apresentação: o clique mostra o balão do elemento (ou do município); não mexe na seleção (trocar = setas ← →)
    // 25/11/2026: obra/projeto = a mesma seleção do painel (destaque + caixa); clique fora do item desfaz; o resto segue com o balão
    if (APRES && !IMG) {
      if (COTA && pertoDoDestaque(e.containerPoint)) return;
      const ob = maisPerto(e, [[camadas.projP, p => [p, true, true], 13], [camadas.dorP, p => [p, false, true], 11],
        [camadas.dorL, p => [p, false, false], 8], [camadas.projL, p => [p, true, false], 8]]);
      if (ob) { fechaBalao(); destacaObraMapa(...ob, e.latlng); return; }
      if (COTA) { fechaBalao(); limpaDestaque(); return; }
      const h = elementoEm(e) || (f && htmlMun(f.properties.cod)); if (h) abreBalao(e.originalEvent, h); return; }
    const oe = e.originalEvent || {};
    // 18/11/2026: em cima de trecho do SRE, obra ou projeto abre o popup (Ctrl/Shift + clique continua somando município)
    // 23/11/2026: obra ou projeto = destaque igual ao do quadro (véu, sombra, início/fim e caixa); SRE segue com o popup.
    // Com algo selecionado (destaque ou popup aberto): clique em OUTRA obra/projeto seleciona direto; clique no próprio
    // item destacado não faz nada; clique em qualquer outro lugar só desfaz a seleção (o seguinte volta ao normal)
    if (!APRES) {
      const mod = oe.ctrlKey || oe.shiftKey || oe.metaKey;
      if (COTA && pertoDoDestaque(e.containerPoint)) return;
      const ob = mod ? null : maisPerto(e, [[camadas.projP, p => [p, true, true], 13], [camadas.dorP, p => [p, false, true], 11],
        [camadas.dorL, p => [p, false, false], 8], [camadas.projL, p => [p, true, false], 8]]);
      if (ob) { POP_ANTES = false; mapa.closePopup(); destacaObraMapa(...ob, e.latlng); return; }
      if (COTA || POP_ANTES) { POP_ANTES = false; limpaDestaque(); return; }
      if (!mod) { const d = popupEm(e); if (d) { abrePop(e.latlng, d); return; } }
    }
    if (!f) return;
    const c = f.properties.cod;
    if (COMB || oe.ctrlKey || oe.shiftKey || oe.metaKey) alterna(c);
    else if (c !== atual || SEL.length > 1) seleciona(c);
  });
  camadas.perimetro.addTo(mapa); camadas.municipios.addTo(mapa); camadas.snv.addTo(mapa); camadas.sre.addTo(mapa);
  camadas.projL.addTo(mapa); camadas.dorL.addTo(mapa); camadas.projP.addTo(mapa); camadas.dorP.addTo(mapa); camadas.loc.addTo(mapa);
  camadas.satelite = satelite;
  camadas.rotVias = L.layerGroup().addTo(mapa);      // GO-xxx / BR-xxx
  camadas.rotMun = L.layerGroup().addTo(mapa);       // nomes dos municípios
  camadas.rotLotes = L.layerGroup();                 // números dos lotes
  camadas.grade = L.layerGroup().addTo(mapa);        // grade de coordenadas
  GEO.lotes.features.forEach(f => camadas.rotLotes.addLayer(L.marker(centro(f.geometry), { interactive: false, pane: "rotulos",
    icon: L.divIcon({ className: "rot-lote", html: "Lote " + esc(f.properties.lote), iconSize: null }) })));
  GEO.municipios.features.forEach(f => f._centro = centro(f.geometry));   // nomes: criados por área em preencheArea
  L.control.zoom({ position: "topleft", zoomInTitle: "Aproximar", zoomOutTitle: "Afastar" }).addTo(mapa);
  const Norte = L.Control.extend({ options: { position: "topright" },
    onAdd() { const d = L.DomUtil.create("div", "norte"); d.title = "Norte";
      d.innerHTML = `<svg viewBox="0 0 40 56" width="34" height="48"><polygon points="20,4 30,40 20,33 10,40" fill="#222"/>
        <polygon points="20,4 20,33 10,40" fill="#fff" stroke="#222" stroke-width="1.2"/>
        <text x="20" y="54" text-anchor="middle" font-size="13" font-weight="bold" font-family="Arial" fill="#222">N</text></svg>`;
      return d; } });
  new Norte().addTo(mapa);
  // 23/11/2026: ícone de camadas logo após "Coordenadas" (à esquerda) — abre a lista dos fundos (satélite é sempre o padrão)
  const Fundo = L.Control.extend({ options: { position: "topleft" },
    onAdd() { const d = L.DomUtil.create("div", "fundo-ctl");
      const FUNDOS = [["satelite", "Satélite"], ["satNomes", "Satélite + nomes"], ["osm", "OpenStreetMap"],
        ["claro", "Ruas (claro)"], ["topo", "Topográfico"], ["nenhum", "Sem fundo"]];
      d.innerHTML = `<button type="button" class="fundo-btn" title="Fundo do mapa" aria-label="Fundo do mapa" aria-expanded="false">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#444" stroke-width="1.6" stroke-linejoin="round">
        <path d="m2.5 16 9.5 5 9.5-5"/><path d="m2.5 12 9.5 5 9.5-5"/><path d="M12 3 2.5 8 12 13l9.5-5z" fill="#fff"/></svg></button>
        <div class="fundo-menu" hidden><b>Fundo do mapa</b>` +
        FUNDOS.map(([k, t]) => `<label><input type="radio" name="fundo" value="${k}" ${camadas.fundo === k ? "checked" : ""}> ${t}</label>`).join("") +
        `</div>`;
      L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
      const btn = d.querySelector(".fundo-btn"), menu = d.querySelector(".fundo-menu");
      const abre = v => { menu.hidden = !v; btn.setAttribute("aria-expanded", v); };
      btn.onclick = () => abre(menu.hidden);
      document.addEventListener("click", e => { if (!d.contains(e.target)) abre(false); });
      d.querySelectorAll("input[name=fundo]").forEach(r => r.onchange = () => {
        const ant = camadas.fundos[camadas.fundo]; if (ant) mapa.removeLayer(ant);
        camadas.fundo = r.value; const novo = camadas.fundos[r.value]; if (novo) mapa.addLayer(novo);
      });
      return d; } });
  painelCamadas();
  // barra de escala (18/11/2026): como a do caderno — caixa dupla com 3 a 5 segmentos, "Km" com K maiúsculo.
  // Metros por pixel medidos no centro do mapa (distância no elipsoide), não pela fórmula do zoom.
  // Na apresentação a folha é uma A3 com 1680 px (0,25 mm/px): a escala numérica e o tamanho da barra (18–32 mm,
  // como no caderno) são os da folha; fora dela, a escala vale para tela de 96 dpi.
  const Barra = L.Control.extend({ options: { position: "bottomleft" },
    onAdd() { this._d = L.DomUtil.create("div", "escala-barra"); return this._d; } });
  const eb = new Barra().addTo(mapa);
  const EscNum = L.Control.extend({ options: { position: "topleft" },
    onAdd() { this._d = L.DomUtil.create("div", "escala-num"); return this._d; } });
  const en = new EscNum().addTo(mapa);
  const atualizaEsc = () => {
    const t = mapa.getSize(); if (!t.x) return;
    // PAINEL (23/11/2026): no modo painel a escala numérica fica embaixo, logo acima da barra de escala;
    // na folha A3 (apresentação) volta ao lugar de sempre, abaixo do zoom
    // 25/11/2026: na apresentação também fica embaixo, como no painel
    const cc = mapa._controlCorners, emPainel = APRES || document.documentElement.classList.contains("modo-painel");
    if (emPainel && en._d.nextSibling !== eb._d) cc.bottomleft.insertBefore(en._d, eb._d);
    else if (!emPainel && en._d.parentNode !== cc.topleft) cc.topleft.insertBefore(en._d, cc.topleft.children[1] || null);
    const y = t.y / 2, x0 = Math.max(0, t.x / 2 - 50);
    const mpp = mapa.distance(mapa.containerPointToLatLng([x0, y]), mapa.containerPointToLatLng([x0 + 100, y])) / 100;
    const folha = APRES && !IMG, mmPx = folha ? 420 / FOLHA_W : 25.4 / 96;
    // PAINEL (23/11/2026): rótulo e valor separados (cartão "Escala | 1:…" no painel; na folha lê "ESCALA 1:…")
    en._d.innerHTML = `<span class="en-rot">Escala</span> <b class="en-val">1:${br(Math.round(mpp * 1000 / mmPx / 1000) * 1000, 0)}</b>`;
    const maxPx = (folha ? 32 : 40) / mmPx;
    let melhor = null;
    for (const seg of [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500])
      for (const n of [5, 4, 3]) {
        const px = seg * 1000 * n / mpp;
        if (px <= maxPx && (!melhor || px > melhor.px)) melhor = { seg, n, px };
      }
    if (!melhor) { eb._d.innerHTML = ""; return; }
    const w = melhor.px / melhor.n, num = v => br(v, Number.isInteger(v) ? 0 : (Number.isInteger(v * 10) ? 1 : 2));
    let rot = "", cx = "";
    for (let i = 0; i <= melhor.n; i++)
      // PAINEL (23/11/2026): todo número centralizado na divisão (com tracinho); "Km" fica fora, depois do último
      rot += `<span style="left:${i * w}px">${num(i * melhor.seg)}${i === melhor.n ? '<em class="eb-un">Km</em>' : ""}</span>`;
    for (let i = 0; i < melhor.n; i++) cx += `<i class="${i % 2 ? "b" : "p"}" style="left:${i * w}px;width:${w}px"></i>`;
    eb._d.innerHTML = `<div class="eb-rot">${rot}</div><div class="eb-cx" style="width:${melhor.px}px">${cx}</div>`;
    eb._d.style.width = melhor.px + "px";       // PAINEL: caixa justa (antes +34 px, somados ao recuo = 61 px sobrando)
  };
  mapa.on("zoomend moveend resize", atualizaEsc);
  const Volta = L.Control.extend({ options: { position: "topleft" },
    onAdd() { const b = L.DomUtil.create("button", "btn-mapa"); b.textContent = "⤢ Município"; b.title = "Voltar ao município";
      L.DomEvent.on(b, "click", e => { L.DomEvent.stop(e); enquadra(); }); return b; } });
  new Volta().addTo(mapa);
  // expandir só o mapa na tela toda (16/11/2026); Esc ou "✕ Fechar" volta
  const Expande = L.Control.extend({ options: { position: "topleft" },
    onAdd() { const b = L.DomUtil.create("button", "btn-mapa btn-expande"); b.type = "button";
      L.DomEvent.on(b, "click", e => { L.DomEvent.stop(e); expandeMapa(!$("#mapa").classList.contains("mapa-cheio")); });
      this._b = b; return b; } });
  const ex = new Expande().addTo(mapa);
  const rotuloExp = cheio => { ex._b.textContent = cheio ? "✕ Fechar" : "⛶ Expandir mapa";
    ex._b.title = cheio ? "Fechar o mapa expandido (Esc)" : "Ver só o mapa, na tela toda"; ex._b.setAttribute("aria-pressed", cheio); };
  rotuloExp(false);
  window.expandeMapa = cheio => {
    const c = mapa.getCenter(), z = mapa.getZoom();
    $("#mapa").classList.toggle("mapa-cheio", cheio);
    document.documentElement.classList.toggle("mapa-expandido", cheio);
    rotuloExp(cheio);
    mapa.invalidateSize();
    mapa.setView(c, z, { animate: false });   // mantém o que a pessoa estava vendo
  };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#mapa").classList.contains("mapa-cheio")) expandeMapa(false); });
  // copiar coordenadas em graus decimais (16/11/2026): botão liga o modo (cursor em cruz, leitura ao vivo,
  // clique copia "lat, lon"); fora do modo, botão direito (ou toque longo) abre o mesmo balão com "Copiar"
  const Coord = L.Control.extend({ options: { position: "topleft" },
    onAdd() { const b = L.DomUtil.create("button", "btn-mapa btn-coord"); b.type = "button";
      b.textContent = "⌖ Coordenadas"; b.title = "Clique no mapa para copiar a coordenada (graus decimais)";
      L.DomEvent.on(b, "click", e => { L.DomEvent.stop(e); ligaCoord(!COORD); }); this._b = b; return b; } });
  const co = new Coord().addTo(mapa);
  new Fundo().addTo(mapa);
  const Leitura = L.Control.extend({ options: { position: "bottomleft" },
    onAdd() { this._d = L.DomUtil.create("div", "leitura-coord"); this._d.hidden = true; return this._d; } });
  const lei = new Leitura().addTo(mapa);
  const ligaCoord = on => {
    COORD = on; co._b.classList.toggle("ativo", on); co._b.setAttribute("aria-pressed", on);
    $("#mapa").classList.toggle("modo-coord", on); lei._d.hidden = !on;
    lei._d.textContent = "Clique no mapa para copiar"; if (!on) mapa.closePopup();
  };
  mapa.on("mousemove", e => { if (COORD) lei._d.textContent = fmtCoord(e.latlng); });
  mapa.on("contextmenu", e => mostraCoord(e.latlng, false));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && COORD && !$("#mapa").classList.contains("mapa-cheio")) ligaCoord(false); });
  // rótulos só quando o zoom muda; arrastar só redesenha a grade (13/11/2026: arrasto ficava lento)
  mapa.on("zoomend", atualizaRotulos);
  mapa.on("moveend", () => { if (mapa.hasLayer(camadas.grade)) desenhaGrade(); });
  mapa.on("moveend", () => {                       // visão saiu da área desenhada: desenha também o que ficou visível
    if (!BBOX || !ZONA) return;
    const v = visaoMapa();
    if (v[0] >= ZONA[0] && v[1] >= ZONA[1] && v[2] <= ZONA[2] && v[3] <= ZONA[3] && zoomBaixo() === NIVEL) return;
    preencheArea([Math.min(v[0], ZONA[0]), Math.min(v[1], ZONA[1]), Math.max(v[2], ZONA[2]), Math.max(v[3], ZONA[3])]);
    atualizaRotulos();
  });
}

/* ---------- desenhar só a área do município (13/11/2026: desempenho) ---------- */
function caixa(g) {                        // [xmin, ymin, xmax, ymax] de qualquer geometria
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const vai = c => { if (typeof c[0] === "number") { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1]; }
    else c.forEach(vai); };
  if (g && g.coordinates) vai(g.coordinates);
  return [x0, y0, x1, y1];
}
// 19/11/2026: a área desenhada cresce com a visão do mapa (afastar o zoom ou arrastar mostra todos os municípios de Goiás);
// ZONA = caixa já desenhada; só redesenha quando a visão sai dela
let ZONA = null, NIVEL = null;
function visaoMapa() { const v = mapa.getBounds().pad(0.25); return [v.getWest(), v.getSouth(), v.getEast(), v.getNorth()]; }
// 19/11/2026: leveza com zoom afastado (≤ Z_BAIXO): linhas e contornos simplificados (Douglas-Peucker, ~300 m, menos de
// 1 pixel nesse zoom) e sem o traço branco de obras/projetos; ao aproximar volta o desenho completo
const Z_BAIXO = 8, TOL_BAIXO = 0.003, GEO_S = {};
const zoomBaixo = () => mapa.getZoom() <= Z_BAIXO;
function rdp(pts, tol) {
  if (pts.length < 3) return pts;
  const t2 = tol * tol, keep = new Uint8Array(pts.length), pilha = [[0, pts.length - 1]];
  keep[0] = keep[pts.length - 1] = 1;
  while (pilha.length) {
    const [a, b] = pilha.pop(), [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let mx = 0, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]; let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = ax + t * dx - px, ey = ay + t * dy - py, d = ex * ex + ey * ey; if (d > mx) { mx = d; mi = i; }
    }
    if (mx > t2) { keep[mi] = 1; pilha.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function geoSimples(g) {
  const s = c => rdp(c, TOL_BAIXO);
  switch (g && g.type) {
    case "LineString": return { type: g.type, coordinates: s(g.coordinates) };
    case "MultiLineString": case "Polygon": return { type: g.type, coordinates: g.coordinates.map(s) };
    case "MultiPolygon": return { type: g.type, coordinates: g.coordinates.map(p => p.map(s)) };
    default: return g;
  }
}
const fontes = n => {                               // feições da camada no nível de zoom atual
  if (!zoomBaixo() || n === "localidades") return GEO[n].features;
  return GEO_S[n] || (GEO_S[n] = GEO[n].features.map(f => ({ ...f, geometry: geoSimples(f.geometry) })));
};
function preencheArea(extra) {
  // seleção + uma margem de meia largura em cada lado (pega os vizinhos e o que o enquadramento mostra)
  const b = BBOX, mx = Math.max(b[2] - b[0], b[3] - b[1]) * 0.6;
  const z0 = [b[0] - mx, b[1] - mx, b[2] + mx, b[3] + mx];
  const z = extra ? [Math.min(z0[0], extra[0]), Math.min(z0[1], extra[1]), Math.max(z0[2], extra[2]), Math.max(z0[3], extra[3])] : z0;
  ZONA = z;
  const em = c => bb => !(bb[2] < c[0] || bb[0] > c[2] || bb[3] < c[1] || bb[1] > c[3]), dentroZ = em(z);
  // localidades ficam só em volta da seleção (no estado inteiro seriam milhares de pontos)
  const baixo = zoomBaixo(); NIVEL = baixo;
  AREA.forEach(([lyr, n]) => { const ok = n === "localidades" ? em(z0) : dentroZ;
    lyr.clearLayers();
    if (baixo && lyr._topo) return;                  // zoom afastado: obra/projeto só com a faixa colorida
    lyr.addData({ type: "FeatureCollection", features: fontes(n).filter(f => ok(f._bb)) }); });
  camadas.rotMun.clearLayers();
  GEO.municipios.features.filter(f => dentroZ(f._bb)).forEach(f => {
    const mk = L.marker(f._centro, { interactive: false, pane: "rotulos",
      icon: L.divIcon({ className: "rot-mun", html: esc(f.properties.nome), iconSize: null }) });
    mk._cod = f.properties.cod; camadas.rotMun.addLayer(mk);
  });
  faixaRot = null;                         // força atualizar os rótulos das localidades novas
}

/* ---------- rótulos, grade, painel de camadas e busca no mapa ---------- */
const ROT = { vias: true, mun: true, loc: true, lotes: false };
function centro(g) {                       // centro do maior anel (média ponderada pela área)
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let best = null, ba = -1;
  polys.forEach(p => { const r = p[0]; let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const k = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += k; cx += (r[j][0] + r[i][0]) * k; cy += (r[j][1] + r[i][1]) * k; }
    if (Math.abs(a) > ba) { ba = Math.abs(a); best = a ? [cy / (3 * a), cx / (3 * a)] : [r[0][1], r[0][0]]; } });
  return best;
}
function dentro(pt, g) {                   // ponto [lon, lat] dentro do polígono (raio)
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.some(p => { let d = false; const r = p[0];
    for (let i = 0, j = r.length - 1; i < r.length; j = i++)
      if ((r[i][1] > pt[1]) !== (r[j][1] > pt[1]) && pt[0] < (r[j][0] - r[i][0]) * (pt[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) d = !d;
    return d; });
}
function linhas(g) { return g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : []; }
function meio(g) {                         // ponto no meio da linha mais longa + comprimento
  let best = null, bl = -1;
  linhas(g).forEach(c => { let l = 0; for (let i = 1; i < c.length; i++) l += Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]);
    if (l > bl) { bl = l; let h = l / 2, k = 1; for (; k < c.length; k++) { const s = Math.hypot(c[k][0] - c[k - 1][0], c[k][1] - c[k - 1][1]); if (h <= s) break; h -= s; }
      const a = c[k - 1] || c[0], b = c[k] || a, s = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; best = [a[0] + (b[0] - a[0]) * h / s, a[1] + (b[1] - a[1]) * h / s]; } });
  return [best, bl];
}
// rótulos das rodovias da seleção: um por rodovia (GO e BR), no trecho mais longo dentro dos municípios selecionados
function montaRotulosVias(cods) {
  camadas.rotVias.clearLayers();
  const gms_ = GEO.municipios.features.filter(f => cods.includes(f.properties.cod)).map(f => f.geometry), b = BBOX;
  const melhor = {};
  const avalia = (chave, g, tipo) => { const [p, l] = meio(g); if (!p || p[0] < b[0] || p[0] > b[2] || p[1] < b[1] || p[1] > b[3] || !gms_.some(gm => dentro(p, gm))) return;
    if (!melhor[chave] || melhor[chave].l < l) melhor[chave] = { p, l, tipo }; };
  GEO.sre.features.forEach(f => f.properties.go && avalia("GO-" + f.properties.go, f.geometry, "go"));
  GEO.snv_federal.features.forEach(f => f.properties.br && avalia("BR-" + String(f.properties.br).padStart(3, "0"), f.geometry, "br"));
  Object.entries(melhor).forEach(([t, v]) => camadas.rotVias.addLayer(L.marker([v.p[1], v.p[0]], { interactive: false, pane: "rotulos",
    icon: L.divIcon({ className: "rot-via rot-" + v.tipo, html: esc(t), iconSize: null }) })));
}
let faixaRot = null;
function atualizaRotulos() {
  if (!mapa) return;
  const z = mapa.getZoom();
  // localidades: sedes a partir do zoom 9, demais a partir do 11 — só mexe quando muda a faixa de zoom ou as opções
  const faixa = [z >= 9, z >= 11, ROT.loc, mapa.hasLayer(camadas.loc)].join();
  if (faixa !== faixaRot) {
    faixaRot = faixa;
    camadas.loc.eachLayer(l => { const t = l.getTooltip(); if (!t) return;
      const sede = /Sede|Capital/.test(l.feature.properties.t);
      (ROT.loc && mapa.hasLayer(camadas.loc) && z >= (sede ? 9 : 11)) ? (t.options.permanent = true, l.openTooltip()) : l.closeTooltip(); });
  }
  ROT.vias ? mapa.addLayer(camadas.rotVias) : mapa.removeLayer(camadas.rotVias);
  ROT.lotes ? mapa.addLayer(camadas.rotLotes) : mapa.removeLayer(camadas.rotLotes);
  if (ROT.mun && z >= 8) { mapa.addLayer(camadas.rotMun);
    camadas.rotMun.eachLayer(m => { const el = m.getElement(); if (el) el.classList.toggle("atual", SEL.includes(m._cod)); });
  } else mapa.removeLayer(camadas.rotMun);
  if (mapa.hasLayer(camadas.grade)) desenhaGrade();
}
// grade de coordenadas (graus e minutos), com rótulos nas bordas do mapa
function gms(v, eixo) {
  const h = eixo === "lat" ? (v < 0 ? "S" : "N") : (v < 0 ? "W" : "E"), a = Math.abs(v);
  let g = Math.floor(a + 1e-9), m = Math.round((a - g) * 60); if (m === 60) { g++; m = 0; }
  return `${g}°${m ? String(m).padStart(2, "0") + "'" : ""}${h}`;
}
function desenhaGrade() {
  camadas.grade.clearLayers();
  const b = mapa.getBounds(), span = Math.max(b.getEast() - b.getWest(), b.getNorth() - b.getSouth());
  const passo = [10, 5, 2, 1, 0.5, 1 / 3, 0.25, 1 / 6, 1 / 12, 1 / 20, 1 / 30, 1 / 60].find(p => span / p >= 3) || 1 / 60;
  const est = { color: "#ffffff", weight: 0.8, opacity: 0.75, dashArray: "4 4", interactive: false, pane: "rotulos" };
  const n0 = Math.ceil(b.getSouth() / passo) * passo, e0 = Math.ceil(b.getWest() / passo) * passo;
  for (let y = n0; y <= b.getNorth(); y += passo) {
    camadas.grade.addLayer(L.polyline([[y, b.getWest() - 1], [y, b.getEast() + 1]], est));
    camadas.grade.addLayer(L.marker([y, b.getWest()], { interactive: false, pane: "rotulos",
      icon: L.divIcon({ className: "rot-grade rot-grade-y", html: gms(y, "lat"), iconSize: null }) }));
  }
  for (let x = e0; x <= b.getEast(); x += passo) {
    camadas.grade.addLayer(L.polyline([[b.getSouth() - 1, x], [b.getNorth() + 1, x]], est));
    camadas.grade.addLayer(L.marker([b.getSouth(), x], { interactive: false, pane: "rotulos",
      icon: L.divIcon({ className: "rot-grade rot-grade-x", html: gms(x, "lon"), iconSize: null }) }));
  }
}
function painelCamadas() {
  const itens = [["Camadas"],
    ["sre", "SRE – " + A.rotulo], ["dorL", "Obras"], ["dorP", "Obras pontuais"], ["projL", "Projetos"], ["projP", "Projetos pontuais"],
    ["snv", "SNV – rodovias federais"], ["loc", "Localidades"], ["perimetro", "Perímetro urbano"],
    ["municipios", "Limites municipais"], ["lotes", "Lotes de manutenção"], ["grade", "Grade de coordenadas"],
    ["Rótulos"], ["r:vias", "Rodovias (GO / BR)"], ["r:mun", "Municípios"], ["r:loc", "Localidades"], ["r:lotes", "Lotes"]];
  // painel fora do mapa (logo abaixo dele): no mapa ficam só os elementos da visualização
  const d = document.getElementById("camadas"), grupos = [];
  itens.forEach(([k, t]) => t === undefined ? grupos.push({ tit: k, l: [] }) : grupos[grupos.length - 1].l.push([k, t]));
  d.innerHTML = grupos.map(g => `<div class="camadas-grp"><span class="camadas-tit">${g.tit}:</span>` +
    g.l.map(([k, t]) => `<label><input type="checkbox" data-k="${k}" ${k.startsWith("r:") ? (ROT[k.slice(2)] ? "checked" : "") : (mapa.hasLayer(camadas[k]) ? "checked" : "")}> ${t}</label>`).join("") +
    `</div>`).join("");
  d.querySelectorAll("input[type=checkbox]").forEach(cb => cb.onchange = () => {
    const k = cb.dataset.k;
    if (k.startsWith("r:")) ROT[k.slice(2)] = cb.checked;
    else cb.checked ? mapa.addLayer(camadas[k]) : mapa.removeLayer(camadas[k]);
    if (k === "grade" && cb.checked) desenhaGrade();
    atualizaRotulos();
  });
}
function autocompleta(input, aoEscolher) {        // lista de sugestões própria (funciona igual no celular)
  const lista = document.createElement("ul"); lista.className = "sugestoes"; input.parentNode.appendChild(lista);
  let sel = -1, itens = [];
  const fecha = () => { lista.innerHTML = ""; lista.style.display = "none"; sel = -1; };
  const marca = () => lista.querySelectorAll("li").forEach((li, i) => li.classList.toggle("ativo", i === sel));
  input.addEventListener("input", () => {
    const t = semAcento(input.value); if (!t) return fecha();
    itens = LISTA.filter(c => semAcento(A.municipios[c].nome).includes(t))
      .sort((a, b) => semAcento(A.municipios[b].nome).startsWith(t) - semAcento(A.municipios[a].nome).startsWith(t)).slice(0, 12);
    lista.innerHTML = itens.length ? itens.map(c => `<li data-c="${c}">${esc(A.municipios[c].nome)}</li>`).join("") : `<li class="nada">Nenhum município encontrado</li>`;
    lista.style.display = "block"; sel = itens.length ? 0 : -1; marca();
  });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { sel = Math.min(itens.length - 1, sel + 1); marca(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); marca(); e.preventDefault(); }
    else if (e.key === "Enter") { const c = itens[sel] || procura(input.value); if (c) { aoEscolher(c); input.value = ""; fecha(); input.blur(); } }
    else if (e.key === "Escape") fecha();
  });
  lista.addEventListener("mousedown", e => { const li = e.target.closest("li[data-c]"); if (li) { e.preventDefault(); aoEscolher(li.dataset.c); input.value = ""; fecha(); input.blur(); } });
  input.addEventListener("blur", () => setTimeout(fecha, 150));
}
function enquadra(b = BBOX) {
  mapa.invalidateSize();
  mapa.fitBounds([[b[1], b[0]], [b[3], b[2]]], { padding: [18, 18] });
}
function municipioEm(ll) {
  const x = ll.lng, y = ll.lat;
  const dentro = r => { let d = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d; } return d; };
  return GEO.municipios.features.find(f => { const b = f._bb;
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) return false;
    const ps = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    return ps.some(p => dentro(p[0]) && !p.slice(1).some(dentro)); });
}
function destacaMunicipios(cods) {
  if (camadas.mascara) mapa.removeLayer(camadas.mascara);
  if (camadas.contorno) mapa.removeLayer(camadas.contorno);
  const fs = GEO.municipios.features.filter(x => cods.includes(x.properties.cod));
  const aneis = [];
  fs.forEach(f => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates)
    .forEach(p => aneis.push(p[0].map(([x, y]) => L.latLng(y, x)))));
  // fora da seleção: fundo claro (como o recorte do atlas); dentro: satélite. Um ou vários municípios ficam
  // com a mesma aparência: uma área só, contorno amarelo só por fora (sem a divisa entre os selecionados)
  camadas.mascara = new AreaSel(aneis, "mascara").addTo(mapa);
  camadas.contorno = new AreaSel(aneis, "contorno").addTo(mapa);
}
// 23/11/2026: divisas estaduais em realce (linha escura com contorno branco, acima do véu e abaixo das rodovias) e o
// nome dos estados vizinhos no mapa. Fonte: malha de UFs do IBGE 2025 (data/estados.geojson, só GO e vizinhos, recortados
// numa caixa em volta de Goiás — o corte da caixa não é desenhado). O nome vai no meio da parte visível de cada estado.
function divisasEstaduais() {
  mapa.createPane("divisa").style.zIndex = 392;
  mapa.getPane("divisa").style.pointerEvents = "none";
  const CX = [-58, -23, -41, -9], naCaixa = ([x, y]) => x <= CX[0] + 1e-3 || x >= CX[2] - 1e-3 || y <= CX[1] + 1e-3 || y >= CX[3] - 1e-3;
  fetch("data/estados.geojson").then(r => r.ok ? r.json() : null).then(gj => {
    if (!gj) return;
    const linhas = [];
    gj.features.forEach(f => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates)
      .forEach(p => p.forEach(anel => { let run = [];
        for (let i = 0; i < anel.length; i++) {
          if (i && naCaixa(anel[i]) && naCaixa(anel[i - 1])) { if (run.length > 1) linhas.push(run); run = []; }
          run.push(L.latLng(anel[i][1], anel[i][0])); }
        if (run.length > 1) linhas.push(run); })));
    const rd = L.canvas({ pane: "divisa", padding: 0.3 }), op = { renderer: rd, interactive: false, lineJoin: "round" };
    L.layerGroup([L.polyline(linhas, { ...op, color: "#ffffff", weight: 6, opacity: 0.9 }),
      L.polyline(linhas, { ...op, color: "#2b2b2b", weight: 2.5, opacity: 1 })]).addTo(mapa);
    // rótulos dos vizinhos
    const viz = gj.features.filter(f => f.properties.sigla !== "GO").map(f => {
      const ps = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      const mk = L.marker([0, 0], { pane: "rotulos", interactive: false, keyboard: false,
        icon: L.divIcon({ className: "uf-rot", html: `<span>${esc(f.properties.nome.toLocaleUpperCase("pt-BR"))}</span>`, iconSize: null }) });
      return { ps, mk, bb: L.latLngBounds(ps.flatMap(p => p[0].map(([x, y]) => [y, x]))) };
    });
    const dentro = (ps, x, y) => ps.some(p => { const no = r => { let d = false;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d; } return d; };
      return no(p[0]) && !p.slice(1).some(no); });
    const posiciona = () => {
      const s = mapa.getSize(), vb = mapa.getBounds(), N = 20, M = 14;
      viz.forEach(v => {
        let pts = [];
        if (vb.intersects(v.bb)) for (let i = 1; i < N; i++) for (let j = 1; j < M; j++) {
          const ll = mapa.containerPointToLatLng([s.x * i / N, s.y * j / M]);
          if (v.bb.contains(ll) && dentro(v.ps, ll.lng, ll.lat)) pts.push(ll); }
        if (pts.length < 3) { mapa.removeLayer(v.mk); return; }
        if (!v.w) { v.mk.setLatLng(pts[0]).addTo(mapa); v.w = v.mk.getElement().firstChild.offsetWidth || 160; }
        // o nome inteiro tem que caber na tela (longe da barra de botões e da escala) e dentro do estado
        const cabe = ll => { const p = mapa.latLngToContainerPoint(ll), h = v.w / 2 + 6;
          if (p.x - h < 0 || p.x + h > s.x || p.y < 70 || p.y > s.y - 40) return false;
          return [-h, h].every(dx => { const q = mapa.containerPointToLatLng([p.x + dx, p.y]); return dentro(v.ps, q.lng, q.lat); }); };
        const cy = pts.reduce((a, p) => a + p.lat, 0) / pts.length, cx = pts.reduce((a, p) => a + p.lng, 0) / pts.length;
        pts = pts.filter(cabe);
        if (!pts.length) { mapa.removeLayer(v.mk); return; }
        pts.sort((a, b) => (a.lat - cy) ** 2 + (a.lng - cx) ** 2 - (b.lat - cy) ** 2 - (b.lng - cx) ** 2);
        v.mk.setLatLng(pts[0]).addTo(mapa);
      });
    };
    mapa.on("moveend zoomend resize", posiciona); posiciona();
  }).catch(() => {});
}
// anéis externos de todos os municípios (= território de Goiás), calculados uma vez
let GO_ANEIS = null;
function goiasAneis() {
  if (GO_ANEIS) return GO_ANEIS;
  GO_ANEIS = [];
  GEO.municipios.features.forEach(f => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates)
    .forEach(p => { const ll = p[0].map(([x, y]) => L.latLng(y, x)); GO_ANEIS.push({ ll, bb: L.latLngBounds(ll) }); }));
  return GO_ANEIS;
}
// desenho da área selecionada num canvas próprio, sem receber clique
const AreaSel = L.Layer.extend({
  initialize(aneis, tipo) { this._a = aneis; this._t = tipo; },
  onAdd(m) {
    this._c = L.DomUtil.create("canvas", "area-sel"); this._c.style.pointerEvents = "none";
    m.getPane(this._t === "mascara" ? "mascara" : "vias").appendChild(this._c);
    m.on("moveend zoomend resize viewreset", this.redesenha, this); m.on("zoomstart", this._esconde, this);
    this.redesenha();
  },
  onRemove(m) {
    L.DomUtil.remove(this._c);
    m.off("moveend zoomend resize viewreset", this.redesenha, this); m.off("zoomstart", this._esconde, this);
  },
  _esconde() { this._c.style.visibility = "hidden"; },
  redesenha() {
    const m = this._map; if (!m) return;
    const s = m.getSize(), r = window.devicePixelRatio || 1, c = this._c, P = 0.35;   // folga para o arrasto
    const ox = P * s.x, oy = P * s.y, w = s.x + 2 * ox, h = s.y + 2 * oy;
    c.width = Math.round(w * r); c.height = Math.round(h * r); c.style.width = w + "px"; c.style.height = h + "px";
    L.DomUtil.setPosition(c, m.containerPointToLayerPoint([-ox, -oy]));
    const x = c.getContext("2d"); x.setTransform(r, 0, 0, r, ox * r, oy * r);
    const anel = a => { x.beginPath(); a.forEach((ll, i) => { const p = m.latLngToContainerPoint(ll); i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y); }); x.closePath(); };
    if (this._t === "mascara") {
      // 23/11/2026: esbranquiçado só dentro de Goiás (todos os municípios num caminho só, sem fresta nas divisas);
      // outros estados e o DF ficam com o mapa base puro. Pontos a menos de 1 px do anterior são pulados.
      const vb = m.getBounds().pad(P + 0.05), ar = goiasAneis();
      x.fillStyle = estiloMascara(); x.beginPath();
      ar.forEach(a => { if (!vb.intersects(a.bb)) return; let u = null;
        a.ll.forEach((ll, i) => { const p = m.latLngToContainerPoint(ll);
          if (!i) x.moveTo(p.x, p.y); else if (Math.abs(p.x - u.x) + Math.abs(p.y - u.y) >= 1) x.lineTo(p.x, p.y); else return;
          u = p; });
        x.closePath(); });
      x.fill();
    } else {
      x.strokeStyle = "#ffd400"; x.lineWidth = 8; x.lineJoin = "round";
      this._a.forEach(a => { anel(a); x.stroke(); });
    }
    x.globalCompositeOperation = "destination-out";       // recorta o interior de todos os selecionados
    this._a.forEach(a => { anel(a); x.fill(); });
    x.globalCompositeOperation = "source-over"; c.style.visibility = "";
  }
});
// clique numa linha dos quadros (SRE, obras e projetos) — 23/11/2026, 2ª versão. Regra do usuário: SEM COR no destaque
// (o magenta "engolia" a simbologia) — só SOMBRA: o item fica intacto, com uma sombra projetada por baixo (parece levantado
// do mapa), e o resto do mapa fica na sombra (véu escuro com um corredor aberto em volta do item); início e fim com
// etiquetas neutras (Km no SRE); caixa do resumo neutra, no estilo dos cartões do painel. Duas vistas: só a parte no recorte (município / municípios /
// lote) ou o item inteiro, ignorando municípios e lotes (a obra vem cortada por município: junta os pedaços do mesmo código)
let COTA = null, VISTA = "recorte";                        // a vista escolhida vale para os próximos cliques até recarregar
let POP_ANTES = false;                                     // havia popup aberto antes do clique (o Leaflet fecha no preclick)
// o clique (px na tela) caiu em cima da parte DESTACADA do item (a da vista atual)? Mesmo com outra camada por cima.
// A parte apagada (outro município, na vista "No município") não conta: clicar nela age como em outra intervenção
function pertoDoDestaque(p, tol = 10) {
  const px = ll => mapa.latLngToContainerPoint(ll);
  if (COTA.pts.some(ll => px(ll).distanceTo(p) <= tol + 4)) return true;
  return runsVista().some(rr => { const q = rr.pts.map(px);
    for (let i = 1; i < q.length; i++) if (L.LineUtil.pointToSegmentDistance(p, q[i - 1], q[i]) <= tol) return true; return false; });
}
function limpaDestaque() {
  if (camadas.sel) { mapa.removeLayer(camadas.sel); camadas.sel = null; }
  if (camadas.cota) { mapa.removeLayer(camadas.cota); camadas.cota = null; }
  COTA = null;
  document.querySelectorAll("#t-sre tr.sel, #t-obras tr.sel").forEach(x => x.classList.remove("sel"));
}
const linhasDe = g => g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
// junta pedaços que se tocam pela ponta (obra/projeto vêm em várias partes); pts = [lon, lat]
// tol: pedaços cortados na divisa por município não coincidem exatamente na ponta — no item inteiro emenda até ~250 m
function juntaPartes(runs, tol = 1e-5) {
  const igual = (a, b) => Math.abs(a[0] - b[0]) < tol && Math.abs(a[1] - b[1]) < tol;
  for (let mudou = true; mudou;) { mudou = false;
    for (let i = 0; i < runs.length && !mudou; i++) for (let j = 0; j < runs.length && !mudou; j++) { if (i === j) continue;
      const a = runs[i], b = runs[j], af = a.pts[a.pts.length - 1];
      let bp = null, bFim;
      if (igual(af, b.pts[0])) { bp = b.pts; bFim = b.fimB; }
      else if (igual(af, b.pts[b.pts.length - 1])) { bp = b.pts.slice().reverse(); bFim = b.iniB; }
      if (!bp) continue;
      a.pts = a.pts.concat(bp.slice(1)); a.fimB = bFim; runs.splice(j, 1); mudou = true; } }
  return runs.map(r => ({ pts: r.pts.map(p => [p[1], p[0]]), iniB: !!r.iniB, fimB: !!r.fimB }));
}
// partes contínuas DENTRO do recorte (municípios selecionados); a divisa é achada por bisseção (fica exata)
function partesDentro(fs) {
  const gb = GEO.municipios.features.filter(f => SEL.includes(f.properties.cod)).map(f => [f.geometry, f._bb || (f._bb = caixa(f.geometry))]);
  const den = p => gb.some(([g, b]) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3] && dentro(p, g));
  const borda = (a, b) => { let lo = a, hi = b;            // a dentro, b fora
    for (let k = 0; k < 16; k++) { const m = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2]; if (den(m)) lo = m; else hi = m; } return lo; };
  const runs = [];
  fs.forEach(f => linhasDe(f.geometry).forEach(c => {
    const q = [];                                          // pontos a cada ~200 m (trecho reto com um só vértice dentro)
    c.forEach((p, i) => { q.push(p); const r = c[i + 1]; if (!r) return;
      const n = Math.min(200, Math.floor(Math.hypot(r[0] - p[0], r[1] - p[1]) / 0.002));
      for (let k = 1; k < n; k++) q.push([p[0] + (r[0] - p[0]) * k / n, p[1] + (r[1] - p[1]) * k / n]); });
    let run = null, ant = null;
    q.forEach(p => { const d = den(p);
      if (d && !run) { run = { pts: [], iniB: !!ant }; if (ant) run.pts.push(borda(p, ant)); }
      if (d) run.pts.push(p);
      if (!d && run) { run.pts.push(borda(ant, p)); run.fimB = true; runs.push(run); run = null; }
      ant = p; });
    if (run) { run.fimB = false; runs.push(run); }
  }));
  return juntaPartes(runs.filter(r => r.pts.length > 1));
}
const pxLinha = (lls, z) => { const ps = [];
  lls.forEach((ll, i) => { const p = mapa.project(ll, z), u = ps[ps.length - 1];
    if (!u || Math.hypot(p.x - u.x, p.y - u.y) >= 3 || i === lls.length - 1) ps.push(p); });
  if (ps.length > 2 && ps[ps.length - 1].distanceTo(ps[ps.length - 2]) < 1) ps.splice(-2, 1);
  return ps; };
const compPx = ps => ps.reduce((s, p, i) => i ? s + p.distanceTo(ps[i - 1]) : 0, 0);
const temDuasVistas = () => COTA && COTA.dentro.length && COTA.dentro.some(r => r.iniB || r.fimB);
const vistaInteira = () => VISTA === "inteiro" || !COTA.dentro.length;
const runsVista = () => vistaInteira() ? COTA.inteiras : COTA.dentro;
// holofote: véu escuro sobre o mapa (acima das linhas, abaixo das placas e rótulos) com um corredor aberto no item
const FOCO_R = 17;                                         // meia largura do corredor (px)
const Foco = L.Layer.extend({
  onAdd(m) { this._c = L.DomUtil.create("canvas", "foco-veu"); m.getPane("foco").appendChild(this._c);
    this._s = L.DomUtil.create("canvas", "foco-veu"); m.getPane("realce").appendChild(this._s);   // sombra (abaixo das linhas)
    m.on("move zoomend resize viewreset", this._desenha, this); m.on("zoomstart", this._esconde, this); this._desenha();
    requestAnimationFrame(() => requestAnimationFrame(() => { if (this._c) { this._c.classList.add("on"); this._s.classList.add("on"); } })); },
  onRemove(m) { m.off("move zoomend resize viewreset", this._desenha, this); m.off("zoomstart", this._esconde, this);
    this._c.remove(); this._s.remove(); this._c = this._s = null; },
  _esconde() { if (this._c) { this._c.style.visibility = "hidden"; this._s.style.visibility = "hidden"; } },
  _desenha() { const m = this._map, c = this._c; if (!c || !COTA) return;
    const ct = m.getContainer(), s = L.point(ct.clientWidth, ct.clientHeight), r = window.devicePixelRatio || 1;
    c.style.visibility = ""; c.width = s.x * r; c.height = s.y * r; c.style.width = s.x + "px"; c.style.height = s.y + "px";
    L.DomUtil.setPosition(c, m.containerPointToLayerPoint([0, 0]));
    const x = c.getContext("2d"); x.setTransform(r, 0, 0, r, 0, 0);
    x.fillStyle = "rgba(10, 16, 20, .55)"; x.fillRect(0, 0, s.x, s.y);
    x.globalCompositeOperation = "destination-out"; x.lineCap = "round"; x.lineJoin = "round";
    const cam = () => { x.beginPath(); runsVista().forEach(rr => rr.pts.forEach((ll, i) => { const p = m.latLngToContainerPoint(ll);
      if (i) x.lineTo(p.x, p.y); else x.moveTo(p.x, p.y); })); };
    cam(); x.strokeStyle = "rgba(0,0,0,.5)"; x.lineWidth = FOCO_R * 2 + 16; x.stroke();          // borda suave
    cam(); x.strokeStyle = "#000"; x.lineWidth = FOCO_R * 2; x.stroke();
    COTA.pts.forEach(ll => { const p = m.latLngToContainerPoint(ll);
      x.beginPath(); x.arc(p.x, p.y, 30, 0, 7); x.fillStyle = "rgba(0,0,0,.5)"; x.fill();
      x.beginPath(); x.arc(p.x, p.y, 22, 0, 7); x.fillStyle = "#000"; x.fill(); });
    x.globalCompositeOperation = "source-over";
    // sombra projetada do item: desenhado fora da tela, só a sombra cai no lugar (deslocada 3 px →, 5 px ↓)
    const t = this._s; t.style.visibility = ""; t.width = s.x * r; t.height = s.y * r; t.style.width = s.x + "px"; t.style.height = s.y + "px";
    L.DomUtil.setPosition(t, m.containerPointToLayerPoint([0, 0]));
    const y = t.getContext("2d"); y.setTransform(r, 0, 0, r, 0, 0); y.translate(-30000, 0);
    y.shadowColor = "rgba(0, 0, 0, .9)"; y.shadowBlur = 9 * r; y.shadowOffsetX = (30000 + 3) * r; y.shadowOffsetY = 5 * r;
    y.lineCap = "round"; y.lineJoin = "round"; y.strokeStyle = "#000"; y.fillStyle = "#000";
    y.beginPath(); runsVista().forEach(rr => rr.pts.forEach((ll, i) => { const p = m.latLngToContainerPoint(ll);
      if (i) y.lineTo(p.x, p.y); else y.moveTo(p.x, p.y); }));
    y.lineWidth = 9; y.stroke();
    COTA.pts.forEach(ll => { const p = m.latLngToContainerPoint(ll); y.beginPath(); y.arc(p.x, p.y, 11, 0, 7); y.fill(); }); }
});
// etiquetas (início, fim, divisa) e caixa do resumo; redesenhadas a cada zoom
function desenhaCota() {
  if (camadas.cota) { mapa.removeLayer(camadas.cota); camadas.cota = null; }
  if (!COTA) return;
  const z = mapa.getZoom(), LL = p => mapa.unproject(p, z), g = L.featureGroup(), inteiro = vistaInteira(), inf = COTA.info;
  // pixel do mundo → ponto da tela: p − ori (pela área real; o Leaflet pode guardar o tamanho antigo do mapa)
  const anc = [], obst = [], ori = mapa.project(mapa.containerPointToLatLng(L.point(0, 0)), z);
  const amostra = ps => ps.forEach((p, i) => { obst.push(p.subtract(ori)); const q = ps[i + 1]; if (!q) return;
    const n = Math.floor(p.distanceTo(q) / 8); for (let k = 1; k < n; k++) obst.push(L.point(p.x + (q.x - p.x) * k / n, p.y + (q.y - p.y) * k / n).subtract(ori)); });
  // etiqueta presa num ponto do item; dir = para onde ela abre (fora da linha)
  const Wc = mapa.getContainer().clientWidth;
  const etiqueta = (p, txt, dir, cls = "") => {
    let lado = dir.x >= 0 ? "dir" : "esq"; const cx0 = p.x - ori.x, larg = 16 + txt.length * 6.5;
    if (lado === "esq" && cx0 - larg < 4) lado = "dir"; else if (lado === "dir" && cx0 + larg > Wc - 4) lado = "esq";   // não sai do mapa
    g.addLayer(L.marker(LL(p), { pane: "cota", interactive: false, keyboard: false,
      icon: L.divIcon({ className: "cota-ic", iconSize: [0, 0], html: `<span class="foco-pino ${cls}"></span><span class="foco-tag ${lado} ${cls}">${txt}</span>` }) }));
    for (let k = 0; k <= 110; k += 10) obst.push(L.point(p.x + (lado === "dir" ? 1 : -1) * (14 + k), p.y).subtract(ori)); };
  const unit = (a, b) => { const l = a.distanceTo(b) || 1; return L.point((b.x - a.x) / l, (b.y - a.y) / l); };
  const naFracao = (ps, comp, f) => { let acc = 0;
    for (let i = 1; i < ps.length; i++) { const l = ps[i].distanceTo(ps[i - 1]);
      if (acc + l >= comp * f || i === ps.length - 1) { const t = l ? Math.min(1, (comp * f - acc) / l) : 0, a = ps[i - 1], b = ps[i];
        return { p: L.point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t), n: L.point(-(b.y - a.y) / (l || 1), (b.x - a.x) / (l || 1)) }; }
      acc += l; } return { p: ps[0], n: L.point(0.7, -0.7) }; };
  const km = v => v !== undefined && v !== null && v !== "" ? ` · Km ${num(v, 2)}` : "";
  const pontas = [], livres = [];                         // pontas com etiqueta; pontas que não são corte na divisa
  runsVista().forEach((r, ir) => {
    const ps = pxLinha(r.pts, z); if (ps.length < 2) return;
    const comp = compPx(ps);
    amostra(ps); pontas.push(ps[0], ps[ps.length - 1]);
    // corte na divisa do recorte: sempre marcado; início/fim de verdade: decididos depois (só as 2 pontas extremas)
    const d0 = unit(ps[Math.min(1, ps.length - 1)], ps[0]), d1 = unit(ps[ps.length - 2], ps[ps.length - 1]);
    if (r.iniB) etiqueta(ps[0], "Divisa · continua", d0, "div"); else livres.push({ p: ps[0], d: d0, ini: true, ir });
    if (r.fimB) etiqueta(ps[ps.length - 1], "Divisa · continua", d1, "div"); else livres.push({ p: ps[ps.length - 1], d: d1, ini: false, ir });
    [0.5, 0.35, 0.65, 0.2, 0.8].forEach((f, k) => { const m = naFracao(ps, comp, f);
      [1, -1].forEach(s => anc.push({ p: m.p.add(m.n.multiplyBy(FOCO_R * s)), n: m.n.multiplyBy(s), comp, f: k })); });
  });
  // início e fim: as duas pontas livres mais distantes entre si (obra com ramal ou em pedaços não ganha "Fim/Início" no meio)
  let par = livres.length >= 2 ? [livres[0], livres[1]] : livres.slice();
  livres.forEach((a, i) => livres.forEach((b, j) => { if (j > i && a.p.distanceTo(b.p) > par[0].p.distanceTo(par[1].p)) par = [a, b]; }));
  if (par.length === 2) {
    if (!par[0].ini && par[1].ini || par[0].ini === par[1].ini && par[0].ir > par[1].ir) par.reverse();
    etiqueta(par[0].p, "Início" + km(inf.ki), par[0].d); etiqueta(par[1].p, "Fim" + km(inf.kf), par[1].d);
  } else if (par.length === 1) etiqueta(par[0].p, (par[0].ini ? "Início" + km(inf.ki) : "Fim" + km(inf.kf)), par[0].d);
  // vista inteira: marca onde o item cruza o limite do recorte
  if (inteiro) COTA.div.forEach(ll => { const p = mapa.project(ll, z);
    if (!pontas.some(q => q.distanceTo(p) < 40)) etiqueta(p, "Divisa", L.point(1, 0), "div"); });
  COTA.pts.forEach(ll => { const p = mapa.project(ll, z); obst.push(p.subtract(ori));
    [[0.7, -0.7], [0.7, 0.7], [-0.7, -0.7], [-0.7, 0.7]].forEach(([x, y], k) => anc.push({ p: p.add(L.point(x * 24, y * 24)), n: L.point(x, y), comp: 0, f: k })); });
  if (!anc.length) { camadas.cota = g.addTo(mapa); return; }
  const vis = temDuasVistas() ? `<div class="cota-vis">` +
    [["recorte", COTA.rotRec], ["inteiro", COTA.rotInt]].map(([v, t]) =>
      `<button type="button" class="cota-v${(v === "inteiro") === inteiro ? " on" : ""}" data-v="${v}">${t}</button>`).join("") + `</div>` : "";
  const miolo = `<button class="cota-x" type="button" title="Limpar seleção (Esc)" aria-label="Limpar seleção">✕</button>` +
    `<b>${inf.tit}</b>${vis}${((inteiro && (temDuasVistas() || !COTA.dentro.length) ? inf.lsInt : inf.lsRec) || inf.ls || []).filter(Boolean).map(t => /^<div/.test(t) ? t : `<div>${t}</div>`).join("")}` +
    `${inf.sub ? `<div class="cx-s">${inf.sub}</div>` : ""}`;
  // caixa: marcador no canto superior esquerdo; a linha de chamada vai da borda do corredor ao ponto mais perto da caixa
  const med = document.createElement("div"); med.className = "cota-cx"; med.style.visibility = "hidden"; med.innerHTML = miolo;
  const ct = mapa.getContainer(); ct.appendChild(med); const bw = med.offsetWidth, bh = med.offsetHeight; med.remove();
  const perto = (q, x0, y0) => L.point(Math.max(x0, Math.min(x0 + bw, q.x)), Math.max(y0, Math.min(y0 + bh, q.y)));
  let ini, cantoLL = COTA.caixa;                           // posição arrastada pelo usuário
  if (cantoLL && COTA.iniLL) ini = mapa.project(COTA.iniLL, z);
  else {
    // áreas proibidas (botões, escala, norte) e tamanho do mapa
    const W = L.point(ct.clientWidth, ct.clientHeight), rc = ct.getBoundingClientRect(), escT = rc.width / (ct.offsetWidth || 1);
    const ctl = [...ct.querySelectorAll(".leaflet-control, .btn-mapa")].map(e => e.getBoundingClientRect()).filter(b => b.width)
      .map(b => [(b.left - rc.left) / escT, (b.top - rc.top) / escT, (b.right - rc.left) / escT, (b.bottom - rc.top) / escT]);
    let melhor = null; const maior = Math.max(...anc.map(a => a.comp));
    const avalia = (a, x0, y0, extra) => {               // x0, y0 = canto da caixa na tela
      const x1 = x0 + bw, y1 = y0 + bh; let pen = extra;
      obst.forEach(o => { if (o.x > x0 - 10 && o.x < x1 + 10 && o.y > y0 - 10 && o.y < y1 + 10) pen += 10; });
      pen += (Math.max(0, 8 - x0) + Math.max(0, x1 - W.x + 8) + Math.max(0, 8 - y0) + Math.max(0, y1 - W.y + 8)) * 60;
      ctl.forEach(([a0, b0, a1, b1]) => { const ix = Math.min(x1 + 6, a1) - Math.max(x0 - 6, a0), iy = Math.min(y1 + 6, b1) - Math.max(y0 - 6, b0);
        if (ix > 0 && iy > 0) pen += ix * iy; });
      const ap = a.p.subtract(ori), le = perto(ap, x0, y0);
      pen += le.distanceTo(ap) * 0.15 + a.f * 3 + (a.comp < maior ? 15 : 0);
      if (!melhor || pen < melhor.pen) melhor = { pen, ini: a.p, x0, y0 }; };
    // perto do item, para o lado de fora
    anc.forEach(a => [0, 40, -40, 75, -75].forEach((ang, ka) => { const t = ang * Math.PI / 180;
      const d = L.point(a.n.x * Math.cos(t) - a.n.y * Math.sin(t), a.n.x * Math.sin(t) + a.n.y * Math.cos(t));
      [30, 65, 110, 170].forEach(len => { const c = a.p.add(d.multiplyBy(len)).subtract(ori);
        const ox = d.x >= 0 ? 0 : -1, oy = Math.abs(d.y) < 0.5 ? -0.5 : d.y >= 0 ? 0 : -1;
        avalia(a, c.x + ox * bw, c.y + oy * bh, ka * 2); }); }));
    // ou encaixada num canto livre do mapa (mapa estreito), ligada pela linha
    const xs = [10, W.x - bw - 10], ys = [62, W.y - bh - 90];
    anc.forEach(a => xs.forEach(x0 => ys.forEach(y0 => avalia(a, x0, y0, 25))));
    ini = melhor.ini; cantoLL = LL(L.point(melhor.x0, melhor.y0).add(ori)); COTA.iniLL = LL(ini);
  }
  const fimDe = ll => { const c = mapa.project(ll, z); return LL(perto(ini, c.x, c.y)); };
  // linha de chamada neutra (branca com contorno escuro) e bolinha na borda do corredor
  const chamada = L.polyline([LL(ini), fimDe(cantoLL)], { pane: "cota", interactive: false, color: "#fff", weight: 1.5, opacity: 0.95 });
  const casca = L.polyline([LL(ini), fimDe(cantoLL)], { pane: "cota", interactive: false, color: "#1d2b24", weight: 3.5, opacity: 0.6 });
  g.addLayer(casca); g.addLayer(chamada);
  g.addLayer(L.circleMarker(LL(ini), { pane: "cota", interactive: false, radius: 3.5, color: "#1d2b24", weight: 1.5, fillColor: "#fff", fillOpacity: 1 }));
  const cx = L.marker(cantoLL, { pane: "cotaCx", draggable: true, keyboard: false, autoPan: false,
    icon: L.divIcon({ className: "cota-ic", iconSize: [0, 0],
      html: `<div class="cota-cx" title="Arraste para mover">${miolo}</div>` }) });
  cx.on("drag", e => { const f = fimDe(e.target.getLatLng()); chamada.setLatLngs([LL(ini), f]); casca.setLatLngs([LL(ini), f]); });
  cx.on("dragend", e => { COTA.caixa = e.target.getLatLng(); });
  cx.on("add", () => { const el = cx.getElement(); if (!el) return;
    L.DomEvent.disableClickPropagation(el); L.DomEvent.disableScrollPropagation(el);
    el.querySelectorAll("button").forEach(b => L.DomEvent.on(b, "mousedown touchstart pointerdown", L.DomEvent.stopPropagation));
    const x = el.querySelector(".cota-x");
    if (x) L.DomEvent.on(x, "click", ev => { L.DomEvent.stop(ev); limpaDestaque(); });
    el.querySelectorAll(".cota-v").forEach(b => L.DomEvent.on(b, "click", ev => { L.DomEvent.stop(ev);
      if (VISTA !== b.dataset.v) { VISTA = b.dataset.v; aplicaVista(); } })); });
  g.addLayer(cx);
  camadas.cota = g.addTo(mapa);
}
// zoom, holofote e etiquetas da vista atual (recorte ou inteiro)
function aplicaVista() {
  if (!COTA) return;
  COTA.caixa = null; COTA.iniLL = null;
  const lls = runsVista().flatMap(r => r.pts).concat(COTA.pts);
  if (!lls.length) return;
  const alvo = L.latLngBounds(lls);
  if (camadas.sel) camadas.sel._desenha();
  mapa.once("moveend", desenhaCota);                       // redesenha com a vista final (posição da caixa)
  const ct = mapa.getContainer(), px = Math.round(Math.min(130, ct.clientWidth * 0.1)), py = Math.round(Math.min(90, ct.clientHeight * 0.1));
  mapa.fitBounds(alvo, { paddingTopLeft: [px, py], paddingBottomRight: [px, py], maxZoom: 15 });     // folga proporcional ao mapa
  desenhaCota();
}
// resumo da caixa (regras de texto do site: Km com 2 casas, % com 1, "Projeto" sempre marcado)
const nomeRod = v => /^\d/.test(String(v ?? "")) ? "GO-" + v : String(v ?? "");
// extensão do item em cada município (mesmos números dos quadros/caderno): [{ cod, nome, km }], maior primeiro
function extPorMun(campo, valor, kmCampo) {
  const out = [];
  Object.entries(A.municipios).forEach(([cod, m]) => (campo === "sre" ? m.trechos : m.obras || []).forEach(r => {
    if (r[campo] === valor && +r[kmCampo] > 0) out.push({ cod, nome: m.nome, km: +r[kmCampo] }); }));
  return out.sort((a, b) => b.km - a.km);
}
// 23/11/2026: o número em destaque muda com a vista — "No município" = extensão dentro do recorte (município, municípios
// ou lote); "Inteiro" = extensão total da intervenção, com os municípios por onde passa.
// Regra do usuário (23/11/2026): a extensão total informada é SEMPRE a declarada na obra/projeto (Km contratado), mesmo
// que o SRE meça outra; item todo dentro do recorte = só "Extensão" (sem repetir "de X no total (100%)" nem contrato).
function blocoExt(pm, total, rotTot) {
  const rec = pm.filter(x => SEL.includes(x.cod)).reduce((s, x) => s + x.km, 0);
  const caixa = (t, v) => `<div class="cx-km"><span>${t}</span><strong>${km2(v)}</strong></div>`;
  if (pm.every(x => SEL.includes(x.cod))) { const so = [caixa("Extensão", total)]; return { lsRec: so, lsInt: so }; }
  const rot = LOTE_SEL ? "no lote" : SEL.length > 1 ? "nos municípios" : "no município";
  const lista = pm.slice(0, 5).map(x => esc(x.nome)).join(" · ") + (pm.length > 5 ? ` · e mais ${pm.length - 5}` : "");
  return {
    lsRec: [caixa(`Extensão ${rot}`, rec), `${rotTot}: ${km2(total)}`],
    lsInt: [caixa("Extensão total", total), pm.length > 1 ? `Passa por: ${lista}` : ""] };
}
const resumoSRE = l => { const pm = extPorMun("sre", l.sre, "ext_mun"), b = blocoExt(pm, +l.ext || pm.reduce((s, x) => s + x.km, 0), "Extensão do trecho");
  const com = [[(SIT[l.situacao] || [l.situacao])[0], l.classe].filter(Boolean).map(esc).join(" · ") + (l.perim_urb === "s" ? " · perímetro urbano" : ""),
    `Km ${num(l.km_ini, 2)} – ${num(l.km_fim, 2)}`];
  return { tit: `${esc(l.sre)} · ${esc(nomeRod(l.go))}`, int: "Trecho inteiro", ki: l.km_ini, kf: l.km_fim,
    lsRec: [...b.lsRec, ...com], lsInt: [...b.lsInt, ...com], sub: l.inicio || l.fim ? `${esc(l.inicio)} → ${esc(l.fim)}` : "" }; };
// obra/projeto — modelo do usuário (23/11/2026), cada campo com o nome da coluna do quadro:
//   GO-219 / Pavimentação - Obra / EXTENSÃO DA OBRA: 17,20 Km / Etapa: Obra / Situação: Em andamento / Código: OB26-01460
//   pontual: GO-060 / Viaduto - Obra / Etapa: Licitação / Situação: Publicado / Código: OB26-01482
// (intervencao - natureza; etapa = fase do processo; situacao = situação dentro da etapa; extensão = a declarada)
const resumoObra = l => { const pj = l.natureza === "Projeto", qual = pj ? "do projeto" : "da obra";
  const tipo = [l.intervencao, pj ? "Projeto" : "Obra"].filter(Boolean).map(esc).join(" - ");
  const et = l.etapa ? `Etapa: ${esc(l.etapa)}` : "", sit = l.situacao ? `Situação: ${esc(l.situacao)}` : "";
  const base = { tit: esc(l.rodovia), int: pj ? "Projeto inteiro" : "Obra inteira", sub: `Código: ${esc(l.codigo)}` };
  const caixa = (t, v) => `<div class="cx-km"><span>${t}:</span><strong>${km2(v)}</strong></div>`;
  if (l.tipo === "Pontual") { const ls = [tipo, et, sit]; return { ...base, lsRec: ls, lsInt: ls }; }
  const pm = extPorMun("codigo", l.codigo, "km_mun"), tot = +l.km_contrato || pm.reduce((s, x) => s + x.km, 0);   // declarada
  const rec = pm.filter(x => SEL.includes(x.cod)).reduce((s, x) => s + x.km, 0);
  const rot = LOTE_SEL ? "no lote" : SEL.length > 1 ? "nos municípios" : "no município";
  const lsInt = [tipo, caixa(`Extensão ${qual}`, tot), et, sit];
  if (pm.every(x => SEL.includes(x.cod))) return { ...base, lsRec: lsInt, lsInt };
  return { ...base, lsRec: [tipo, caixa(`Extensão ${qual} ${rot}`, rec), `de ${km2(tot)} no total`, et, sit], lsInt }; };
function destacaFeicoes(fs, info) {
  limpaDestaque();
  if (!fs.length) return;
  const lin = fs.filter(f => f.geometry.type !== "Point");
  const dentroR = partesDentro(lin), div = [];
  dentroR.forEach(r => { if (r.iniB) div.push(r.pts[0]); if (r.fimB) div.push(r.pts[r.pts.length - 1]); });
  const inteiras = juntaPartes(lin.flatMap(f => linhasDe(f.geometry).map(c => ({ pts: c.slice(), iniB: false, fimB: false }))), 0.0025);
  info = info || { tit: "Seleção", ls: [] };
  COTA = { fs, dentro: dentroR, inteiras, div, info,
    pts: fs.filter(f => f.geometry.type === "Point").map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]]),
    rotRec: LOTE_SEL ? "No lote" : SEL.length > 1 ? "Nos municípios" : "No município", rotInt: info.int || "Inteiro" };
  camadas.sel = new Foco().addTo(mapa);
  aplicaVista();
  if (!APRES) document.getElementById("mapa").scrollIntoView({ behavior: "smooth", block: "center" });
}
// trecho do quadro que não está no mapa do SRE (coincidente com BR / jurisdição federal): a geometria vem de
// data/<mês>/sre_zoom.geojson, baixado só no primeiro clique que precisar (19/11/2026)
const SRE_ZOOM = {};
async function destacaTrecho(sre, l) {
  let fs = GEO.sre.features.filter(f => f.properties.sre === sre);
  if (!fs.length) {
    const mes = MES_SITE, base = typeof DADOS !== "undefined" ? DADOS : "";
    SRE_ZOOM[mes] = SRE_ZOOM[mes] || fetch(`${base}data/${mes}/sre_zoom.geojson`).then(r => r.ok ? r.json() : { features: [] })
      .catch(() => ({ features: [] }));
    fs = (await SRE_ZOOM[mes]).features.filter(f => f.properties.sre === sre);
  }
  destacaFeicoes(fs, l && resumoSRE(l));
}
// obra/projeto: TODOS os pedaços do código (de qualquer município); o recorte é feito na vista "No município"
function destacaObra(l) {
  const pontual = l.tipo === "Pontual", projeto = l.natureza === "Projeto";
  const n = (projeto ? "dpj_" : "dor_") + (pontual ? "pontos" : "linhas");
  let fs = (GEO[n]?.features || []).filter(f => f.properties.codigo === l.codigo);
  if (pontual) fs = fs.filter(f => SEL.includes(f.properties.cod_ibge));
  destacaFeicoes(fs, resumoObra(l));
}
// clique real no ícone da placa (obra/projeto pontual): o marcador não repassa o clique ao mapa, então ele mesmo aplica
// as regras do clique no mapa — mesma placa destacada = nada; senão destaca (e troca de município, se for o caso)
function clicaPlaca(e, f, projeto) {
  if (APRES || COORD) return;
  L.DomEvent.stopPropagation(e); mapa.closePopup(); POP_ANTES = false;
  const ll = e.target.getLatLng();
  if (COTA && pertoDoDestaque(mapa.latLngToContainerPoint(ll), 2)) return;
  destacaObraMapa(f.properties, projeto, true, ll);
}
// 23/11/2026: clique direto na linha/placa da obra ou do projeto no mapa = mesmo destaque do quadro (no lugar do popup).
// Os dados vêm da linha do quadro; se o item não está na seleção, de qualquer município do atlas; por fim, do próprio mapa
function destacaObraMapa(p, projeto, pontual, ll) {
  const nat = projeto ? "Projeto" : "Obra", acha = os => (os || []).find(o => o.codigo === p.codigo && (o.natureza || nat) === nat);
  // 23/11/2026: clique numa parte do item que fica num município FORA da seleção (outro item, ou a parte apagada do
  // mesmo) = a página inteira vai para o município clicado e depois destaca nele. Item sem nenhuma parte na seleção e
  // clique fora de todos os municípios dele = vai para o de maior extensão
  const muns = Object.entries(A.municipios).filter(([, m]) => acha(m.obras)).map(([c]) => c);
  const aqui = ll && municipioEm(ll)?.properties.cod, ext = c => +(acha(A.municipios[c].obras).km_mun || 0);
  if (muns.includes(aqui) && !SEL.includes(aqui)) selecionaLista([aqui]);
  else if (muns.length && !muns.some(c => SEL.includes(c))) selecionaLista([muns.sort((a, b) => ext(b) - ext(a))[0]]);
  let r = acha(M?.obras);
  if (!r) for (const m of Object.values(A.municipios)) if ((r = acha(m.obras))) break;
  r = r || {};
  const l = { ...r, codigo: p.codigo, rodovia: r.rodovia || p.rodovia, intervencao: r.intervencao || p.intervencao,
    etapa: r.etapa || p.etapa, natureza: nat, tipo: pontual ? "Pontual" : r.tipo || "Trecho" };
  if (!pontual) return destacaObra(l);
  const fs = (GEO[projeto ? "dpj_pontos" : "dor_pontos"]?.features || [])     // pontual: só a placa clicada (o mesmo município)
    .filter(f => f.properties.codigo === p.codigo && (!p.cod_ibge || f.properties.cod_ibge === p.cod_ibge));
  destacaFeicoes(fs, resumoObra(l));
}

/* ---------------- seleção: um ou vários municípios (13/11/2026) ---------------- */
function seleciona(cod, hist = true) { selecionaLista([cod], hist); }
// adiciona/remove um município da seleção (modo Combinar, Ctrl+clique ou busca no modo Combinar)
function alterna(cod, soAdiciona = false) {
  if (SEL.includes(cod)) { if (soAdiciona || SEL.length === 1) return; selecionaLista(SEL.filter(c => c !== cod)); }
  else selecionaLista([...SEL, cod]);
}
const nomeLista = ns => ns.length === 1 ? ns[0] : ns.slice(0, -1).join(", ") + " e " + ns[ns.length - 1];
function selecionaLista(cods, hist = true, lote = null) {
  SEL = [...new Set(cods)].filter(c => A.municipios[c]); if (!SEL.length) return;
  atual = SEL[0];
  // qualquer mudança feita depois (tirar/somar município, buscar outro) volta a ser seleção comum
  LOTE_SEL = lote && A.lotes[lote] ? String(lote) : null;
  guarda("atlas-lote", LOTE_SEL || "");
  const multi = SEL.length > 1, ms = SEL.map(c => A.municipios[c]);
  BBOX = ms.reduce((b, m) => [Math.min(b[0], m.bbox[0]), Math.min(b[1], m.bbox[1]), Math.max(b[2], m.bbox[2]), Math.max(b[3], m.bbox[3])],
    [1e9, 1e9, -1e9, -1e9]);
  M = multi ? agrega(SEL) : ms[0];
  guarda("atlas-sel", SEL.join(","));          // 16/11/2026: não grava mais no endereço; o F5 lê daqui
  const nomes = ms.map(m => m.nome), curto = LOTE_SEL && multi ? `Lote ${LOTE_SEL} – ${SEL.length} municípios`
    : multi && SEL.length > 3 ? `${SEL.length} municípios` : nomeLista(nomes);
  document.title = `${multi ? curto : nomes[0] + "/GO"} – Atlas SRE Municípios`;
  $("#titulo").textContent = multi ? curto : nomes[0];
  document.querySelector(".cab-titulo").classList.toggle("multi", multi);
  document.querySelectorAll(".nome-up").forEach(e => e.textContent = (multi ? curto : nomes[0]).toUpperCase());
  document.querySelectorAll(".no-mun").forEach(e => e.textContent = multi ? "NOS MUNICÍPIOS DE " + nomeLista(nomes).toUpperCase()
    : "NO MUNICÍPIO DE " + nomes[0].toUpperCase());
  $("#q").value = ""; $("#q").placeholder = COMB ? "Somar outro município…" : (multi ? "Buscar município…" : nomes[0] + " — buscar outro município…");
  $("#pag").textContent = multi ? `${SEL.length} municípios selecionados` : `Página ${ms[0].ordem} de ${LISTA.length}`;
  limpaDestaque();
  preencheArea(); destacaMunicipios(SEL); montaRotulosVias(SEL); enquadra(); atualizaRotulos();
  cartoes(M); grafSituacao(M); grafRodovia(M); grafUrbano(M); grafPeso(SEL, M); grafTipoObra(M);
  tabelaObras(M, multi); tabelaSRE(M, multi); comparacao(); barraSelecao();
  $("#notas").textContent = (M.notas || "").replace(/\\n/g, "\n") + (LOTE_SEL && multi ? `\n• Lote ${LOTE_SEL}: ` +
    `os ${SEL.length} municípios por onde passa a malha do lote. O comparativo da composição da malha mostra só a malha dentro do lote ` +
    `(${km2(soma(A.lotes[LOTE_SEL]))}); cartões, gráficos e quadros mostram os municípios inteiros (${M.c1_val}), com a parte que fica em outros lotes.` : "");
  $("#apres-pag").textContent = multi ? "" : "Página " + ms[0].ordem;
  if (APRES) modoApres();
}

// soma dos municípios selecionados — trechos, obras e projetos que cruzam a divisa entre eles contam uma vez só
function somaDic(lista) { const o = {}; lista.forEach(d => Object.entries(d || {}).forEach(([k, v]) => o[k] = (o[k] || 0) + v)); return o; }
function somaDic2(lista) { const o = {}; lista.forEach(d => Object.entries(d || {}).forEach(([k, r]) => o[k] = somaDic([o[k], r]))); return o; }
function agrega(cods) {
  const ms = cods.map(c => A.municipios[c]), comNome = (rows, m) => (rows || []).map(r => ({ ...r, _mun: m.nome }));
  const s = somaDic(ms.map(m => m.situacao)), tot = soma(s), pav = (s.PAV || 0) + (s.DUP || 0), eop = s.EOP || 0;
  const area = ms.reduce((a, m) => a + (m.area_km2 || 0), 0);
  const un = k => new Set(ms.flatMap(m => m[k] || [])).size;
  const go = somaDic2(ms.map(m => m.go_situacao)), nr = Object.values(go).filter(r => soma(r) > 0).length;
  const fx = ms.reduce((a, m) => a + (m.faixa_ha || 0), 0), G = A.goias;
  const pc1 = v => tot ? br(100 * v / tot) + "%" : "–";
  const nomes = ms.map(m => m.nome);
  return {
    nome: nomeLista(nomes), rot: "Seleção", multi: true, area_km2: area,
    situacao: s, go_situacao: go, urbano_situacao: somaDic2(ms.map(m => m.urbano_situacao)), peso: somaDic2(ms.map(m => m.peso)),
    c1_val: km2(tot), c1_sub: `${un("ids")} trechos  |  ${nr} rodovia${nr === 1 ? "" : "s"}`,
    c2_val: pc1(pav), c2_sub: `Goiás: ${br(G.idx_pav ?? 100 * ((G.situacao.PAV || 0) + (G.situacao.DUP || 0)) / G.total)}%`,
    c3_val: pc1(pav + eop), c3_sub: eop > 0 ? `${km2(eop)} em obras` : "0 Km em obras",
    c4_val: area ? br(1000 * tot / area) : "–", c4_sub: `Km/1.000 Km²  |  GO: ${br(G.dens ?? 0)}`,
    c5_val: br(fx, 2) + " ha", c5_sub: `${un("fx")} trechos  |  ${un("dc")} c/ decreto`,
    obras: ms.flatMap(m => comNome(m.obras, m)).sort((a, b) => (a.natureza !== "Obra") - (b.natureza !== "Obra") || String(a.mapa).localeCompare(String(b.mapa))),
    trechos: ms.flatMap(m => comNome(m.trechos, m)),
    notas: `• Seleção de ${ms.length} municípios: ${nomeLista(nomes)}.\n` +
      `• Base: SRE-GO ${A.rotulo} recortado pelos limites municipais; extensões medidas sobre o elipsoide GRS80 (SIRGAS 2000).\n` +
      `• Somas: Km, área e faixa de domínio somados; trechos, obras e projetos que cruzam a divisa entre municípios selecionados contam uma vez só (os Km de cada parte se somam).\n` +
      `• Índice de pavimentação, "após as obras" e densidade recalculados sobre o total da seleção (área somada: ${br(area, 2)} Km²).\n` +
      `• Totais e gráficos: só trechos estaduais principais; o quadro também lista os trechos coincidentes e federais.\n` +
      `• Obras e projetos: cadastros de ${A.obras_data || "12/11/2026"}; no mapa, o projeto aparece inteiro.`
  };
}

// obras/projetos por tipo a partir das linhas do quadro (obra/projeto que aparece em 2 municípios conta uma vez)
function tipoDeObras(rows) {
  const t = { Obra: { lineares: {}, pontuais: {} }, Projeto: { lineares: {}, pontuais: {} } }, vistos = new Set();
  (rows || []).forEach(r => { const T = t[r.natureza]; if (!T) return;
    if (r.tipo === "Trecho") { const x = T.lineares[r.intervencao] = T.lineares[r.intervencao] || { n: 0, km: 0, cods: new Set() };
      if (!x.cods.has(r.codigo)) { x.cods.add(r.codigo); x.n++; } x.km += r.km_mun || 0; }
    else if (!vistos.has(r.natureza + r.codigo)) { vistos.add(r.natureza + r.codigo); T.pontuais[r.intervencao] = (T.pontuais[r.intervencao] || 0) + 1; } });
  return t;
}

/* ---------- barra da seleção (chips) e modo Combinar ---------- */
function barraSelecao() {
  const b = $("#selecao"), multi = SEL.length > 1;
  b.hidden = !(COMB || multi);
  $("#combinar").classList.toggle("ativo", COMB);
  $("#combinar").setAttribute("aria-pressed", COMB);
  if (b.hidden) return;
  b.innerHTML = `<span class="sel-tit">${COMB ? "Modo combinar: clique no mapa para somar ou tirar municípios."
      : LOTE_SEL ? `Municípios do lote ${esc(LOTE_SEL)}:` : "Seleção:"}</span>` +
    SEL.map(c => `<span class="chip" title="${esc(A.municipios[c].nome)}">${esc(A.municipios[c].nome)}` +
      (multi ? `<button type="button" data-c="${c}" aria-label="Tirar ${esc(A.municipios[c].nome)} da seleção">×</button>` : "") + `</span>`).join("") +
    (multi ? `<span class="sel-tot">Total: <b>${esc(M.c1_val)}</b></span>` +
      `<button type="button" class="sel-btn" id="sel-comp">Ver comparação ↓</button>` +
      `<button type="button" class="sel-btn" id="sel-copiar" title="Copiar o link desta seleção">Copiar link</button>` +
      `<button type="button" class="sel-btn" id="sel-limpar">Limpar seleção</button>` : "");
  b.querySelectorAll(".chip button").forEach(x => x.onclick = () => alterna(x.dataset.c));
  if (multi) {
    $("#sel-limpar").onclick = () => selecionaLista([SEL[0]]);
    $("#sel-comp").onclick = () => $("#comp").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#sel-copiar").onclick = () => { const u = location.origin + location.pathname + location.search + "#" + hashDaSel(); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject())
      .then(() => { $("#sel-copiar").textContent = "Link copiado ✓"; setTimeout(() => $("#sel-copiar") && ($("#sel-copiar").textContent = "Copiar link"), 1800); })
      .catch(() => prompt("Copie o link:", u)); };
  }
}
$("#combinar").onclick = () => { if (!A) return; COMB = !COMB; barraSelecao();
  $("#q").placeholder = COMB ? "Somar outro município…" : (SEL.length > 1 ? "Buscar município…" : A.municipios[atual].nome + " — buscar outro município…"); };

/* ---------- comparação entre os municípios selecionados ---------- */
function linhaComp(c) {
  const m = A.municipios[c], s = m.situacao || {}, tot = soma(s), pav = (s.PAV || 0) + (s.DUP || 0), t = tipoDeObras(m.obras);
  const n = o => Object.values(o.lineares).reduce((a, x) => a + x.n, 0), k = o => Object.values(o.lineares).reduce((a, x) => a + x.km, 0);
  const p = o => soma(o.pontuais);
  return { cod: c, nome: m.nome, ext: tot, ip: tot ? 100 * pav / tot : null, ipos: tot ? 100 * (pav + (s.EOP || 0)) / tot : null,
    dens: m.area_km2 ? 1000 * tot / m.area_km2 : null, fx: m.faixa_ha || 0, area: m.area_km2,
    ob_n: n(t.Obra), ob_km: k(t.Obra), ob_p: p(t.Obra), pj_n: n(t.Projeto), pj_km: k(t.Projeto), pj_p: p(t.Projeto), s };
}
function comparacao() {
  const el = $("#comp");
  if (SEL.length < 2) { el.hidden = true; return; }
  el.hidden = false;
  const L_ = SEL.map(linhaComp), mx = k => Math.max(1e-9, ...L_.map(l => l[k] || 0));
  const barra = (v, max, cor, txt) => `<div class="cbar"><b style="width:${Math.max(0, Math.min(100, 100 * (v || 0) / max))}%;background:${cor}"></b><span>${txt}</span></div>`;
  $("#comp-graf").innerHTML = cab("Extensão por situação, por município", "Km no município (estaduais principais)") +
    empilhado(L_.filter(l => l.ext > 0).map(l => ({ rot: l.nome, r: l.s })), 760);
  const mExt = mx("ext"), mDens = mx("dens"), mFx = mx("fx");
  const t = tabela($("#t-comp"), [
    { k: "nome", t: "Município" },
    { k: "ext", t: "Extensão (Km)", f: v => barra(v, mExt, "#e31a1c", br(v, 2)) },
    { k: "ip", t: "Índice de pav.", f: v => v === null ? "–" : barra(v, 100, "#7a0a0d", br(v) + "%") },
    { k: "ipos", t: "Após obras de pav.", f: v => v === null ? "–" : barra(v, 100, "#f7a8a9", br(v) + "%") },
    { k: "dens", t: "Densidade (Km/1.000 Km²)", f: v => v === null ? "–" : barra(v, mDens, "#2f6db5", br(v)) },
    { k: "fx", t: "Faixa de domínio (ha)", f: v => barra(v, mFx, "#138a72", br(v, 2)) },
    { k: "ob_n", t: "Obras", f: (v, l) => v || l.ob_p ? `${v} · ${km2(l.ob_km)}${l.ob_p ? ` + ${l.ob_p} pontual${l.ob_p > 1 ? "is" : ""}` : ""}` : "–" },
    { k: "pj_n", t: "Projetos", f: (v, l) => v || l.pj_p ? `${v} · ${km2(l.pj_km)}${l.pj_p ? ` + ${l.pj_p} pontual${l.pj_p > 1 ? "is" : ""}` : ""}` : "–" }
  ], L_, "", l => { const b = A.municipios[l.cod].bbox; enquadra(b); $("#mapa").scrollIntoView({ behavior: "smooth", block: "center" }); });
  const T = tipoDeObras(M.obras), nn = o => Object.values(o.lineares).reduce((a, x) => a + x.n, 0), kk = o => Object.values(o.lineares).reduce((a, x) => a + x.km, 0);
  $("#comp-tot").innerHTML = `<b>Total da seleção:</b> ${esc(M.c1_val)} · índice de pavimentação ${esc(M.c2_val)} · após as obras ${esc(M.c3_val)} · ` +
    `densidade ${esc(M.c4_val)} Km/1.000 Km² · faixa ${esc(M.c5_val)} · obras ${nn(T.Obra)} (${km2(kk(T.Obra))}) · projetos ${nn(T.Projeto)} (${km2(kk(T.Projeto))}). ` +
    `<span class="g-sub">Clique numa linha para ver o município no mapa; clique no título da coluna para ordenar.</span>`;
  return t;
}

/* ---------------- cartões ---------------- */
function cartoes(m) {
  const tit = [m.multi ? "EXTENSÃO NA SELEÇÃO" : "EXTENSÃO NO MUNICÍPIO", "ÍNDICE DE PAVIMENTAÇÃO", "APÓS AS OBRAS DE PAVIMENTAÇÃO", "DENSIDADE RODOVIÁRIA", "FAIXA DE DOMÍNIO"];
  $("#cartoes").innerHTML = tit.map((t, i) => `<div class="cartao">
      <div class="cartao-tit">${t}</div><img src="img/c${i + 1}.svg" alt="">
      <div class="cartao-val">${esc(m[`c${i + 1}_val`])}</div>
      <div class="cartao-sub">${esc(m[`c${i + 1}_sub`])}</div></div>`).join("");
}

/* ---------------- gráficos (SVG) ---------------- */
const SEM = "Sem trechos estaduais do SRE no município";
function cab(t, s) { return `<div class="g-tit">${t}</div>` + (s ? `<div class="g-sub">${s}</div>` : ""); }
function textW(t, fs) { return String(t).length * fs * 0.55; }

function barrasH(itens, tot) {             // [{rot, v, cor, tip}]
  const vmax = Math.max(...itens.map(i => i.v)), lw = Math.max(...itens.map(i => textW(i.rot, 11))) + 8;
  const W = 300, bh = 18, gap = 8, H = itens.length * (bh + gap) + 18, x0 = lw, bw = (W - x0) / 2.1;  // folga p/ "000,00 Km (00,0%)"
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}">`;
  for (const t of ticks(vmax * 2.1)) {
    const x = x0 + bw * t / vmax; if (x > W) continue;
    s += `<line x1="${x}" x2="${x}" y1="0" y2="${H - 16}" stroke="#c4c3bb" stroke-width=".6"/>` +
         `<text x="${x}" y="${H - 4}" font-size="9" fill="#898781" text-anchor="middle">${br(t, t >= 1 || t === 0 ? 0 : 1)}</text>`;
  }
  itens.forEach((it, i) => {
    const y = i * (bh + gap) + 2, w = Math.max(1, bw * it.v / vmax);
    s += `<text x="${x0 - 6}" y="${y + bh / 2 + 4}" font-size="11" fill="#52514e" text-anchor="end">${esc(it.rot)}</text>` +
         `<rect class="hov" x="${x0}" y="${y}" width="${w}" height="${bh}" fill="${it.cor}" data-tip="${esc(it.tip)}"/>` +
         `<text x="${x0 + w + 5}" y="${y + bh / 2 + 4}" font-size="10.5" fill="#0b0b0b">${km2(it.v)}${tot ? `  (${br(100 * it.v / tot)}%)` : ""}</text>`;
  });
  return s + `<line x1="${x0}" x2="${x0}" y1="0" y2="${H - 16}" stroke="#8f8e86" stroke-width=".8"/></svg>`;
}
function ticks(max) {
  const p = Math.pow(10, Math.floor(Math.log10(max / 4))), passo = [1, 2, 2.5, 5, 10].map(k => k * p).find(k => max / k <= 5);
  const r = []; for (let v = 0; v <= max; v += passo) r.push(+v.toFixed(6)); return r;
}
function empilhado(linhas, W = 300) {      // [{rot, r:{sit:km}}]; W maior = gráfico largo sem ampliar as letras
  const tots = linhas.map(l => soma(l.r)), vmax = Math.max(...tots);
  const lw = Math.max(...linhas.map(l => textW(l.rot, 11))) + 8;
  const bh = 18, gap = 8, H = linhas.length * (bh + gap) + 18, x0 = lw, bw = (W - x0) / 1.3;
  let s = `<svg class="graf" viewBox="0 0 ${W} ${H}">`;
  for (const t of ticks(vmax * 1.3)) {
    const x = x0 + bw * t / vmax; if (x > W) continue;
    s += `<line x1="${x}" x2="${x}" y1="0" y2="${H - 16}" stroke="#c4c3bb" stroke-width=".6"/>` +
         `<text x="${x}" y="${H - 4}" font-size="9" fill="#898781" text-anchor="middle">${br(t, 0)}</text>`;
  }
  linhas.forEach((l, i) => {
    const y = i * (bh + gap) + 2; let x = x0;
    s += `<text x="${x0 - 6}" y="${y + bh / 2 + 4}" font-size="11" fill="#52514e" text-anchor="end">${esc(l.rot)}</text>`;
    for (const c of ORD) {
      const v = l.r[c]; if (!v) continue;
      const w = bw * v / vmax;
      s += `<rect class="hov" x="${x}" y="${y}" width="${w}" height="${bh}" fill="${SIT[c][1]}" stroke="#fff" stroke-width=".8"
              data-tip="<b>${esc(l.rot)}</b><br>${SIT[c][0]}: ${km2(v)} (${br(100 * v / tots[i])}%)"/>`;
      if (w > textW(br(v, 2), 9.5) + 6) s += `<text x="${x + w / 2}" y="${y + bh / 2 + 3.5}" font-size="9.5" text-anchor="middle" pointer-events="none"
              fill="${BRANCO.has(c) ? "#fff" : "#0b0b0b"}">${br(v, 2)}</text>`;
      x += w;
    }
    s += `<text x="${x + 5}" y="${y + bh / 2 + 4}" font-size="10.5" fill="#0b0b0b">${km2(tots[i])}</text>`;
  });
  s += `<line x1="${x0}" x2="${x0}" y1="0" y2="${H - 16}" stroke="#8f8e86" stroke-width=".8"/></svg>`;
  const usados = ORD.filter(c => linhas.some(l => l.r[c]));
  return s + `<div class="leg-g">${usados.map(c => `<span><i style="background:${SIT[c][1]}"></i>${SIT[c][0]}</span>`).join("")}</div>`;
}
function grafSituacao(m) {
  const S = Object.fromEntries(Object.entries(m.situacao).filter(([, v]) => v > 0)), tot = soma(S);
  if (!tot) { $("#g1").innerHTML = cab("Extensão por situação") + `<div class="g-vazio">${SEM}</div>`; return; }
  const it = Object.keys(S).sort((a, b) => S[b] - S[a]).map(c => ({ rot: SIT[c][0], v: S[c], cor: SIT[c][1],
    tip: `<b>${SIT[c][0]}</b><br>${km2(S[c])} · ${br(100 * S[c] / tot)}% da malha estadual no município` }));
  $("#g1").innerHTML = cab("Extensão por situação", `Km no município e % do total (${km2(tot)})`) + barrasH(it, tot);
}
function grafRodovia(m) {
  const gos = Object.entries(m.go_situacao).filter(([, r]) => soma(r) > 0).sort((a, b) => soma(b[1]) - soma(a[1]));
  $("#g2").innerHTML = !gos.length ? cab("Extensão por rodovia e situação") + `<div class="g-vazio">${SEM}</div>` :
    cab("Extensão por rodovia e situação", "Km no município") + empilhado(gos.map(([k, r]) => ({ rot: k, r })));
}
function grafUrbano(m) {
  const ur = ["Rural", "Urbano"].filter(k => soma(m.urbano_situacao[k]) > 0).map(k => ({ rot: k, r: m.urbano_situacao[k] }));
  $("#g3").innerHTML = !ur.length ? cab("Trechos urbanos × rurais") + `<div class="g-vazio">${SEM}</div>` :
    cab("Trechos urbanos × rurais", "Km no município, por situação (perímetro urbano)") + empilhado(ur);
}
// "Tipo de Obra" (igual ao gráfico do layout 04): barras "Obra – X" e "Projeto – X" + texto dos pontuais
function grafTipoObra(m) {
  const t = tipoDeObras(m.obras), O = t.Obra, P = t.Projeto;   // a partir do quadro: vale para 1 ou vários municípios
  const txtP = (titulo, pon) => titulo + ": " + Object.entries(pon).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${n} ${n > 1 ? (PLURAL[k] || k.toLowerCase() + "s") : (SINGULAR[k] || k.toLowerCase())}`).join(" · ");
  let h = cab("Tipo de Obra", "obras e projetos: quantidade e Km no município");
  const barras = [
    ...Object.entries(O.lineares).sort((a, b) => b[1].km - a[1].km).map(([k, v]) => ({ rot: "Obra – " + k, n: v.n, km: v.km, cor: DOR_COR[k] || "#0055d6", nat: "obra" })),
    ...Object.entries(P.lineares).sort((a, b) => b[1].km - a[1].km).map(([k, v]) => ({ rot: "Projeto – " + k, n: v.n, km: v.km, cor: PJ_COR[k] || "#666666", nat: "projeto" }))];
  const temP = Object.keys(O.pontuais).length || Object.keys(P.pontuais).length;
  if (!barras.length && !temP) { $("#g-dor").innerHTML = h + `<div class="g-vazio">Sem obras e projetos<br>para o município</div>`; return; }
  if (barras.length) {
    const vmax = Math.max(1e-9, ...barras.map(b => b.km)), W = 190, bh = 12, H = barras.length * 33;
    h += `<svg class="graf" viewBox="0 0 ${W} ${H}">`;
    barras.forEach((b, i) => {
      const y = i * 33, w = Math.max(2, (W * 0.42) * b.km / vmax), q = `${b.n} ${b.nat}${b.n > 1 ? "s" : ""}`;
      h += `<text x="0" y="${y + 11}" font-size="11" fill="#52514e">${esc(b.rot)}</text>` +
           `<rect class="hov" x="0" y="${y + 15}" width="${w}" height="${bh}" fill="${b.cor}" stroke="#fff" stroke-width="1.2"
              data-tip="<b>${esc(b.rot)}</b><br>${q} · ${km2(b.km)} no município"/>` +
           `<text x="${w + 4}" y="${y + 24.5}" font-size="10" fill="#0b0b0b">${q} · ${km2(b.km)}</text>`;
    });
    h += `</svg>`;
  }
  const rod = [];
  if (Object.keys(O.pontuais).length) rod.push(txtP("Obras pontuais", O.pontuais));
  if (Object.keys(P.pontuais).length) rod.push(txtP("Projetos pontuais", P.pontuais));
  $("#g-dor").innerHTML = h + rod.map(r => `<div class="g-sub" style="margin-top:4px">${esc(r)}</div>`).join("");
}

/* --- comparativo: peso da malha do município no próprio município, no(s) lote(s) e em Goiás --- */
function pc(v) { if (v <= 0) return "0%"; return (v < 0.01 ? "<0,01" : br(v, v >= 1 ? 1 : 2)) + "%"; }
function miniMapa(cods, lts, LS = null) {
  const todos = GEO.lotes.features; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const anel = g => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
  todos.forEach(f => anel(f.geometry).forEach(p => p[0].forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); })));
  const kx = Math.cos((y0 + y1) / 2 * Math.PI / 180), S = 200, esc_ = S / Math.max((x1 - x0) * kx, y1 - y0);
  const ox = (S - (x1 - x0) * kx * esc_) / 2, oy = (S - (y1 - y0) * esc_) / 2;
  const P = ([x, y]) => `${(ox + (x - x0) * kx * esc_).toFixed(1)},${(oy + (y1 - y) * esc_).toFixed(1)}`;
  const d = g => anel(g).map(p => p.map(r => "M" + r.map(P).join("L") + "Z").join("")).join("");
  let s = `<svg viewBox="0 0 ${S} ${S}">`;
  // seleção aberta por um lote: o lote escolhido em cor forte, os vizinhos tocados pelos municípios em cor clara
  todos.forEach(f => { const k = String(f.properties.lote), meu = lts.includes(k), esse = LS && k === LS;
    const cor = esse ? T_LT : meu ? (LS ? "#c5e8df" : "#7fcbb9") : "#e3ecf8";
    const tip = esse ? " — lote selecionado" : meu ? (LS ? " — vizinho (tem parte dos municípios)" : cods.length > 1 ? " — contém a seleção" : " — contém o município") : "";
    s += `<path class="hov" d="${d(f.geometry)}" fill="${cor}" stroke="${meu ? "#fff" : "#a9bfdf"}" stroke-width=".7"
            data-tip="Lote ${esc(k)}${tip}"/>`; });
  GEO.municipios.features.filter(f => cods.includes(f.properties.cod)).forEach(fm =>
    s += `<path class="hov" d="${d(fm.geometry)}" fill="${LS ? "none" : T_MU}" stroke="${T_MU}" stroke-width="${LS ? ".5" : ".6"}" pointer-events="all"
            data-tip="<b>${esc((A.municipios[fm.properties.cod] || {}).nome || "")}</b>"/>`);   // 20/11/2026: nome do município ao passar o mouse
  if (lts.length > 1) todos.filter(f => lts.includes(f.properties.lote)).forEach(f => {
    let mx = 0, my = 0, n = 0; anel(f.geometry).forEach(p => p[0].forEach(c => { mx += c[0]; my += c[1]; n++; }));
    const [x, y] = P([mx / n, my / n]).split(",");
    s += `<text x="${x}" y="${+y + 4}" font-size="12" font-weight="bold" fill="${T_LT}" text-anchor="middle" stroke="#fff" stroke-width="2.5" paint-order="stroke">${esc(f.properties.lote)}</text>`;
  });
  return s + "</svg>";
}
// 19/11/2026: o comparativo mostra o dado em Km, em % ou nos dois (só muda o texto das barras; desenho e cores iguais)
const UN_PESO = { km: ["Km", "Km por situação"], pct: ["%", "% da extensão total por situação"], ambos: ["Km e %", "Km e % por situação"] };
let MODO_PESO = "km";
try { const u = localStorage.getItem("atlas-peso-un"); if (UN_PESO[u]) MODO_PESO = u; } catch (e) {}
function grafPeso(cods, m) {
  const ml = m.peso || {}, ms = {};
  Object.values(ml).forEach(r => Object.entries(r).forEach(([s, v]) => ms[s] = (ms[s] || 0) + v));
  const tm = soma(ms);
  let h = `<div class="seg-un" role="group" aria-label="Mostrar o dado em">${Object.entries(UN_PESO).map(([k, [t]]) =>
      `<button type="button" data-un="${k}" aria-pressed="${k === MODO_PESO}">${t}</button>`).join("")}</div>` +
    cab("Comparativo da composição da malha", UN_PESO[MODO_PESO][1] + " (estaduais principais)");
  if (!tm) { $("#g-peso").innerHTML = h + `<div class="g-vazio">${SEM}</div>`; return; }
  // 20/11/2026: seleção aberta por um lote (#lote=N) — o lote escolhido vem primeiro, em destaque, e some a linha
  // "Seleção", que somava os municípios inteiros (com a parte deles que fica em outros lotes) e passava do lote
  const LS = LOTE_SEL && ml[LOTE_SEL] ? LOTE_SEL : null;
  let lts = Object.keys(ml).sort((a, b) => soma(ml[b]) - soma(ml[a]));
  if (LS) lts = [LS, ...lts.filter(k => k !== LS)];
  const GO = A.goias.situacao, GOt = A.goias.total, LT = A.lotes;
  const sits = ["PAV", "DUP", "EOD", "EOP", "IMP", "LEN"];
  const rl = lts.length === 1 ? "Lote " + lts[0] : "Lotes " + lts.slice(0, -1).join(", ") + " e " + lts[lts.length - 1];
  // barras em Km (layout 04): cada linha mostra a composição da própria malha; extensão total à direita
  const rotM = m.multi ? `Seleção (${cods.length})` : m.nome;
  const linhas = LS
    ? [...lts.map(k => ({ rot: "Lote " + k, r: LT[k] || {}, cor: T_LT, dest: k === LS })), { rot: "Goiás", r: GO, cor: T_GO }]
    : [{ rot: rotM, r: ms, cor: T_MU }, ...lts.map(k => ({ rot: "Lote " + k, r: LT[k] || {}, cor: T_LT })),
       { rot: "Goiás", r: GO, cor: T_GO }];
  // 20/11/2026: com poucas linhas as barras ficam mais altas, para o gráfico acompanhar a altura do mini mapa
  const W = 640, x0 = 150, xT = W - 92, bw = xT - x0 - 10, nL = linhas.length,
    bh = nL <= 3 ? 34 : nL <= 5 ? 28 : 22, gap = nL <= 3 ? 30 : nL <= 5 ? 24 : 22, fT = nL <= 5 ? 10.5 : 9.5;
  let s = `<svg class="graf graf-comp" viewBox="0 0 ${W} ${linhas.length * (bh + gap) + 4}">`;
  s += `<text x="${W - 2}" y="11" font-size="10.5" font-weight="bold" fill="#52514e" text-anchor="end">Extensão total</text>`;
  linhas.forEach((l, i) => {
    const y = 16 + i * (bh + gap), tot = soma(l.r); let x = x0;
    if (l.dest) s += `<rect x="0" y="${y - 4}" width="${W}" height="${bh + 8}" rx="4" fill="${T_LT}" fill-opacity=".12" stroke="${T_LT}" stroke-width="1.2"/>` +
      `<text x="${x0 - 8}" y="${y + bh + 1}" font-size="8.5" text-anchor="end" fill="${T_LT}">selecionado</text>`;
    s += `<text x="${x0 - 8}" y="${y + bh / 2 + (l.dest ? 1 : 4)}" font-size="${l.dest ? 12.5 : 11.5}" font-weight="bold" text-anchor="end" style="fill:${l.cor}" fill="${l.cor}">${esc(l.rot)}</text>`;
    for (const c of sits) {
      const v = l.r[c]; if (!v) continue;
      const w = bw * v / tot, rot = km2(v), pc = br(100 * v / tot) + "%";
      s += `<rect class="hov" x="${x}" y="${y}" width="${Math.max(w, 0.8)}" height="${bh}" fill="${SIT[c][1]}" stroke="#fff" stroke-width=".6"
              data-tip="<b>${esc(l.rot)}</b><br>${SIT[c][0]}: ${rot} (${pc})"/>`;
      const tc = `font-weight="bold" text-anchor="middle" pointer-events="none" fill="${BRANCO.has(c) ? "#fff" : "#0b0b0b"}"`;
      if (MODO_PESO === "ambos") {          // duas linhas dentro da barra: Km em cima, % embaixo
        const f2 = fT - .5;
        if (w > textW(rot, f2) + 8) s += `<text x="${x + w / 2}" y="${y + bh / 2 - 1.5}" font-size="${f2}" ${tc}>${rot}</text>` +
          `<text x="${x + w / 2}" y="${y + bh / 2 + f2 - .5}" font-size="${f2}" ${tc}>${pc}</text>`;
      } else {
        const t = MODO_PESO === "pct" ? pc : rot;
        if (w > textW(t, fT) + 8) s += `<text x="${x + w / 2}" y="${y + bh / 2 + fT * .37}" font-size="${fT}" ${tc}>${t}</text>`;
      }
      x += w;
    }
    s += `<text x="${xT}" y="${y + bh / 2 + 4}" font-size="11" font-weight="bold" style="fill:${l.cor}" fill="${l.cor}">${km2(tot)}</text>`;
  });
  s += `</svg><div class="leg-g">${sits.map(c => `<span><i style="background:${SIT[c][1]}"></i>${SIT[c][0]}</span>`).join("")}</div>`;
  if (LS) s += `<div class="g-sub" style="margin-top:4px">Extensões do lote ${esc(LS)}: só a malha dentro do lote. Os ${cods.length} municípios ` +
    `têm ${km2(tm)} somados inteiros, porque parte deles fica em ${lts.length > 2 ? "outros lotes" : "outro lote"}; ` +
    `esse total aparece nos cartões e nos quadros por município.</div>`;
  const nm0 = m.multi ? `Seleção: ${cods.length} municípios` : (m.nome.length <= 22 ? m.nome : m.nome.slice(0, 21) + "…");
  const rotMapa = LS ? `<span style="color:${T_LT};font-weight:bold">Lote ${esc(LS)}</span><br><span style="color:${T_MU}">${cods.length} municípios</span>` +
      (lts.length > 1 ? `<br><span style="color:${T_LT}">Vizinhos: ${esc(lts.slice(1).join(", "))}</span>` : "")
    : `<span style="color:${T_MU}">${esc(nm0)}</span><br><span style="color:${T_LT}">${esc(rl)}</span>`;
  $("#g-peso").innerHTML = h + `<div class="peso"><div class="peso-mapa"><div class="peso-mini">${miniMapa(cods, lts, LS)}</div>
        <div class="peso-pe"><div class="peso-rot">${rotMapa}<br><span style="color:${T_GO}">Goiás</span></div>
        <button type="button" class="amplia-mini" title="Ampliar mapa" aria-label="Ampliar mapa">⤢</button></div></div><div>${s}</div></div>`;
  const amplia = () => { if (!APRES) ampliaMini($("#g-peso .peso-mini svg").outerHTML, $("#g-peso .peso-rot").innerHTML); };
  $("#g-peso .amplia-mini").onclick = amplia;
  $("#g-peso .peso-mini svg").addEventListener("click", amplia);
  $("#g-peso").querySelectorAll(".seg-un button").forEach(b => b.onclick = () => {
    MODO_PESO = b.dataset.un; try { localStorage.setItem("atlas-peso-un", MODO_PESO); } catch (e) {}
    grafPeso(cods, m);
    if (APRES && !IMG) ajustaFolha();
  });
}

// 20/11/2026: "⤢ Ampliar mapa" do comparativo — o mesmo mini mapa grande numa janela por cima (✕, Esc ou clique fora fecha)
function ampliaMini(svg, rot) {
  let o = $("#mini-zoom");
  if (!o) {
    o = document.createElement("div"); o.id = "mini-zoom"; o.hidden = true;
    o.innerHTML = `<div class="mz-caixa" role="dialog" aria-modal="true" aria-label="Mapa dos lotes ampliado">
      <button type="button" class="mz-fecha" aria-label="Fechar">✕</button><div class="mz-corpo"></div></div>`;
    document.body.appendChild(o);
    const fecha = () => { o.hidden = true; dica.style.display = "none"; };
    o.addEventListener("click", e => { if (e.target === o || e.target.closest(".mz-fecha")) fecha(); });
    window.addEventListener("keydown", e => { if (e.key === "Escape" && !o.hidden) { fecha(); e.stopImmediatePropagation(); } }, true);
  }
  o.querySelector(".mz-corpo").innerHTML = `<div class="mz-mapa">${svg}</div><div class="peso-rot mz-rot">${rot}</div>`;
  // o desenho cresce ~3x: letras e contornos voltam a um tamanho de leitura normal
  o.querySelectorAll(".mz-mapa text").forEach(t => { t.setAttribute("font-size", +t.getAttribute("font-size") * .5); t.setAttribute("stroke-width", 1.5); });
  o.querySelectorAll(".mz-mapa path").forEach(p => p.setAttribute("stroke-width", +p.getAttribute("stroke-width") * .6));
  o.hidden = false; o.querySelector(".mz-fecha").focus();
}

/* ---------------- tabelas ---------------- */
const num = (v, d) => (v === null || v === undefined || v === "" || isNaN(+v)) ? esc(v ?? "") : br(+v, d);
function tabela(el, cols, linhas, vazio, aoClicar) {
  let ord = null, asc = true, filtro = "";
  const desenha = () => {
    let ls = linhas.filter(l => !filtro || cols.some(c => semAcento(String(l[c.k] ?? "")).includes(filtro)));
    if (ord) ls = [...ls].sort((a, b) => { const x = a[ord], y = b[ord], nx = +x, ny = +y;
      const r = (!isNaN(nx) && !isNaN(ny) && x !== "" && y !== "") ? nx - ny : String(x ?? "").localeCompare(String(y ?? ""), "pt-BR");
      return asc ? r : -r; });
    el.innerHTML = `<thead><tr>${cols.map(c => `<th data-k="${c.k}" class="${ord === c.k ? "ord" + (asc ? " asc" : "") : ""}">${c.t}</th>`).join("")}</tr></thead><tbody>` +
      (ls.length ? ls.map((l, i) => `<tr data-i="${linhas.indexOf(l)}">${cols.map(c => `<td>${c.f ? c.f(l[c.k], l) : esc(l[c.k] ?? "")}</td>`).join("")}</tr>`).join("")
        : `<tr class="vazio"><td colspan="${cols.length}">${vazio}</td></tr>`) + "</tbody>";
    el.querySelectorAll("th").forEach(th => th.onclick = () => { const k = th.dataset.k; asc = ord === k ? !asc : true; ord = k; desenha(); });
    if (aoClicar) el.querySelectorAll("tbody tr[data-i]").forEach(tr => tr.onclick = () => {
      el.querySelectorAll("tr.sel").forEach(x => x.classList.remove("sel")); tr.classList.add("sel"); aoClicar(linhas[+tr.dataset.i]); });
  };
  desenha();
  return { filtra: t => { filtro = semAcento(t); desenha(); } };
}
// cor da tarja do "Mapa" = cor do símbolo no mapa (obra azul por tipo; projeto pela intervenção ou pela placa)
function corTarja(l) {
  if (l.tipo === "Pontual") { const p = PLACA[catPlaca(l, l.natureza !== "Obra")]; return [p[1], p[2]]; }
  return [INT_COR[l.intervencao] || "#666666", "#fff"];
}
function tabelaObras(m, multi = false) {
  const ls = (m.obras || []).map(l => ({ ...l, _cor: corTarja(l) }));
  tabela($("#t-obras"), [
    ...(multi ? [{ k: "_mun", t: "Município" }] : []),
    { k: "mapa", t: "Mapa", f: (v, l) => `<span class="tarja" style="background:${l._cor[0]};color:${l._cor[1]}">${esc(v)}</span>` },
    { k: "codigo", t: "Código" }, { k: "rodovia", t: "Rodovia" }, { k: "intervencao", t: "Intervenção" },
    { k: "tipo", t: "Tipo" }, { k: "km_mun", t: "Km mun.", f: v => num(v, 2) }, { k: "km_contrato", t: "Km contr.", f: v => num(v, 2) },
    { k: "etapa", t: "Etapa" }, { k: "situacao", t: "Situação" }, { k: "natureza", t: "Natureza" }], ls, "Sem obras e projetos para o município",
    l => destacaObra(l));
}
let tSRE = null;
function tabelaSRE(m, multi = false) {
  $("#filtro").value = "";
  tSRE = tabela($("#t-sre"), [
    ...(multi ? [{ k: "_mun", t: "Município" }] : []),
    { k: "sre", t: "SRE" }, { k: "go", t: "GO" }, { k: "classe", t: "Classe" }, { k: "inicio", t: "Início" }, { k: "fim", t: "Fim" },
    { k: "km_ini", t: "Km inicial", f: v => num(v, 2) }, { k: "km_fim", t: "Km final", f: v => num(v, 2) },
    { k: "ext", t: "Ext. SRE (Km)", f: v => num(v, 2) }, { k: "ext_mun", t: "Ext. no mun. (Km)", f: v => num(v, 2) },
    { k: "pct_mun", t: "% no mun.", f: v => num(v, 1) }, { k: "situacao", t: "Situação" }, { k: "jurisdicao", t: "Jurisdição" },
    { k: "perim_urb", t: "Perím. urb." }], m.trechos || [], "Sem trechos do SRE no município", l => destacaTrecho(l.sre, l));
}
$("#filtro").addEventListener("input", e => tSRE && tSRE.filtra(e.target.value));

/* ---------------- legenda (mesmos símbolos do mapa) ---------------- */
function legenda() {
  const ln = (cor, w, dash, casing) => `<svg width="34" height="12">${casing ? `<line x1="2" x2="32" y1="6" y2="6" stroke="${casing}" stroke-width="${w + 3}"/>` : ""}
      <line x1="2" x2="32" y1="6" y2="6" stroke="${cor}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ""}/></svg>`;
  const it = (sw, t) => `<div>${sw}<span>${t}</span></div>`;
  // símbolos da legenda oficial (19/11/2026): mesmo desenho do mapa (faixa + traço branco conforme a etapa)
  const traco = (iv, et) => { const t = etapaTraco(et), c = INT_COR[iv];
    return `<svg width="34" height="12"><line x1="2" x2="32" y1="6" y2="6" stroke="${c}" stroke-width="${t === "obra" ? 6 : 8}"/>` +
      (t === "obra" ? "" : `<line x1="2" x2="32" y1="6" y2="6" stroke="#fff" stroke-width="${t === "projeto" ? 3 : 4.5}"${t === "projeto" ? "" : ` stroke-dasharray="6 3"`}/>`) + `</svg>`; };
  const placaLg = k => `<img src="${PLACA[k][0]}" width="20" height="20" alt="" style="margin:0 7px">`;
  $("#legenda").innerHTML =
    `<div class="lg-tit">SRE – ${cap(A.rotulo)}</div>` +
    it(ln("#e31a1c", 5), "Duplicada") + it(ln("#e31a1c", 3), "Pavimentada") + it(ln("#e31a1c", 3, "8 5"), "Em obras de pavimentação") +
    it(ln("#e88000", 3), "Implantada / Leito natural") +
    `<div class="lg-tit">SNV – Rodovias federais</div>` + it(ln("#33a02c", 3), "Federal") +
    `<div class="lg-tit">Obras</div>` + DOR_CLASSES.map(([iv, et]) => it(traco(iv, et), `${iv} - ${et}`)).join("") +
    DOR_PLACAS.map(k => it(placaLg(k), k)).join("") +
    `<div class="lg-tit">Projetos</div>` + PJ_CLASSES.map(([iv, et]) => it(traco(iv, et), `${iv} - ${et}`)).join("") +
    PJ_PLACAS.map(k => it(placaLg(k), k)).join("") +
    `<div class="lg-tit">Demais</div>` +
    it(`<svg width="34" height="14"><rect x="3" y="2" width="28" height="10" fill="none" stroke="#ffd400" stroke-width="3"/></svg>`, "Limite municipal") +
    it(`<svg width="34" height="14"><rect x="3" y="2" width="28" height="10" fill="#5f6b4e"/><rect x="3" y="2" width="28" height="10" fill="#f4f4ef" fill-opacity=".3" stroke="#f4f4ef"/></svg>`, "Perímetro urbano") +
    it(`<svg width="34" height="14"><circle cx="17" cy="7" r="4" fill="#fff" stroke="#222"/></svg>`, "Localidades");
}

carrega().catch(e => { $("#carregando").textContent = "Erro ao carregar o atlas: " + e.message; console.error(e); });
