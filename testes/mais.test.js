import { test } from "node:test";
import assert from "node:assert/strict";
import { telaMais, telaConta, voltarMais } from "../js/telas/mais.js";

test("Mais leva para as 5 coisas que saíram da barra", () => {
  const h = telaMais();
  for (const a of ['data-aba="economizar"','data-aba="metas"','data-aba="importar"','data-acao="csv"','data-aba="conta"']) assert.ok(h.includes(a), a);
});
test("voltar leva para Mais", () => {
  assert.match(voltarMais(), /data-acao="ir" data-aba="mais"/);
});
test("Conta: logado mostra e-mail escapado, estado e Sair; deslogado mostra Entrar", () => {
  const h = telaConta({ email: "a<b>@x.com", estado: "Tudo salvo" });
  assert.ok(h.includes("a&lt;b&gt;@x.com"));
  assert.match(h, /id="conta-estado">Tudo salvo</);
  assert.match(h, /data-acao="sair"/);
  assert.match(telaConta({ email: "", estado: "" }), /data-acao="entrar"/);
});
