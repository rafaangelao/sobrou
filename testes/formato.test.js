import { test } from "node:test";
import assert from "node:assert/strict";
import { brl, esc, rotuloDia, rotuloMes, rotuloData, din, maiuscula, pctTxt } from "../js/formato.js";

test("rotuloDia: hoje, ontem e data por extenso sem zero à esquerda", () => {
  assert.equal(rotuloDia("2026-11-09", "2026-11-09"), "Hoje");
  assert.equal(rotuloDia("2026-11-08", "2026-11-09"), "Ontem");
  assert.equal(rotuloDia("2026-11-07", "2026-11-09"), "7 de novembro");
  assert.equal(rotuloDia("2026-10-31", "2026-11-01"), "Ontem");
});
test("din embrulha o valor para o modo de esconder valores", () => {
  assert.equal(din(35), `<span class="din">${brl(35)}</span>`);
  assert.equal(din(35, "−"), `<span class="din">−${brl(35)}</span>`);
});
test("esc, maiuscula, rotulos e porcentagem", () => {
  assert.equal(esc(`<b a="1">'&`), "&lt;b a=&quot;1&quot;&gt;&#39;&amp;");
  assert.equal(maiuscula("  ifood "), "Ifood");
  assert.equal(maiuscula(""), "");
  assert.equal(rotuloMes("2026-11"), "novembro de 2026");
  assert.equal(rotuloData("2026-11-07"), "07 de novembro");
  assert.equal(pctTxt(38.4), "38%");
  assert.equal(pctTxt(2.45), "2,5%");
});
