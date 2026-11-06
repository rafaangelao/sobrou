import { test } from "node:test";
import assert from "node:assert/strict";
import { lerLinha } from "../js/rapido.js";

const H = "2026-11-05";
const cls = d => /uber/i.test(d) ? { categoria:"Transporte", origem:"reconheci “uber”" }
             : /ifood/i.test(d) ? { categoria:"Comida/Fast Food", origem:"reconheci “ifood”" }
             : { categoria:"", origem:"" };
const ler = t => lerLinha(t, H, cls);

test("uber 15", () => {
  assert.deepEqual(ler("uber 15"), { tipo:"gasto", valor:15, data:H, descricao:"uber", categoria:"Transporte", origem:"reconheci “uber”", parcelas:null });
});
test("vírgula e ontem", () => {
  const r = ler("ifood 42,90 ontem");
  assert.equal(r.valor, 42.9); assert.equal(r.data, "2026-11-04"); assert.equal(r.descricao, "ifood"); assert.equal(r.categoria, "Comida/Fast Food");
});
test("anteontem no começo", () => {
  const r = ler("anteontem padaria 8");
  assert.equal(r.data, "2026-11-03"); assert.equal(r.descricao, "padaria"); assert.equal(r.valor, 8);
});
test("dia N do mês e limite do mês", () => {
  assert.equal(ler("farmácia 30 dia 3").data, "2026-11-03");
  assert.equal(ler("farmácia 30 dia 3").descricao, "farmácia");
  assert.equal(ler("luz 90 dia 31").data, "2026-11-30");
});
test("data dd/mm e dd/mm/aaaa não viram valor", () => {
  const r = ler("mercado 120 2/11");
  assert.equal(r.valor, 120); assert.equal(r.data, "2026-11-02"); assert.equal(r.descricao, "mercado");
  assert.equal(ler("pizza 50 3/1").data, "2026-01-03");
  assert.equal(ler("pizza 50 03/01/2027").data, "2027-01-03");
});
test("milhar", () => {
  assert.equal(ler("aluguel 1.495,54").valor, 1495.54);
  assert.equal(ler("tv 1.500").valor, 1500);
  assert.equal(ler("tv 42.90").valor, 42.9);
});
test("número colado em palavra não é valor", () => {
  const r = ler("99app 20");
  assert.equal(r.valor, 20); assert.equal(r.descricao, "99app");
});
test("entradas", () => {
  const a = ler("+1500 freela");
  assert.equal(a.tipo, "entrada"); assert.equal(a.valor, 1500); assert.equal(a.descricao, "freela"); assert.equal(a.categoria, "");
  assert.equal(ler("salário 1500").tipo, "entrada");
});
test("parcelado", () => {
  const r = ler("celular 1500 em 10x");
  assert.equal(r.parcelas, 10); assert.equal(r.valor, 1500); assert.equal(r.descricao, "celular");
  assert.equal(ler("tênis 300 3x").parcelas, 3);
});
test("sem valor ou vazio → null", () => {
  assert.equal(ler("uber"), null);
  assert.equal(ler("   "), null);
  assert.equal(ler("uber 0"), null);
});
test("descrição vazia ganha nome padrão", () => {
  assert.equal(ler("15").descricao, "Gasto");
  assert.equal(ler("+15").descricao, "Entrada");
});
