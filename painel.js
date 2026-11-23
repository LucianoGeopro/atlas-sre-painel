/* ATLAS_PAINEL — arranjo de painéis no modelo do SIPLAWEB (18/11/2026).
   O conteúdo é o mesmo do site atual (app.js): este arquivo só MUDA OS BLOCOS DE LUGAR.
   Esquerda: município (busca, ‹ ›, combinar, link, apresentação, mês), camadas e legenda.
   Centro: o mapa. Direita: nome do município, indicadores, gráficos, peso, comparação, obras, trechos e notas.
   No modo apresentação o app.js chama PAINEL.restaura() (a folha A3 montada usa o arranjo original da página)
   e, ao sair, PAINEL.monta(). Cada bloco deixa um marcador (comentário) no lugar original para poder voltar. */
"use strict";
window.PAINEL = (function () {             // window.: o app.js procura window.PAINEL
  const q = s => document.querySelector(s);
  const html = document.documentElement;
  const guardaP = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const lembraP = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  // seção recolhível (como os "+" do SIPLAWEB); o estado aberto/fechado fica guardado no navegador
  function secao(lado, id, titulo, aberta = true) {
    const s = document.createElement("section"); s.className = "sp"; s.id = "sp-" + id;
    const salvo = lembraP("painel-sp-" + id); if (salvo ? salvo === "0" : !aberta) s.classList.add("fechada");
    s.innerHTML = `<button type="button" class="sp-tit" aria-expanded="${!s.classList.contains("fechada")}"><span>${titulo}</span><i aria-hidden="true"></i></button><div class="sp-corpo"></div>`;
    s.querySelector(".sp-tit").onclick = () => {
      const f = s.classList.toggle("fechada"); s.querySelector(".sp-tit").setAttribute("aria-expanded", !f);
      guardaP("painel-sp-" + id, f ? "0" : "1");
      if (id === "mapa" && typeof mapa !== "undefined" && mapa) setTimeout(() => mapa.invalidateSize(), 50);
    };
    q(lado).appendChild(s);
    return s.querySelector(".sp-corpo");
  }
  const estreita = window.innerWidth <= 1100;   // celular: camadas e legenda começam fechadas para o mapa vir logo
  const esq = {
    mun: secao("#esq-corpo", "mun", "MUNICÍPIO"),
    cam: secao("#esq-corpo", "camadas", "CAMADAS DO MAPA", !estreita),
    leg: secao("#esq-corpo", "legenda", "LEGENDA", !estreita)
  };
  // cabeçalho do painel da direita: nome do município (o .cab do layout)
  const dirCab = document.createElement("div"); dirCab.className = "dir-cab"; q("#dir-corpo").appendChild(dirCab);
  const dir = {
    ind: secao("#dir-corpo", "ind", "INDICADORES DO SRE"),
    graf: secao("#dir-corpo", "graf", "GRÁFICOS"),
    peso: secao("#dir-corpo", "peso", "PESO DO MUNICÍPIO NO LOTE E EM GOIÁS"),
    comp: secao("#dir-corpo", "comp", "COMPARAÇÃO ENTRE OS MUNICÍPIOS"),
    obras: secao("#dir-corpo", "obras", "OBRAS E PROJETOS"),
    sre: secao("#dir-corpo", "sre", "SRE – QUADRO DE TRECHOS"),
    notas: secao("#dir-corpo", "notas", "NOTAS METODOLÓGICAS", false)
  };
  const rodapeDir = document.createElement("div"); rodapeDir.className = "dir-rodape"; q("#dir-corpo").appendChild(rodapeDir);

  // [elemento, destino]: a ordem é a ordem dentro do destino
  const LUGARES = [
    [".busca", esq.mun], ["#camadas", esq.cam], [".b-legenda", esq.leg],
    [".b-mapa", "#centro"],
    [".cab", dirCab], [".b-ind", dir.ind], [".b-graf", dir.graf], [".b-peso", dir.peso], ["#comp", dir.comp],
    [".b-obras", dir.obras], [".b-sre", dir.sre], [".b-notas", dir.notas], [".rodape", rodapeDir],
    ["#tema", "#tp-btns"], ["#novid-btn", "#tp-btns"], ["#ver-sobre", "#tp-btns"]   // 20/11/2026: Novidades entre Tema e Sobre
  ].map(([s, d]) => ({ el: q(s), destino: typeof d === "string" ? q(d) : d, marca: null }));

  function monta() {
    LUGARES.forEach(l => {
      if (!l.el) return;
      if (!l.marca) { l.marca = document.createComment("painel: " + (l.el.id || l.el.className)); l.el.parentNode.insertBefore(l.marca, l.el); }
      l.destino.appendChild(l.el);
    });
    html.classList.add("modo-painel");
    if (typeof mapa !== "undefined" && mapa) setTimeout(() => { mapa.invalidateSize(); if (typeof atual !== "undefined" && atual) enquadra(); }, 60);
  }
  function restaura() {
    LUGARES.forEach(l => { if (l.el && l.marca) l.marca.parentNode.insertBefore(l.el, l.marca); });
    html.classList.remove("modo-painel");
  }

  // recolher os painéis laterais (como as setas ◂ ▸ do SIPLAWEB)
  function recolhe(lado, fechar) {
    html.classList.toggle(lado + "-fechado", fechar); guardaP("painel-" + lado, fechar ? "0" : "1");
    q("#rec-" + lado).textContent = (lado === "esq") === fechar ? "❯" : "❮";   // 23/11/2026: setas mais grossas (antes ▸ ◂)
    if (typeof mapa !== "undefined" && mapa) setTimeout(() => { mapa.invalidateSize(); }, 260);
  }
  q("#rec-esq").onclick = () => recolhe("esq", !html.classList.contains("esq-fechado"));
  q("#rec-dir").onclick = () => recolhe("dir", !html.classList.contains("dir-fechado"));
  if (lembraP("painel-esq") === "0") recolhe("esq", true);
  if (lembraP("painel-dir") === "0") recolhe("dir", true);

  // link da página inicial: ?sobre=1 abre "Sobre os dados"; ?combinar=1 liga o modo Combinar
  const ps = new URLSearchParams(location.search);
  if (ps.get("sobre") === "1" && typeof abreSobre === "function") abreSobre();
  if (ps.get("combinar") === "1") {            // o botão só funciona depois que os dados carregam (A do app.js)
    const liga = (n = 0) => { if (typeof A !== "undefined" && A && !document.querySelector("#carregando")) { if (!COMB) q("#combinar").click(); }
      else if (n < 600) setTimeout(() => liga(n + 1), 300); };
    liga();
  }

  monta();
  return { monta, restaura };
})();
