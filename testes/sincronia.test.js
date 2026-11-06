import { test } from "node:test";
import assert from "node:assert/strict";
import { sincronizar } from "../js/sincronia.js";
import { estadoVazio } from "../js/juntar.js";

const L = (id, t = 1) => ({ id, tipo:"gasto", data:"2026-11-01", categoria:"Lazer", descricao:id, valor:10, editadoEm:t });
const est = (ids, at = 100) => ({ ...estadoVazio(at), lancamentos: ids.map(i => L(i)) });

function nuvemFalsa(inicial = null){
  const n = { linha: inicial, gravacoes: 0, roubar: 0 };
  n.api = {
    async ler(){ return n.linha && structuredClone(n.linha); },
    async inserir(dados){ if (n.linha) return false; n.linha = { dados, versao: 1 }; n.gravacoes++; return true; },
    async atualizar(dados, v){
      if (n.roubar > 0){ n.roubar--; n.linha = { dados: n.linha.dados, versao: n.linha.versao + 1 }; return false; }
      if (n.linha.versao !== v) return false;
      n.linha = { dados, versao: v + 1 }; n.gravacoes++; return true;
    },
  };
  return n;
}

test("primeira vez: insere o estado local", async () => {
  const n = nuvemFalsa();
  const r = await sincronizar(n.api, est(["a", "b"]));
  assert.equal(r.ok, true);
  assert.equal(n.linha.dados.lancamentos.length, 2);
});

test("nuvem já tem caderno de outro aparelho: nada local se perde", async () => {
  const n = nuvemFalsa({ dados: est(["celular"]), versao: 3 });
  const r = await sincronizar(n.api, est(["pc1", "pc2"]));
  assert.equal(r.ok, true);
  assert.deepEqual(r.estado.lancamentos.map(x => x.id).sort(), ["celular", "pc1", "pc2"]);
  assert.equal(n.linha.versao, 4);
});

test("conflito uma vez: lê de novo, junta e grava", async () => {
  const n = nuvemFalsa({ dados: est(["x"]), versao: 1 });
  n.roubar = 1;
  const r = await sincronizar(n.api, est(["meu"]));
  assert.equal(r.ok, true);
  assert.deepEqual(r.estado.lancamentos.map(x => x.id).sort(), ["meu", "x"]);
});

test("conflito três vezes: desiste sem perder o local", async () => {
  const n = nuvemFalsa({ dados: est(["x"]), versao: 1 });
  n.roubar = 3;
  const local = est(["meu"]);
  const r = await sincronizar(n.api, local);
  assert.equal(r.ok, false);
  assert.deepEqual(r.estado, local);
});

test("nada mudou: não grava de novo", async () => {
  const n = nuvemFalsa();
  const local = est(["a"]);
  await sincronizar(n.api, local);
  const antes = n.gravacoes;
  await sincronizar(n.api, local);
  assert.equal(n.gravacoes, antes);
});

test("erro de rede sobe como exceção", async () => {
  const api = { async ler(){ throw new Error("offline"); } };
  await assert.rejects(sincronizar(api, est(["a"])), /offline/);
});
