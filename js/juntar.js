import { CATS_BASE } from "./base.js";

export function estadoVazio(agora = Date.now()){
  return { v:2, atualizadoEm: agora, lancamentos:[], fixas:[], apagados:{}, categorias: CATS_BASE.map(c => c.nome), metas:{}, regras:{} };
}

export function migrarV2(e, agora = Date.now()){
  const x = { ...e };
  x.v = 2;
  x.atualizadoEm ||= agora;
  x.lancamentos = (x.lancamentos || []).map(l => l.editadoEm ? l : { ...l, editadoEm: x.atualizadoEm });
  x.fixas = (x.fixas || []).map(f => f.editadoEm ? f : { ...f, editadoEm: x.atualizadoEm });
  x.apagados = { ...(x.apagados || {}) };
  x.categorias = [...(x.categorias || CATS_BASE.map(c => c.nome))];
  x.metas = { ...(x.metas || {}) };
  x.regras = { ...(x.regras || {}) };
  return x;
}

function unirLista(a, b, apagados){
  const m = new Map(a.map(i => [i.id, i]));
  for (const i of b){
    const atual = m.get(i.id);
    if (!atual || (i.editadoEm || 0) > (atual.editadoEm || 0)) m.set(i.id, i);
  }
  return [...m.values()].filter(i => !(apagados[i.id] >= (i.editadoEm || 0)));
}

/* une o que está no aparelho com o que está na nuvem, item por item */
export function juntar(local, nuvem){
  const L = migrarV2(local);
  if (!nuvem) return L;
  const N = migrarV2(nuvem);
  const apagados = { ...N.apagados };
  for (const [id, t] of Object.entries(L.apagados)) apagados[id] = Math.max(apagados[id] || 0, t);
  const recente = (L.atualizadoEm || 0) >= (N.atualizadoEm || 0) ? L : N;
  const categorias = [...L.categorias];
  for (const c of N.categorias) if (!categorias.includes(c)) categorias.push(c);
  return {
    v: 2,
    atualizadoEm: Math.max(L.atualizadoEm || 0, N.atualizadoEm || 0),
    lancamentos: unirLista(L.lancamentos, N.lancamentos, apagados),
    fixas: unirLista(L.fixas, N.fixas, apagados),
    apagados,
    categorias,
    metas: { ...recente.metas },
    regras: { ...recente.regras },
  };
}
