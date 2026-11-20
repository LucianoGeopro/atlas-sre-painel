/* Aviso de novidades — ATUALIZAR A CADA PUBLICAÇÃO: pôr os itens do dia no topo de HIST (data dd/mm/aaaa) e trocar o ID
   (id novo = o aviso aparece de novo para todos). 20/11/2026: o aviso automático mostra só a atualização mais recente
   (HIST[0]); o botão #novid-btn (🔔) abre o histórico inteiro, por data. Fica por cima da capa, fecha no ✕/Entendi,
   é lembrado no navegador. Some no modo apresentação e na impressão. */
(() => {
  "use strict";
  const ID = "2026-11-20b";
  const HIST = [
    { data: "20/11/2026", itens: [
      "Comparativo da composição da malha: novo botão <b>⤢ Ampliar mapa</b>, que mostra o mapa dos lotes em tamanho maior.",
      "<b>Lotes de manutenção:</b> ao abrir um lote pela página inicial, o comparativo da composição da malha mostra o lote escolhido em primeiro e em destaque, só com a malha dentro dele, seguido dos lotes vizinhos e de Goiás. Saiu a linha “Seleção”, que somava os municípios inteiros e passava do total do lote.",
      "O <b>Copiar link</b> de um lote abre o mesmo lote para quem receber.",
    ] },
    { data: "19/11/2026", itens: [
      "Quadros de obras e projetos e de trechos do SRE: clique numa linha e o mapa dá zoom nela, dentro do município.",
      "Mapa: ao afastar o zoom ou arrastar, aparecem todos os municípios de Goiás, com as rodovias, obras e projetos.",
      "Perímetro urbano no mapa agora em branco transparente (antes amarelo), para destacar as rodovias.",
      "Comparativo da composição da malha: escolha ver os valores em <b>Km</b>, em <b>%</b> ou nos dois (<b>Km e %</b>), no canto do quadro.",
      "Legendas e símbolos de obras e projetos no padrão oficial: cor pelo tipo de intervenção e traço pela etapa (Estudo Técnico Preliminar, Licitação, Projeto, Obra), com as placas de OAE e OAC.",
      "Novo botão <b>🖨 Imprimir</b> no modo apresentação: imprime ou salva em PDF a folha do município, ou dos municípios combinados, em A3 deitada.",
      "Zoom (<b>−</b> / <b>Ajustar</b> / <b>+</b>) também na página de um município no modo apresentação; com zoom, arraste para mover.",
      "No modo apresentação, os botões ficam escondidos e aparecem ao mexer o mouse.",
      "Impressora A4: na janela de impressão, escolha “Ajustar à página”.",
    ] },
  ];
  const CHAVE = "novid:" + (location.pathname.split("/")[1] || "local");     // atlas e painel guardam separado
  const css = `
.novid { position: fixed; right: 18px; bottom: 18px; z-index: 5050; width: min(380px, calc(100vw - 32px)); box-sizing: border-box;
  background: #fff; color: #2b2b2b; border: 1px solid #d5dbd7; border-left: 5px solid #00923f; border-radius: 6px;
  box-shadow: 0 6px 24px rgba(0,0,0,.25); padding: 14px 16px 12px; font: 14px/1.45 Arial, sans-serif; text-align: left; }
.novid[hidden] { display: none; }
.novid-tit { font-weight: bold; font-size: 15px; color: #1f5b46; padding-right: 24px; margin-bottom: 6px; }
.novid-data { font-weight: normal; font-size: 13px; color: #898781; }
.novid-lista { margin: 0 0 10px; padding-left: 18px; }
.novid-lista li + li { margin-top: 5px; }
.novid-x { position: absolute; top: 8px; right: 8px; border: 0; background: none; color: #52514e; font-size: 16px; cursor: pointer; padding: 2px 6px; }
.novid-sec { font-weight: bold; font-size: 13px; color: #1f5b46; margin: 10px 0 4px; }
.novid-sec:first-child { margin-top: 0; }
.novid-hist .novid-corpo { max-height: min(60vh, 480px); overflow: auto; padding-right: 6px; }
.novid-ok { font: bold 13px Arial, sans-serif; color: #fff; background: #00923f; border: 0; border-radius: 4px; padding: 6px 14px; cursor: pointer; }
[data-tema=escuro] .novid { background: #24282a; color: #e4e4df; border-color: #363a3d; border-left-color: #6cc59a; box-shadow: 0 6px 24px rgba(0,0,0,.6); }
[data-tema=escuro] .novid-tit, [data-tema=escuro] .novid-sec { color: #6cc59a; }
[data-tema=escuro] .novid-x { color: #b7b6b0; }
html.apres .novid, html.apres-img .novid { display: none !important; }
@media print { .novid { display: none !important; } }
@media (max-width: 600px) { .novid { right: 16px; bottom: 16px; } }`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const c = document.createElement("aside");
  c.id = "novid"; c.className = "novid"; c.hidden = true; c.setAttribute("role", "dialog"); c.setAttribute("aria-labelledby", "novid-tit");
  const lista = it => `<ul class="novid-lista">${it.map(t => `<li>${t}</li>`).join("")}</ul>`;
  c.innerHTML = `<button class="novid-x" type="button" aria-label="Fechar">✕</button>
    <div class="novid-tit" id="novid-tit"></div><div class="novid-corpo"></div>
    <button class="novid-ok" type="button">Entendi</button>`;
  document.body.appendChild(c);
  const tit = c.querySelector(".novid-tit"), corpo = c.querySelector(".novid-corpo");
  // hist = false: só a atualização mais recente; true: todas, da mais nova para a mais antiga, cada uma com a data
  function monta(hist) {
    c.classList.toggle("novid-hist", hist);
    if (hist) {
      tit.innerHTML = "🔔 Histórico de atualizações";
      corpo.innerHTML = HIST.map(h => `<div class="novid-sec">${h.data}</div>${lista(h.itens)}`).join("");
    } else {
      tit.innerHTML = `🔔 Novidades do site <span class="novid-data">· ${HIST[0].data}</span>`;
      corpo.innerHTML = lista(HIST[0].itens);
    }
    corpo.scrollTop = 0;
  }
  const apres = () => /apres/.test(document.documentElement.className);
  function mostra(forcar) {
    if (apres()) return;
    if (!forcar) { try { if (localStorage.getItem(CHAVE) === ID) return; } catch (e) {} }
    monta(!!forcar); c.hidden = false;
  }
  function fecha() { c.hidden = true; try { localStorage.setItem(CHAVE, ID); } catch (e) {} }
  c.querySelector(".novid-x").onclick = fecha;
  c.querySelector(".novid-ok").onclick = fecha;
  const b = document.getElementById("novid-btn");
  if (b) b.onclick = () => (c.hidden || !c.classList.contains("novid-hist")) ? mostra(true) : fecha();
  window.mostraNovidades = mostra;
  setTimeout(() => mostra(false), 800);
})();
