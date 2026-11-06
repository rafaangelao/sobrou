import { test } from "node:test";
import assert from "node:assert/strict";
import * as F from "../js/fixas.js";

const celular = { id:"cel", nome:"Celular", valor:150, categoria:"Coisas pra mim", dia:10, tipo:"parcelado", inicio:"2026-09", parcelas:10, editadoEm:1 };
const aluguel = { id:"alu", nome:"Aluguel", valor:900, categoria:"Contas fixas", dia:31, tipo:"mensal", inicio:"2026-11", editadoEm:1 };
const net     = { id:"net", nome:"Internet", valor:100, categoria:"Contas fixas", dia:5, tipo:"mensal", inicio:"2026-01", fim:"2026-12", editadoEm:1 };

test("parcela do mês", () => {
  assert.equal(F.parcelaNoMes(celular, "2026-08"), null);
  assert.equal(F.parcelaNoMes(celular, "2026-09"), 1);
  assert.equal(F.parcelaNoMes(celular, "2026-11"), 3);
  assert.equal(F.parcelaNoMes(celular, "2027-06"), 10);
  assert.equal(F.parcelaNoMes(celular, "2027-07"), null);
  assert.equal(F.parcelaNoMes(aluguel, "2026-11"), null);
});

test("último mês e ativa no mês", () => {
  assert.equal(F.ultimoMes(celular), "2027-06");
  assert.equal(F.ultimoMes(aluguel), null);
  assert.equal(F.ultimoMes(net), "2026-12");
  assert.equal(F.ativaNoMes(aluguel, "2030-01"), true);
  assert.equal(F.ativaNoMes(aluguel, "2026-10"), false);
  assert.equal(F.ativaNoMes(net, "2027-01"), false);
  assert.equal(F.ativaNoMes(celular, "2027-07"), false);
});

test("vencimento limita ao último dia do mês", () => {
  assert.equal(F.vencimento(aluguel, "2027-02"), "2027-02-28");
  assert.equal(F.vencimento(aluguel, "2028-02"), "2028-02-29");
  assert.equal(F.vencimento(aluguel, "2026-11"), "2026-11-30");
  assert.equal(F.vencimento(celular, "2026-11"), "2026-11-10");
});

test("situação: pago, atrasado, a pagar", () => {
  const pago = { id:"l1", tipo:"gasto", data:"2026-11-04", categoria:"Contas fixas", descricao:"Internet", valor:95, fixaId:"net", fixaMes:"2026-11", editadoEm:1 };
  const ocs = F.ocorrencias([celular, aluguel, net], [pago], "2026-11", "2026-11-12");
  const por = Object.fromEntries(ocs.map(o => [o.fixa.id, o]));
  assert.equal(por.net.situacao, "pago");
  assert.equal(por.net.valor, 95);
  assert.equal(por.cel.situacao, "atrasado");
  assert.equal(por.cel.parcela, 3);
  assert.equal(por.alu.situacao, "a-pagar");
  assert.deepEqual(ocs.map(o => o.fixa.id), ["net", "cel", "alu"]);
});

test("resumo do mês", () => {
  const ocs = F.ocorrencias([celular, aluguel], [], "2026-11", "2026-11-12");
  assert.deepEqual(F.resumoDoMes(ocs), { total: 1050, pago: 0, aPagar: 1050, atrasado: 150 });
});

test("faixa de meses até dez/2027", () => {
  const m = F.mesesDaFaixa("2026-11-05");
  assert.equal(m.length, 14);
  assert.equal(m[0], "2026-11");
  assert.equal(m[13], "2027-12");
  assert.deepEqual(F.mesesDaFaixa("2028-03-01"), ["2028-03"]);
});

test("pendentes de meses anteriores", () => {
  const p = F.pendentesAnteriores([celular], [], "2026-11-05");
  assert.deepEqual(p.map(o => o.mes), ["2026-09", "2026-10"]);
  assert.deepEqual(F.pendentesAnteriores([], [], "2026-11-05"), []);
});

test("descrição do pagamento", () => {
  const [o] = F.ocorrencias([celular], [], "2026-11", "2026-11-01");
  assert.equal(F.descricaoPagamento(o), "Celular (3/10)");
  const [a] = F.ocorrencias([aluguel], [], "2026-11", "2026-11-01");
  assert.equal(F.descricaoPagamento(a), "Aluguel");
});

test("pagar cria um lançamento e não duplica (toque duplo)", () => {
  const estado = { fixas:[celular], lancamentos:[] };
  const l = F.pagar(estado, "cel", "2026-11", "2026-11-05", "id1", 77);
  assert.deepEqual(l, { id:"id1", tipo:"gasto", data:"2026-11-10", categoria:"Coisas pra mim", descricao:"Celular (3/10)", valor:150, fixaId:"cel", fixaMes:"2026-11", editadoEm:77 });
  estado.lancamentos.push(l);
  assert.equal(F.pagar(estado, "cel", "2026-11", "2026-11-05", "id2", 78), null);
});

test("pagar atrasado usa a data de hoje; mês fora da fixa não paga", () => {
  const estado = { fixas:[celular], lancamentos:[] };
  assert.equal(F.pagar(estado, "cel", "2026-10", "2026-11-05", "x", 1).data, "2026-11-05");
  assert.equal(F.pagar(estado, "cel", "2027-07", "2026-11-05", "x", 1), null);
});

test("casar linha do extrato com a fixa", () => {
  const chave = d => d.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(t => t.length > 2).slice(0, 2).join(" ");
  const ocs = F.ocorrencias([celular, aluguel], [], "2026-11", "2026-11-01");
  assert.equal(F.casarComFixa({ descricao:"LOJA XYZ PARCELA 03/10", valor:150 }, ocs, chave)?.fixa.id, "cel");
  assert.equal(F.casarComFixa({ descricao:"PIX ALUGUEL APTO", valor:900.3 }, ocs, chave)?.fixa.id, "alu");
  assert.equal(F.casarComFixa({ descricao:"PIX ALUGUEL APTO", valor:950 }, ocs, chave), null);
  assert.equal(F.casarComFixa({ descricao:"MERCADO", valor:150 }, ocs, chave), null);
});

test("linha do extrato que já é o pagamento lançado de uma fixa", () => {
  const chave = d => d.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(t => t.length > 2).slice(0, 2).join(" ");
  const pago = { id:"p", tipo:"gasto", data:"2026-11-10", valor:150, descricao:"Celular (3/10)", fixaId:"cel", fixaMes:"2026-11" };
  const ocs = F.ocorrencias([{ ...celular, valor:160 }, aluguel], [pago], "2026-11", "2026-11-01");
  assert.equal(F.jaPagaNoExtrato({ descricao:"LOJA CEL PARCELA 03/10", valor:150 }, ocs, chave)?.fixa.id, "cel");
  assert.equal(F.jaPagaNoExtrato({ descricao:"LOJA CEL PARCELA 03/10", valor:151 }, ocs, chave), null);
  assert.equal(F.jaPagaNoExtrato({ descricao:"PIX ALUGUEL APTO", valor:900 }, ocs, chave), null);
});
