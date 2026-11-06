import { test } from "node:test";
import assert from "node:assert/strict";
import { novoCodigo, urlDeRetorno, codigoDaUrl, pedidoValido, VALIDADE_PEDIDO } from "../js/pareamento.js";

test("novoCodigo: 48 letras hex, diferente a cada vez", () => {
  const a = novoCodigo(), b = novoCodigo();
  assert.match(a, /^[0-9a-f]{48}$/);
  assert.notEqual(a, b);
});

test("urlDeRetorno: põe o código no ?par= da origem", () => {
  assert.equal(urlDeRetorno("https://x.app", "ab".repeat(24)), "https://x.app/?par=" + "ab".repeat(24));
});

test("codigoDaUrl: lê só código válido", () => {
  const c = "0f".repeat(24);
  assert.equal(codigoDaUrl("?par=" + c), c);
  assert.equal(codigoDaUrl("?x=1&par=" + c), c);
  assert.equal(codigoDaUrl(""), "");
  assert.equal(codigoDaUrl("?par=curto"), "");
  assert.equal(codigoDaUrl("?par=" + "zz".repeat(24)), "");
});

test("pedidoValido: o app espera o Safari por pelo menos 1 hora (e-mail pode demorar)", () => {
  const p = { codigo: "0f".repeat(24), em: 0 };
  assert.equal(pedidoValido(p, 60 * 60 * 1000), true);
});

test("pedidoValido: vale por um tempo e depois vence", () => {
  const p = { codigo: "0f".repeat(24), em: 1000 };
  assert.equal(pedidoValido(p, 1000 + 60_000), true);
  assert.equal(pedidoValido(p, 1000 + VALIDADE_PEDIDO + 1), false);
  assert.equal(pedidoValido(null, 1000), false);
  assert.equal(pedidoValido({ codigo: "x", em: 1000 }, 1000), false);
});
