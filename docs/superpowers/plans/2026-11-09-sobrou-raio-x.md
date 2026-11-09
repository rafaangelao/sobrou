# Sobrou estilo banco + Raio-X do mês: plano de construção

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a cara do Sobrou por uma de app de banco (Nubank/Inter) com o Raio-X do mês (número grande, faixa por categoria, "Os 3 que mais pesaram" por lugar, detalhe por semana), extrato por dia, barra Início/Extrato/+/Fixas/Mais e 9 animações. Por fim, publicar o projeto num repositório do GitHub.

**Architecture:**
- O app continua em ES modules estáticos, sem etapa de build.
- Os cálculos e as telas novas saem do `js/painel.js` (~1.860 linhas) para módulos pequenos e puros. Cada tela é uma função que recebe dados e devolve HTML em texto, e roda no Node para os testes.
- O `painel.js` fica só com estado, eventos e ligações com o DOM.
- As animações ficam em `js/movimento.js` e no CSS, e respeitam "Reduzir movimento".

**Tech Stack:**
- HTML, CSS e JS puro (ES modules).
- Testes com `node --test`.
- Supabase (sem mudança nenhuma), Vercel (site estático) e GitHub CLI (`gh`, já logado como `rafaangelao`).

**Spec:** `docs/superpowers/specs/2026-11-09-sobrou-raio-x-design.md`

## Global Constraints

- **Sem dependências novas** e sem build: só arquivos `.js` importados direto pelo navegador.
- **Testes:**
  - Suíte inteira: `node --test "testes/*.test.js"`.
  - Um arquivo: `node --test testes/<arquivo>.test.js`.
  - Os 55 testes atuais continuam passando.
- **Banco de dados:** nenhuma mudança no formato salvo nem no Supabase. A única chave nova no aparelho é `sobrou:ocultar`.
- **Duração das animações:**
  - Nenhuma passa de 500ms, exceto o número contando (700ms).
  - Curva de mola: `cubic-bezier(.3,1.3,.5,1)`, guardada em `--mola-forte`.
  - Com `prefers-reduced-motion: reduce` tudo vira troca simples. O CSS já tem `animation:none;transition:none` global, e o JS consulta `semMovimento()`.
- **Textos** em português do Brasil, frases curtas, sem ponto de exclamação.
- **Fontes e cores:**
  - Figtree para textos e números. A Fraunces fica só na marca "Sobrou".
  - O verde e o dourado continuam (`--papel #0F241B`, `--marca #D8B45A`).
- **Git:**
  - Commits só na branch `feat/sobrou-banco`.
  - A mensagem termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Produção e segredos:**
  - Produção (`vercel deploy --prod`) só muda depois do ok do Rafael. Juntar no `main` também só com o ok dele.
  - Nunca imprimir nem commitar segredos (`.env*` e `.vercel` estão no `.gitignore`).
- **Conferência no navegador:**
  - `preview_start` com nome `painel` (porta 4173).
  - Celular com `resize_window` 390x844. Computador com `preset: "desktop"`.
  - Ao terminar, voltar para `desktop`.

## Review Focus

1. **Período "Todos os meses"** (`periodo === "tudo"`): sem linha de comparação e sem gráfico por semana. "Os 3 que mais pesaram" usa todos os meses, e nada quebra. Os testes ficam nas Tasks 2 e 5.
2. **Mês só com entradas, ou sem gastos:** sem faixa, sem "Os 3", sem divisão por zero, e o número grande mostra R$ 0,00. Os testes ficam nas Tasks 2 e 5.
3. **Categoria criada pelo usuário e descrição vazia:** usam o ícone e a cor de "Outros", e a linha mostra "Gasto" ou "Entrada". Os testes ficam nas Tasks 4 e 6.
4. **Aba antiga salva no aparelho** (`visao`, `lancamentos`) e o botão Sair, que não existe mais no topo:
   - A aba antiga vira a nova.
   - Sair ou entrar não quebra o app.
   - O teste fica na Task 3, e a conferência no navegador na Task 8.
5. **Desfazer depois que a nuvem já recebeu o lançamento:** o item não pode voltar na próxima sincronia, porque a marca em `apagados` vence. O teste fica na Task 3.

---

### Task 1: `js/formato.js` e `chaveComerciante` em `base.js`

Tira de `painel.js` as funções puras de formatação e a chave do lugar, sem mudar o comportamento.

**Files:**
- Create: `js/formato.js`
- Modify: `js/base.js` (adicionar `chaveComerciante` no fim)
- Modify: `js/painel.js:15-16` (MESES/DIAS_SEM), `:25-39` (moeda, brl, brlCurto, pct, pctTxt, esc, rotuloMes, rotuloData, abrevMes), `:177-186` (chaveComerciante), import da linha 1
- Test: `testes/formato.test.js` (novo), `testes/base.test.js` (acrescentar)

**Interfaces:**
- Produces:
  - `formato.js`: `MESES: string[]`, `DIAS_SEM: string[]`, `brl(v): string`, `brlCurto(v): string`, `pct(a,b): number`, `pctTxt(n): string`, `esc(s): string`, `rotuloMes("2026-11"): "novembro de 2026"`, `rotuloData("2026-11-07"): "07 de novembro"`, `abrevMes("2026-11"): "nov/2026"`.
  - Também em `formato.js`: `rotuloDia(data, hoje): "Hoje" | "Ontem" | "7 de novembro"`, `din(v, sinal=""): '<span class="din">' + sinal + brl(v) + '</span>'`, `maiuscula(s): string` (sem espaços nas pontas, primeira letra maiúscula).
  - `base.js`: `chaveComerciante(desc): string`.

- [ ] **Step 1: Write the failing tests**

`testes/formato.test.js`:
```js
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
```
Acrescentar em `testes/base.test.js` (incluir `chaveComerciante` no import da linha 3):
```js
test("chaveComerciante reduz a descrição ao nome do lugar", () => {
  assert.equal(chaveComerciante("COMPRA CARTAO IFOOD *IFOOD 4829"), "ifood");
  assert.equal(chaveComerciante("iFood"), "ifood");
  assert.equal(chaveComerciante("pix enviado joao"), "joao");
  assert.equal(chaveComerciante("Gasto"), "gasto");
  assert.equal(chaveComerciante("123"), "");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test testes/formato.test.js testes/base.test.js`
Expected: FAIL com `Cannot find module` para `formato.js` e `chaveComerciante` não exportada.

- [ ] **Step 3: Implement**

`js/formato.js`:
```js
/* formatação pura — sem DOM, sem estado; usada pelo painel, pelas telas e pelos testes */
import { somarDias } from "./base.js";

export const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
export const DIAS_SEM = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];

const moeda = new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" });
export const brl = v => moeda.format(Number(v) || 0);
export const brlCurto = v => {
  const n = Number(v) || 0;
  return n >= 1000 ? "R$ " + (n/1000).toFixed(1).replace(".",",") + "k" : brl(n);
};
export const pct = (a,b) => (!b ? 0 : (a/b)*100);
export const pctTxt = n => (n < 10 ? n.toFixed(1).replace(".",",") : Math.round(n)) + "%";
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

const partes = d => d.split("-").map(Number);
export const rotuloMes = p => { const [a,m] = p.split("-"); return MESES[+m-1] + " de " + a; };
export const rotuloData = d => { const [,m,dd] = partes(d); return String(dd).padStart(2,"0") + " de " + MESES[m-1]; };
export const abrevMes = p => MESES[+p.slice(5) - 1].slice(0, 3) + "/" + p.slice(0, 4);
export const rotuloDia = (d, hoje) => {
  if (d === hoje) return "Hoje";
  if (d === somarDias(hoje, -1)) return "Ontem";
  const [,m,dd] = partes(d);
  return dd + " de " + MESES[m-1];
};

/* todo valor em dinheiro desenhado dentro de .din some no modo "esconder valores" */
export const din = (v, sinal = "") => `<span class="din">${sinal}${brl(v)}</span>`;
export const maiuscula = s => { const t = String(s ?? "").trim(); return t ? t[0].toUpperCase() + t.slice(1) : t; };
```
`js/base.js`: acrescentar no fim, copiando o corpo **igual** ao de `painel.js:177-186`:
```js
/* reduz "COMPRA CARTAO IFOOD *IFOOD 4829" a "ifood" — chave do lugar e do aprendizado */
export function chaveComerciante(desc){
  let n = normalizar(desc)
    .replace(/\b(compra|no|na|nos|debito|credito|cartao|cart|pix|enviado|recebido|para|de|do|da|pagamento|pag|parcela|em|cp|tarifa|transferencia|ted|doc|final|elo|visa|master|mastercard|pagto|com)\b/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const toks = [...new Set(n.split(" ").filter(t => t.length > 2))];
  return toks.slice(0, 3).join(" ");
}
```
`js/painel.js`:
- Apagar `MESES`, `DIAS_SEM`, `moeda`, `brl`, `brlCurto`, `pct`, `pctTxt`, `esc`, `rotuloMes`, `rotuloData`, `abrevMes` e a função `chaveComerciante`.
- Ficam no `painel.js`: `$`, `uid`, `hoje`, `partes`, `diaSemana` e os ícones.
- Imports no topo:
```js
import { normalizar, RE_ENTRADA, CATS_BASE, mesDe, diasNoMes, hojeLocal, somarDias, somarMeses, chaveComerciante } from "./base.js";
import { MESES, DIAS_SEM, brl, brlCurto, pct, pctTxt, esc, rotuloMes, rotuloData, abrevMes, maiuscula } from "./formato.js";
```

- [ ] **Step 4: Run tests**

Run: `node --test "testes/*.test.js"`
Expected: PASS, todos (55 + 4 novos).

- [ ] **Step 5: Smoke no navegador**

`preview_start` "painel", abrir `/` e ler o console com `read_console_messages` (`onlyErrors: true`).
Expected: nenhum erro, e as abas atuais funcionando como antes.

- [ ] **Step 6: Commit**
```bash
git add js/formato.js js/base.js js/painel.js testes/formato.test.js testes/base.test.js
git commit -m "refactor: formatação e chave do lugar em módulos testáveis

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `js/raiox.js` (cálculos do Raio-X) e `js/icones.js` (cores)

`icones.js` nasce aqui só com `corDe`, porque `porCategoria` precisa dela. Os ícones entram na Task 4.

**Files:**
- Create: `js/raiox.js`, `js/icones.js`
- Modify: `js/painel.js:19` (NAO_CORTAR), `:42` (corDe), `:142-149` (porCategoria) → passam a ser importados
- Test: `testes/raiox.test.js` (novo)

**Interfaces:**
- Consumes: `chaveComerciante`, `normalizar`, `mesDe`, `diasNoMes`, `somarMeses` (base.js); `MESES`, `maiuscula` (formato.js).
- Produces:
  - `icones.js`: `corDe(nome): string` (CSS var).
  - `raiox.js` (constante e categorias): `NAO_CORTAR: string[]`; `porCategoria(gastos): {nome,total,cor}[]`, em ordem de total.
  - `raiox.js` (lugares): `chaveLugar(desc): string`; `agruparPorLugar(gastos): {chave,nome,categoria,total,qtd,media,itens}[]`.
  - `raiox.js` (comparação):
    - `trechoComparavel(periodo, hoje)` devolve `{ atual:{de,ate}, anterior:{de,ate}, rotulo } | null`.
    - `comparar(atual, anterior)` devolve `{ diferenca, sentido: "mais"|"menos"|"igual" }`.
    - `compararPeriodo(lancamentos, periodo, hoje, escolher)` devolve `{ diferenca, sentido, rotulo } | null`.
  - `raiox.js` (faixa, semanas e dica):
    - `faixaCategorias(cats, minimo=3)` devolve `{nome,total,cor,pct,agrupado?}[]`.
    - `porSemana(gastos, periodo)` devolve `{rot,total}[4] | null`.
    - `dicaCorte(lugar)` devolve `{n, valor} | null`.

- [ ] **Step 1: Write the failing test** — `testes/raiox.test.js`:
```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test testes/raiox.test.js`
Expected: FAIL, `Cannot find module '../js/raiox.js'`.

- [ ] **Step 3: Implement**

`js/icones.js` (só o começo; a Task 4 completa):
```js
/* ícones e cores das categorias e da interface */
import { CATS_BASE } from "./base.js";

export const corDe = nome => (CATS_BASE.find(c => c.nome === nome) || { cor:"var(--c0)" }).cor;
```
`js/raiox.js`:
```js
/* Raio-X do mês: para onde foi o dinheiro — cálculos puros, testados em testes/raiox.test.js */
import { normalizar, chaveComerciante, mesDe, diasNoMes, somarMeses } from "./base.js";
import { MESES, maiuscula } from "./formato.js";
import { corDe } from "./icones.js";

