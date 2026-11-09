import { test } from "node:test";
import assert from "node:assert/strict";
import { CATS_BASE } from "../js/base.js";
import { iconeCat, iconeUI, nomeCurto, corDe } from "../js/icones.js";

test("cada categoria base tem ícone próprio; criada pelo usuário usa o de Outros", () => {
  const outros = iconeCat("Outros");
  for (const c of CATS_BASE.filter(c => c.nome !== "Outros")) assert.notEqual(iconeCat(c.nome), outros, c.nome);
  assert.equal(iconeCat("Minha categoria"), outros);
  assert.equal(corDe("Minha categoria"), "var(--c0)");
});
test("entrada tem ícone e cor de dinheiro entrando", () => {
  assert.match(iconeCat("", { entrada: true }), /--c:var\(--bom\)/);
});
test("view-transition-name só quando pedido", () => {
  assert.match(iconeCat("Lazer", { vt: "ic-detalhe" }), /view-transition-name:ic-detalhe/);
  assert.doesNotMatch(iconeCat("Lazer"), /view-transition-name/);
});
test("ícones da interface existem e não roubam o toque", () => {
  for (const n of ["inicio","extrato","fixas","mais","somar","olho","olho-fechado","voltar","fechar","busca","seta","editar","apagar","economizar","metas","importar","planilha","nuvem","check"]){
    const s = iconeUI(n);
    assert.match(s, /<svg[^>]*pointer-events="none"/, n);
    assert.match(s, /<(path|circle|rect)/, n);
  }
});
test("nomeCurto encurta só o que é comprido", () => {
  assert.equal(nomeCurto("Comida/Fast Food"), "Comida");
  assert.equal(nomeCurto("Coisas pra mim"), "Pra mim");
  assert.equal(nomeCurto("Lazer"), "Lazer");
});
