/* Aviso de novidades — ATUALIZAR A CADA PUBLICAÇÃO: pôr os itens do dia no topo de HIST (data dd/mm/aaaa).
   20/11/2026: o aviso automático mostra só a atualização mais recente (HIST[0]); o botão #novid-btn (🔔) abre o
   histórico inteiro, por data. "Entendi"/✕ vale para a DATA de HIST[0]: o aviso só volta a abrir sozinho quando entrar
   um bloco com data nova (itens a mais no mesmo dia não reabrem). Guardado em localStorage e, de reserva, num cookie.
   Fica por cima da capa. Some no modo apresentação e na impressão. */
(() => {
  "use strict";
  const HIST = [
    { data: "23/11/2026", itens: [
      "Quadros de trechos do SRE e de obras e projetos: ao clicar numa linha, o item fica em destaque no mapa com a simbologia original, uma sombra por baixo e o restante do mapa escurecido; início e fim aparecem marcados (com o Km no SRE) e uma caixa mostra o resumo. Na caixa, escolha ver só a parte <b>no município</b> (ou no lote), com a extensão dentro dele, ou o item <b>inteiro</b>, com a extensão total declarada na obra ou no projeto, os municípios por onde passa e as divisas marcadas. O mesmo destaque aparece ao clicar direto numa obra ou num projeto no mapa, na linha ou na placa das obras e projetos pontuais; se ela estiver em outro município, a página passa para esse município. A caixa pode ser arrastada. Para desfazer a seleção, basta clicar fora do item no mapa (ou no <b>✕</b>, ou a tecla Esc); clicar em outra obra ou projeto já seleciona o novo.",
      "Abas verdes com setas <b>❮ ❯</b> ao lado do mapa, agora maiores e mais visíveis: recolhem ou abrem os painéis da esquerda e da direita para o mapa ganhar espaço.",
      "Novo: botão de <b>camadas</b> no mapa, ao lado de <b>Coordenadas</b>, para trocar o fundo: Satélite (padrão), Satélite + nomes, OpenStreetMap, Ruas (claro) ou Topográfico.",
      "Mapa com visual novo: os botões de visualização (aproximar/afastar, <b>Município</b>, <b>Expandir mapa</b> e <b>Coordenadas</b>) agora ficam numa barra no alto do mapa, e a escala numérica fica embaixo, junto da barra de escala.",
      "Barra de escala do mapa mais fácil de ler: números centralizados em cada divisão, com tracinhos, e caixa ajustada ao tamanho da barra.",
    ] },
    { data: "20/11/2026", itens: [
      "O botão <b>🔔 Novidades</b> agora fica na barra verde do topo, entre o tema e o <b>Sobre os dados</b>; ele mostra o histórico de atualizações.",
      "Comparativo da composição da malha: clique no mapa dos lotes (ou no botão <b>⤢</b> ao lado dos nomes, embaixo dele) para vê-lo em tamanho maior; passe o mouse sobre um município para ver o nome; com poucas linhas, as barras ficam maiores e mais fáceis de ler.",
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
  const CK = CHAVE.replace(/[^\w-]/g, "_");
  function visto() {                     // data da última atualização já fechada neste navegador
    const dt = v => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v); return m ? `${m[3]}/${m[2]}/${m[1]}` : v; };  // id antigo "2026-11-20b"
    try { const v = localStorage.getItem(CHAVE); if (v) return dt(v); } catch (e) {}
    try { const m = document.cookie.match(new RegExp("(?:^|; )" + CK + "=([^;]*)")); if (m) return decodeURIComponent(m[1]); } catch (e) {}
    return null;
  }
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
    if (!forcar && visto() === HIST[0].data) return;
    monta(!!forcar); c.hidden = false;
  }
  function fecha() {
    c.hidden = true; const v = HIST[0].data;
    try { localStorage.setItem(CHAVE, v); } catch (e) {}
    try { document.cookie = CK + "=" + encodeURIComponent(v) + "; max-age=31536000; path=/; SameSite=Lax"; } catch (e) {}
  }
  c.querySelector(".novid-x").onclick = fecha;
  c.querySelector(".novid-ok").onclick = fecha;
  const b = document.getElementById("novid-btn");
  if (b) b.onclick = () => (c.hidden || !c.classList.contains("novid-hist")) ? mostra(true) : fecha();
  window.mostraNovidades = mostra;
  setTimeout(() => mostra(false), 800);
})();