/* Não sugerimos cortar estas: dízimo é decisão pessoal, poupança não é gasto. */
export const NAO_CORTAR = ["Igreja", "Guardar dinheiro"];

const arred = v => Math.round(v * 100) / 100;
const pad = n => String(n).padStart(2, "0");
const soma = arr => arr.reduce((t, l) => t + (Number(l.valor) || 0), 0);
const maisRecente = (a, b) => b.data.localeCompare(a.data) || String(b.id).localeCompare(String(a.id));

export function porCategoria(gastos){
  const m = new Map();
  for (const g of gastos){
    const k = g.categoria || "Outros";
    m.set(k, (m.get(k) || 0) + (Number(g.valor) || 0));
  }
  return [...m].map(([nome, total]) => ({ nome, total, cor: corDe(nome) })).sort((a, b) => b.total - a.total);
}

/* "ifood 35" e "COMPRA CARTAO IFOOD *IFOOD" são o mesmo lugar */
export const chaveLugar = desc => chaveComerciante(desc) || normalizar(desc) || "-";

export function agruparPorLugar(gastos){
  const grupos = new Map();
  for (const g of gastos){
    const k = chaveLugar(g.descricao);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(g);
  }
  return [...grupos].map(([chave, itens]) => {
    itens.sort(maisRecente);
    const vezes = new Map();
    for (const g of itens) vezes.set(g.categoria || "Outros", (vezes.get(g.categoria || "Outros") || 0) + 1);
    const max = Math.max(...vezes.values());
    const categoria = itens.find(g => vezes.get(g.categoria || "Outros") === max).categoria || "Outros";
    const total = arred(soma(itens));
    return { chave, nome: maiuscula(itens[0].descricao) || "Sem descrição", categoria,
             total, qtd: itens.length, media: arred(total / itens.length), itens };
  }).sort((a, b) => b.total - a.total || b.qtd - a.qtd || a.nome.localeCompare(b.nome, "pt-BR"));
}

/* no dia 9, novembro se compara com 1 a 9 de outubro — não com outubro inteiro */
export function trechoComparavel(periodo, hoje){
  if (!/^\d{4}-\d{2}$/.test(periodo)) return null;
  const agora = mesDe(hoje);
  if (periodo > agora) return null;
  const ant = somarMeses(periodo, -1);
  const [aa, ma] = ant.split("-").map(Number);
  if (periodo === agora){
    const fim = Math.min(+hoje.slice(8), diasNoMes(aa, ma));
    return { atual: { de: periodo + "-01", ate: hoje },
             anterior: { de: ant + "-01", ate: ant + "-" + pad(fim) },
             rotulo: "até " + fim + " de " + MESES[ma - 1] };
  }
  const [a, m] = periodo.split("-").map(Number);
  return { atual: { de: periodo + "-01", ate: periodo + "-" + pad(diasNoMes(a, m)) },
           anterior: { de: ant + "-01", ate: ant + "-" + pad(diasNoMes(aa, ma)) },
           rotulo: "em " + MESES[ma - 1] };
}

export function comparar(atual, anterior){
  const d = arred(atual - anterior);
  return { diferenca: Math.abs(d), sentido: Math.abs(d) < 1 ? "igual" : d > 0 ? "mais" : "menos" };
}

const noTrecho = (l, t) => l.data >= t.de && l.data <= t.ate;
export function compararPeriodo(lancamentos, periodo, hoje, escolher){
  const t = trechoComparavel(periodo, hoje);
  if (!t) return null;
  const mesAnterior = t.anterior.de.slice(0, 7);
  if (!lancamentos.some(l => mesDe(l.data) === mesAnterior)) return null;
  const atual = soma(lancamentos.filter(l => escolher(l) && noTrecho(l, t.atual)));
  const anterior = soma(lancamentos.filter(l => escolher(l) && noTrecho(l, t.anterior)));
  return { ...comparar(atual, anterior), rotulo: t.rotulo };
}

/* pedaços da faixa: os menores que `minimo`% viram um só "Outros" (a lista completa continua com todos) */
export function faixaCategorias(cats, minimo = 3){
  const total = cats.reduce((t, c) => t + c.total, 0);
  if (!(total > 0)) return [];
  const grandes = [], resto = { total: 0, nomes: [] };
  for (const c of cats){
    if (c.nome === "Outros" || c.total / total * 100 < minimo){ resto.total += c.total; resto.nomes.push(c.nome); }
    else grandes.push({ ...c, pct: c.total / total * 100 });
  }
  if (resto.total > 0) grandes.push({ nome: "Outros", total: arred(resto.total), cor: "var(--c0)",
    pct: resto.total / total * 100, agrupado: resto.nomes.some(n => n !== "Outros") });
  return grandes;
}

export function porSemana(gastos, periodo){
  if (!/^\d{4}-\d{2}$/.test(periodo)) return null;
  const [a, m] = periodo.split("-").map(Number);
  const sem = ["1–7", "8–14", "15–21", "22–" + diasNoMes(a, m)].map(rot => ({ rot, total: 0 }));
  for (const g of gastos){
    if (mesDe(g.data) !== periodo) continue;
    const d = +g.data.slice(8);
    sem[d <= 7 ? 0 : d <= 14 ? 1 : d <= 21 ? 2 : 3].total += Number(g.valor) || 0;
  }
  for (const s of sem) s.total = arred(s.total);
  return sem;
}

/* "Se cortar 4 vezes, sobram uns R$ 140" — um terço das vezes, arredondado */
export function dicaCorte(lugar){
  if (!lugar || lugar.qtd < 4 || NAO_CORTAR.includes(lugar.categoria)) return null;
  const n = Math.round(lugar.qtd / 3);
  return { n, valor: arred(lugar.media * n) };
}
```
`js/painel.js`:
- Apagar `NAO_CORTAR`, `corDe` e `porCategoria`.
- Imports:
```js
import { corDe } from "./icones.js";
import { porCategoria, NAO_CORTAR } from "./raiox.js";
```
- Se `CATS_BASE` ficar sem uso em `painel.js`, tirar do import. Conferir com `grep -n CATS_BASE js/painel.js`.

- [ ] **Step 4: Run tests**

Run: `node --test "testes/*.test.js"`
Expected: PASS, todos.

- [ ] **Step 5: Smoke**

Recarregar `/` no navegador e conferir que o console não tem erros. As abas Economizar e Metas devem mostrar os mesmos números de antes.

- [ ] **Step 6: Commit**
```bash
git add js/raiox.js js/icones.js js/painel.js testes/raiox.test.js
git commit -m "feat: cálculos do Raio-X (lugares, trecho comparável, faixa, semanas)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Navegação nova e apagar que não volta

**Files:**
- Create: `js/navegacao.js`
- Modify: `js/juntar.js` (acrescentar `apagarLancamento`)
- Modify: `js/painel.js`, cases `apagar` (~1455) e `desfazer-fixa` (~1500) passam a usar `apagarLancamento`
- Test: `testes/navegacao.test.js` (novo), `testes/juntar.test.js` (acrescentar)

**Interfaces:**
- Produces:
  - `navegacao.js`: `BARRA = ["inicio","extrato","+","fixas","mais"]` e `SUBTELAS = ["economizar","metas","importar","conta"]`.
  - `navegacao.js`: `abaValida(id): string` (id novo válido, ou `"inicio"`) e `posicaoNaBarra(id): number` (0 a 4; as sub-telas dão 4).
  - `juntar.js`: `apagarLancamento(estado, id, agora): boolean`.

- [ ] **Step 1: Write the failing tests**

`testes/navegacao.test.js`:
```js
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
```
Acrescentar em `testes/juntar.test.js` (incluir `apagarLancamento` e `estadoVazio` no import, se ainda não estiverem):
```js
test("apagarLancamento tira o item e marca em apagados", () => {
  const e = estadoVazio(1);
  e.lancamentos.push({ id:"x", tipo:"gasto", data:"2026-11-09", valor:35, descricao:"ifood", categoria:"Outros", editadoEm:1 });
  assert.equal(apagarLancamento(e, "x", 50), true);
  assert.equal(e.lancamentos.length, 0);
  assert.equal(e.apagados.x, 50);
  assert.equal(apagarLancamento(e, "nao-existe", 60), false);
});
test("desfazer depois que a nuvem já tem o lançamento: ele não volta", () => {
  const item = { id:"x", tipo:"gasto", data:"2026-11-09", valor:35, descricao:"ifood", categoria:"Outros", editadoEm:10 };
  const nuvem = estadoVazio(1); nuvem.lancamentos.push({ ...item });
  const local = estadoVazio(1); local.lancamentos.push({ ...item });
  apagarLancamento(local, "x", 20);
  assert.equal(juntar(local, nuvem).lancamentos.some(l => l.id === "x"), false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test testes/navegacao.test.js testes/juntar.test.js`
Expected: FAIL, módulo `navegacao.js` não existe e `apagarLancamento` não é exportada.

- [ ] **Step 3: Implement**

`js/navegacao.js`:
```js
/* abas da barra de baixo; "+" é o botão de lançar, não uma tela */
export const BARRA = ["inicio", "extrato", "+", "fixas", "mais"];
export const SUBTELAS = ["economizar", "metas", "importar", "conta"];
const ANTIGAS = { visao: "inicio", lancamentos: "extrato" };

export function abaValida(id){
  const n = ANTIGAS[id] || id;
  return (n !== "+" && BARRA.includes(n)) || SUBTELAS.includes(n) ? n : "inicio";
}
export const posicaoNaBarra = id => SUBTELAS.includes(id) ? 4 : Math.max(0, BARRA.indexOf(id));
```
`js/juntar.js` (fim do arquivo):
```js
/* apagar de verdade: a marca em `apagados` impede que a nuvem traga o item de volta */
export function apagarLancamento(estado, id, agora){
  const antes = estado.lancamentos.length;
  estado.lancamentos = estado.lancamentos.filter(l => l.id !== id);
  if (estado.lancamentos.length === antes) return false;
  estado.apagados[id] = agora;
  return true;
}
```
`js/painel.js`:
- Import: `import { estadoVazio, migrarV2, juntar, apagarLancamento } from "./juntar.js";`
- No case `apagar`, trocar o corpo do callback por:
```js
if (apagarLancamento(estado, l.id, Date.now())){ mudou(); torrada("Lançamento apagado."); }
```
- No case `desfazer-fixa`, trocar as duas linhas de filtro e `apagados` por:
```js
apagarLancamento(estado, l.id, Date.now());
```

- [ ] **Step 4: Run tests**

Run: `node --test "testes/*.test.js"`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add js/navegacao.js js/juntar.js js/painel.js testes/navegacao.test.js testes/juntar.test.js
git commit -m "feat: abas novas com conversão das antigas e apagar que não volta da nuvem

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Ícones das categorias e da interface

**Files:**
- Modify: `js/icones.js` (completar)
- Test: `testes/icones.test.js` (novo)

**Interfaces:**
- Consumes: `CATS_BASE` (base.js).
- Produces:
  - `iconeCat(nome, { entrada=false, vt="" }={}): string`, um `<span class="ic-cat" style="--c:COR[;view-transition-name:VT]" aria-hidden="true"><svg…></span>`.
  - `iconeUI(nome, tam=20): string`. Nomes válidos: `inicio`, `extrato`, `fixas`, `mais`, `somar`, `olho`, `olho-fechado`, `voltar`, `fechar`, `busca`, `seta`, `editar`, `apagar`, `economizar`, `metas`, `importar`, `planilha`, `nuvem`, `check`.
  - `nomeCurto(nome): string`.
  - Todo `<svg>` sai com `pointer-events="none"`, para o toque cair no botão. O `click` do painel compara `ev.target` com o botão em `fechar`.

- [ ] **Step 1: Write the failing test** — `testes/icones.test.js`:
```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test testes/icones.test.js`
Expected: FAIL, `iconeCat is not a function` (o export não existe).

- [ ] **Step 3: Implement**

