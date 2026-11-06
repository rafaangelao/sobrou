import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoVazio, migrarV2, juntar } from "../js/juntar.js";

const L = (id, editadoEm, extra = {}) => ({ id, tipo:"gasto", data:"2026-11-01", categoria:"Lazer", descricao:id, valor:10, editadoEm, ...extra });
const base = (over = {}) => ({ ...estadoVazio(100), ...over });

test("estadoVazio não tem lançamentos de exemplo", () => {
  const e = estadoVazio(5);
  assert.equal(e.v, 2);
  assert.deepEqual(e.lancamentos, []);
  assert.deepEqual(e.fixas, []);
  assert.deepEqual(e.apagados, {});
  assert.ok(e.categorias.includes("Contas fixas"));
});

test("migrarV2 completa campos e carimba editadoEm", () => {
  const v1 = { v:1, atualizadoEm: 50, lancamentos:[{ id:"a", tipo:"gasto", data:"2026-07-03", categoria:"Lazer", descricao:"x", valor:1 }], categorias:["Lazer"], metas:{}, regras:{} };
  const e = migrarV2(v1);
  assert.equal(e.v, 2);
  assert.equal(e.lancamentos[0].editadoEm, 50);
  assert.deepEqual(e.fixas, []);
  assert.deepEqual(e.apagados, {});
});

test("lançamento novo dos dois lados entra", () => {
  const r = juntar(base({ lancamentos:[L("a", 1)] }), base({ lancamentos:[L("b", 1)] }));
  assert.deepEqual(r.lancamentos.map(x => x.id).sort(), ["a", "b"]);
});

test("mesmo id: vale a edição mais nova", () => {
  const r = juntar(base({ lancamentos:[L("a", 5, { valor: 99 })] }), base({ lancamentos:[L("a", 3, { valor: 1 })] }));
  assert.equal(r.lancamentos[0].valor, 99);
  const r2 = juntar(base({ lancamentos:[L("a", 3, { valor: 1 })] }), base({ lancamentos:[L("a", 5, { valor: 99 })] }));
  assert.equal(r2.lancamentos[0].valor, 99);
});

test("apagado não volta; edição posterior ao apagar volta", () => {
  const apagou = base({ lancamentos:[], apagados:{ a: 10 } });
  assert.equal(juntar(apagou, base({ lancamentos:[L("a", 5)] })).lancamentos.length, 0);
  assert.equal(juntar(apagou, base({ lancamentos:[L("a", 20)] })).lancamentos.length, 1);
  assert.equal(juntar(apagou, base()).apagados.a, 10);
});

test("fixas seguem a mesma regra", () => {
  const f = (id, t, valor) => ({ id, nome:id, valor, categoria:"Contas fixas", dia:10, tipo:"mensal", inicio:"2026-11", editadoEm:t });
  const r = juntar(base({ fixas:[f("x", 2, 100)] }), base({ fixas:[f("x", 7, 120), f("y", 1, 50)] }));
  assert.deepEqual(r.fixas.map(x => [x.id, x.valor]).sort(), [["x", 120], ["y", 50]]);
});

test("categorias: une mantendo a ordem local", () => {
  const r = juntar(base({ categorias:["A", "B"] }), base({ categorias:["B", "C"] }));
  assert.deepEqual(r.categorias, ["A", "B", "C"]);
});

test("metas e regras: vale o lado mais recente inteiro", () => {
  const velho = base({ atualizadoEm: 10, regras:{ ifood:"Comida/Fast Food" }, metas:{ Lazer: 100 } });
  const novo  = base({ atualizadoEm: 20, regras:{}, metas:{} });
  const r = juntar(velho, novo);
  assert.deepEqual(r.regras, {});
  assert.deepEqual(r.metas, {});
  assert.equal(r.atualizadoEm, 20);
});

test("sem nuvem: devolve o local migrado", () => {
  const r = juntar(base({ lancamentos:[L("a", 1)] }), null);
  assert.equal(r.lancamentos.length, 1);
});

test("idempotente", () => {
  const a = base({ atualizadoEm: 30, lancamentos:[L("a", 1), L("c", 4)], apagados:{ z: 3 }, categorias:["A"] });
  const b = base({ atualizadoEm: 40, lancamentos:[L("b", 2), L("c", 9)], categorias:["B"], regras:{ k:"Lazer" } });
  const j = juntar(a, b);
  assert.deepEqual(juntar(a, j), j);
  assert.deepEqual(juntar(j, j), j);
});
