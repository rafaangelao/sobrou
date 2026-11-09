import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.matchMedia = () => ({ matches: false });
const { comTransicao } = await import("../js/movimento.js");

test("comTransicao abre mesmo quando a transição do navegador nunca chama de volta", async () => {
  globalThis.document = { startViewTransition: () => {} };   /* aba sem quadros: o callback nunca vem */
  const origem = { style: {} };
  let vezes = 0;
  comTransicao(origem, () => vezes++);
  await new Promise(r => setTimeout(r, 400));
  assert.equal(vezes, 1);
  assert.equal(origem.style.viewTransitionName, "");
});
test("comTransicao não abre duas vezes quando o navegador chama de volta", async () => {
  let cb;
  globalThis.document = { startViewTransition: f => { cb = f; } };
  let vezes = 0;
  comTransicao({ style: {} }, () => vezes++);
  cb();
  await new Promise(r => setTimeout(r, 400));
  assert.equal(vezes, 1);
});
