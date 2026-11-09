import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoVazio, migrarV2, juntar, apagarLancamento } from "../js/juntar.js";

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

test("metas e regras: vale o objeto mexido por último (Esquecer tudo propaga)", () => {
  const velho = base({ atualizadoEm: 10, regras:{ ifood:"Comida/Fast Food" }, regrasEm: 10, metas:{ Lazer: 100 }, metasEm: 10 });
  const novo  = base({ atualizadoEm: 20, regras:{}, regrasEm: 20, metas:{}, metasEm: 20 });
  const r = juntar(velho, novo);
  assert.deepEqual(r.regras, {});
  assert.deepEqual(r.metas, {});
  assert.equal(r.atualizadoEm, 20);
  assert.equal(r.metasEm, 20);
  assert.equal(r.regrasEm, 20);
});

test("aparelho novo (vazio e mais recente) não apaga metas e regras do outro", () => {
  const pc = base({ atualizadoEm: 10, regras:{ ifood:"Comida/Fast Food" }, regrasEm: 10, metas:{ Lazer: 200 }, metasEm: 10 });
  const celular = estadoVazio(999);
  assert.deepEqual(juntar(celular, pc).metas, { Lazer: 200 });
  assert.deepEqual(juntar(celular, pc).regras, { ifood:"Comida/Fast Food" });
  assert.deepEqual(juntar(pc, celular).metas, { Lazer: 200 });
});

test("editar um lançamento não faz as metas antigas daquele lado vencerem", () => {
  const a = base({ atualizadoEm: 50, metas:{ Lazer: 100 }, metasEm: 5 });
  const b = base({ atualizadoEm: 20, metas:{ Lazer: 300 }, metasEm: 15 });
  assert.deepEqual(juntar(a, b).metas, { Lazer: 300 });
});

test("migrarV2 carimba metas/regras de dados antigos e zera quando vazios", () => {
  const v1 = migrarV2({ v:1, atualizadoEm: 50, lancamentos:[], metas:{ Lazer: 1 }, regras:{} });
  assert.equal(v1.metasEm, 50);
  assert.equal(v1.regrasEm, 0);
  const vazio = estadoVazio(77);
  assert.equal(vazio.metasEm, 0);
  assert.equal(vazio.regrasEm, 0);
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

test("apagarLancamento tira o item e marca em apagados", () => {
  const e = estadoVazio(1);
  e.lancamentos.push({ id:"x", tipo:"gasto", data:"2026-11-09", valor:35, descricao:"ifood", categoria:"Outros", editadoEm:1 });
  assert.equal(apagarLancamento(e, "x", 50), true);
  assert.equal(e.lancamentos.length, 0);
  assert.equal(e.apagados.x, 50);
  assert.equal(apagarLancamento(e, "nao-existe", 60), false);
});
test("desfazer depois que a nuvem já tem o lançamento: ele não volta", () => {
  const item = { id:"x", tipo:"gasto", data:"2026-11-09", valor:35, descricao:"ifood", categoria:"Outros", editadoEm:10 };
  const nuvem = estadoVazio(1); nuvem.lancamentos.push({ ...item });
  const local = estadoVazio(1); local.lancamentos.push({ ...item });
  apagarLancamento(local, "x", 20);
  assert.equal(juntar(local, nuvem).lancamentos.some(l => l.id === "x"), false);
});