Completar `js/icones.js`:
```js
/* ícones e cores das categorias e da interface */
import { CATS_BASE } from "./base.js";

export const corDe = nome => (CATS_BASE.find(c => c.nome === nome) || { cor:"var(--c0)" }).cor;

const CAT = {
  "Comida/Fast Food": '<path d="M7 3v7a2 2 0 0 0 2 2 2 2 0 0 0 2-2V3M9 12v9M17 21V3c-2 1.5-3 4-3 7h3"/>',
  "Transporte":       '<path d="M5 16.5V12l1.8-4.6A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.4L19 12v4.5M3.5 12h17"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/>',
  "Contas fixas":     '<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3zM9 8h6M9 12h6M9 16h3"/>',
  "Lazer":            '<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4z"/><path d="M14 7v2M14 11v2M14 15v2"/>',
  "Presentes":        '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8C10.5 5 7 4.5 7 6.8 7 8 9.5 8 12 8zm0 0c1.5-3 5-3.5 5-1.2C17 8 14.5 8 12 8z"/>',
  "Igreja":           '<path d="M12 2.5v4M10 4.5h4M6 21v-8.5l6-4.5 6 4.5V21M4 21h16M10 21v-4a2 2 0 0 1 4 0v4"/>',
  "Coisas pra mim":   '<path d="M5.5 8h13l-1 12.5h-11zM9 8V6.5a3 3 0 0 1 6 0V8"/>',
  "Saúde":            '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10C19.5 15.6 12 20 12 20z"/><path d="M12 10.5v4M10 12.5h4"/>',
  "Guardar dinheiro": '<path d="M5 11.5a6.5 5.5 0 0 1 12-2.8l2.5-1.2v3.4l1 .8v3l-1.6.7a6.5 5.5 0 0 1-2.4 2.3V20h-3v-1.3a8 8 0 0 1-3 0V20h-3v-2.3A5.4 5.4 0 0 1 5 11.5z"/><path d="M10 7.5h3"/>',
  "Outros":           '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
};
const ENTRADA = '<path d="M17 7 7 17M7 9v8h8"/>';

const UI = {
  inicio:        '<path d="M4 11.2 12 4l8 7.2V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
  extrato:       '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.6" cy="6.5" r="1"/><circle cx="4.6" cy="12" r="1"/><circle cx="4.6" cy="17.5" r="1"/>',
  fixas:         '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>',
  mais:          '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  somar:         '<path d="M12 5v14M5 12h14"/>',
  olho:          '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  "olho-fechado":'<path d="M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.7 3.4M6.6 6.6A16.8 16.8 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  voltar:        '<path d="M15 5l-7 7 7 7"/>',
  fechar:        '<path d="M6 6l12 12M18 6 6 18"/>',
  busca:         '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  seta:          '<path d="M9 5l7 7-7 7"/>',
  editar:        '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  apagar:        '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  economizar:    '<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.8 10.6c.8.7 1.3 1.6 1.3 2.6v.3h5v-.3c0-1 .5-1.9 1.3-2.6A6 6 0 0 0 12 3z"/>',
  metas:         '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  importar:      '<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5zM14 3.5v5h5M12 11.5v6M9.5 15l2.5 2.5 2.5-2.5"/>',
  planilha:      '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  nuvem:         '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.6 3.8 3.8 0 0 1-.4 7.4z"/>',
  check:         '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
};

const CURTO = { "Comida/Fast Food":"Comida", "Contas fixas":"Contas", "Coisas pra mim":"Pra mim", "Guardar dinheiro":"Guardado" };
export const nomeCurto = nome => CURTO[nome] || nome;

const svg = (corpo, tam) => `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" pointer-events="none">${corpo}</svg>`;
export const iconeUI = (nome, tam = 20) => svg(UI[nome] || "", tam);

