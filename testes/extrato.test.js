import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrarExtrato, gruposPorDia, telaExtrato, listaExtrato, linhaExtrato, filtroValido } from "../js/telas/extrato.js";
import { brl } from "../js/formato.js";

const L = (id, tipo, data, valor, descricao, categoria = "") => ({ id, tipo, data, valor, descricao, categoria });
const ITENS = [
  L("a","gasto","2026-11-09",42.9,"iFood","Comida/Fast Food"),
  L("b","gasto","2026-11-09",35,"Uber","Transporte"),
  L("c","entrada","2026-11-08",5000,"Salário"),
  L("d","gasto","2026-11-08",31.5,"Farmácia","Saúde"),
];

test("busca ignora acento e maiúscula e olha categoria", () => {
  assert.deepEqual(filtrarExtrato(ITENS, { busca: "FARMACIA" }).map(l => l.id), ["d"]);
  assert.deepEqual(filtrarExtrato(ITENS, { busca: "transp" }).map(l => l.id), ["b"]);
});
test("filtros de saídas, entradas e categoria", () => {
  assert.deepEqual(filtrarExtrato(ITENS, { filtro: "entradas" }).map(l => l.id), ["c"]);
  assert.equal(filtrarExtrato(ITENS, { filtro: "saidas" }).length, 3);
  assert.deepEqual(filtrarExtrato(ITENS, { filtro: "cat:Saúde" }).map(l => l.id), ["d"]);
});
test("grupos por dia: mais novo primeiro, com saldo do dia", () => {
  const g = gruposPorDia(ITENS);
  assert.deepEqual(g.map(x => x.data), ["2026-11-09", "2026-11-08"]);
  assert.equal(g[0].saldo, -77.9);
  assert.equal(g[1].saldo, 4968.5);
});
test("lista usa Hoje e Ontem e o sinal do saldo", () => {
  const h = listaExtrato(ITENS, "2026-11-09");
  assert.ok(h.indexOf("Hoje") < h.indexOf("Ontem"));
  assert.ok(h.includes("−" + brl(77.9)));
  assert.ok(h.includes("+" + brl(4968.5)));
});
test("linha: arrastável, com editar e apagar, e descrição vazia vira Gasto", () => {
  const h = linhaExtrato(L("z","gasto","2026-11-09",10,"",""));
  assert.match(h, /class="lin" data-arrasta data-id="z"/);
  assert.match(h, /data-acao="apagar" data-id="z"/);
  assert.match(h, /<b>Gasto<\/b>/);
  assert.match(h, /<small>Outros<\/small>/);
});
test("tela: busca escapada, filtro marcado e filtro de categoria sumida volta para Tudo", () => {
  const h = telaExtrato({ itens: ITENS, hoje: "2026-11-09", busca: '"><x', filtro: "cat:Lazer", rotuloPeriodo: "em novembro" });
  assert.ok(h.includes('value="&quot;&gt;&lt;x"'));
  assert.match(h, /data-f="tudo" aria-pressed="true"/);
  assert.match(h, /data-f="cat:Saúde" aria-pressed="false"/);
});
test("tela vazia convida a lançar; filtro sem resultado avisa", () => {
  assert.match(telaExtrato({ itens: [], hoje: "2026-11-09", rotuloPeriodo: "em novembro" }), /Nada lançado em novembro/);
  assert.match(listaExtrato([], "2026-11-09", "pizza"), /Nada encontrado para “pizza”/);
});
test("filtro de categoria que não existe no mês volta para Tudo (a busca usa o mesmo)", () => {
  assert.equal(filtroValido(ITENS, "cat:Lazer"), "tudo");
  assert.equal(filtroValido(ITENS, "cat:Saúde"), "cat:Saúde");
  assert.equal(filtroValido(ITENS, "entradas"), "entradas");
  assert.equal(filtroValido([], "cat:Saúde"), "tudo");
});
