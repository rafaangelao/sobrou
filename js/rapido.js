import { normalizar, RE_ENTRADA, diasNoMes, somarDias } from "./base.js";

const RE_ENTRADA_RAPIDO = new RegExp(RE_ENTRADA.source + "|freela|recebi");
const RE_VALOR = /(?:r\$\s*)?(?<![\p{L}\d.,\/])(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\p{L}\d\/])/giu;
const pad = n => String(n).padStart(2, "0");

function lerNumero(s){
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  return Number(s);
}

/* "ifood 42,90 ontem" → { tipo, valor, data, descricao, categoria, origem, parcelas } */
export function lerLinha(texto, hoje, classificar){
  let t = " " + String(texto || "").trim() + " ";
  if (!t.trim()) return null;

  let entrada = false;
  if (/^\s*\+/.test(t)){ entrada = true; t = t.replace(/^\s*\+/, " "); }

  let parcelas = null;
  t = t.replace(/\s(?:em\s+)?(\d{1,3})\s*x(?=\s)/i, (_, n) => { parcelas = +n; return " "; });

  const [a, m] = hoje.split("-").map(Number);
  let data = hoje, achou = false;
  t = t.replace(/\s(anteontem|ontem|hoje)(?=\s)/i, (_, w) => {
    achou = true; const x = w.toLowerCase();
    data = x === "hoje" ? hoje : somarDias(hoje, x === "ontem" ? -1 : -2);
    return " ";
  });
  if (!achou) t = t.replace(/\sdia\s+(\d{1,2})(?=\s)/i, (_, d) => {
    achou = true;
    data = `${a}-${pad(m)}-${pad(Math.min(Math.max(+d, 1), diasNoMes(a, m)))}`;
    return " ";
  });
  if (!achou) t = t.replace(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/, (tudo, d, mm, aa) => {
    const ano = aa ? (aa.length === 2 ? 2000 + +aa : +aa) : a;
    if (+mm < 1 || +mm > 12 || +d < 1 || +d > diasNoMes(ano, +mm)) return tudo;
    data = `${ano}-${pad(mm)}-${pad(d)}`;
    return " ";
  });

  const achados = [...t.matchAll(RE_VALOR)];
  if (!achados.length) return null;
  const ult = achados[achados.length - 1];
  const valor = Math.round(lerNumero(ult[1]) * 100) / 100;
  if (!(valor > 0)) return null;
  t = t.slice(0, ult.index) + " " + t.slice(ult.index + ult[0].length);

  let descricao = t.replace(/\s+/g, " ").trim()
    .replace(/^(de|em|no|na)\s+/i, "").replace(/\s+(de|em|no|na)$/i, "");
  const tipo = entrada || RE_ENTRADA_RAPIDO.test(normalizar(descricao)) ? "entrada" : "gasto";
  if (!descricao) descricao = tipo === "entrada" ? "Entrada" : "Gasto";
  const { categoria, origem } = tipo === "gasto" ? classificar(descricao) : { categoria: "", origem: "" };
  return { tipo, valor, data, descricao, categoria, origem, parcelas };
}
