import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizar, somarMeses, mesesEntre, somarDias, hojeLocal, diasNoMes, mesDe } from "../js/base.js";

test("normalizar tira acento, pontuação e caixa", () => {
  assert.equal(normalizar("  Farmácia São-João!! "), "farmacia sao joao");
});
test("somarMeses atravessa o ano", () => {
  assert.equal(somarMeses("2026-11", 2), "2027-01");
  assert.equal(somarMeses("2026-09", 9), "2027-06");
  assert.equal(somarMeses("2026-01", 0), "2026-01");
});
test("mesesEntre", () => {
  assert.equal(mesesEntre("2026-09", "2026-11"), 2);
  assert.equal(mesesEntre("2026-11", "2026-09"), -2);
  assert.equal(mesesEntre("2026-11", "2027-12"), 13);
});
test("somarDias atravessa mês e ano", () => {
  assert.equal(somarDias("2026-11-01", -1), "2026-10-31");
  assert.equal(somarDias("2026-12-30", 5), "2027-01-04");
});
test("hojeLocal usa a data local, não UTC", () => {
  assert.equal(hojeLocal(new Date(2026, 10, 5, 23, 30)), "2026-11-05");
});
test("diasNoMes e mesDe", () => {
  assert.equal(diasNoMes(2028, 2), 29);
  assert.equal(diasNoMes(2027, 2), 28);
  assert.equal(mesDe("2026-11-05"), "2026-11");
});