export function iconeCat(nome, { entrada = false, vt = "" } = {}){
  const corpo = entrada ? ENTRADA : (CAT[nome] || CAT.Outros);
  const cor = entrada ? "var(--bom)" : corDe(nome);
  return `<span class="ic-cat" style="--c:${cor}${vt ? ";view-transition-name:" + vt : ""}" aria-hidden="true">${svg(corpo, 19)}</span>`;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test "testes/*.test.js"`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add js/icones.js testes/icones.test.js
git commit -m "feat: ícones das categorias e da interface

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Tela Início (Raio-X) e folha de detalhe

**Files:**
- Create: `js/telas/inicio.js`
- Test: `testes/inicio.test.js` (novo)

**Interfaces:**
- Consumes:
  - De `raiox.js`: `porCategoria`, `agruparPorLugar`, `chaveLugar`, `compararPeriodo`, `faixaCategorias`, `porSemana`, `dicaCorte`.
  - De `formato.js`: `brl`, `din`, `esc`, `pct`, `pctTxt`, `rotuloDia`, `MESES`.
  - De `icones.js`: `iconeCat`, `iconeUI`, `nomeCurto`.
  - De `base.js`: `mesDe`.
- Produces:
  - `telaInicio({ lancamentos, periodo, hoje, fixas }): string`, onde `fixas` é `{ qtd, valor, atrasado, ateDia } | null`.
  - `folhaDetalhe({ lancamentos, periodo, hoje, tipo: "lugar"|"cat", chave }): string | null`, que devolve o `<div class="folha folha-detalhe">…</div>`. O `painel.js` põe esse HTML dentro do véu.
- Marcas no HTML que o painel e o CSS usam (data-acao):
  - `data-acao="detalhe" data-tipo data-chave` em pedaços, pílulas e linhas.
  - `data-acao="todas-cats"`, `data-acao="lancar"`, `data-acao="ir" data-aba="fixas"`, `data-acao="fechar"` e `data-acao="editar" data-id`.
- Marcas para contar e animar:
  - `data-conta="saiu"` no número grande, `.faixa-pd` com `style="--p:<peso>;--c:<cor>"` e `data-k`.
  - `.sem` com `--h` e `--k`.

- [ ] **Step 1: Write the failing test** — `testes/inicio.test.js`:
```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test testes/inicio.test.js`
Expected: FAIL, módulo `../js/telas/inicio.js` não existe.

- [ ] **Step 3: Implement** — `js/telas/inicio.js`:
```js
/* Início: o Raio-X do mês. Função pura: dados entram, HTML sai. */
import { mesDe } from "../base.js";
import { brl, din, esc, pct, pctTxt, rotuloDia, MESES } from "../formato.js";
import { iconeCat, iconeUI, nomeCurto } from "../icones.js";
import { porCategoria, agruparPorLugar, chaveLugar, compararPeriodo, faixaCategorias, porSemana, dicaCorte } from "../raiox.js";

const ehGasto = l => l.tipo === "gasto";
const soma = arr => arr.reduce((t, l) => t + (Number(l.valor) || 0), 0);
const doPeriodo = (lancs, periodo) => periodo === "tudo" ? lancs : lancs.filter(l => mesDe(l.data) === periodo);
const nomeMes = periodo => MESES[+periodo.slice(5) - 1];
const vezes = n => n + (n === 1 ? " vez" : " vezes");
const maisRecente = (a, b) => b.data.localeCompare(a.data) || String(b.id).localeCompare(String(a.id));

const textoComparacao = c => c.sentido === "igual" ? "igual " + c.rotulo : `${brl(c.diferenca)} a ${c.sentido} que ${c.rotulo}`;
const curta = c => c.sentido === "igual" ? "igual" : din(c.diferenca, c.sentido === "mais" ? "+" : "−");

function avisoFixas(f){
  if (!f) return "";
  const quando = f.atrasado ? " · tem atrasada" : f.ateDia ? " até dia " + f.ateDia : "";
  return `<button type="button" class="aviso-fixas" data-t="${f.atrasado ? "grave" : ""}" data-acao="ir" data-aba="fixas">
    ${iconeUI("fixas", 18)}<span>${f.qtd} fixa${f.qtd === 1 ? "" : "s"} a pagar · ${din(f.valor)}${quando}</span>${iconeUI("seta", 16)}</button>`;
}

function blocoFaixa(gastos){
  const fx = faixaCategorias(porCategoria(gastos));
  const alvo = s => s.agrupado ? `data-acao="todas-cats"` : `data-acao="detalhe" data-tipo="cat" data-chave="${esc(s.nome)}"`;
  const pedacos = fx.map(s =>
    `<button type="button" class="faixa-pd" style="--p:${s.pct.toFixed(2)};--c:${s.cor}" data-k="${esc(s.nome)}" ${alvo(s)} aria-label="${esc(s.nome)} ${pctTxt(s.pct)}"></button>`).join("");
  const top = fx.slice(0, 4), resto = fx.length - top.length;
  const pilulas = top.map(s => `<button type="button" class="pilula" ${alvo(s)}><i style="--c:${s.cor}"></i>${esc(nomeCurto(s.nome))} ${pctTxt(s.pct)}</button>`).join("")
    + (resto > 0 ? `<button type="button" class="pilula" data-acao="todas-cats">+${resto}</button>` : "");
  return `<section class="bloco"><div class="faixa">${pedacos}</div><div class="pilulas">${pilulas}</div></section>`;
}

function blocoTop(lancamentos, gastos, periodo, hoje){
  const lugares = agruparPorLugar(gastos.filter(g => g.categoria !== "Guardar dinheiro")).slice(0, 3);
  if (!lugares.length) return "";
  const linhas = lugares.map(l => {
    const c = compararPeriodo(lancamentos, periodo, hoje, x => ehGasto(x) && chaveLugar(x.descricao) === l.chave);
    return `<button type="button" class="linha" data-acao="detalhe" data-tipo="lugar" data-chave="${esc(l.chave)}">
      ${iconeCat(l.categoria)}
      <span class="linha-txt"><b>${esc(l.nome)}</b><small>${vezes(l.qtd)} · média ${din(l.media)}</small></span>
      <span class="linha-val"><b>${din(l.total)}</b>${c ? `<small data-s="${c.sentido}">${curta(c)}</small>` : ""}</span>
    </button>`;
  }).join("");
  return `<section class="bloco"><h2>Os 3 que mais pesaram</h2><div class="linhas">${linhas}</div></section>`;
}

export function telaInicio({ lancamentos, periodo, hoje, fixas = null }){
  const itens = doPeriodo(lancamentos, periodo);
  const aviso = avisoFixas(fixas);
  if (!itens.length) return aviso + `
    <section class="convite">
      <h2>Nada lançado ${periodo === "tudo" ? "ainda" : "em " + nomeMes(periodo)}</h2>
      <p>Toque no + e lance o primeiro gasto${periodo === "tudo" ? "" : " de " + nomeMes(periodo)}. O Sobrou calcula o resto.</p>
      <button class="btn btn-forte" type="button" data-acao="lancar">Lançar agora</button>
    </section>`;

  const gastos = itens.filter(ehGasto);
  const tg = soma(gastos), te = soma(itens.filter(l => l.tipo === "entrada")), saldo = te - tg;
  const comp = compararPeriodo(lancamentos, periodo, hoje, ehGasto);
  const heroi = `
    <section class="heroi">
      <div class="heroi-rot">${periodo === "tudo" ? "Saiu no total" : "Saiu em " + nomeMes(periodo)}</div>
      <div class="heroi-val din" data-conta="saiu">${brl(tg)}</div>
      ${comp ? `<div class="heroi-comp" data-s="${comp.sentido}">${textoComparacao(comp)}</div>` : ""}
      <div class="heroi-pe">Entrou ${din(te)} · ${saldo >= 0 ? "Sobrou" : "Faltou"} ${din(Math.abs(saldo))}</div>
    </section>`;
  if (!gastos.length) return heroi + aviso + `<p class="nada">Nenhum gasto ${periodo === "tudo" ? "lançado" : "em " + nomeMes(periodo)} ainda.</p>`;
  return heroi + blocoFaixa(gastos) + blocoTop(lancamentos, gastos, periodo, hoje) + aviso;
}

export function folhaDetalhe({ lancamentos, periodo, hoje, tipo, chave }){
  const gastos = doPeriodo(lancamentos, periodo).filter(ehGasto);
  const pertence = tipo === "lugar" ? g => chaveLugar(g.descricao) === chave : g => (g.categoria || "Outros") === chave;
  const itens = gastos.filter(pertence).sort(maisRecente);
  if (!itens.length) return null;

  const lugar = tipo === "lugar" ? agruparPorLugar(itens)[0] : null;
  const nome = lugar ? lugar.nome : chave;
  const total = soma(itens);
  const comp = compararPeriodo(lancamentos, periodo, hoje, l => ehGasto(l) && pertence(l));
  const sem = porSemana(itens, periodo);
  const maior = sem ? Math.max(...sem.map(s => s.total), 0) : 0;
  const dica = dicaCorte(lugar);
  const semanas = !sem ? "" : `<div class="semanas">${sem.map((s, i) =>
    `<button type="button" class="sem" style="--h:${maior ? (s.total / maior * 100).toFixed(1) : 0}%;--k:${i}" data-v="${esc(brl(s.total))}" aria-label="${s.rot}: ${esc(brl(s.total))}"><i></i><span>${s.rot}</span></button>`).join("")}</div>`;

  return `
  <div class="folha folha-detalhe" role="dialog" aria-modal="true" aria-labelledby="det-tit">
    <div class="alca" aria-hidden="true"></div>
    <div class="det-topo" data-puxa>${iconeCat(lugar ? lugar.categoria : chave, { vt: "ic-detalhe" })}<h2 id="det-tit">${esc(nome)}</h2>
      <button type="button" class="icone" data-acao="fechar" aria-label="Fechar">${iconeUI("fechar", 20)}</button></div>
    <div class="det-total din">${brl(total)}</div>
    <p class="sub">${vezes(itens.length)} ${periodo === "tudo" ? "no total" : "em " + nomeMes(periodo)} · ${pctTxt(pct(total, soma(gastos)))} de tudo que saiu</p>
    ${comp ? `<p class="heroi-comp" data-s="${comp.sentido}">${textoComparacao(comp)}</p>` : ""}
    ${semanas}
    <div class="det-lista">${itens.map(l => `<button type="button" class="det-item" data-acao="editar" data-id="${esc(l.id)}"><span>${rotuloDia(l.data, hoje)}${tipo === "cat" ? " · " + esc(l.descricao) : ""}</span>${din(l.valor)}</button>`).join("")}</div>
    ${dica ? `<p class="dica">${iconeUI("economizar", 16)}<span>Se cortar ${vezes(dica.n)}, sobram uns ${din(dica.valor)} a mais no mês.</span></p>` : ""}
  </div>`;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test "testes/*.test.js"`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add js/telas/inicio.js testes/inicio.test.js
git commit -m "feat: tela Início (Raio-X) e folha de detalhe

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tela Extrato

**Files:**
- Create: `js/telas/extrato.js`
- Test: `testes/extrato.test.js` (novo)

**Interfaces:**
- Consumes:
  - De `base.js`: `normalizar`.
  - De `formato.js`: `din`, `esc`, `rotuloDia`, `maiuscula`.
  - De `icones.js`: `iconeCat`, `iconeUI`, `nomeCurto`.
- Produces:
  - `filtrarExtrato(itens, { busca, filtro }): itens[]`. O `filtro` pode ser `"tudo"`, `"saidas"`, `"entradas"` ou `"cat:<Nome>"`.
  - `gruposPorDia(itens): { data, itens, saldo }[]`, do mais novo para o mais velho.
  - `linhaExtrato(l): string` e `listaExtrato(itens, hoje, busca=""): string`.
  - `telaExtrato({ itens, hoje, busca, filtro, rotuloPeriodo }): string`.
- Marcas no HTML que o painel e o CSS usam:
  - `#busca-extrato` e `#extrato-lista`.
  - `data-acao="filtro" data-f`.
  - `.lin[data-arrasta][data-id]` contendo `.lin-acoes`, os botões `editar` e `apagar` e o botão `.lin-frente` com `data-acao="editar"`.

- [ ] **Step 1: Write the failing test** — `testes/extrato.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrarExtrato, gruposPorDia, telaExtrato, listaExtrato, linhaExtrato } from "../js/telas/extrato.js";
import { brl } from "../js/formato.js";

const L = (id, tipo, data, valor, descricao, categoria = "") => ({ id, tipo, data, valor, descricao, categoria });
const ITENS = [
  L("a","gasto","2026-11-09",42.9,"iFood","Comida/Fast Food"),
  L("b","gasto","2026-11-09",35,"Uber","Transporte"),
  L("c","entrada","2026-11-08",5000,"Salário"),
  L("d","gasto","2026-11-08",31.5,"Farmácia","Saúde"),
];

test("busca ignora acento e maiúscula e olha categoria", () => {
  assert.deepEqual(filtrarExtrato(ITENS, { busca: "FARMACIA" }).map(l => l.id), ["d"]);
  assert.deepEqual(filtrarExtrato(ITENS, { busca: "transp" }).map(l => l.id), ["b"]);
});
test("filtros de saídas, entradas e categoria", () => {
  assert.deepEqual(filtrarExtrato(ITENS, { filtro: "entradas" }).map(l => l.id), ["c"]);
  assert.equal(filtrarExtrato(ITENS, { filtro: "saidas" }).length, 3);
  assert.deepEqual(filtrarExtrato(ITENS, { filtro: "cat:Saúde" }).map(l => l.id), ["d"]);
});
test("grupos por dia: mais novo primeiro, com saldo do dia", () => {
  const g = gruposPorDia(ITENS);
  assert.deepEqual(g.map(x => x.data), ["2026-11-09", "2026-11-08"]);
  assert.equal(g[0].saldo, -77.9);
  assert.equal(g[1].saldo, 4968.5);
});
test("lista usa Hoje e Ontem e o sinal do saldo", () => {
  const h = listaExtrato(ITENS, "2026-11-09");
  assert.ok(h.indexOf("Hoje") < h.indexOf("Ontem"));
  assert.ok(h.includes("−" + brl(77.9)));
  assert.ok(h.includes("+" + brl(4968.5)));
});
test("linha: arrastável, com editar e apagar, e descrição vazia vira Gasto", () => {
  const h = linhaExtrato(L("z","gasto","2026-11-09",10,"",""));
  assert.match(h, /class="lin" data-arrasta data-id="z"/);
  assert.match(h, /data-acao="apagar" data-id="z"/);
  assert.match(h, /<b>Gasto<\/b>/);
  assert.match(h, /<small>Outros<\/small>/);
});
test("tela: busca escapada, filtro marcado e filtro de categoria sumida volta para Tudo", () => {
  const h = telaExtrato({ itens: ITENS, hoje: "2026-11-09", busca: '"><x', filtro: "cat:Lazer", rotuloPeriodo: "em novembro" });
  assert.ok(h.includes('value="&quot;&gt;&lt;x"'));
  assert.match(h, /data-f="tudo" aria-pressed="true"/);
  assert.match(h, /data-f="cat:Saúde" aria-pressed="false"/);
});
test("tela vazia convida a lançar; filtro sem resultado avisa", () => {
  assert.match(telaExtrato({ itens: [], hoje: "2026-11-09", rotuloPeriodo: "em novembro" }), /Nada lançado em novembro/);
  assert.match(listaExtrato([], "2026-11-09", "pizza"), /Nada encontrado para “pizza”/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test testes/extrato.test.js`
Expected: FAIL, módulo não existe.

- [ ] **Step 3: Implement** — `js/telas/extrato.js`:
```js
/* Extrato: lista por dia, estilo app de banco. Funções puras: dados entram, HTML sai. */
import { normalizar } from "../base.js";
import { din, esc, rotuloDia, maiuscula } from "../formato.js";
import { iconeCat, iconeUI, nomeCurto } from "../icones.js";

const maisRecente = (a, b) => b.data.localeCompare(a.data) || String(b.id).localeCompare(String(a.id));

export function filtrarExtrato(itens, { busca = "", filtro = "tudo" } = {}){
  const q = normalizar(busca);
  return itens.filter(l => {
    if (filtro === "saidas" && l.tipo !== "gasto") return false;
    if (filtro === "entradas" && l.tipo !== "entrada") return false;
    if (filtro.startsWith("cat:") && (l.tipo !== "gasto" || (l.categoria || "Outros") !== filtro.slice(4))) return false;
    return !q || normalizar((l.descricao || "") + " " + (l.categoria || "")).includes(q);
  });
}

export function gruposPorDia(itens){
  const m = new Map();
  for (const l of itens.slice().sort(maisRecente)){
    if (!m.has(l.data)) m.set(l.data, []);
    m.get(l.data).push(l);
  }
  return [...m].map(([data, ls]) => ({
    data, itens: ls,
    saldo: Math.round(ls.reduce((t, l) => t + (l.tipo === "entrada" ? 1 : -1) * (Number(l.valor) || 0), 0) * 100) / 100,
  }));
}

export function linhaExtrato(l){
  const mais = l.tipo === "entrada";
  const desc = esc(maiuscula(l.descricao) || (mais ? "Entrada" : "Gasto"));
  const id = esc(l.id);
  return `<div class="lin" data-arrasta data-id="${id}">
    <div class="lin-acoes">
      <button type="button" class="lin-ed" data-acao="editar" data-id="${id}" aria-label="Editar ${desc}">${iconeUI("editar", 18)}</button>
      <button type="button" class="lin-ap" data-acao="apagar" data-id="${id}" aria-label="Apagar ${desc}">${iconeUI("apagar", 18)}</button>
    </div>
    <button type="button" class="lin-frente" data-acao="editar" data-id="${id}">
      ${iconeCat(l.categoria, { entrada: mais })}
      <span class="lin-txt"><b>${desc}</b><small>${mais ? "Entrada" : esc(l.categoria || "Outros")}</small></span>
      <span class="lin-val${mais ? " mais" : ""}">${din(l.valor, mais ? "+" : "−")}</span>
    </button>
  </div>`;
}

export function listaExtrato(itens, hoje, busca = ""){
  if (!itens.length) return `<p class="nada">${busca.trim() ? "Nada encontrado para “" + esc(busca.trim()) + "”." : "Nada com esse filtro."}</p>`;
  return gruposPorDia(itens).map(g =>
    `<div class="dia"><span>${rotuloDia(g.data, hoje)}</span>${din(Math.abs(g.saldo), g.saldo >= 0 ? "+" : "−")}</div>${g.itens.map(linhaExtrato).join("")}`).join("");
}

export function telaExtrato({ itens, hoje, busca = "", filtro = "tudo", rotuloPeriodo = "" }){
  if (!itens.length) return `<section class="convite"><h2>Nada lançado ${esc(rotuloPeriodo)}</h2>
    <p>Toque no + para lançar um gasto ou um recebimento.</p>
    <button class="btn btn-forte" type="button" data-acao="lancar">Lançar agora</button></section>`;
  const cats = [...new Set(itens.filter(l => l.tipo === "gasto").map(l => l.categoria || "Outros"))];
  if (filtro.startsWith("cat:") && !cats.includes(filtro.slice(4))) filtro = "tudo";
  const chips = [["tudo", "Tudo"], ["saidas", "Saídas"], ["entradas", "Entradas"], ...cats.map(c => ["cat:" + c, nomeCurto(c)])]
    .map(([f, r]) => `<button type="button" class="chip-f" data-acao="filtro" data-f="${esc(f)}" aria-pressed="${f === filtro}">${esc(r)}</button>`).join("");
  return `<div class="busca">${iconeUI("busca", 18)}<input id="busca-extrato" type="search" value="${esc(busca)}" placeholder="Buscar ifood, mercado…" aria-label="Buscar no extrato" autocomplete="off" enterkeyhint="search"></div>
    <div class="chips-f">${chips}</div>
    <div id="extrato-lista">${listaExtrato(filtrarExtrato(itens, { busca, filtro }), hoje, busca)}</div>`;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test "testes/*.test.js"`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add js/telas/extrato.js testes/extrato.test.js
git commit -m "feat: tela Extrato por dia com busca e filtros

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Telas Mais e Conta e nuvem

**Files:**
- Create: `js/telas/mais.js`
- Test: `testes/mais.test.js` (novo)

**Interfaces:**
- Consumes: `esc` (formato.js), `iconeUI` (icones.js).
- Produces:
  - `telaMais(): string`.
  - `voltarMais(): string`, o botão `data-acao="ir" data-aba="mais"`.
  - `telaConta({ email, estado }): string`. Com e-mail tem `#conta-estado` e os botões `data-acao="sincronizar"` e `data-acao="sair"`. Sem e-mail tem `data-acao="entrar"`.

- [ ] **Step 1: Write the failing test** — `testes/mais.test.js`:
```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test testes/mais.test.js`
Expected: FAIL, módulo não existe.

- [ ] **Step 3: Implement** — `js/telas/mais.js`:
```js
/* Mais: o que saiu da barra de baixo, sem mudar de lógica */
import { esc } from "../formato.js";
import { iconeUI } from "../icones.js";

const ITENS = [
  { alvo: 'data-acao="ir" data-aba="economizar"', ic: "economizar", t: "Economizar",       s: "Onde dá para cortar" },
  { alvo: 'data-acao="ir" data-aba="metas"',      ic: "metas",      t: "Metas",            s: "Limites por categoria" },
  { alvo: 'data-acao="ir" data-aba="importar"',   ic: "importar",   t: "Importar extrato", s: "Arquivo do banco" },
  { alvo: 'data-acao="csv"',                      ic: "planilha",   t: "Baixar planilha",  s: "CSV de tudo" },
  { alvo: 'data-acao="ir" data-aba="conta"',      ic: "nuvem",      t: "Conta e nuvem",    s: "E-mail e sincronia" },
];

export const telaMais = () => `<div class="menu">${ITENS.map(i =>
  `<button type="button" class="menu-it" ${i.alvo}><span class="menu-ic">${iconeUI(i.ic, 20)}</span><span class="menu-txt"><b>${i.t}</b><small>${i.s}</small></span>${iconeUI("seta", 16)}</button>`).join("")}</div>`;

export const voltarMais = () => `<button type="button" class="voltar" data-acao="ir" data-aba="mais">${iconeUI("voltar", 18)}Mais</button>`;

export function telaConta({ email = "", estado = "" }){
  if (!email) return `<section class="convite"><h2>Salvar na nuvem</h2>
    <p>Entre com seu e-mail para ver seus lançamentos no celular e no computador.</p>
    <button class="btn btn-forte" type="button" data-acao="entrar">Entrar</button></section>`;
  return `<div class="menu"><div class="menu-it estatico"><span class="menu-ic">${iconeUI("nuvem", 20)}</span>
      <span class="menu-txt"><b>${esc(email)}</b><small id="conta-estado">${esc(estado)}</small></span></div></div>
    <div class="brisa" style="margin-top:16px"><button class="btn" type="button" data-acao="sincronizar">Salvar agora</button>
      <button class="btn" type="button" data-acao="sair">Sair</button></div>`;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test "testes/*.test.js"`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add js/telas/mais.js testes/mais.test.js
git commit -m "feat: telas Mais e Conta e nuvem

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Ligar tudo: marcação, barra, folha do +, pílula, olho e visual de banco

Esta é a tarefa que troca o que aparece na tela. Ela não tem teste em Node, porque é DOM. A prova é a conferência no navegador do Step 6.

**Files:**
- Modify: `index.html`, o `<body>` (linhas ~658-713) e um bloco de CSS novo logo antes de `.oculto{display:none!important}`
- Modify: `js/painel.js`: imports, `ui`, `pintarEstado`, `render`, eventos, `torrada`, `salvarRapido`, `iniciar`, `entrou`, `sair` e `aoMudarSessao`. Apagar `abaVisao`, `abaLancamentos`, `blocoUltimos`, `avisoFixas` e `ABAS/ICONE_ABA/svgAba`. Apagar também `itemHTML` e `tabelaCats` se ficarem sem uso (`grep`).

**Interfaces:**
- Consumes: tudo das Tasks 1 a 7.
- Produces, para a Task 9:
  - Funções: `abrirFolha(html)`, `abrirDetalhe(tipo, chave, origem)`, `abrirLancar()`, `fecharLancar()` e `torrada(msg, { desfazer })`.
  - Mais: `marcarValores(raiz)` e `alternarOcultar()`.
  - Variável `ultimoNovo` (id do último lançamento) e `#barra` montada uma vez, com `--i`.

- [ ] **Step 1: Marcação nova** — em `index.html`, trocar de `<div class="app">` até `<button class="fab" …></button>` (inclusive) por:
```html
<div class="app">
  <header class="topo">
    <div class="topo-linha">
      <h1 id="titulo">Olá</h1>
      <div class="periodo">
        <button type="button" data-acao="mes-ant" aria-label="Mês anterior">&#8249;</button>
        <select id="sel-periodo" aria-label="Período"></select>
        <button type="button" data-acao="mes-prox" aria-label="Próximo mês">&#8250;</button>
      </div>
      <button type="button" class="icone-topo" id="btn-olho" data-acao="olho" aria-pressed="false" aria-label="Esconder valores"></button>
      <button type="button" class="estado" id="estado" data-s="ok"><i class="ponto"></i><span>Salvo</span></button>
    </div>
  </header>
  <main id="conteudo"></main>
</div>

<nav class="barra" id="barra" aria-label="Navegação"></nav>

<div id="lancar" class="veu oculto" data-acao="fechar-lancar">
  <div class="folha folha-lancar" role="dialog" aria-modal="true" aria-labelledby="lancar-tit">
    <div class="alca" aria-hidden="true"></div>
    <h2 id="lancar-tit" data-puxa>Lançar</h2>
    <form class="rapido" id="rapido" autocomplete="off">
      <input id="rapido-txt" type="text" enterkeyhint="done" placeholder="ifood 35 · uber 15 ontem · +salário 3000" aria-label="Lançar rápido" aria-describedby="rapido-previa">
      <button type="submit" class="btn btn-forte" id="rapido-ok">Lançar</button>
    </form>
    <div class="rapido-previa" id="rapido-previa" aria-live="polite"></div>
    <button type="button" class="btn btn-txt" data-acao="novo">Formulário completo</button>
  </div>
</div>
```
`#entrar`, `#modal`, `#torrada` e o `<script>` continuam como estão.

- [ ] **Step 2: CSS de app de banco** — em `index.html`, inserir antes da linha `.oculto{display:none!important}`:
```css
/* ======================= SOBROU: cara de app de banco ======================= */
:root{
  --fonte-marca:"Fraunces",ui-serif,Georgia,serif;
  --fonte-display:"Figtree",ui-sans-serif,system-ui,-apple-system,sans-serif;
  --fonte-num:"Figtree",ui-sans-serif,system-ui,-apple-system,sans-serif;
  --mola-forte:cubic-bezier(.3,1.3,.5,1);
}
body{font-variant-numeric:tabular-nums}
.app{max-width:560px;padding:0 16px calc(110px + env(safe-area-inset-bottom))}
.topo{position:static;background:transparent;border:0;backdrop-filter:none;-webkit-backdrop-filter:none;padding:calc(10px + env(safe-area-inset-top)) 0 4px}
.topo .topo-linha{display:flex;align-items:center;gap:6px;flex-wrap:nowrap}
#titulo{font-family:var(--fonte-display);font-size:24px;font-weight:700;letter-spacing:-.02em;margin-right:auto}
.topo .periodo{order:0;width:auto;gap:0;background:transparent;border:0}
.topo .periodo select{flex:none;background:transparent;border:0;font-weight:600;color:var(--tinta-2);padding:6px 2px;max-width:150px;text-align:right;text-align-last:right}
.topo .periodo button{min-width:30px;min-height:40px;background:transparent;border:0;color:var(--tinta-3);font-size:20px}
.icone-topo{width:42px;height:42px;border-radius:50%;border:0;background:transparent;color:var(--tinta-2);display:grid;place-items:center;cursor:pointer}
.topo .estado{background:transparent;border:0;padding:10px 6px;min-height:0}
.topo .estado span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.cartao{background:var(--superficie);border:1px solid var(--linha);border-radius:18px;box-shadow:none}

/* Início */
.heroi{padding:14px 2px 6px}
.heroi-rot{font-size:13px;color:var(--tinta-3);font-weight:500}
.heroi-val{display:inline-block;font-size:clamp(34px,10vw,44px);font-weight:700;letter-spacing:-.03em;line-height:1.1;margin:2px 0 6px}
.heroi-comp{font-size:13px;font-weight:600;margin:0 0 4px}
.heroi-comp[data-s="menos"]{color:var(--bom)}
.heroi-comp[data-s="mais"]{color:var(--grave)}
.heroi-comp[data-s="igual"]{color:var(--tinta-3)}
.heroi-comp[data-s="menos"]::before{content:"↓ "}
.heroi-comp[data-s="mais"]::before{content:"↑ "}
.heroi-pe{font-size:13px;color:var(--tinta-3)}
.bloco{margin-top:22px}
.bloco h2{font-size:16px;font-weight:700;margin:0 0 4px}
.faixa{display:flex;gap:3px;height:16px;border-radius:8px;overflow:hidden}
.faixa-pd{flex:var(--p) 1 0;min-width:6px;background:var(--c);border:0;padding:0;cursor:pointer}
.pilulas{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.pilula{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--linha);background:var(--superficie);color:var(--tinta-2);border-radius:999px;padding:5px 11px;font-size:12.5px;font-weight:500;cursor:pointer}
.pilula i{width:8px;height:8px;border-radius:50%;background:var(--c)}
.linhas{display:flex;flex-direction:column}
.linha{display:flex;align-items:center;gap:12px;width:100%;background:none;border:0;border-bottom:1px solid var(--linha);padding:12px 2px;text-align:left;cursor:pointer;color:inherit}
.linha:last-child{border-bottom:0}
.linha-txt,.lin-txt{flex:1;min-width:0;display:flex;flex-direction:column}
.linha-txt b,.lin-txt b{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.linha-txt small,.lin-txt small{color:var(--tinta-3);font-size:12.5px}
.linha-val{text-align:right;display:flex;flex-direction:column;align-items:flex-end}
.linha-val b{font-weight:700}
.linha-val small{font-size:12px;font-weight:600}
.linha-val small[data-s="mais"]{color:var(--grave)}
.linha-val small[data-s="menos"]{color:var(--bom)}
.linha-val small[data-s="igual"]{color:var(--tinta-3)}
.ic-cat{flex:none;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;color:var(--c);background:color-mix(in srgb,var(--c) 18%,transparent)}
.aviso-fixas{display:flex;align-items:center;gap:10px;width:100%;margin-top:18px;padding:12px 14px;border-radius:14px;border:0;cursor:pointer;text-align:left;font-weight:600;font-size:14px;background:var(--alerta-suave);color:var(--alerta)}
.aviso-fixas[data-t="grave"]{background:var(--grave-suave);color:var(--grave)}
.aviso-fixas span{flex:1}
.convite{text-align:center;padding:48px 12px}
.convite h2{font-size:20px;font-weight:700;margin-bottom:6px}
.convite p{color:var(--tinta-3);margin:0 0 18px}
.nada{color:var(--tinta-3);text-align:center;padding:24px 0}

/* folhas */
.alca{width:38px;height:5px;border-radius:3px;background:var(--linha-forte);margin:-6px auto 12px}
.alca,[data-puxa]{touch-action:none}
.det-topo{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.det-topo h2{flex:1;margin:0!important}
.det-total{display:inline-block;font-size:32px;font-weight:700;letter-spacing:-.03em}
.semanas{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;height:120px;align-items:end;margin:18px 0 8px}
.sem{position:relative;height:100%;display:flex;flex-direction:column;justify-content:flex-end;gap:6px;background:none;border:0;padding:0;cursor:pointer;color:var(--tinta-3);font-size:11.5px}
.sem i{display:block;height:max(4px,calc(var(--h) * .8));border-radius:6px 6px 2px 2px;background:var(--marca);opacity:.8;transform-origin:bottom}
.sem:focus i,.sem:active i{opacity:1}
.sem:focus::before{content:attr(data-v);position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:var(--tinta);color:var(--sobre-marca);font-size:11.5px;font-weight:600;padding:3px 8px;border-radius:8px;white-space:nowrap}
.det-item{display:flex;justify-content:space-between;gap:12px;width:100%;padding:11px 2px;background:none;border:0;border-bottom:1px solid var(--linha);color:inherit;font-size:14px;cursor:pointer;text-align:left}
.dica{display:flex;gap:8px;align-items:flex-start;margin:14px 0 0;padding:12px 14px;border-radius:12px;background:var(--marca-suave);color:var(--marca-tinta);font-size:13.5px}
.folha-lancar .rapido{display:flex;gap:8px;margin:0}
.folha-lancar .rapido input{flex:1;min-width:0;font-size:17px!important}
#rapido-ok{min-width:92px;border-radius:999px}
.folha-lancar .rapido-previa{min-height:30px;margin-top:10px}
.folha-lancar > .btn-txt{margin-top:6px}

/* Extrato */
.busca{display:flex;align-items:center;gap:8px;background:var(--superficie);border:1px solid var(--linha);border-radius:12px;padding:0 12px;color:var(--tinta-3);margin-top:6px}
.busca input{flex:1;min-width:0;border:0;background:transparent;padding:11px 0;outline:0;color:var(--tinta)}
.chips-f{display:flex;gap:6px;overflow-x:auto;padding:10px 0 4px;scrollbar-width:none}
.chips-f::-webkit-scrollbar{display:none}
.chip-f{flex:none;border:1px solid var(--linha-forte);background:transparent;color:var(--tinta-2);border-radius:999px;padding:6px 13px;font-size:13px;font-weight:500;cursor:pointer}
.chip-f[aria-pressed="true"]{background:var(--tinta);color:var(--sobre-marca);border-color:var(--tinta)}
.dia{display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;color:var(--tinta-3);padding:16px 2px 4px}
.lin{position:relative;overflow:hidden;border-bottom:1px solid var(--linha)}
.lin-acoes{position:absolute;top:0;right:0;bottom:0;display:flex}
.lin-acoes button{width:56px;border:0;display:grid;place-items:center;cursor:pointer}
.lin-ed{background:var(--superficie-2);color:var(--tinta)}
.lin-ap{background:var(--grave);color:var(--sobre-marca)}
.lin-frente{position:relative;z-index:1;display:flex;align-items:center;gap:12px;width:100%;padding:11px 2px;background:var(--papel);border:0;color:inherit;text-align:left;cursor:pointer;touch-action:pan-y;transition:transform .3s var(--mola-forte)}
.lin-val{font-weight:600;white-space:nowrap}
.lin-val.mais{color:var(--bom)}
@media (hover:hover){.lin:hover .lin-frente{transform:translateX(-112px)}}

/* Mais */
.menu{display:flex;flex-direction:column;margin-top:6px}
.menu-it{display:flex;align-items:center;gap:14px;width:100%;padding:14px 2px;background:none;border:0;border-bottom:1px solid var(--linha);color:inherit;text-align:left;cursor:pointer}
.menu-it.estatico{cursor:default}
.menu-ic{flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--superficie-2);color:var(--marca-tinta)}
.menu-txt{flex:1;min-width:0;display:flex;flex-direction:column}
.menu-txt b{font-weight:600}
.menu-txt small{color:var(--tinta-3);font-size:12.5px}
.voltar{display:inline-flex;align-items:center;gap:4px;background:none;border:0;color:var(--marca-tinta);font-weight:600;padding:8px 0;margin-bottom:4px;cursor:pointer}

/* barra de baixo */
.barra{position:fixed;left:0;right:0;bottom:0;z-index:50;display:grid;grid-template-columns:repeat(5,1fr);align-items:center;
  padding:6px 8px calc(6px + env(safe-area-inset-bottom));
  background:color-mix(in srgb,var(--papel) 92%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-top:1px solid var(--linha)}
.barra-it{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:0;color:var(--tinta-3);font-size:11px;font-weight:600;padding:6px 0;cursor:pointer}
.barra-it[aria-current]{color:var(--marca-tinta)}
.barra-mais{justify-self:center;display:grid;place-items:center;width:52px;height:52px;border-radius:50%;border:0;background:var(--marca);color:var(--sobre-marca);cursor:pointer;box-shadow:0 8px 20px -8px rgba(0,0,0,.6)}
.barra-mais span{display:none}
.barra-ind{position:absolute;top:6px;left:8px;width:calc((100% - 16px) / 5);height:52px;pointer-events:none;transform:translateX(calc(var(--i,0) * 100%));transition:transform .45s var(--mola-forte)}
.barra-ind::before{content:"";position:absolute;inset:0 14%;border-radius:14px;background:color-mix(in srgb,var(--marca) 14%,transparent)}
.barra-marca{display:none}

/* aviso em pílula no topo */
#torrada{top:calc(10px + env(safe-area-inset-top));bottom:auto!important;left:50%;transform:translateX(-50%) scale(.6);opacity:0;display:flex;align-items:center;gap:12px;
  border-radius:999px;padding:10px 16px;background:var(--tinta);color:var(--sobre-marca);font-weight:600;font-size:13.5px;
  transition:transform .45s var(--mola-forte),opacity .2s;max-width:calc(100vw - 24px)}
#torrada.vem{transform:translateX(-50%) scale(1);opacity:1}
.torrada-desf{background:none;border:0;color:inherit;font:inherit;text-decoration:underline;opacity:.75;cursor:pointer;padding:0}

/* esconder valores */
body.ocultar .din{color:transparent!important;position:relative;white-space:nowrap}
body.ocultar .din::after{content:"R$ •••";position:absolute;left:0;top:0;color:var(--tinta-2)}
body.ocultar .heroi-val.din::after,body.ocultar .det-total.din::after{color:var(--tinta)}
body.ocultar .sem:focus::before{content:"R$ •••"}
```

- [ ] **Step 3: `painel.js`, estado, barra e render**

1. Imports a acrescentar (os das Tasks 1 a 3 já existem):
```js
import { corDe, iconeUI, iconeCat } from "./icones.js";
import { BARRA, abaValida, posicaoNaBarra } from "./navegacao.js";
import { telaInicio, folhaDetalhe } from "./telas/inicio.js";
import { telaExtrato, listaExtrato, filtrarExtrato } from "./telas/extrato.js";
import { telaMais, telaConta, voltarMais } from "./telas/mais.js";
```
2. `let ui = { aba:"inicio", periodo:null, tipoForm:"gasto", cortes:{}, lote:null, busca:"", filtro:"tudo" };` e logo abaixo `let ultimoNovo = "";`.
3. Trocar `pintarEstado` por:
```js
function estadoAtual(){
  if (!usuario) return ["offline", navigator.onLine ? "Entrar pra salvar na nuvem" : "Sem conexão — salvo neste aparelho", ""];
  if (publicando) return ["salvando", "Salvando…", ""];
  if (!navigator.onLine || falhou) return ["offline", "Sem conexão — salvo neste aparelho", "Tento de novo quando a internet voltar."];
  if (sujo) return ["sujo", "Salvar agora", "Há mudanças ainda não enviadas."];
  return ["ok", "Tudo salvo", ""];
}
const textoEstado = () => estadoAtual()[1];
function pintarEstado(){
  const [s, t, dica] = estadoAtual();
  const el = $("#estado");
  el.dataset.s = s; el.querySelector("span").textContent = t; el.title = dica || t;
  const ec = $("#conta-estado"); if (ec) ec.textContent = t;
}
```
4. Apagar `abaVisao`, `blocoUltimos`, `abaLancamentos`, `avisoFixas`, `ABAS`, `ICONE_ABA` e `svgAba`. Depois rodar `grep -n "itemHTML\|tabelaCats\|ICONE_EDITAR\|ICONE_APAGAR" js/painel.js` e apagar o que ficou sem uso.
5. Acrescentar, no lugar de `ABAS`:
```js
const TITULOS = { inicio:"Olá", extrato:"Extrato", fixas:"Fixas", mais:"Mais", economizar:"Economizar", metas:"Metas", importar:"Importar extrato", conta:"Conta e nuvem" };
const SEM_PERIODO = ["mais", "conta", "importar"];
const ROT_BARRA = { inicio:"Início", extrato:"Extrato", fixas:"Fixas", mais:"Mais" };

function fixasAPagar(){
  if (ui.periodo === "tudo" || !estado.fixas.length) return null;
  const hj = hoje();
  const anteriores = ui.periodo === mesDe(hj) ? pendentesAnteriores(estado.fixas, estado.lancamentos, hj) : [];
  const ocs = [...anteriores, ...ocorrencias(estado.fixas, estado.lancamentos, ui.periodo, hj).filter(o => o.situacao !== "pago")];
  if (!ocs.length) return null;
  return { qtd: ocs.length, valor: Math.round(somar(ocs) * 100) / 100,
           atrasado: anteriores.length > 0 || ocs.some(o => o.situacao === "atrasado"),
           ateDia: Math.max(...ocs.map(o => +o.vencimento.slice(8))) };
}

const TELAS = {
  inicio:     () => telaInicio({ lancamentos: estado.lancamentos, periodo: ui.periodo, hoje: hoje(), fixas: fixasAPagar() }),
  extrato:    () => telaExtrato({ itens: doPeriodo(), hoje: hoje(), busca: ui.busca, filtro: ui.filtro,
                                  rotuloPeriodo: ui.periodo === "tudo" ? "ainda" : "em " + MESES[+ui.periodo.slice(5) - 1] }),
  fixas:      () => abaFixas(),
  mais:       () => telaMais(),
  economizar: () => voltarMais() + abaEconomizar(),
  metas:      () => voltarMais() + abaMetas(),
  importar:   () => voltarMais() + abaImportar(),
  conta:      () => voltarMais() + telaConta({ email: usuario?.email || "", estado: textoEstado() }),
};

/* a barra é montada uma vez só: assim o destaque desliza em vez de piscar */
function montarBarra(){
  $("#barra").innerHTML = `<span class="barra-ind" aria-hidden="true"></span><span class="barra-marca">Sobrou</span>` +
    BARRA.map(id => id === "+"
      ? `<button type="button" class="barra-mais" data-acao="lancar" aria-label="Lançar">${iconeUI("somar", 26)}<span>Lançar</span></button>`
      : `<button type="button" class="barra-it" data-acao="ir" data-aba="${id}">${iconeUI(id, 22)}<span>${ROT_BARRA[id]}</span></button>`).join("");
}
function pintarBarra(){
  const i = posicaoNaBarra(ui.aba);
  $("#barra").style.setProperty("--i", i);
  document.querySelectorAll("#barra .barra-it").forEach(b => {
    if (BARRA.indexOf(b.dataset.aba) === i) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
}

/* embrulha todo "R$ 12,34" solto num .din para o modo "esconder valores" */
const RE_RS = /[−+-]?R\$\s?(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\dk)/g;
function marcarValores(raiz){
  const andar = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode: n => !n.parentElement || n.parentElement.closest(".din, script, style, option, textarea") || !n.nodeValue.includes("R$")
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nos = [];
  while (andar.nextNode()) nos.push(andar.currentNode);
  for (const n of nos){
    const t = n.nodeValue, f = document.createDocumentFragment();
    let i = 0;
    for (const m of t.matchAll(RE_RS)){
      f.append(t.slice(i, m.index));
      const s = document.createElement("span"); s.className = "din"; s.textContent = m[0]; f.append(s);
      i = m.index + m[0].length;
    }
    if (!i) continue;
    f.append(t.slice(i));
    n.replaceWith(f);
  }
}
```
6. Trocar o corpo de `render()`, de `const n = doPeriodo().length;` até o fim, por:
```js
  $("#titulo").textContent = TITULOS[ui.aba];
  $(".periodo").classList.toggle("oculto", SEM_PERIODO.includes(ui.aba));
  pintarBarra();
  $("#conteudo").innerHTML = TELAS[ui.aba]();
  marcarValores($("#conteudo"));
  animarEntrada();
  if (ui.aba === "importar"){ ligarSolta(); atualizarBarraImport(); }
  gravarLocal(CHAVE_UI, { aba: ui.aba, periodo: ui.periodo });
```
A montagem do `<select>` no começo continua igual.

7. Em `contarValores`, trocar a busca e a chave:
```js
  document.querySelectorAll("#conteudo [data-conta]").forEach(el => {
    const chave = el.dataset.conta;
```
Trocar também `dur = 800` por `dur = 700`.

8. Em `animarEntrada`, acrescentar à lista de grupos: `".linhas > *"`, `".menu > *"` e `"#extrato-lista > *"`.

- [ ] **Step 4: `painel.js`, folhas, lançar, pílula, olho e eventos**
```js
function abrirFolha(html){
  $("#modal").innerHTML = `<div class="veu" data-acao="fechar">${html}</div>`;
  marcarValores($("#modal"));
}
function abrirDetalhe(tipo, chave){
  const html = folhaDetalhe({ lancamentos: estado.lancamentos, periodo: ui.periodo, hoje: hoje(), tipo, chave });
  if (html) abrirFolha(html);
}
function abrirTodasCats(){
  const gastos = gastosDe(doPeriodo()), tg = somar(gastos);
  abrirFolha(`<div class="folha" role="dialog" aria-modal="true" aria-labelledby="cats-tit"><div class="alca" aria-hidden="true"></div>
    <div class="det-topo" data-puxa><h2 id="cats-tit">Todas as categorias</h2><button type="button" class="icone" data-acao="fechar" aria-label="Fechar">${iconeUI("fechar", 20)}</button></div>
    <div class="linhas">${porCategoria(gastos).map(c => `<button type="button" class="linha" data-acao="detalhe" data-tipo="cat" data-chave="${esc(c.nome)}">${iconeCat(c.nome)}
      <span class="linha-txt"><b>${esc(c.nome)}</b><small>${pctTxt(pct(c.total, tg))} do que saiu</small></span><span class="linha-val"><b>${brl(c.total)}</b></span></button>`).join("")}</div></div>`);
}
/* foco no mesmo toque: o iPhone só abre o teclado assim */
function abrirLancar(){
  $("#lancar .folha").style.transform = "";
  $("#lancar").classList.remove("oculto");
  $("#rapido-txt").focus();
}
function fecharLancar(){ $("#rapido-txt").blur(); $("#lancar").classList.add("oculto"); }

const CHAVE_OCULTAR = "sobrou:ocultar";
function pintarOlho(){
  const o = document.body.classList.contains("ocultar"), b = $("#btn-olho");
  b.innerHTML = iconeUI(o ? "olho-fechado" : "olho", 22);
  b.setAttribute("aria-pressed", String(o));
  b.setAttribute("aria-label", o ? "Mostrar valores" : "Esconder valores");
}
function alternarOcultar(){
  const o = !document.body.classList.contains("ocultar");
  document.body.classList.toggle("ocultar", o);
  gravarLocal(CHAVE_OCULTAR, o);
  pintarOlho();
}
```
- Trocar `torrada` por:
```js
function torrada(msg, { desfazer } = {}){
  const t = $("#torrada");
  t.innerHTML = `<span>${msg}</span>` + (desfazer ? `<button type="button" class="torrada-desf">Desfazer</button>` : "");
  marcarValores(t);
  if (desfazer) t.querySelector(".torrada-desf").addEventListener("click", () => { t.classList.remove("vem"); desfazer(); }, { once: true });
  t.classList.add("vem");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("vem"), desfazer ? 5000 : 3400);
}
```
- Em `salvarRapido`:
  - No ramo das parcelas, chamar `fecharLancar();` antes de `abrirFormFixa(...)`.
  - Trocar o trecho do `estado.lancamentos.push({...})` até o fim por:
```js
  const novo = { id: uid(), tipo: r.tipo, data: r.data, categoria: r.tipo === "gasto" ? r.categoria : "",
                 descricao: r.descricao, valor: r.valor, editadoEm: Date.now() };
  estado.lancamentos.push(novo);
  if (ui.periodo !== "tudo" && mesDe(r.data) !== ui.periodo) ui.periodo = mesDe(r.data);
  limparRapido();
  ultimoNovo = novo.id;
  mudou();
  fecharLancar();
  torrada(esc(maiuscula(r.descricao)) + " · " + brl(r.valor) + " lançado", { desfazer: () => {
    if (apagarLancamento(estado, novo.id, Date.now())){ mudou(); torrada("Desfeito."); }
  }});
```
- No `click` do documento:
  - A guarda passa a ser:
```js
if ((a === "fechar" || a === "fechar-lancar") && ev.target !== alvo) return;
```
  - O case `ir` passa a ser:
```js
case "ir": ui.aba = abaValida(alvo.dataset.aba); fecharModal(); render(); window.scrollTo({ top:0, behavior:"smooth" }); break;
```
  - Cases novos:
```js
    case "lancar":        abrirLancar(); break;
    case "fechar-lancar": fecharLancar(); break;
    case "detalhe":       abrirDetalhe(alvo.dataset.tipo, alvo.dataset.chave); break;
    case "todas-cats":    abrirTodasCats(); break;
    case "filtro":        ui.filtro = alvo.dataset.f; render(); break;
    case "olho":          alternarOcultar(); break;
    case "entrar":        mostrarEntrar(); break;
    case "sincronizar":   sincronizar(); break;
```
  - No case `sair`, apagar a linha `$("#btn-sair")…` e acrescentar `if (ui.aba === "conta") render();`.
  - No case `importar`, trocar `ui.aba = "lancamentos";` por `ui.aba = "extrato";`.
- Em `entrou(u)`, trocar a linha do `#btn-sair` por `if (ui.aba === "conta") render();`.
- Em `aoMudarSessao`, apagar `$("#btn-sair").classList.add("oculto");`.
- No `input` do documento, logo no começo:
```js
  if (ev.target.id === "busca-extrato"){
    ui.busca = ev.target.value;
    const l = $("#extrato-lista");
    l.innerHTML = listaExtrato(filtrarExtrato(doPeriodo(), { busca: ui.busca, filtro: ui.filtro }), hoje(), ui.busca);
    marcarValores(l);
    return;
  }
```
- No `keydown`:
  - `Escape` fecha as duas folhas: `fecharModal(); fecharLancar();`.
  - `/` passa a chamar `abrirLancar()`, no lugar de focar o campo.
- Em `iniciar()`:
```js
  ui.aba = abaValida(salvo.aba);
  ui.periodo = salvo.periodo || periodoPadrao();
  document.body.classList.toggle("ocultar", lerLocal(CHAVE_OCULTAR) === true);
  pintarOlho();
  montarBarra();
  render();
```
O resto de `iniciar()` continua igual.

- [ ] **Step 5: Testes**

Run: `node --test "testes/*.test.js"`
Expected: PASS, todos.

- [ ] **Step 6: Conferência no navegador (celular 390x844)**

Abrir `/` com dados de exemplo. Se o aparelho de teste estiver vazio, lançar pelo "+":
- "ifood 35"
- "ifood 42,90 ontem"
- "uber 18"
- "+salário 5000"
- "aluguel 1100 dia 5"
- "mercado 86,40"

Conferir com `read_page`/`find` e `screenshot`:
1. **Início:**
   - Mostra "Olá", o número grande, a faixa, as pílulas e "Os 3 que mais pesaram".
   - Tocar num lugar abre o detalhe com 4 semanas.
   - O X fecha o detalhe.
   - Tocar num pedaço da faixa abre a categoria.
2. **"+":** a folha abre com o campo focado. "uber 20" + Lançar fecha a folha e mostra a pílula com "Desfazer". Desfazer remove o lançamento.
3. **Extrato:**
   - Lista agrupada em "Hoje" e "Ontem".
   - Busca "ifood" filtra e mantém o foco no campo.
   - O chip "Entradas" filtra.
4. **Fixas:** abre como antes.
5. **Mais e Conta:**
   - As 5 linhas de Mais abrem as telas certas, e "Mais" volta.
   - "Conta e nuvem" mostra o e-mail ou o botão Entrar.
6. **Olho:**
   - Os valores viram "R$ •••" em todas as telas e na pílula.
   - Recarregar a página mantém os valores escondidos.
7. **Aba antiga:** `localStorage.setItem("painel-dinheiro:ui", JSON.stringify({aba:"lancamentos"}))` e recarregar. Tem que abrir o Extrato.
8. **Console:** `read_console_messages` com `onlyErrors: true` não mostra nada.

- [ ] **Step 7: Commit**
```bash
git add index.html js/painel.js
git commit -m "feat: Sobrou com cara de app de banco (Início, Extrato, Mais, barra e +)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Animações

**Files:**
- Create: `js/movimento.js`
- Modify: `js/painel.js`: `animarEntrada`, `abrirFolha`, `abrirDetalhe`, `salvarRapido`, `alternarOcultar`, `iniciar` e o case `detalhe`. Apagar `semMovimento` local e importar a de `movimento.js`.
- Modify: `index.html`: CSS de animação, logo depois do bloco da Task 8.

**Interfaces:**
- Consumes: `#conteudo`, `.faixa-pd[data-k]` com `--p`, `#rapido-ok`, `.folha`, `.alca`/`[data-puxa]`, `.lin[data-arrasta]` com `.lin-frente`, `.ic-cat` e `ultimoNovo` (Task 8).
- Produces:
  - `semMovimento(): boolean`.
  - `desenharFaixa(raiz, nova: boolean)` e `botaoCheck(btn): Promise<void>`.
  - `comTransicao(origem: Element|null, mudar: () => void)` e `arrastarParaFechar(folha, fechar)`.
  - `ligarArrastarLinhas(raiz)` e `trocarComDesfoque(alvo: Element, trocar: () => void)`.

- [ ] **Step 1: Implement** — `js/movimento.js`:
```js
/* Animações do Sobrou. Nenhuma passa de 500ms (o número contando, no painel, tem 700ms)
   e todas viram troca simples com "Reduzir movimento". */
export const semMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const depois = fn => requestAnimationFrame(() => requestAnimationFrame(fn));

/* faixa: ao entrar na tela cresce pedaço por pedaço; ao trocar de mês estica do tamanho antigo */
const pesos = new Map();
export function desenharFaixa(raiz, nova){
  raiz.querySelectorAll(".faixa-pd").forEach((p, i) => {
    const alvo = p.style.getPropertyValue("--p");
    const de = nova ? "0.001" : (pesos.get(p.dataset.k) || "0.001");
    pesos.set(p.dataset.k, alvo);
    if (semMovimento()) return;
    p.style.transition = "none";
    p.style.flexGrow = de;
    depois(() => {
      p.style.transition = `flex-grow .5s var(--mola-forte) ${nova ? i * 90 : 0}ms`;
      p.style.flexGrow = alvo;
    });
  });
}

/* botão Lançar: carregando → check */
export function botaoCheck(btn){
  if (semMovimento()) return Promise.resolve();
  const rot = btn.textContent;
  btn.classList.add("carregando");
  return new Promise(pronto => setTimeout(() => {
    btn.classList.replace("carregando", "ok");
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" pointer-events="none"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    setTimeout(() => {
      pronto();
      setTimeout(() => { btn.classList.remove("ok"); btn.textContent = rot; }, 320);
    }, 260);
  }, 200));
}

/* o ícone tocado "voa" até o topo da folha (Safari 18+); sem suporte, a folha só sobe */
export function comTransicao(origem, mudar){
  if (!document.startViewTransition || semMovimento() || !origem){ mudar(); return; }
  origem.style.viewTransitionName = "ic-detalhe";
  document.startViewTransition(() => { origem.style.viewTransitionName = ""; mudar(); });
}

/* arrastar a folha para baixo (pela alça ou pelo título) fecha */
export function arrastarParaFechar(folha, fechar){
  let y0 = null, dy = 0;
  folha.addEventListener("pointerdown", e => {
    if (!e.target.closest(".alca,[data-puxa]") || e.target.closest("button")) return;
    y0 = e.clientY; dy = 0;
    folha.setPointerCapture?.(e.pointerId);
  });
  folha.addEventListener("pointermove", e => {
    if (y0 === null) return;
    dy = Math.max(0, e.clientY - y0);
    folha.style.transition = "none";
    folha.style.transform = `translateY(${dy}px)`;
  });
  const soltar = () => {
    if (y0 === null) return;
    y0 = null;
    folha.style.transition = "transform .3s var(--mola-forte)";
    if (dy > 110){ folha.style.transform = "translateY(110%)"; setTimeout(fechar, 180); }
    else folha.style.transform = "";
  };
  folha.addEventListener("pointerup", soltar);
  folha.addEventListener("pointercancel", soltar);
}

/* extrato: arrastar a linha para a esquerda mostra Editar e Apagar */
const ABRE = 112;
export function ligarArrastarLinhas(raiz){
  let lin = null, x0 = 0, y0 = 0, dx = 0, modo = "";
  const frente = l => l.querySelector(".lin-frente");
  const fechar = l => { l.classList.remove("aberta"); frente(l).style.transform = ""; };
  raiz.addEventListener("pointerdown", e => {
    const l = e.target.closest(".lin[data-arrasta]");
    if (!l || e.pointerType === "mouse" || e.target.closest(".lin-acoes")) return;
    lin = l; x0 = e.clientX; y0 = e.clientY; dx = 0; modo = "";
  });
  raiz.addEventListener("pointermove", e => {
    if (!lin) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!modo){
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      modo = Math.abs(mx) > Math.abs(my) ? "lado" : "rola";
      if (modo === "lado"){
        raiz.querySelectorAll(".lin.aberta").forEach(o => { if (o !== lin) fechar(o); });
        lin.setPointerCapture?.(e.pointerId);
        frente(lin).style.transition = "none";
      }
    }
    if (modo !== "lado") return;
    const base = lin.classList.contains("aberta") ? -ABRE : 0;
    dx = Math.min(0, Math.max(-ABRE * 1.2, base + mx));
    frente(lin).style.transform = `translateX(${dx}px)`;
  });
  const soltar = () => {
    if (!lin) return;
    const l = lin; lin = null;
    if (modo !== "lado") return;
    const f = frente(l);
    f.style.transition = "";
    const abre = -dx > ABRE * 0.4;
    l.classList.toggle("aberta", abre);
    f.style.transform = abre ? `translateX(${-ABRE}px)` : "";
    l._arrastou = true;
    setTimeout(() => { l._arrastou = false; }, 60);
  };
  raiz.addEventListener("pointerup", soltar);
  raiz.addEventListener("pointercancel", soltar);
  /* arrastar não pode virar toque; tocar numa linha aberta só fecha */
  raiz.addEventListener("click", e => {
    const l = e.target.closest(".lin[data-arrasta]");
    if (!l) return;
    const abertaNaFrente = l.classList.contains("aberta") && e.target.closest(".lin-frente");
    if (l._arrastou || abertaNaFrente){
      e.stopPropagation(); e.preventDefault();
      if (abertaNaFrente && !l._arrastou) fechar(l);
    }
  }, true);
}

/* olho: os valores desfocam antes de virar R$ ••• */
export function trocarComDesfoque(alvo, trocar){
  if (semMovimento()){ trocar(); return; }
  alvo.classList.add("desfocando");
  setTimeout(() => { trocar(); depois(() => alvo.classList.remove("desfocando")); }, 160);
}
```

- [ ] **Step 2: Ligar no `painel.js`**
- Import:
```js
import { semMovimento, desenharFaixa, botaoCheck, comTransicao, arrastarParaFechar, ligarArrastarLinhas, trocarComDesfoque } from "./movimento.js";
```
  Apagar a `const semMovimento` local.
- Em `animarEntrada`:
  - Declarar `let ultimaAba = "";` junto de `ultimaVista`.
  - No começo de `animarEntrada`, acrescentar `const trocouAba = ultimaAba !== ui.aba; ultimaAba = ui.aba;`. Assim, trocar de mês na mesma aba não conta como tela nova: o número conta a partir do valor anterior e a faixa estica.
  - Trocar `contarValores(nova);` por:
```js
  contarValores(trocouAba);
  desenharFaixa(c, trocouAba);
  c.querySelectorAll(".semanas .sem").forEach((el, i) => el.style.setProperty("--k", i));
  if (ultimoNovo){
    c.querySelector(`.lin[data-id="${CSS.escape(ultimoNovo)}"]`)?.classList.add("nova");
    ultimoNovo = "";
  }
```
- `abrirFolha(html)`: no fim, acrescentar `const f = $("#modal .folha"); if (f) arrastarParaFechar(f, fecharModal);`.
- `abrirDetalhe(tipo, chave, origem)`: trocar `if (html) abrirFolha(html);` por `if (html) comTransicao(origem, () => abrirFolha(html));`.
- Case `detalhe`:
```js
abrirDetalhe(alvo.dataset.tipo, alvo.dataset.chave, alvo.querySelector(".ic-cat"));
```
- `salvarRapido`:
  - No começo: `if (salvandoRapido) return;`, com `let salvandoRapido = false;` declarado junto de `rascunho`.
  - No sucesso, trocar `fecharLancar(); torrada(...)` por:
```js
  salvandoRapido = true;
  botaoCheck($("#rapido-ok")).then(() => {
    salvandoRapido = false;
    fecharLancar();
    torrada(esc(maiuscula(r.descricao)) + " · " + brl(r.valor) + " lançado", { desfazer: () => {
      if (apagarLancamento(estado, novo.id, Date.now())){ mudou(); torrada("Desfeito."); }
    }});
  });
```
- `alternarOcultar`: embrulhar a troca:
```js
function alternarOcultar(){
  const o = !document.body.classList.contains("ocultar");
  trocarComDesfoque(document.body, () => {
    document.body.classList.toggle("ocultar", o);
    gravarLocal(CHAVE_OCULTAR, o);
    pintarOlho();
  });
}
```
- `iniciar()`, depois de `montarBarra();`:
```js
ligarArrastarLinhas($("#conteudo"));
arrastarParaFechar($("#lancar .folha"), fecharLancar);
```

- [ ] **Step 3: CSS das animações** — em `index.html`, logo depois do bloco da Task 8:
```css
/* ======================= SOBROU: movimento ======================= */
#rapido-ok{transition:min-width .35s var(--mola-forte),width .35s var(--mola-forte),background .2s}
#rapido-ok.carregando{color:transparent;position:relative}
#rapido-ok.carregando::after{content:"";position:absolute;inset:0;margin:auto;width:18px;height:18px;border-radius:50%;border:2px solid color-mix(in srgb,var(--sobre-marca) 30%,transparent);border-top-color:var(--sobre-marca);animation:gira .6s linear infinite}
#rapido-ok.ok{min-width:44px;width:44px;padding:0;display:grid;place-items:center;background:var(--bom);border-color:var(--bom);color:var(--sobre-marca)}
@keyframes gira{to{transform:rotate(360deg)}}
.folha-detalhe .sem i{animation:cresce .45s var(--mola-forte) both;animation-delay:calc(var(--k,0) * 60ms + 120ms)}
.lin.nova{animation:entra-lin .45s var(--mola-forte) both}
@keyframes entra-lin{from{opacity:0;transform:translateY(-10px)}}
.din{transition:filter .16s ease}
body.desfocando .din{filter:blur(6px)}
::view-transition-group(ic-detalhe){animation-duration:.4s;animation-timing-function:var(--mola-forte)}
```
O `@keyframes cresce` já existe. A regra global de `prefers-reduced-motion` (linha ~109) desliga tudo isso.

- [ ] **Step 4: Testes**

Run: `node --test "testes/*.test.js"`
Expected: PASS.

- [ ] **Step 5: Conferência no navegador (390x844)**

Conferir cada uma das 9 animações com `screenshot` logo depois da ação e com `javascript_tool`. O JS é só para ler o estilo, como `getComputedStyle(...).flexGrow` e `document.querySelector("#barra").style.getPropertyValue("--i")`.
1. **Número contando:** ao entrar no Início ele conta. Ao trocar de mês, conta a partir do valor anterior.
2. **Faixa:** cresce ao entrar e estica ao trocar de mês. Os valores de `flex-grow` mudam, sem sumir.
3. **Lançar:** botão → carregando → check e fecha. No Extrato a linha nova entra deslizando.
4. **Pílula:** cresce no topo, abaixo da área segura.
5. **Detalhe:** abre a partir do ícone. Arrastar a alça para baixo além de 110px fecha.
6. **Barra:** o destaque desliza (o `--i` muda e o elemento `.barra-ind` é o mesmo).
7. **Semanas:** crescem em sequência.
8. **Olho:** os valores desfocam e depois viram "R$ •••".
9. **Extrato:** testar o arrastar com `javascript_tool`, disparando `PointerEvent` com `pointerType:"touch"`:
   - `pointerdown` em `.lin-frente`, depois `pointermove` com `clientX` −80 e `pointerup`.
   - A linha tem que ficar `.aberta`, com Editar e Apagar à mostra.
   - Um toque depois fecha a linha, sem abrir a edição.
- Console sem erros.

- [ ] **Step 6: Commit**
```bash
git add js/movimento.js js/painel.js index.html
git commit -m "feat: animações (faixa, número, lançar com check, pílula, folha, barra, semanas, olho, arrastar)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Fixas em lista, computador com coluna lateral e modo offline

**Files:**
- Modify: `js/painel.js` (`fxHTML`: ícone da categoria)
- Modify: `index.html` (CSS de `.fx` e do computador)
- Modify: `sw.js` (arquivos novos + `CACHE = "painel-v3"`)

- [ ] **Step 1: Fixas com ícone** — em `fxHTML`, logo depois de `<div class="fx">`, acrescentar:
```js
${iconeCat(o.fixa.categoria)}
```
CSS, no fim do bloco da Task 8:
```css
.fx{display:flex;align-items:center;gap:12px;padding:12px 0}
.fx > div:first-of-type{flex:1;min-width:0}
.fx b{font-size:15px}
```

- [ ] **Step 2: Computador** — CSS, no fim do bloco da Task 8:
```css
@media (min-width:720px){
  .app{max-width:none;padding:0 24px 60px 124px}
  .app > *{max-width:560px;margin-left:auto;margin-right:auto}
  .barra{top:0;bottom:0;right:auto;width:100px;display:flex;flex-direction:column;align-items:stretch;gap:6px;padding:22px 10px;border-top:0;border-right:1px solid var(--linha);background:var(--papel)}
  .barra-marca{display:block;order:-2;font-family:var(--fonte-marca);font-weight:700;font-size:18px;color:var(--marca-tinta);text-align:center;margin-bottom:14px}
  .barra-mais{order:-1;width:auto;height:44px;border-radius:999px;display:flex;gap:6px;justify-content:center;margin-bottom:14px;font-weight:700}
  .barra-mais span{display:inline}
  .barra-mais svg{width:18px;height:18px}
  .barra-ind{display:none}
  .barra-it{padding:10px 0;border-radius:14px}
  .barra-it[aria-current]{background:color-mix(in srgb,var(--marca) 14%,transparent)}
}
```

- [ ] **Step 3: Modo offline** — em `sw.js`:
  - Trocar `const CACHE = "painel-v2";` por `const CACHE = "painel-v3";`.
  - Na lista `BASE`, acrescentar:
```js
  "/js/formato.js", "/js/raiox.js", "/js/icones.js", "/js/navegacao.js", "/js/movimento.js",
  "/js/telas/inicio.js", "/js/telas/extrato.js", "/js/telas/mais.js",
```

- [ ] **Step 4: Testes**

Run: `node --test "testes/*.test.js"`
Expected: PASS.

- [ ] **Step 5: Conferência no navegador**
- **Celular 390x844:**
  - A tela Fixas mostra o ícone, a situação e os botões "Paguei" e "Desfazer" funcionando.
  - A pílula confirma.
- **Computador** (`resize_window` `preset: "desktop"`, ~1280px):
  - A coluna lateral tem "Sobrou", o botão "Lançar" e as 4 abas.
  - O conteúdo fica centralizado em até 560px.
  - Passar o mouse numa linha do Extrato mostra Editar e Apagar.
- **Offline:** em `/sw.js`, conferir com `javascript_tool` que `(await caches.keys())` inclui `painel-v3` depois de recarregar.

- [ ] **Step 6: Commit**
```bash
git add js/painel.js index.html sw.js
git commit -m "feat: Fixas em lista, coluna lateral no computador e novos arquivos no modo offline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Revisão final, prévia e produção

- [ ] **Step 1: Suíte inteira**

Run: `node --test "testes/*.test.js"`
Expected: PASS, todos (55 antigos + ~45 novos).

- [ ] **Step 2: Revisão do branch inteiro**

Fazer como manda a skill de execução escolhida: revisor novo, no modelo mais capaz, com a seção Review Focus deste plano. Corrigir os achados Critical e Important com teste que falha antes.

- [ ] **Step 3: Prévia na Vercel**

Run: `npx --yes vercel@latest deploy --yes < /dev/null > ../deploy-previa.log 2>&1` e depois ler a URL no fim do log.

Abrir a prévia no navegador e repetir a conferência rápida do Início, do + e do Extrato.

- [ ] **Step 4: Pedir o ok do Rafael**

Mandar a URL da prévia e perguntar se pode publicar na versão oficial e juntar no `main`. Parar aqui até a resposta.

- [ ] **Step 5: Depois do ok**

Run:
```bash
npx --yes vercel@latest deploy --prod --yes < /dev/null > ../deploy-prod.log 2>&1
git checkout main && git merge --ff-only feat/sobrou-banco && node --test "testes/*.test.js"
```
Expected: o deploy termina com a URL `painel-do-meu-dinheiro.vercel.app` e os testes passam no `main`.

---

### Task 12: Repositório no GitHub

O Rafael pediu: "depois que você arrumar tudo isso, monte um repositório no GitHub e coloque tudo".

- [ ] **Step 1: Conferir que não vai segredo**

Run: `git ls-files | grep -iE "\.env|\.vercel|secret|token" || echo "nada sensível"`
Expected: `nada sensível`.

Também rodar `git grep -nE "service_role|sb_secret|eyJhbGci"`. O esperado é não achar nada. A chave publicável do Supabase em `js/config.js` é pública por natureza e pode ir.

- [ ] **Step 2: Perguntar a visibilidade**

Usar `AskUserQuestion` com a pergunta "O repositório do Sobrou fica privado ou público?". Opções:
- **Privado (Recommended):** só você vê.
- **Público:** qualquer um vê o código. Seus dados não vão, eles ficam no Supabase.

O nome sugerido é `sobrou`. Parar até a resposta.

- [ ] **Step 3: Criar e enviar**

Run (trocar `--private` por `--public` se ele escolher público):
```bash
gh repo create rafaangelao/sobrou --private --source . --remote origin --description "Sobrou: controle de dinheiro pessoal (PWA) com Raio-X do mês"
git push -u origin main
git push origin feat/sobrou-banco
```
Expected: `gh repo view rafaangelao/sobrou --json url,visibility` mostra a URL e a visibilidade escolhida.

- [ ] **Step 4: Avisar**

Mandar o link do repositório para o Rafael.
