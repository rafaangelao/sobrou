/* Animações do Sobrou. Nenhuma passa de 500ms (o número contando, no painel, tem 700ms)
   e todas viram troca simples com "Reduzir movimento". */
export const semMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const depois = fn => requestAnimationFrame(() => requestAnimationFrame(fn));

/* faixa: ao entrar na tela cresce pedaço por pedaço; ao trocar de mês estica do tamanho antigo */
const pesos = new Map();
export function desenharFaixa(raiz, nova){
  raiz.querySelectorAll(".faixa-pd").forEach((p, i) => {
    const alvo = p.style.getPropertyValue("--p");
    const de = nova ? "0.001" : (pesos.get(p.dataset.k) || "0.001");
    pesos.set(p.dataset.k, alvo);
    if (semMovimento()) return;
    p.style.transition = "none";
    p.style.flexGrow = de;
    depois(() => {
      p.style.transition = `flex-grow .5s var(--mola-forte) ${nova ? i * 90 : 0}ms`;
      p.style.flexGrow = alvo;
    });
  });
}

/* botão Lançar: carregando → check */
export function botaoCheck(btn){
  if (semMovimento()) return Promise.resolve();
  const rot = btn.textContent;
  btn.classList.add("carregando");
  return new Promise(pronto => setTimeout(() => {
    btn.classList.replace("carregando", "ok");
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" pointer-events="none"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    setTimeout(() => {
      pronto();
      setTimeout(() => { btn.classList.remove("ok"); btn.textContent = rot; }, 320);
    }, 260);
  }, 200));
}

/* o ícone tocado "voa" até o topo da folha (Safari 18+); sem suporte, a folha só sobe */
export function comTransicao(origem, mudar){
  if (!document.startViewTransition || semMovimento() || !origem){ mudar(); return; }
  let feito = false;
  const uma = () => { if (feito) return; feito = true; origem.style.viewTransitionName = ""; mudar(); };
  origem.style.viewTransitionName = "ic-detalhe";
  document.startViewTransition(uma);
  /* se o navegador não pintar (aba escondida, aparelho lento), abre assim mesmo */
  setTimeout(uma, 300);
}

/* arrastar a folha para baixo (pela alça ou pelo título) fecha */
export function arrastarParaFechar(folha, fechar){
  let y0 = null, dy = 0;
  folha.addEventListener("pointerdown", e => {
    if (!e.target.closest(".alca,[data-puxa]") || e.target.closest("button")) return;
    y0 = e.clientY; dy = 0;
    try { folha.setPointerCapture(e.pointerId); } catch {}
  });
  folha.addEventListener("pointermove", e => {
    if (y0 === null) return;
    dy = Math.max(0, e.clientY - y0);
    folha.style.transition = "none";
    folha.style.transform = `translateY(${dy}px)`;
  });
  const soltar = () => {
    if (y0 === null) return;
    y0 = null;
    folha.style.transition = "transform .3s var(--mola-forte)";
    if (dy > 110){ folha.style.transform = "translateY(110%)"; setTimeout(fechar, 180); }
    else folha.style.transform = "";
  };
  folha.addEventListener("pointerup", soltar);
  folha.addEventListener("pointercancel", soltar);
}

/* extrato: arrastar a linha para a esquerda mostra Editar e Apagar */
const ABRE = 112;
export function ligarArrastarLinhas(raiz){
  let lin = null, x0 = 0, y0 = 0, dx = 0, modo = "";
  const frente = l => l.querySelector(".lin-frente");
  const fechar = l => { l.classList.remove("aberta"); frente(l).style.transform = ""; };
  raiz.addEventListener("pointerdown", e => {
    const l = e.target.closest(".lin[data-arrasta]");
    if (!l || e.pointerType === "mouse" || e.target.closest(".lin-acoes")) return;
    lin = l; x0 = e.clientX; y0 = e.clientY; dx = 0; modo = "";
  });
  raiz.addEventListener("pointermove", e => {
    if (!lin) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!modo){
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      modo = Math.abs(mx) > Math.abs(my) ? "lado" : "rola";
      if (modo === "lado"){
        raiz.querySelectorAll(".lin.aberta").forEach(o => { if (o !== lin) fechar(o); });
        try { lin.setPointerCapture(e.pointerId); } catch {}
        frente(lin).style.transition = "none";
      }
    }
    if (modo !== "lado") return;
    const base = lin.classList.contains("aberta") ? -ABRE : 0;
    dx = Math.min(0, Math.max(-ABRE * 1.2, base + mx));
    frente(lin).style.transform = `translateX(${dx}px)`;
  });
  const soltar = () => {
    if (!lin) return;
    const l = lin; lin = null;
    if (modo !== "lado") return;
    const f = frente(l);
    f.style.transition = "";
    const abre = -dx > ABRE * 0.4;
    l.classList.toggle("aberta", abre);
    f.style.transform = abre ? `translateX(${-ABRE}px)` : "";
    l._arrastou = true;
    setTimeout(() => { l._arrastou = false; }, 60);
  };
  raiz.addEventListener("pointerup", soltar);
  raiz.addEventListener("pointercancel", soltar);
  /* arrastar não pode virar toque; tocar numa linha aberta só fecha */
  raiz.addEventListener("click", e => {
    const l = e.target.closest(".lin[data-arrasta]");
    if (!l) return;
    const abertaNaFrente = l.classList.contains("aberta") && e.target.closest(".lin-frente");
    if (l._arrastou || abertaNaFrente){
      e.stopPropagation(); e.preventDefault();
      if (abertaNaFrente && !l._arrastou) fechar(l);
    }
  }, true);
}

/* olho: os valores desfocam antes de virar R$ ••• */
export function trocarComDesfoque(alvo, trocar){
  if (semMovimento()){ trocar(); return; }
  alvo.classList.add("desfocando");
  setTimeout(() => { trocar(); depois(() => alvo.classList.remove("desfocando")); }, 160);
}
