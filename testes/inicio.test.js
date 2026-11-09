import { test } from "node:test";
import assert from "node:assert/strict";
import { telaInicio, folhaDetalhe } from "../js/telas/inicio.js";
import { brl } from "../js/formato.js";

const HOJE = "2026-11-09";
const L = (id, tipo, data, valor, descricao, categoria = "") => ({ id, tipo, data, valor, descricao, categoria });
const DADOS = [
  L("e1","entrada","2026-11-05",5000,"Salário"),
  ...Array.from({ length: 12 }, (_, i) => L("if" + String(i).padStart(2,"0"), "gasto", "2026-11-0" + (1 + (i % 9)), 35, i % 2 ? "ifood" : "iFood", "Comida/Fast Food")),
  L("al","gasto","2026-11-05",1100,"Aluguel","Contas fixas"),
  L("u1","gasto","2026-11-03",21,"uber","Transporte"),
  L("u2","gasto","2026-11-06",19,"Uber","Transporte"),
  L("gd","gasto","2026-11-02",2000,"Poupança","Guardar dinheiro"),
  L("o1","gasto","2026-10-04",270,"ifood","Comida/Fast Food"),
];
const tela = (extra = {}) => telaInicio({ lancamentos: DADOS, periodo: "2026-11", hoje: HOJE, fixas: null, ...extra });

test("número grande soma os gastos do mês e compara com o mesmo trecho", () => {
  const h = tela();
  assert.match(h, /Saiu em novembro/);
  assert.ok(h.includes(brl(3560)));
  assert.match(h, /data-conta="saiu"/);
  assert.ok(h.includes("a mais que até 9 de outubro"));
});
test("Os 3 que mais pesaram: por lugar, sem Guardar dinheiro, com variação", () => {
  const h = tela();
  const chaves = [...h.matchAll(/data-tipo="lugar" data-chave="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(chaves, ["aluguel", "ifood", "uber"]);
  assert.match(h, /12 vezes · média/);
  assert.ok(h.includes("+" + brl(150)));
});
test("faixa tem um pedaço por categoria e abre o detalhe da categoria", () => {
  const h = tela();
  assert.match(h, /class="faixa"/);
  assert.match(h, /class="faixa-pd"[^>]*data-acao="detalhe" data-tipo="cat" data-chave="Guardar dinheiro"/);
});
test("Todos os meses: sem comparação", () => {
  const h = tela({ periodo: "tudo" });
  assert.match(h, /Saiu no total/);
  assert.doesNotMatch(h, /a mais que|a menos que/);
});
test("mês só com entradas: sem faixa e sem os 3", () => {
  const h = telaInicio({ lancamentos: [L("e1","entrada","2026-11-05",5000,"Salário")], periodo: "2026-11", hoje: HOJE, fixas: null });
  assert.doesNotMatch(h, /class="faixa"/);
  assert.doesNotMatch(h, /Os 3 que mais pesaram/);
  assert.ok(h.includes(brl(0)));
});
test("mês vazio convida a lançar", () => {
  assert.match(telaInicio({ lancamentos: [], periodo: "2026-11", hoje: HOJE, fixas: null }), /data-acao="lancar"/);
});
test("aviso de fixas só quando tem e aponta para Fixas", () => {
  assert.doesNotMatch(tela(), /aviso-fixas/);
  const h = tela({ fixas: { qtd: 3, valor: 890, atrasado: false, ateDia: 15 } });
  assert.match(h, /3 fixas a pagar/);
  assert.match(h, /até dia 15/);
  assert.match(h, /data-acao="ir" data-aba="fixas"/);
});
test("descrição com HTML é escapada", () => {
  const h = telaInicio({ lancamentos: [L("x","gasto","2026-11-02",10,"<b>oi</b>","Lazer")], periodo: "2026-11", hoje: HOJE, fixas: null });
  assert.ok(h.includes("&lt;b&gt;oi&lt;/b&gt;"));
  assert.ok(!h.includes("<b>oi</b>"));
});
test("detalhe do lugar: total, semanas, lançamentos e dica", () => {
  const h = folhaDetalhe({ lancamentos: DADOS, periodo: "2026-11", hoje: HOJE, tipo: "lugar", chave: "ifood" });
  assert.ok(h.includes(brl(420)));
  assert.equal((h.match(/class="sem"/g) || []).length, 4);
  assert.equal((h.match(/class="det-item"/g) || []).length, 12);
  assert.match(h, /Se cortar 4 vezes/);
  assert.ok(h.includes(brl(140)));
  assert.match(h, /view-transition-name:ic-detalhe/);
});
test("detalhe da categoria não dá dica; Todos os meses não tem semanas; chave sem itens dá null", () => {
  assert.doesNotMatch(folhaDetalhe({ lancamentos: DADOS, periodo: "2026-11", hoje: HOJE, tipo: "cat", chave: "Contas fixas" }), /Se cortar/);
  assert.doesNotMatch(folhaDetalhe({ lancamentos: DADOS, periodo: "tudo", hoje: HOJE, tipo: "lugar", chave: "ifood" }), /class="sem"/);
  assert.equal(folhaDetalhe({ lancamentos: DADOS, periodo: "2026-11", hoje: HOJE, tipo: "lugar", chave: "nada" }), null);
});
