import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparPorLugar, chaveLugar, trechoComparavel, comparar, compararPeriodo,
         faixaCategorias, porSemana, dicaCorte, porCategoria } from "../js/raiox.js";

const G = (id, data, valor, descricao, categoria = "Outros") => ({ id, tipo:"gasto", data, valor, descricao, categoria });

test("agruparPorLugar junta o mesmo lugar escrito de jeitos diferentes", () => {
  const r = agruparPorLugar([G("a","2026-11-01",35,"ifood","Comida/Fast Food"), G("b","2026-11-03",42.9,"COMPRA CARTAO IFOOD *IFOOD 4829","Comida/Fast Food")]);
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].chave, r[0].qtd, r[0].total, r[0].media], ["ifood", 2, 77.9, 38.95]);
  assert.equal(r[0].nome, "COMPRA CARTAO IFOOD *IFOOD 4829");   /* nome = descrição mais recente */
  assert.equal(r[0].itens[0].id, "b");
});
test("agruparPorLugar: categoria mais frequente e ordem por total", () => {
  const r = agruparPorLugar([
    G("1","2026-11-01",10,"uber","Transporte"), G("2","2026-11-02",10,"Uber","Transporte"), G("3","2026-11-03",10,"uber","Outros"),
    G("4","2026-11-04",100,"Aluguel","Contas fixas"),
  ]);
  assert.deepEqual(r.map(x => x.chave), ["aluguel", "uber"]);
  assert.equal(r[1].categoria, "Transporte");
  assert.equal(r[1].nome, "Uber");
});
test("chaveLugar: descrição genérica ou vazia não quebra", () => {
  assert.equal(chaveLugar("Gasto"), "gasto");
  assert.equal(chaveLugar(""), "-");
  assert.equal(chaveLugar("123"), "123");
});
test("trechoComparavel: mês atual compara o mesmo trecho do mês anterior", () => {
  assert.deepEqual(trechoComparavel("2026-11", "2026-11-09"), {
    atual: { de:"2026-11-01", ate:"2026-11-09" }, anterior: { de:"2026-10-01", ate:"2026-10-09" }, rotulo:"até 9 de outubro" });
  assert.deepEqual(trechoComparavel("2026-03", "2026-03-31").anterior, { de:"2026-02-01", ate:"2026-02-28" });
  assert.equal(trechoComparavel("2026-03", "2026-03-31").rotulo, "até 28 de fevereiro");
  assert.deepEqual(trechoComparavel("2026-01", "2026-01-15").anterior, { de:"2025-12-01", ate:"2025-12-15" });
});
test("trechoComparavel: mês fechado compara inteiro; futuro e tudo não comparam", () => {
  assert.deepEqual(trechoComparavel("2026-10", "2026-11-09"), {
    atual: { de:"2026-10-01", ate:"2026-10-31" }, anterior: { de:"2026-09-01", ate:"2026-09-30" }, rotulo:"em setembro" });
  assert.equal(trechoComparavel("2026-12", "2026-11-09"), null);
  assert.equal(trechoComparavel("tudo", "2026-11-09"), null);
});
test("comparar: mais, menos e igual abaixo de R$ 1", () => {
  assert.deepEqual(comparar(100, 50), { diferenca:50, sentido:"mais" });
  assert.deepEqual(comparar(50, 100), { diferenca:50, sentido:"menos" });
  assert.deepEqual(comparar(100, 100.5), { diferenca:0.5, sentido:"igual" });
});
test("compararPeriodo: some quando o mês anterior não tem nada", () => {
  const so = [G("a","2026-11-02",50,"x")];
  assert.equal(compararPeriodo(so, "2026-11", "2026-11-09", l => l.tipo === "gasto"), null);
  const com = [...so, G("b","2026-10-03",20,"x"), G("c","2026-10-20",999,"x")];
  assert.deepEqual(compararPeriodo(com, "2026-11", "2026-11-09", l => l.tipo === "gasto"),
    { diferenca:30, sentido:"mais", rotulo:"até 9 de outubro" });
});
test("faixaCategorias: soma 100% e junta as menores de 3% em Outros", () => {
  const f = faixaCategorias([{nome:"A",total:90,cor:"a"},{nome:"B",total:8,cor:"b"},{nome:"C",total:1,cor:"c"},{nome:"D",total:1,cor:"d"}]);
  assert.deepEqual(f.map(x => x.nome), ["A","B","Outros"]);
  assert.equal(Math.round(f.reduce((t,x) => t + x.pct, 0)), 100);
  assert.equal(f[2].agrupado, true);
  assert.equal(f[2].total, 2);
});
test("faixaCategorias: Outros de verdade sozinho não é agrupado; vazio dá lista vazia", () => {
  const f = faixaCategorias([{nome:"A",total:50,cor:"a"},{nome:"Outros",total:50,cor:"o"}]);
  assert.equal(f[1].agrupado, false);
  assert.deepEqual(faixaCategorias([]), []);
  assert.deepEqual(faixaCategorias([{nome:"A",total:0,cor:"a"}]), []);
});
test("porSemana: 4 grupos fixos e o último vai até o fim do mês", () => {
  const s = porSemana([G("1","2026-11-07",7,"x"), G("2","2026-11-08",8,"x"), G("3","2026-11-22",22,"x"), G("4","2026-11-30",30,"x"), G("5","2026-10-30",99,"x")], "2026-11");
  assert.deepEqual(s, [{rot:"1–7",total:7},{rot:"8–14",total:8},{rot:"15–21",total:0},{rot:"22–30",total:52}]);
  assert.equal(porSemana([], "tudo"), null);
});
test("dicaCorte: só com 4+ vezes e fora de Igreja e Guardar dinheiro", () => {
  assert.deepEqual(dicaCorte({ qtd:12, media:35, categoria:"Comida/Fast Food" }), { n:4, valor:140 });
  assert.deepEqual(dicaCorte({ qtd:4, media:10, categoria:"Lazer" }), { n:1, valor:10 });
  assert.equal(dicaCorte({ qtd:3, media:35, categoria:"Lazer" }), null);
  assert.equal(dicaCorte({ qtd:6, media:50, categoria:"Igreja" }), null);
});
test("porCategoria soma por categoria com cor e sem categoria vira Outros", () => {
  const c = porCategoria([G("1","2026-11-01",10,"x","Lazer"), G("2","2026-11-01",5,"y",""), G("3","2026-11-01",20,"z","Lazer")]);
  assert.deepEqual(c.map(x => [x.nome, x.total]), [["Lazer",30],["Outros",5]]);
  assert.equal(c[0].cor, "var(--c4)");
});
