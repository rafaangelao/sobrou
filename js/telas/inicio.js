/* Início: o Raio-X do mês. Função pura: dados entram, HTML sai. */
import { mesDe } from "../base.js";
import { brl, din, esc, pct, pctTxt, rotuloDia, MESES } from "../formato.js";
import { iconeCat, iconeUI, nomeCurto } from "../icones.js";
import { porCategoria, agruparPorLugar, chaveLugar, compararPeriodo, faixaCategorias, porSemana, dicaCorte } from "../raiox.js";

const ehGasto = l => l.tipo === "gasto";
const soma = arr => arr.reduce((t, l) => t + (Number(l.valor) || 0), 0);
const doPeriodo = (lancs, periodo) => periodo === "tudo" ? lancs : lancs.filter(l => mesDe(l.data) === periodo);
const nomeMes = periodo => MESES[+periodo.slice(5) - 1];
const vezes = n => n + (n === 1 ? " vez" : " vezes");
const maisRecente = (a, b) => b.data.localeCompare(a.data) || String(b.id).localeCompare(String(a.id));

const textoComparacao = c => c.sentido === "igual" ? "igual " + c.rotulo : `${brl(c.diferenca)} a ${c.sentido} que ${c.rotulo}`;
const curta = c => c.sentido === "igual" ? "igual" : din(c.diferenca, c.sentido === "mais" ? "+" : "−");

function avisoFixas(f){
  if (!f) return "";
  const quando = f.atrasado ? " · tem atrasada" : f.ateDia ? " até dia " + f.ateDia : "";
  return `<button type="button" class="aviso-fixas" data-t="${f.atrasado ? "grave" : ""}" data-acao="ir" data-aba="fixas">
    ${iconeUI("fixas", 18)}<span>${f.qtd} fixa${f.qtd === 1 ? "" : "s"} a pagar · ${din(f.valor)}${quando}</span>${iconeUI("seta", 16)}</button>`;
}

function blocoFaixa(gastos){
  const fx = faixaCategorias(porCategoria(gastos));
  const alvo = s => s.agrupado ? `data-acao="todas-cats"` : `data-acao="detalhe" data-tipo="cat" data-chave="${esc(s.nome)}"`;
  const pedacos = fx.map(s =>
    `<button type="button" class="faixa-pd" style="--p:${s.pct.toFixed(2)};--c:${s.cor}" data-k="${esc(s.nome)}" ${alvo(s)} aria-label="${esc(s.nome)} ${pctTxt(s.pct)}"></button>`).join("");
  const top = fx.slice(0, 4), resto = fx.length - top.length;
  const pilulas = top.map(s => `<button type="button" class="pilula" ${alvo(s)}><i style="--c:${s.cor}"></i>${esc(nomeCurto(s.nome))} ${pctTxt(s.pct)}</button>`).join("")
    + (resto > 0 ? `<button type="button" class="pilula" data-acao="todas-cats">+${resto}</button>` : "");
  return `<section class="bloco"><div class="faixa">${pedacos}</div><div class="pilulas">${pilulas}</div></section>`;
}

function blocoTop(lancamentos, gastos, periodo, hoje){
  const lugares = agruparPorLugar(gastos.filter(g => g.categoria !== "Guardar dinheiro")).slice(0, 3);
  if (!lugares.length) return "";
  const linhas = lugares.map(l => {
    const c = compararPeriodo(lancamentos, periodo, hoje, x => ehGasto(x) && chaveLugar(x.descricao) === l.chave);
    return `<button type="button" class="linha" data-acao="detalhe" data-tipo="lugar" data-chave="${esc(l.chave)}">
      ${iconeCat(l.categoria)}
      <span class="linha-txt"><b>${esc(l.nome)}</b><small>${vezes(l.qtd)} · média ${din(l.media)}</small></span>
      <span class="linha-val"><b>${din(l.total)}</b>${c ? `<small data-s="${c.sentido}">${curta(c)}</small>` : ""}</span>
    </button>`;
  }).join("");
  return `<section class="bloco"><h2>Os 3 que mais pesaram</h2><div class="linhas">${linhas}</div></section>`;
}

