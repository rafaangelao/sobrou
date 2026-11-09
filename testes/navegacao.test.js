import { test } from "node:test";
import assert from "node:assert/strict";
import { abaValida, posicaoNaBarra, BARRA } from "../js/navegacao.js";

test("abaValida converte as abas antigas salvas no aparelho", () => {
  assert.equal(abaValida("visao"), "inicio");
  assert.equal(abaValida("lancamentos"), "extrato");
  assert.equal(abaValida("importar"), "importar");
  assert.equal(abaValida("metas"), "metas");
  assert.equal(abaValida("fixas"), "fixas");
});
test("abaValida recusa o + e lixo", () => {
  assert.equal(abaValida("+"), "inicio");
  assert.equal(abaValida("qualquer"), "inicio");
  assert.equal(abaValida(undefined), "inicio");
});
test("posicaoNaBarra: sub-telas acendem o Mais", () => {
  assert.equal(BARRA.length, 5);
  assert.equal(posicaoNaBarra("inicio"), 0);
  assert.equal(posicaoNaBarra("extrato"), 1);
  assert.equal(posicaoNaBarra("fixas"), 3);
  assert.equal(posicaoNaBarra("mais"), 4);
  assert.equal(posicaoNaBarra("economizar"), 4);
  assert.equal(posicaoNaBarra("conta"), 4);
});
