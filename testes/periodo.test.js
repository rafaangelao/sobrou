import { test } from "node:test";
import assert from "node:assert/strict";
import { folhaPeriodo, rotuloPeriodo } from "../js/telas/periodo.js";

const PERIODOS = ["2026-12","2026-11","2026-10","2026-09","2026-08","2026-07","2026-06","2026-05","2026-04","2026-03","2026-02","2026-01",
                  "2025-12","2025-11","2025-10","2025-09","2025-08","2025-07","2025-06","2025-05","2025-04","2025-03","2025-02","2025-01"];
const folha = (extra = {}) => folhaPeriodo({ periodos: PERIODOS, atual: "2026-11", contagem: new Map([["2026-11", 9], ["2025-12", 2]]), total: 11, hoje: "2026-11-09", ...extra });

test("rótulo do botão do topo", () => {
  assert.equal(rotuloPeriodo("2026-11"), "novembro de 2026");
  assert.equal(rotuloPeriodo("tudo"), "Todos os meses");
});
test("anos do mais novo para o mais velho, meses em ordem de calendário", () => {
  const h = folha();
  assert.ok(h.indexOf(">2026<") < h.indexOf(">2025<"));
  const meses = [...h.matchAll(/data-p="(2026-\d\d)"/g)].map(m => m[1]);
  assert.deepEqual(meses.slice(0, 3), ["2026-01", "2026-02", "2026-03"]);
  assert.equal(meses.length, 12);
});
test("mês escolhido marcado, mês de hoje marcado, mês com lançamentos mostra quantos", () => {
  const h = folha();
  assert.match(h, /data-p="2026-11" aria-pressed="true"/);
  assert.match(h, /data-p="2026-10" aria-pressed="false"/);
  assert.match(h, /data-p="2026-11"[^>]*data-hoje/);
  assert.match(h, /data-p="2025-12"[^>]*>dez<small>2<\/small>/);
  assert.match(h, /data-p="2026-10"[^>]*>out<\/button>/);
});
test("Todos os meses com o total, marcado quando escolhido", () => {
  assert.match(folha(), /data-p="tudo" aria-pressed="false">Todos os meses<small>11<\/small>/);
  assert.match(folha({ atual: "tudo" }), /data-p="tudo" aria-pressed="true"/);
});