export function telaInicio({ lancamentos, periodo, hoje, fixas = null }){
  const itens = doPeriodo(lancamentos, periodo);
  const aviso = avisoFixas(fixas);
  if (!itens.length) return aviso + `
    <section class="convite">
      <h2>Nada lançado ${periodo === "tudo" ? "ainda" : "em " + nomeMes(periodo)}</h2>
      <p>Toque no + e lance o primeiro gasto${periodo === "tudo" ? "" : " de " + nomeMes(periodo)}. O Sobrou calcula o resto.</p>
      <button class="btn btn-forte" type="button" data-acao="lancar">Lançar agora</button>
    </section>`;

  const gastos = itens.filter(ehGasto);
  const tg = soma(gastos), te = soma(itens.filter(l => l.tipo === "entrada")), saldo = te - tg;
  const comp = compararPeriodo(lancamentos, periodo, hoje, ehGasto);
  const heroi = `
    <section class="heroi">
      <div class="heroi-rot">${periodo === "tudo" ? "Saiu no total" : "Saiu em " + nomeMes(periodo)}</div>
      <div class="heroi-val din" data-conta="saiu">${brl(tg)}</div>
      ${comp ? `<div class="heroi-comp" data-s="${comp.sentido}">${textoComparacao(comp)}</div>` : ""}
      <div class="heroi-pe">Entrou ${din(te)} · ${saldo >= 0 ? "Sobrou" : "Faltou"} ${din(Math.abs(saldo))}</div>
    </section>`;
  if (!gastos.length) return heroi + aviso + `<p class="nada">Nenhum gasto ${periodo === "tudo" ? "lançado" : "em " + nomeMes(periodo)} ainda.</p>`;
  return heroi + blocoFaixa(gastos) + blocoTop(lancamentos, gastos, periodo, hoje) + aviso;
}

export function folhaDetalhe({ lancamentos, periodo, hoje, tipo, chave }){
  const gastos = doPeriodo(lancamentos, periodo).filter(ehGasto);
  const pertence = tipo === "lugar" ? g => chaveLugar(g.descricao) === chave : g => (g.categoria || "Outros") === chave;
  const itens = gastos.filter(pertence).sort(maisRecente);
  if (!itens.length) return null;

  const lugar = tipo === "lugar" ? agruparPorLugar(itens)[0] : null;
  const nome = lugar ? lugar.nome : chave;
  const total = soma(itens);
  const comp = compararPeriodo(lancamentos, periodo, hoje, l => ehGasto(l) && pertence(l));
  const sem = porSemana(itens, periodo);
  const maior = sem ? Math.max(...sem.map(s => s.total), 0) : 0;
  const dica = dicaCorte(lugar);
  const semanas = !sem ? "" : `<div class="semanas">${sem.map((s, i) =>
    `<button type="button" class="sem" data-acao="semana" aria-pressed="false" style="--h:${maior ? (s.total / maior * 100).toFixed(1) : 0}%;--k:${i}" data-v="${esc(brl(s.total))}" aria-label="${s.rot}: ${esc(brl(s.total))}"><i></i><span>${s.rot}</span></button>`).join("")}</div>`;

  return `
  <div class="folha folha-detalhe" role="dialog" aria-modal="true" aria-labelledby="det-tit">
    <div class="alca" aria-hidden="true"></div>
    <div class="det-topo" data-puxa>${iconeCat(lugar ? lugar.categoria : chave, { vt: "ic-detalhe" })}<h2 id="det-tit">${esc(nome)}</h2>
      <button type="button" class="icone" data-acao="fechar" aria-label="Fechar">${iconeUI("fechar", 20)}</button></div>
    <div class="det-total din">${brl(total)}</div>
    <p class="sub">${vezes(itens.length)} ${periodo === "tudo" ? "no total" : "em " + nomeMes(periodo)} · ${pctTxt(pct(total, soma(gastos)))} de tudo que saiu</p>
    ${comp ? `<p class="heroi-comp" data-s="${comp.sentido}">${textoComparacao(comp)}</p>` : ""}
    ${semanas}
    <div class="det-lista">${itens.map(l => `<button type="button" class="det-item" data-acao="editar" data-id="${esc(l.id)}"><span>${rotuloDia(l.data, hoje)}${tipo === "cat" ? " · " + esc(l.descricao) : ""}</span>${din(l.valor)}</button>`).join("")}</div>
    ${dica ? `<p class="dica">${iconeUI("economizar", 16)}<span>Se cortar ${vezes(dica.n)}, sobram uns ${din(dica.valor)} a mais no mês.</span></p>` : ""}
  </div>`;
}
