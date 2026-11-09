/* Raio-X do mês: para onde foi o dinheiro — cálculos puros, testados em testes/raiox.test.js */
import { normalizar, chaveComerciante, mesDe, diasNoMes, somarMeses } from "./base.js";
import { MESES, maiuscula } from "./formato.js";
import { corDe } from "./icones.js";

/* Não sugerimos cortar estas: dízimo é decisão pessoal, poupança não é gasto. */
export const NAO_CORTAR = ["Igreja", "Guardar dinheiro"];

const arred = v => Math.round(v * 100) / 100;
const pad = n => String(n).padStart(2, "0");
const soma = arr => arr.reduce((t, l) => t + (Number(l.valor) || 0), 0);
const maisRecente = (a, b) => b.data.localeCompare(a.data) || String(b.id).localeCompare(String(a.id));

export function porCategoria(gastos){
  const m = new Map();
  for (const g of gastos){
    const k = g.categoria || "Outros";
    m.set(k, (m.get(k) || 0) + (Number(g.valor) || 0));
  }
  return [...m].map(([nome, total]) => ({ nome, total, cor: corDe(nome) })).sort((a, b) => b.total - a.total);
}

/* "ifood 35" e "COMPRA CARTAO IFOOD *IFOOD" são o mesmo lugar */
export const chaveLugar = desc => chaveComerciante(desc) || normalizar(desc) || "-";

export function agruparPorLugar(gastos){
  const grupos = new Map();
  for (const g of gastos){
    const k = chaveLugar(g.descricao);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(g);
  }
  return [...grupos].map(([chave, itens]) => {
    itens.sort(maisRecente);
    const vezes = new Map();
    for (const g of itens) vezes.set(g.categoria || "Outros", (vezes.get(g.categoria || "Outros") || 0) + 1);
    const max = Math.max(...vezes.values());
    const categoria = itens.find(g => vezes.get(g.categoria || "Outros") === max).categoria || "Outros";
    const total = arred(soma(itens));
    return { chave, nome: maiuscula(itens[0].descricao) || "Sem descrição", categoria,
             total, qtd: itens.length, media: arred(total / itens.length), itens };
  }).sort((a, b) => b.total - a.total || b.qtd - a.qtd || a.nome.localeCompare(b.nome, "pt-BR"));
}

/* no dia 9, novembro se compara com 1 a 9 de outubro — não com outubro inteiro */
export function trechoComparavel(periodo, hoje){
  if (!/^\d{4}-\d{2}$/.test(periodo)) return null;
  const agora = mesDe(hoje);
  if (periodo > agora) return null;
  const ant = somarMeses(periodo, -1);
  const [aa, ma] = ant.split("-").map(Number);
  if (periodo === agora){
    const fim = Math.min(+hoje.slice(8), diasNoMes(aa, ma));
    return { atual: { de: periodo + "-01", ate: hoje },
             anterior: { de: ant + "-01", ate: ant + "-" + pad(fim) },
             rotulo: "até " + fim + " de " + MESES[ma - 1] };
  }
  const [a, m] = periodo.split("-").map(Number);
  return { atual: { de: periodo + "-01", ate: periodo + "-" + pad(diasNoMes(a, m)) },
           anterior: { de: ant + "-01", ate: ant + "-" + pad(diasNoMes(aa, ma)) },
           rotulo: "em " + MESES[ma - 1] };
}

export function comparar(atual, anterior){
  const d = arred(atual - anterior);
  return { diferenca: Math.abs(d), sentido: Math.abs(d) < 1 ? "igual" : d > 0 ? "mais" : "menos" };
}

const noTrecho = (l, t) => l.data >= t.de && l.data <= t.ate;
export function compararPeriodo(lancamentos, periodo, hoje, escolher){
  const t = trechoComparavel(periodo, hoje);
  if (!t) return null;
  const mesAnterior = t.anterior.de.slice(0, 7);
  if (!lancamentos.some(l => mesDe(l.data) === mesAnterior)) return null;
  const atual = soma(lancamentos.filter(l => escolher(l) && noTrecho(l, t.atual)));
  const anterior = soma(lancamentos.filter(l => escolher(l) && noTrecho(l, t.anterior)));
  return { ...comparar(atual, anterior), rotulo: t.rotulo };
}

/* pedaços da faixa: os menores que `minimo`% viram um só "Outros" (a lista completa continua com todos) */
export function faixaCategorias(cats, minimo = 3){
  const total = cats.reduce((t, c) => t + c.total, 0);
  if (!(total > 0)) return [];
  const grandes = [], resto = { total: 0, nomes: [] };
  for (const c of cats){
    if (c.nome === "Outros" || c.total / total * 100 < minimo){ resto.total += c.total; resto.nomes.push(c.nome); }
    else grandes.push({ ...c, pct: c.total / total * 100 });
  }
  if (resto.total > 0) grandes.push({ nome: "Outros", total: arred(resto.total), cor: "var(--c0)",
    pct: resto.total / total * 100, agrupado: resto.nomes.some(n => n !== "Outros") });
  return grandes;
}

export function porSemana(gastos, periodo){
  if (!/^\d{4}-\d{2}$/.test(periodo)) return null;
  const [a, m] = periodo.split("-").map(Number);
  const sem = ["1–7", "8–14", "15–21", "22–" + diasNoMes(a, m)].map(rot => ({ rot, total: 0 }));
  for (const g of gastos){
    if (mesDe(g.data) !== periodo) continue;
    const d = +g.data.slice(8);
    sem[d <= 7 ? 0 : d <= 14 ? 1 : d <= 21 ? 2 : 3].total += Number(g.valor) || 0;
  }
  for (const s of sem) s.total = arred(s.total);
  return sem;
}

/* "Se cortar 4 vezes, sobram uns R$ 140" — um terço das vezes, arredondado */
export function dicaCorte(lugar){
  if (!lugar || lugar.qtd < 4 || NAO_CORTAR.includes(lugar.categoria)) return null;
  const n = Math.round(lugar.qtd / 3);
  return { n, valor: arred(lugar.media * n) };
}
