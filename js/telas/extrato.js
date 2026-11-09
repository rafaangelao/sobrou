/* Extrato: lista por dia, estilo app de banco. Funções puras: dados entram, HTML sai. */
import { normalizar } from "../base.js";
import { din, esc, rotuloDia, maiuscula } from "../formato.js";
import { iconeCat, iconeUI, nomeCurto } from "../icones.js";

const maisRecente = (a, b) => b.data.localeCompare(a.data) || String(b.id).localeCompare(String(a.id));

export function filtrarExtrato(itens, { busca = "", filtro = "tudo" } = {}){
  const q = normalizar(busca);
  return itens.filter(l => {
    if (filtro === "saidas" && l.tipo !== "gasto") return false;
    if (filtro === "entradas" && l.tipo !== "entrada") return false;
    if (filtro.startsWith("cat:") && (l.tipo !== "gasto" || (l.categoria || "Outros") !== filtro.slice(4))) return false;
    return !q || normalizar((l.descricao || "") + " " + (l.categoria || "")).includes(q);
  });
}

export function gruposPorDia(itens){
  const m = new Map();
  for (const l of itens.slice().sort(maisRecente)){
    if (!m.has(l.data)) m.set(l.data, []);
    m.get(l.data).push(l);
  }
  return [...m].map(([data, ls]) => ({
    data, itens: ls,
    saldo: Math.round(ls.reduce((t, l) => t + (l.tipo === "entrada" ? 1 : -1) * (Number(l.valor) || 0), 0) * 100) / 100,
  }));
}

export function linhaExtrato(l){
  const mais = l.tipo === "entrada";
  const desc = esc(maiuscula(l.descricao) || (mais ? "Entrada" : "Gasto"));
  const id = esc(l.id);
  return `<div class="lin" data-arrasta data-id="${id}">
    <div class="lin-acoes">
      <button type="button" class="lin-ed" data-acao="editar" data-id="${id}" aria-label="Editar ${desc}">${iconeUI("editar", 18)}</button>
      <button type="button" class="lin-ap" data-acao="apagar" data-id="${id}" aria-label="Apagar ${desc}">${iconeUI("apagar", 18)}</button>
    </div>
    <button type="button" class="lin-frente" data-acao="editar" data-id="${id}">
      ${iconeCat(l.categoria, { entrada: mais })}
      <span class="lin-txt"><b>${desc}</b><small>${mais ? "Entrada" : esc(l.categoria || "Outros")}</small></span>
      <span class="lin-val${mais ? " mais" : ""}">${din(l.valor, mais ? "+" : "−")}</span>
    </button>
  </div>`;
}

export function listaExtrato(itens, hoje, busca = ""){
  if (!itens.length) return `<p class="nada">${busca.trim() ? "Nada encontrado para “" + esc(busca.trim()) + "”." : "Nada com esse filtro."}</p>`;
  return gruposPorDia(itens).map(g =>
    `<div class="dia"><span>${rotuloDia(g.data, hoje)}</span>${din(Math.abs(g.saldo), g.saldo >= 0 ? "+" : "−")}</div>${g.itens.map(linhaExtrato).join("")}`).join("");
}

/* um filtro de categoria que este período não tem vira "tudo" — a tela e a busca usam o mesmo */
export function filtroValido(itens, filtro = "tudo"){
  if (!filtro.startsWith("cat:")) return filtro;
  return itens.some(l => l.tipo === "gasto" && (l.categoria || "Outros") === filtro.slice(4)) ? filtro : "tudo";
}

export function telaExtrato({ itens, hoje, busca = "", filtro = "tudo", rotuloPeriodo = "" }){
  if (!itens.length) return `<section class="convite"><h2>Nada lançado ${esc(rotuloPeriodo)}</h2>
    <p>Toque no + para lançar um gasto ou um recebimento.</p>
    <button class="btn btn-forte" type="button" data-acao="lancar">Lançar agora</button></section>`;
  const cats = [...new Set(itens.filter(l => l.tipo === "gasto").map(l => l.categoria || "Outros"))];
  filtro = filtroValido(itens, filtro);
  const chips = [["tudo", "Tudo"], ["saidas", "Saídas"], ["entradas", "Entradas"], ...cats.map(c => ["cat:" + c, nomeCurto(c)])]
    .map(([f, r]) => `<button type="button" class="chip-f" data-acao="filtro" data-f="${esc(f)}" aria-pressed="${f === filtro}">${esc(r)}</button>`).join("");
  return `<div class="busca">${iconeUI("busca", 18)}<input id="busca-extrato" type="search" value="${esc(busca)}" placeholder="Buscar ifood, mercado…" aria-label="Buscar no extrato" autocomplete="off" enterkeyhint="search"></div>
    <div class="chips-f">${chips}</div>
    <div id="extrato-lista">${listaExtrato(filtrarExtrato(itens, { busca, filtro }), hoje, busca)}</div>`;
}
