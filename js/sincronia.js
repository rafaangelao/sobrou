import { juntar } from "./juntar.js";

/* JSON com chaves em ordem: o jsonb do Postgres não guarda a ordem das chaves */
const estavel = v => JSON.stringify(v, (_k, x) =>
  x && typeof x === "object" && !Array.isArray(x)
    ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : x);

/* lê a nuvem, junta com o local e grava com trava de versão.
   Se outro aparelho gravou no meio, tenta de novo. */
export async function sincronizar(api, local, tentativas = 3){
  for (let i = 0; i < tentativas; i++){
    const nuvem = await api.ler();
    const unido = juntar(local, nuvem ? nuvem.dados : null);
    if (nuvem && estavel(unido) === estavel(juntar(nuvem.dados, null)))
      return { estado: unido, ok: true };            /* nada novo: não grava */
    const gravou = nuvem ? await api.atualizar(unido, nuvem.versao) : await api.inserir(unido);
    if (gravou) return { estado: unido, ok: true };
  }
  return { estado: local, ok: false };
}
