import { somarMeses, mesesEntre, diasNoMes, mesDe, normalizar } from "./base.js";

export const ATE_PADRAO = "2027-12";

export function ultimoMes(f){
  return f.tipo === "parcelado" ? somarMeses(f.inicio, f.parcelas - 1) : (f.fim || null);
}

export function parcelaNoMes(f, mes){
  if (f.tipo !== "parcelado") return null;
  const k = mesesEntre(f.inicio, mes) + 1;
  return k >= 1 && k <= f.parcelas ? k : null;
}

export function ativaNoMes(f, mes){
  if (mesesEntre(f.inicio, mes) < 0) return false;
  const fim = ultimoMes(f);
  return !fim || mesesEntre(mes, fim) >= 0;
}

export function vencimento(f, mes){
  const [a, m] = mes.split("-").map(Number);
  return mes + "-" + String(Math.min(f.dia, diasNoMes(a, m))).padStart(2, "0");
}

export function ocorrencias(fixas, lancamentos, mes, hoje){
  const out = [];
  for (const f of fixas){
    if (!ativaNoMes(f, mes)) continue;
    const pago = lancamentos.find(l => l.fixaId === f.id && l.fixaMes === mes) || null;
    const venc = vencimento(f, mes);
    out.push({
      fixa: f, mes,
      parcela: parcelaNoMes(f, mes),
      valor: pago ? pago.valor : f.valor,
      vencimento: venc,
      situacao: pago ? "pago" : venc < hoje ? "atrasado" : "a-pagar",
      lancamento: pago,
    });
  }
  return out.sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.fixa.nome.localeCompare(b.fixa.nome));
}

export function resumoDoMes(ocs){
  const r = { total: 0, pago: 0, aPagar: 0, atrasado: 0 };
  for (const o of ocs){
    r.total += o.valor;
    if (o.situacao === "pago") r.pago += o.valor;
    else { r.aPagar += o.valor; if (o.situacao === "atrasado") r.atrasado += o.valor; }
  }
  for (const k of Object.keys(r)) r[k] = Math.round(r[k] * 100) / 100;
  return r;
}

export function mesesDaFaixa(hoje, ate = ATE_PADRAO){
  const ini = mesDe(hoje);
  const fim = mesesEntre(ini, ate) >= 0 ? ate : ini;
  const out = [];
  for (let m = ini; mesesEntre(m, fim) >= 0; m = somarMeses(m, 1)) out.push(m);
  return out;
}

export function pendentesAnteriores(fixas, lancamentos, hoje){
  if (!fixas.length) return [];
  const atual = mesDe(hoje);
  let m = fixas.map(f => f.inicio).sort()[0];
  const out = [];
  for (; mesesEntre(m, atual) > 0; m = somarMeses(m, 1))
    out.push(...ocorrencias(fixas, lancamentos, m, hoje).filter(o => o.situacao !== "pago"));
  return out;
}

export function descricaoPagamento(o){
  return o.parcela ? `${o.fixa.nome} (${o.parcela}/${o.fixa.parcelas})` : o.fixa.nome;
}

/* devolve o lançamento a criar, ou null se já está pago (protege do toque duplo) */
export function pagar(estado, fixaId, mes, hoje, id, agora){
  if (estado.lancamentos.some(l => l.fixaId === fixaId && l.fixaMes === mes)) return null;
  const f = estado.fixas.find(x => x.id === fixaId);
  if (!f || !ativaNoMes(f, mes)) return null;
  const [o] = ocorrencias([f], [], mes, hoje);
  return {
    id, tipo: "gasto",
    data: o.vencimento < hoje ? hoje : o.vencimento,
    categoria: f.categoria,
    descricao: descricaoPagamento(o),
    valor: f.valor,
    fixaId: f.id, fixaMes: mes,
    editadoEm: agora,
  };
}

/* linha do extrato que é uma fixa ainda não paga daquele mês */
export function casarComFixa(linha, ocs, chave){
  const desc = normalizar(linha.descricao);
  const k = chave(linha.descricao);
  const mParc = String(linha.descricao).match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
  return ocs.find(o => {
    if (o.situacao === "pago" || Math.abs(o.fixa.valor - linha.valor) > 0.5) return false;
    const nome = normalizar(o.fixa.nome);
    if (k && k === chave(o.fixa.nome)) return true;
    if (nome && desc.includes(nome)) return true;
    return !!(mParc && o.parcela && +mParc[1] === o.parcela && +mParc[2] === o.fixa.parcelas);
  }) || null;
}
