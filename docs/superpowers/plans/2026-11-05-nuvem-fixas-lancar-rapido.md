# Nuvem, Fixas e parcelas, Lançar rápido — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Salvar o painel na nuvem com login por código, criar a aba "Fixas e parcelas" (nov/2026–dez/2027) e o campo "Lançar rápido".

**Architecture:** Site estático sem build. O `<script>` gigante do `index.html` vira módulos ES em `js/`. As regras que não podem errar (parcelas, leitura da linha rápida, junção de dados, laço de sincronização) ficam em módulos puros testados com `node --test`. O Supabase guarda o estado inteiro numa linha por usuário (`cadernos`), com RLS e trava otimista por `versao`.

**Tech Stack:** HTML/CSS/JS puro (módulos ES), Node 24 (`node --test`), Supabase (Auth OTP por e-mail + Postgres), `@supabase/supabase-js@2.119.0` via `esm.sh`, Vercel (site estático).

**Spec:** `docs/superpowers/specs/2026-11-05-nuvem-fixas-lancar-rapido-design.md`

## Global Constraints

- Sem build e sem dependências npm em produção; `supabase-js` só por `https://esm.sh/@supabase/supabase-js@2.119.0`, carregado com `import()` dinâmico (o painel tem que abrir sem internet).
- Faixa da aba Fixas: do mês atual até `2027-12`.
- Supabase: projeto `painel-do-meu-dinheiro`, região `sa-east-1`, na organização **gratuita e pessoal** do Rafael (nunca na org "Mizuta", nunca no projeto `apex`).
- Tabela `public.cadernos`, uma linha por usuário, RLS ligada, sem política de delete.
- Fixas aparecem "a pagar" até o "Paguei"; "Paguei" cria lançamento com `fixaId` e `fixaMes`.
- Textos da interface em português do Brasil, no tom do painel atual.
- Estado v2: `{ v:2, atualizadoEm, lancamentos, fixas, apagados, categorias, metas, regras }`; todo lançamento e fixa tem `editadoEm`.
- Claude não cria conta nem faz login no Supabase; o primeiro login real é do Rafael.
- Produção (`painel-do-meu-dinheiro.vercel.app`) só muda depois do "ok" do Rafael na prévia.

**Duas mudanças pequenas em relação à spec** (para avisar o Rafael):
1. Trava otimista por coluna `versao integer` em vez de comparar `atualizado_em`. Comparar inteiros evita erro de formatação de data; o efeito é o mesmo.
2. `metas` e `regras`: vale o objeto inteiro do lado mais recente, em vez de unir chave por chave. Sem isso, "Esquecer tudo" e apagar uma meta voltariam sozinhos na sincronização.

## Review Focus

1. **Aparelho novo, sem dados:** abrir o painel num aparelho limpo não pode criar os lançamentos de exemplo de julho; senão eles se misturam com os dados reais na primeira sincronização. Esperado: estado vazio. (Teste na Tarefa 2.)
2. **Primeiro login no aparelho com dados quando a nuvem já tem um caderno:** por exemplo, ele logou antes no celular vazio. Esperado: todos os lançamentos locais continuam e sobem; nada é sobrescrito. (Teste na Tarefa 3.)
3. **Outro aparelho grava três vezes seguidas durante o envio** (trava sempre falha). Esperado: nada se perde; o estado local continua e o indicador fica "Salvar agora". (Teste na Tarefa 3.)
4. **"Paguei" tocado duas vezes rápido:** esperado um único lançamento. (Teste na Tarefa 6.)
5. **Linha rápida com números que não são valor:** `mercado 120 2/11`, `tv 1.500`, `99app 20`. Esperado: data 02/11, R$ 1.500,00, R$ 20,00 com descrição "99app". (Teste na Tarefa 9.)

---

## Antes de começar

Pasta do projeto: a pasta `painel-do-meu-dinheiro` (repositório Git, ramo `feat/nuvem-fixas-lancar-rapido`). Todos os comandos rodam nela.

```bash
git config user.name "Rafael Santiago"
git config user.email "<seu e-mail>"
git config core.longpaths true
```

## Estrutura de arquivos

| Arquivo | Cria/Muda | Responsabilidade |
|---|---|---|
| `index.html` | muda | layout + CSS; ganha tela "Entrar", campo "Lançar rápido", botão "Sair"; carrega `js/painel.js` como módulo |
| `js/painel.js` | cria (sai do index) | app: estado, abas, formulários, importação, eventos, login e sincronização na interface |
| `js/base.js` | cria | utilidades puras: `normalizar`, `RE_ENTRADA`, `CATS_BASE`, datas (`mesDe`, `diasNoMes`, `somarMeses`, `mesesEntre`, `somarDias`, `hojeLocal`) |
| `js/juntar.js` | cria | `estadoVazio`, `migrarV2`, `juntar` |
| `js/sincronia.js` | cria | `sincronizar(api, local)`: ler, juntar, gravar com trava, repetir |
| `js/nuvem.js` | cria | adaptador do Supabase: login OTP, sessão, `apiDoCaderno` |
| `js/config.js` | cria | URL e chave publicável do Supabase |
| `js/fixas.js` | cria | cálculo de parcelas, ocorrências por mês, situação, pagar, casar com extrato |
| `js/rapido.js` | cria | `lerLinha` |
| `testes/*.test.js` | cria | testes das funções puras |
| `ferramentas/servir.mjs` | cria | servidor estático local para testar no navegador |
| `.claude/launch.json` | cria | configuração do servidor de prévia |
| `package.json` | cria | `"type": "module"` e `npm test` (não vai para a Vercel) |
| `.vercelignore` | cria | não publicar docs, testes, ferramentas, package.json |
| `.gitattributes` | cria | fim de linha LF |
| `vercel.json` | muda | redireciona `/Painel-do-Meu-Dinheiro` para `/` |
| `Painel-do-Meu-Dinheiro.html` | não existe no repo | era cópia idêntica no deploy antigo; substituída pelo redirecionamento |

---

### Tarefa 1: Separar o código em módulos (sem mudar comportamento)

**Files:**
- Create: `js/painel.js`, `js/base.js`, `testes/base.test.js`, `package.json`, `.gitattributes`, `.vercelignore`, `ferramentas/servir.mjs`, `.claude/launch.json`
- Modify: `index.html` (troca o `<script>` inline pelo módulo; remove `#dados-app`), `vercel.json`

**Interfaces:**
- Produces (`js/base.js`): `normalizar(s): string`, `RE_ENTRADA: RegExp`, `CATS_BASE: {nome,cor}[]`, `mesDe(iso): "AAAA-MM"`, `diasNoMes(ano, mes): number`, `somarMeses("AAAA-MM", n): "AAAA-MM"`, `mesesEntre(de, ate): number`, `somarDias("AAAA-MM-DD", n): "AAAA-MM-DD"`, `hojeLocal(date?): "AAAA-MM-DD"`.
- Produces (`js/painel.js`): por enquanto, `agendarSync()` é um stub vazio e `pintarEstado()` mostra "Salvo neste aparelho".

- [ ] **Step 1: Arquivos de apoio**

`package.json`:
```json
{
  "name": "painel-do-meu-dinheiro",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test testes/" }
}
```

`.gitattributes`:
```
* text=auto eol=lf
```

`.vercelignore`:
```
docs
testes
ferramentas
.claude
package.json
```

`vercel.json`:
```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "redirects": [
    { "source": "/Painel-do-Meu-Dinheiro", "destination": "/", "permanent": false }
  ]
}
```

`ferramentas/servir.mjs`:
```js
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const raiz = process.cwd();
const porta = Number(process.env.PORT) || 4173;
const tipos = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json", ".css":"text/css" };

http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const arq = normalize(join(raiz, p));
  if (!arq.startsWith(raiz)) { res.writeHead(403).end(); return; }
  try {
    const dados = await readFile(arq);
    res.writeHead(200, { "content-type": tipos[extname(arq)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(dados);
  } catch { res.writeHead(404).end("não achei"); }
}).listen(porta, () => console.log("http://localhost:" + porta));
```

`.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "painel", "runtimeExecutable": "node", "runtimeArgs": ["ferramentas/servir.mjs"], "port": 4173 }
  ]
}
```

- [ ] **Step 2: Teste de `base.js` (falha)**

`testes/base.test.js`:
```js
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
```

Run: `npm test`
Expected: FAIL (`Cannot find module .../js/base.js`)

- [ ] **Step 3: Criar `js/base.js`**

```js
/* utilidades puras — sem DOM, sem estado; usadas pelo painel e pelos testes */

export const normalizar = s => String(s || "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

export const RE_ENTRADA = /salario|pix recebido|transferencia recebida|deposito|rendimento|estorno|reembolso|devolucao|credito em conta|cashback|recebimento/;

/* Categorias base: cor fixa por identidade (paleta validada p/ daltonismo).
   "Guardar dinheiro" usa a cor semântica de positivo — não é gasto perdido.
   "Outros" usa neutro porque é justamente o balde de sobra. */
export const CATS_BASE = [
  { nome:"Comida/Fast Food", cor:"var(--c1)" },
  { nome:"Transporte",       cor:"var(--c2)" },
  { nome:"Contas fixas",     cor:"var(--c3)" },
  { nome:"Lazer",            cor:"var(--c4)" },
  { nome:"Presentes",        cor:"var(--c5)" },
  { nome:"Igreja",           cor:"var(--c6)" },
  { nome:"Coisas pra mim",   cor:"var(--c7)" },
  { nome:"Saúde",            cor:"var(--c8)" },
  { nome:"Guardar dinheiro", cor:"var(--c9)" },
  { nome:"Outros",           cor:"var(--c0)" },
];

const pad = n => String(n).padStart(2, "0");

export const mesDe = d => d.slice(0, 7);
export const diasNoMes = (a, m) => new Date(a, m, 0).getDate();

export function somarMeses(mes, n){
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return Math.floor(t / 12) + "-" + pad(t % 12 + 1);
}

export function mesesEntre(de, ate){
  const [a1, m1] = de.split("-").map(Number);
  const [a2, m2] = ate.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

export function somarDias(iso, n){
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

export const hojeLocal = (d = new Date()) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
```

Run: `npm test` → Expected: PASS (6 testes)

- [ ] **Step 4: Tirar o script do `index.html`**

```bash
node -e '
const fs = require("fs");
const h = fs.readFileSync("index.html", "utf8");
const abre = h.match(/<script>\r?\n\(function\(\)\{\r?\n/);
const fecha = h.match(/\}\)\(\);\r?\n<\/script>/);
if (!abre || !fecha) throw new Error("marcadores não encontrados");
const ini = abre.index, fim = h.lastIndexOf(fecha[0]);
fs.mkdirSync("js", { recursive: true });
fs.writeFileSync("js/painel.js", h.slice(ini + abre[0].length, fim));
let novo = h.slice(0, ini) + "<script type=\"module\" src=\"/js/painel.js\"></script>" + h.slice(fim + fecha[0].length);
novo = novo.replace(/<script type="application\/json" id="dados-app">null<\/script>\r?\n/, "");
fs.writeFileSync("index.html", novo);
'
```

Check: `grep -c "<script" index.html` → `1`; `head -5 js/painel.js` começa com o comentário `/* ===... Painel do Meu Dinheiro`.

- [ ] **Step 5: Ajustar `js/painel.js` para módulo**

1. No topo do arquivo:
```js
import { normalizar, RE_ENTRADA, CATS_BASE, mesDe, diasNoMes, hojeLocal } from "./base.js";
```
2. Apagar de `painel.js` as definições que agora vêm de `base.js`: o bloco `const CATS_BASE = [ ... ];` (e o comentário acima dele), `const mesDe = ...`, `const diasNoMes = ...`, `const normalizar = ...`, `const RE_ENTRADA = ...`.
3. Trocar `const hoje = () => new Date().toISOString().slice(0,10);` por:
```js
const hoje = () => hojeLocal();
```
4. Trocar o comentário do cabeçalho `Estado -> localStorage (imediato) + artifact.publish (permanente)` por `Estado -> localStorage (imediato) + Supabase (nuvem)`.
5. Remover a publicação via artefato do Claude:
   - apagar `let FONTE = "";`, a função `montarDocumento()` inteira e a função `sincronizar()` inteira;
   - trocar `let artifact = null, downloads = null;` por nada e `let sujo = false, publicando = false, timerSync = 0;` por `let sujo = false;`;
   - substituir `agendarSync()` por um stub (a Tarefa 5 troca):
```js
function agendarSync(){ /* nuvem entra na Tarefa 5 */ }
```
   - substituir `pintarEstado()` por:
```js
function pintarEstado(){
  const el = $("#estado"), txt = el.querySelector("span");
  el.dataset.s = "ok"; txt.textContent = "Salvo neste aparelho"; el.title = "";
}
```
   - em `carregarEstado()`, apagar as linhas do `incorporado` e usar só o local:
```js
function carregarEstado(){
  const base = lerLocal(CHAVE_DADOS) || SEMENTE();
  base.lancamentos ||= [];
  base.categorias  ||= CATS_BASE.map(c => c.nome);
  base.metas       ||= {};
  base.regras      ||= {};   /* comerciante → categoria, aprendido nas importações */
  for (const l of base.lancamentos)
    if (l.categoria && !base.categorias.includes(l.categoria)) base.categorias.push(l.categoria);
  estado = base;
  gravarLocal(CHAVE_DADOS, estado);
}
```
   - em `render()`, apagar as duas linhas do comentário/`if (csv && !downloads && window.claude)` (o botão CSV sempre aparece);
   - em `baixarCSV()`, apagar o bloco `if (downloads){ ... }`;
   - trocar `$("#estado").addEventListener("click", () => { if (sujo && artifact) sincronizar(); });` por `$("#estado").addEventListener("click", () => {});` (a Tarefa 5 troca);
   - em `iniciar()`, apagar a linha do `FONTE = ...` (e o comentário acima) e o bloco `if (window.claude?.use){ ... }`.

Check: `grep -nE "artifact|FONTE|downloads|claude\\.use|dados-app" js/painel.js` → nada.

- [ ] **Step 6: Conferir no navegador**

Iniciar a prévia (`preview_start` com o nome `painel`). Abrir `http://localhost:4173/`.
Expected: painel abre com os dados de exemplo de julho (localStorage vazio nesta origem), abas funcionam, console sem erros (`read_console_messages` com `onlyErrors: true`). Criar um gasto pelo "+" e recarregar: continua lá.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: separa o script do painel em módulos ES e remove a publicação via artefato"
```

---

### Tarefa 2: Estado v2 e junção de dados

**Files:**
- Create: `js/juntar.js`, `testes/juntar.test.js`
- Modify: `js/painel.js` (`carregarEstado`, criação/edição/apagamento de lançamentos, importação; remove `SEMENTE`)

**Interfaces:**
- Consumes: `CATS_BASE` (base.js)
- Produces: `estadoVazio(agora?): Estado`, `migrarV2(e, agora?): Estado`, `juntar(local, nuvem|null): Estado`

- [ ] **Step 1: Testes (falham)**

`testes/juntar.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoVazio, migrarV2, juntar } from "../js/juntar.js";

const L = (id, editadoEm, extra = {}) => ({ id, tipo:"gasto", data:"2026-11-01", categoria:"Lazer", descricao:id, valor:10, editadoEm, ...extra });
const base = (over = {}) => ({ ...estadoVazio(100), ...over });

test("estadoVazio não tem lançamentos de exemplo", () => {
  const e = estadoVazio(5);
  assert.equal(e.v, 2);
  assert.deepEqual(e.lancamentos, []);
  assert.deepEqual(e.fixas, []);
  assert.deepEqual(e.apagados, {});
  assert.ok(e.categorias.includes("Contas fixas"));
});

test("migrarV2 completa campos e carimba editadoEm", () => {
  const v1 = { v:1, atualizadoEm: 50, lancamentos:[{ id:"a", tipo:"gasto", data:"2026-07-03", categoria:"Lazer", descricao:"x", valor:1 }], categorias:["Lazer"], metas:{}, regras:{} };
  const e = migrarV2(v1);
  assert.equal(e.v, 2);
  assert.equal(e.lancamentos[0].editadoEm, 50);
  assert.deepEqual(e.fixas, []);
  assert.deepEqual(e.apagados, {});
});

test("lançamento novo dos dois lados entra", () => {
  const r = juntar(base({ lancamentos:[L("a", 1)] }), base({ lancamentos:[L("b", 1)] }));
  assert.deepEqual(r.lancamentos.map(x => x.id).sort(), ["a", "b"]);
});

test("mesmo id: vale a edição mais nova", () => {
  const r = juntar(base({ lancamentos:[L("a", 5, { valor: 99 })] }), base({ lancamentos:[L("a", 3, { valor: 1 })] }));
  assert.equal(r.lancamentos[0].valor, 99);
  const r2 = juntar(base({ lancamentos:[L("a", 3, { valor: 1 })] }), base({ lancamentos:[L("a", 5, { valor: 99 })] }));
  assert.equal(r2.lancamentos[0].valor, 99);
});

test("apagado não volta; edição posterior ao apagar volta", () => {
  const apagou = base({ lancamentos:[], apagados:{ a: 10 } });
  assert.equal(juntar(apagou, base({ lancamentos:[L("a", 5)] })).lancamentos.length, 0);
  assert.equal(juntar(apagou, base({ lancamentos:[L("a", 20)] })).lancamentos.length, 1);
  assert.equal(juntar(apagou, base()).apagados.a, 10);
});

test("fixas seguem a mesma regra", () => {
  const f = (id, t, valor) => ({ id, nome:id, valor, categoria:"Contas fixas", dia:10, tipo:"mensal", inicio:"2026-11", editadoEm:t });
  const r = juntar(base({ fixas:[f("x", 2, 100)] }), base({ fixas:[f("x", 7, 120), f("y", 1, 50)] }));
  assert.deepEqual(r.fixas.map(x => [x.id, x.valor]).sort(), [["x", 120], ["y", 50]]);
});

test("categorias: une mantendo a ordem local", () => {
  const r = juntar(base({ categorias:["A", "B"] }), base({ categorias:["B", "C"] }));
  assert.deepEqual(r.categorias, ["A", "B", "C"]);
});

test("metas e regras: vale o lado mais recente inteiro", () => {
  const velho = base({ atualizadoEm: 10, regras:{ ifood:"Comida/Fast Food" }, metas:{ Lazer: 100 } });
  const novo  = base({ atualizadoEm: 20, regras:{}, metas:{} });
  const r = juntar(velho, novo);
  assert.deepEqual(r.regras, {});
  assert.deepEqual(r.metas, {});
  assert.equal(r.atualizadoEm, 20);
});

test("sem nuvem: devolve o local migrado", () => {
  const r = juntar(base({ lancamentos:[L("a", 1)] }), null);
  assert.equal(r.lancamentos.length, 1);
});

test("idempotente", () => {
  const a = base({ atualizadoEm: 30, lancamentos:[L("a", 1), L("c", 4)], apagados:{ z: 3 }, categorias:["A"] });
  const b = base({ atualizadoEm: 40, lancamentos:[L("b", 2), L("c", 9)], categorias:["B"], regras:{ k:"Lazer" } });
  const j = juntar(a, b);
  assert.deepEqual(juntar(a, j), j);
  assert.deepEqual(juntar(j, j), j);
});
```

Run: `npm test` → Expected: FAIL (`juntar.js` não existe)

- [ ] **Step 2: Implementar `js/juntar.js`**

```js
import { CATS_BASE } from "./base.js";

export function estadoVazio(agora = Date.now()){
  return { v:2, atualizadoEm: agora, lancamentos:[], fixas:[], apagados:{}, categorias: CATS_BASE.map(c => c.nome), metas:{}, regras:{} };
}

export function migrarV2(e, agora = Date.now()){
  const x = { ...e };
  x.v = 2;
  x.atualizadoEm ||= agora;
  x.lancamentos = (x.lancamentos || []).map(l => l.editadoEm ? l : { ...l, editadoEm: x.atualizadoEm });
  x.fixas = (x.fixas || []).map(f => f.editadoEm ? f : { ...f, editadoEm: x.atualizadoEm });
  x.apagados = { ...(x.apagados || {}) };
  x.categorias = [...(x.categorias || CATS_BASE.map(c => c.nome))];
  x.metas = { ...(x.metas || {}) };
  x.regras = { ...(x.regras || {}) };
  return x;
}

function unirLista(a, b, apagados){
  const m = new Map(a.map(i => [i.id, i]));
  for (const i of b){
    const atual = m.get(i.id);
    if (!atual || (i.editadoEm || 0) > (atual.editadoEm || 0)) m.set(i.id, i);
  }
  return [...m.values()].filter(i => !(apagados[i.id] >= (i.editadoEm || 0)));
}

/* une o que está no aparelho com o que está na nuvem, item por item */
export function juntar(local, nuvem){
  const L = migrarV2(local);
  if (!nuvem) return L;
  const N = migrarV2(nuvem);
  const apagados = { ...N.apagados };
  for (const [id, t] of Object.entries(L.apagados)) apagados[id] = Math.max(apagados[id] || 0, t);
  const recente = (L.atualizadoEm || 0) >= (N.atualizadoEm || 0) ? L : N;
  const categorias = [...L.categorias];
  for (const c of N.categorias) if (!categorias.includes(c)) categorias.push(c);
  return {
    v: 2,
    atualizadoEm: Math.max(L.atualizadoEm || 0, N.atualizadoEm || 0),
    lancamentos: unirLista(L.lancamentos, N.lancamentos, apagados),
    fixas: unirLista(L.fixas, N.fixas, apagados),
    apagados,
    categorias,
    metas: { ...recente.metas },
    regras: { ...recente.regras },
  };
}
```

Run: `npm test` → Expected: PASS

- [ ] **Step 3: Ligar no painel**

Em `js/painel.js`:
1. `import { estadoVazio, migrarV2, juntar } from "./juntar.js";`
2. Apagar a função `SEMENTE` inteira (ela era só exemplo; aparelho novo começa vazio — Review Focus 1).
3. `carregarEstado()` vira:
```js
function carregarEstado(){
  estado = migrarV2(lerLocal(CHAVE_DADOS) || estadoVazio());
  for (const l of estado.lancamentos)
    if (l.categoria && !estado.categorias.includes(l.categoria)) estado.categorias.push(l.categoria);
  gravarLocal(CHAVE_DADOS, estado);
}
```
4. No `submit` de `abrirForm`, o objeto `reg` ganha `editadoEm: Date.now()`:
```js
const reg = { tipo:d.tipo, data:d.data, categoria, descricao:String(d.descricao).trim(), valor:Math.round(valor*100)/100, editadoEm: Date.now() };
```
5. No `case "apagar"`, antes do `filter`:
```js
estado.apagados[l.id] = Date.now();
```
6. No `case "importar"`, o objeto empurrado ganha `editadoEm: Date.now(),`.
7. O texto de `vazio()` da Visão geral continua igual.

- [ ] **Step 4: Conferir no navegador**

Na prévia, rodar no console da página (`javascript_tool`): `localStorage.clear(); location.reload()`.
Expected: painel vazio ("Nada lançado em novembro de 2026"), sem os exemplos de julho. Criar, editar e apagar um gasto; depois `JSON.parse(localStorage.getItem("painel-dinheiro:dados"))` mostra `v: 2`, `editadoEm` no lançamento editado e o id apagado em `apagados`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: estado v2 com editadoEm, apagados e junção item a item"
```

---

### Tarefa 3: Laço de sincronização (puro, testado)

**Files:**
- Create: `js/sincronia.js`, `testes/sincronia.test.js`

**Interfaces:**
- Consumes: `juntar` (juntar.js)
- Produces: `sincronizar(api, local, tentativas = 3): Promise<{ estado, ok: boolean }>` onde `api = { ler(): Promise<{dados, versao}|null>, inserir(dados): Promise<boolean>, atualizar(dados, versaoLida): Promise<boolean> }`. Erros de rede da `api` sobem como exceção.

- [ ] **Step 1: Testes (falham)**

`testes/sincronia.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { sincronizar } from "../js/sincronia.js";
import { estadoVazio } from "../js/juntar.js";

const L = (id, t = 1) => ({ id, tipo:"gasto", data:"2026-11-01", categoria:"Lazer", descricao:id, valor:10, editadoEm:t });
const est = (ids, at = 100) => ({ ...estadoVazio(at), lancamentos: ids.map(i => L(i)) });

function nuvemFalsa(inicial = null){
  const n = { linha: inicial, gravacoes: 0, roubar: 0 };
  n.api = {
    async ler(){ return n.linha && structuredClone(n.linha); },
    async inserir(dados){ if (n.linha) return false; n.linha = { dados, versao: 1 }; n.gravacoes++; return true; },
    async atualizar(dados, v){
      if (n.roubar > 0){ n.roubar--; n.linha = { dados: n.linha.dados, versao: n.linha.versao + 1 }; return false; }
      if (n.linha.versao !== v) return false;
      n.linha = { dados, versao: v + 1 }; n.gravacoes++; return true;
    },
  };
  return n;
}

test("primeira vez: insere o estado local", async () => {
  const n = nuvemFalsa();
  const r = await sincronizar(n.api, est(["a", "b"]));
  assert.equal(r.ok, true);
  assert.equal(n.linha.dados.lancamentos.length, 2);
});

test("nuvem já tem caderno de outro aparelho: nada local se perde", async () => {
  const n = nuvemFalsa({ dados: est(["celular"]), versao: 3 });
  const r = await sincronizar(n.api, est(["pc1", "pc2"]));
  assert.equal(r.ok, true);
  assert.deepEqual(r.estado.lancamentos.map(x => x.id).sort(), ["celular", "pc1", "pc2"]);
  assert.equal(n.linha.versao, 4);
});

test("conflito uma vez: lê de novo, junta e grava", async () => {
  const n = nuvemFalsa({ dados: est(["x"]), versao: 1 });
  n.roubar = 1;
  const r = await sincronizar(n.api, est(["meu"]));
  assert.equal(r.ok, true);
  assert.deepEqual(r.estado.lancamentos.map(x => x.id).sort(), ["meu", "x"]);
});

test("conflito três vezes: desiste sem perder o local", async () => {
  const n = nuvemFalsa({ dados: est(["x"]), versao: 1 });
  n.roubar = 3;
  const local = est(["meu"]);
  const r = await sincronizar(n.api, local);
  assert.equal(r.ok, false);
  assert.deepEqual(r.estado, local);
});

test("nada mudou: não grava de novo", async () => {
  const n = nuvemFalsa();
  const local = est(["a"]);
  await sincronizar(n.api, local);
  const antes = n.gravacoes;
  await sincronizar(n.api, local);
  assert.equal(n.gravacoes, antes);
});

test("erro de rede sobe como exceção", async () => {
  const api = { async ler(){ throw new Error("offline"); } };
  await assert.rejects(sincronizar(api, est(["a"])), /offline/);
});
```

Run: `npm test` → Expected: FAIL

- [ ] **Step 2: Implementar `js/sincronia.js`**

```js
import { juntar } from "./juntar.js";

/* JSON com chaves em ordem: o jsonb do Postgres não guarda a ordem das chaves */
const estavel = v => JSON.stringify(v, (_k, x) =>
  x && typeof x === "object" && !Array.isArray(x)
    ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : x);

/* lê a nuvem, junta com o local e grava com trava de versão.
   Se outro aparelho gravou no meio, tenta de novo. */
export async function sincronizar(api, local, tentativas = 3){
  for (let i = 0; i < tentativas; i++){
    const nuvem = await api.ler();
    const unido = juntar(local, nuvem ? nuvem.dados : null);
    if (nuvem && estavel(unido) === estavel(juntar(nuvem.dados, null)))
      return { estado: unido, ok: true };            /* nada novo: não grava */
    const gravou = nuvem ? await api.atualizar(unido, nuvem.versao) : await api.inserir(unido);
    if (gravou) return { estado: unido, ok: true };
  }
  return { estado: local, ok: false };
}
```

Run: `npm test` → Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: laço de sincronização com trava de versão e repetição"
```

---

### Tarefa 4: Projeto Supabase (precisa do Rafael)

**Files:**
- Create: `js/config.js`

**Interfaces:**
- Produces: `SUPABASE_URL: string`, `SUPABASE_CHAVE: string` (chave publicável `sb_publishable_...`)

- [ ] **Step 1: Rafael cria a organização gratuita**

Pedir a ele: em supabase.com/dashboard, menu da organização (canto superior esquerdo) → **New organization** → nome "Rafael pessoal", tipo Personal, plano **Free** → Create. Esperar o "pronto".

- [ ] **Step 2: Achar a org e conferir custo zero**

`list_organizations` → pegar o `id` da org nova (não `vdrjtslnnwfqjnidxzld`).
`get_cost` com `type: "project"` e essa org → Expected: `amount: 0`. Se não for 0, **parar e perguntar** ao Rafael. Repetir o custo para ele e só seguir com o "ok".

- [ ] **Step 3: Criar o projeto**

`confirm_cost` → `create_project` com `name: "painel-do-meu-dinheiro"`, `region: "sa-east-1"`, a org nova e o id de confirmação. Esperar `get_project` mostrar `ACTIVE_HEALTHY`.

- [ ] **Step 4: Migração da tabela**

`apply_migration` com `name: "cadernos"`:
```sql
create table public.cadernos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dados jsonb not null,
  versao integer not null default 1,
  atualizado_em timestamptz not null default now()
);

alter table public.cadernos enable row level security;

create policy "dono le" on public.cadernos
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.cadernos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.cadernos
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update on public.cadernos to authenticated;
```

Check: `list_tables` mostra `cadernos` com RLS ligada; `get_advisors` (`type: "security"`) sem alerta sobre `cadernos`.

- [ ] **Step 5: `js/config.js`**

`get_project_url` e `get_publishable_keys` (usar a chave publicável `sb_publishable_...`, nunca a secreta):
```js
/* chave publicável: pode estar no site; quem protege os dados é a RLS da tabela cadernos */
export const SUPABASE_URL = "<valor de get_project_url>";
export const SUPABASE_CHAVE = "<valor sb_publishable_ de get_publishable_keys>";
```
(Os dois valores saem das ferramentas neste passo; não deixar os sinais `<...>` no arquivo.)

- [ ] **Step 6: Rafael ajusta o login no painel do Supabase**

Guiar, no projeto novo:
1. **Authentication → Email Templates → Magic Link**: trocar o corpo por
```html
<h2>Seu código do Painel do Meu Dinheiro</h2>
<p>Digite este código no painel: <b style="font-size:22px;letter-spacing:3px">{{ .Token }}</b></p>
<p>Vale por 1 hora. Se não foi você, ignore este e-mail.</p>
```
2. Repetir o mesmo texto em **Confirm signup** (primeiro acesso usa esse modelo).
3. **Authentication → URL Configuration → Site URL**: `https://painel-do-meu-dinheiro.vercel.app`.

- [ ] **Step 7: Commit**

```bash
git add js/config.js
git commit -m "chore: configura o projeto Supabase do painel"
```

---

### Tarefa 5: Login, sessão e sincronização na interface

**Files:**
- Create: `js/nuvem.js`
- Modify: `index.html` (tela Entrar, botão Sair, CSS), `js/painel.js` (indicador, `mudou`, `agendarSync`, `sincronizar`, `iniciar`, eventos)

**Interfaces:**
- Consumes: `SUPABASE_URL`, `SUPABASE_CHAVE` (config.js); `sincronizar(api, local)` (sincronia.js); `juntar` (juntar.js)
- Produces (`js/nuvem.js`): `usuarioAtual(): Promise<User|null>`, `pedirCodigo(email): Promise<void>`, `confirmarCodigo(email, codigo): Promise<User>`, `sair(): Promise<void>`, `aoMudarSessao(cb: (User|null) => void): Promise<void>`, `apiDoCaderno(userId)` no formato de `api` da Tarefa 3.

- [ ] **Step 1: `js/nuvem.js`**

```js
import { SUPABASE_URL, SUPABASE_CHAVE } from "./config.js";

/* supabase-js só é baixado quando precisa: sem internet o painel abre igual */
let cliente = null;
async function obter(){
  if (!cliente){
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.119.0");
    cliente = createClient(SUPABASE_URL, SUPABASE_CHAVE, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return cliente;
}

export async function usuarioAtual(){
  const { data } = await (await obter()).auth.getSession();
  return data.session?.user || null;
}

export async function pedirCodigo(email){
  const { error } = await (await obter()).auth.signInWithOtp({
    email, options: { shouldCreateUser: true, emailRedirectTo: location.origin },
  });
  if (error) throw error;
}

export async function confirmarCodigo(email, codigo){
  const { data, error } = await (await obter()).auth.verifyOtp({ email, token: codigo, type: "email" });
  if (error) throw error;
  return data.user;
}

export async function sair(){ await (await obter()).auth.signOut(); }

export async function aoMudarSessao(cb){
  (await obter()).auth.onAuthStateChange((_ev, sessao) => cb(sessao?.user || null));
}

export function apiDoCaderno(userId){
  return {
    async ler(){
      const { data, error } = await (await obter()).from("cadernos").select("dados, versao").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
    async inserir(dados){
      const { error } = await (await obter()).from("cadernos").insert({ user_id: userId, dados, versao: 1 });
      if (error){ if (error.code === "23505") return false; throw error; }
      return true;
    },
    async atualizar(dados, versaoLida){
      const { data, error } = await (await obter()).from("cadernos")
        .update({ dados, versao: versaoLida + 1, atualizado_em: new Date().toISOString() })
        .eq("user_id", userId).eq("versao", versaoLida).select("versao");
      if (error) throw error;
      return data.length === 1;
    },
  };
}
```

- [ ] **Step 2: `index.html` — marcação**

Dentro de `.topo-linha`, logo depois do `<button ... id="estado">...</button>`:
```html
<button type="button" class="btn btn-txt oculto" id="btn-sair" data-acao="sair" style="padding:6px 10px;font-size:12.5px">Sair</button>
```

Antes de `<div id="modal"></div>`:
```html
<div id="entrar" class="entrar oculto" role="dialog" aria-modal="true" aria-labelledby="entrar-tit">
  <form class="folha" id="form-entrar" novalidate>
    <h2 id="entrar-tit">Entrar no painel</h2>
    <p class="sub" style="margin:0 0 12px">Seus lançamentos ficam salvos na nuvem e aparecem no celular e no computador. É só uma vez por aparelho.</p>
    <div class="campo">
      <label for="e-email">Seu e-mail</label>
      <input id="e-email" type="email" autocomplete="email" inputmode="email" required>
    </div>
    <div class="campo oculto" id="bloco-codigo">
      <label for="e-codigo">Código que chegou no e-mail</label>
      <input id="e-codigo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10">
    </div>
    <p class="sub" id="entrar-msg" role="status" style="margin:8px 0 0"></p>
    <div class="folha-pe">
      <button type="button" class="btn" id="e-depois">Agora não</button>
      <button type="button" class="btn oculto" id="e-outro">Mandar outro código</button>
      <button type="submit" class="btn btn-forte" id="e-ok">Mandar código</button>
    </div>
  </form>
</div>
```

- [ ] **Step 3: `index.html` — CSS** (antes de `.oculto{...}`)

```css
.estado[data-s="offline"]{border-color:var(--alerta);background:var(--alerta-suave);color:var(--alerta);cursor:pointer}
.estado[data-s="offline"] .ponto{background:var(--alerta)}
.entrar{position:fixed;inset:0;z-index:95;display:grid;place-items:center;padding:18px;background:rgba(26,24,38,.55);backdrop-filter:blur(3px)}
.entrar .folha{max-width:400px;width:100%}
```

- [ ] **Step 4: `js/painel.js` — estado da sincronização**

1. Imports:
```js
import * as nuvem from "./nuvem.js";
import { sincronizar as sincronizarCom } from "./sincronia.js";
```
2. Trocar `let sujo = false;` por:
```js
let sujo = false, publicando = false, falhou = false, timerSync = 0, mudancas = 0;
let usuario = null;
```
3. `mudou()` vira:
```js
function mudou(){
  estado.atualizadoEm = Date.now();
  mudancas++;
  gravarLocal(CHAVE_DADOS, estado);
  sujo = true;
  pintarEstado();
  render();
  agendarSync();
}
```
(Procurar chamadas `mudou({ sincronizar: false })`; se houver, trocar por `mudou()`.)
4. Trocar o stub `agendarSync` e `pintarEstado` por:
```js
function agendarSync(ms = 3000){
  clearTimeout(timerSync);
  timerSync = setTimeout(sincronizar, ms);
}

async function sincronizar(){
  if (!usuario || publicando) return;
  publicando = true; pintarEstado();
  const n = mudancas;
  try {
    const r = await sincronizarCom(nuvem.apiDoCaderno(usuario.id), estado);
    falhou = false;
    if (!r.ok){ sujo = true; agendarSync(15000); return; }
    const antes = JSON.stringify(estado);
    estado = juntar(estado, r.estado);       /* não perde o que foi digitado durante o envio */
    gravarLocal(CHAVE_DADOS, estado);
    sujo = mudancas !== n;
    if (sujo) agendarSync();
    if (JSON.stringify(estado) !== antes) render();
  } catch {
    falhou = true; sujo = true;
  } finally {
    publicando = false; pintarEstado();
  }
}

function pintarEstado(){
  const el = $("#estado"), txt = el.querySelector("span");
  const por = (s, t, dica = "") => { el.dataset.s = s; txt.textContent = t; el.title = dica; };
  if (!usuario) return por("offline", navigator.onLine ? "Entrar pra salvar na nuvem" : "Sem conexão — salvo neste aparelho");
  if (publicando) return por("salvando", "Salvando…");
  if (!navigator.onLine || falhou) return por("offline", "Sem conexão — salvo neste aparelho", "Tento de novo quando a internet voltar.");
  if (sujo) return por("sujo", "Salvar agora", "Há mudanças ainda não enviadas.");
  por("ok", "Tudo salvo");
}
```
5. Trocar `$("#estado").addEventListener("click", () => {});` por:
```js
$("#estado").addEventListener("click", () => { if (!usuario) mostrarEntrar(); else sincronizar(); });
```

- [ ] **Step 5: `js/painel.js` — tela Entrar**

Adicionar antes de `iniciar()`:
```js
/* ================================ LOGIN ================================= */
let emailPendente = "";

function mostrarEntrar(){
  $("#entrar").classList.remove("oculto");
  setTimeout(() => (emailPendente ? $("#e-codigo") : $("#e-email")).focus(), 40);
}
function esconderEntrar(){ $("#entrar").classList.add("oculto"); }

function voltarPraEmail(){
  emailPendente = "";
  $("#e-email").disabled = false;
  $("#bloco-codigo").classList.add("oculto");
  $("#e-outro").classList.add("oculto");
  $("#e-codigo").value = "";
  $("#e-ok").textContent = "Mandar código";
}

async function entrou(u){
  usuario = u;
  $("#btn-sair").classList.remove("oculto");
  esconderEntrar();
  pintarEstado();
  await sincronizar();
}

function ligarEntrar(){
  const msg = $("#entrar-msg"), ok = $("#e-ok");
  $("#form-entrar").addEventListener("submit", async ev => {
    ev.preventDefault();
    ok.disabled = true;
    try {
      if (!emailPendente){
        const email = $("#e-email").value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)){ msg.textContent = "Confira o e-mail."; return; }
        await nuvem.pedirCodigo(email);
        emailPendente = email;
        $("#e-email").disabled = true;
        $("#bloco-codigo").classList.remove("oculto");
        $("#e-outro").classList.remove("oculto");
        ok.textContent = "Entrar";
        msg.textContent = "Mandamos um código para " + email + ". Pode levar um minuto — olhe também o spam.";
        $("#e-codigo").focus();
      } else {
        const codigo = $("#e-codigo").value.replace(/\D/g, "");
        if (codigo.length < 6){ msg.textContent = "O código tem pelo menos 6 dígitos."; return; }
        const u = await nuvem.confirmarCodigo(emailPendente, codigo);
        msg.textContent = "";
        voltarPraEmail();
        await entrou(u);
        torrada("Pronto! Seus dados agora ficam salvos na nuvem.");
      }
    } catch (e) {
      msg.textContent = e?.status === 429
        ? "Muitos pedidos seguidos. Espere um minuto e tente de novo."
        : emailPendente ? "Código errado ou vencido. Confira ou peça outro."
        : "Não deu pra mandar o código agora. Confira a internet e tente de novo.";
    } finally { ok.disabled = false; }
  });
  $("#e-outro").addEventListener("click", () => { voltarPraEmail(); msg.textContent = ""; $("#e-email").focus(); });
  $("#e-depois").addEventListener("click", () => { esconderEntrar(); pintarEstado(); torrada("Tudo bem. Seus dados ficam só neste aparelho até você entrar."); });
}
```

No `switch` do clique, novo caso:
```js
case "sair": {
  nuvem.sair().catch(() => {});
  usuario = null;
  $("#btn-sair").classList.add("oculto");
  pintarEstado();
  torrada("Você saiu. Os dados continuam neste aparelho.");
  break;
}
```

- [ ] **Step 6: `js/painel.js` — `iniciar()`**

Substituir o corpo de `iniciar()` por:
```js
function iniciar(){
  carregarEstado();
  const salvo = lerLocal(CHAVE_UI) || {};
  ui.aba = ABAS.some(a => a.id === salvo.aba) ? salvo.aba : "visao";
  ui.periodo = salvo.periodo || periodoPadrao();
  render();
  pintarEstado();
  ligarEntrar();
  ligarNuvem();
}

async function ligarNuvem(){
  try { usuario = await nuvem.usuarioAtual(); } catch { usuario = null; }
  if (usuario) await entrou(usuario);
  else if (navigator.onLine) mostrarEntrar();
  pintarEstado();
  nuvem.aoMudarSessao(u => {
    if (!u && usuario){ usuario = null; $("#btn-sair").classList.add("oculto"); pintarEstado(); mostrarEntrar(); }
  }).catch(() => {});
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sincronizar(); });
  window.addEventListener("online", async () => {
    falhou = false;
    if (!usuario){ try { usuario = await nuvem.usuarioAtual(); } catch {} }
    if (usuario) await entrou(usuario); else mostrarEntrar();
  });
  window.addEventListener("offline", pintarEstado);
}
```

- [ ] **Step 7: Conferir no navegador**

Na prévia (`http://localhost:4173/`):
1. Recarregar → a tela "Entrar" aparece; console sem erro.
2. "Agora não" → fecha; indicador "Entrar pra salvar na nuvem"; criar um gasto funciona.
3. Clicar no indicador → a tela volta.
4. No console: `JSON.parse(localStorage.getItem("painel-dinheiro:dados")).v === 2`.
**Não** pedir código nem logar (regra: Claude não entra em serviço externo). O login real é testado pelo Rafael na Tarefa 12.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: login por código e sincronização com o Supabase"
```

---

### Tarefa 6: Cálculo de fixas e parcelas (puro, testado)

**Files:**
- Create: `js/fixas.js`, `testes/fixas.test.js`

**Interfaces:**
- Consumes: `somarMeses`, `mesesEntre`, `diasNoMes`, `mesDe`, `normalizar` (base.js)
- Produces:
  - `ATE_PADRAO = "2027-12"`
  - `ultimoMes(fixa): "AAAA-MM"|null`
  - `parcelaNoMes(fixa, mes): number|null`
  - `ativaNoMes(fixa, mes): boolean`
  - `vencimento(fixa, mes): "AAAA-MM-DD"`
  - `ocorrencias(fixas, lancamentos, mes, hoje): Ocorrencia[]` onde `Ocorrencia = { fixa, mes, parcela, valor, vencimento, situacao: "pago"|"a-pagar"|"atrasado", lancamento }`
  - `resumoDoMes(ocs): { total, pago, aPagar, atrasado }`
  - `mesesDaFaixa(hoje, ate = ATE_PADRAO): string[]`
  - `pendentesAnteriores(fixas, lancamentos, hoje): Ocorrencia[]`
  - `descricaoPagamento(oc): string`
  - `pagar(estado, fixaId, mes, hoje, id, agora): Lancamento|null`
  - `casarComFixa({descricao, valor}, ocs, chave): Ocorrencia|null`

- [ ] **Step 1: Testes (falham)**

`testes/fixas.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as F from "../js/fixas.js";

const celular = { id:"cel", nome:"Celular", valor:150, categoria:"Coisas pra mim", dia:10, tipo:"parcelado", inicio:"2026-09", parcelas:10, editadoEm:1 };
const aluguel = { id:"alu", nome:"Aluguel", valor:900, categoria:"Contas fixas", dia:31, tipo:"mensal", inicio:"2026-11", editadoEm:1 };
const net     = { id:"net", nome:"Internet", valor:100, categoria:"Contas fixas", dia:5, tipo:"mensal", inicio:"2026-01", fim:"2026-12", editadoEm:1 };

test("parcela do mês", () => {
  assert.equal(F.parcelaNoMes(celular, "2026-08"), null);
  assert.equal(F.parcelaNoMes(celular, "2026-09"), 1);
  assert.equal(F.parcelaNoMes(celular, "2026-11"), 3);
  assert.equal(F.parcelaNoMes(celular, "2027-06"), 10);
  assert.equal(F.parcelaNoMes(celular, "2027-07"), null);
  assert.equal(F.parcelaNoMes(aluguel, "2026-11"), null);
});

test("último mês e ativa no mês", () => {
  assert.equal(F.ultimoMes(celular), "2027-06");
  assert.equal(F.ultimoMes(aluguel), null);
  assert.equal(F.ultimoMes(net), "2026-12");
  assert.equal(F.ativaNoMes(aluguel, "2030-01"), true);
  assert.equal(F.ativaNoMes(aluguel, "2026-10"), false);
  assert.equal(F.ativaNoMes(net, "2027-01"), false);
  assert.equal(F.ativaNoMes(celular, "2027-07"), false);
});

test("vencimento limita ao último dia do mês", () => {
  assert.equal(F.vencimento(aluguel, "2027-02"), "2027-02-28");
  assert.equal(F.vencimento(aluguel, "2028-02"), "2028-02-29");
  assert.equal(F.vencimento(aluguel, "2026-11"), "2026-11-30");
  assert.equal(F.vencimento(celular, "2026-11"), "2026-11-10");
});

test("situação: pago, atrasado, a pagar", () => {
  const pago = { id:"l1", tipo:"gasto", data:"2026-11-04", categoria:"Contas fixas", descricao:"Internet", valor:95, fixaId:"net", fixaMes:"2026-11", editadoEm:1 };
  const ocs = F.ocorrencias([celular, aluguel, net], [pago], "2026-11", "2026-11-12");
  const por = Object.fromEntries(ocs.map(o => [o.fixa.id, o]));
  assert.equal(por.net.situacao, "pago");
  assert.equal(por.net.valor, 95);
  assert.equal(por.cel.situacao, "atrasado");
  assert.equal(por.cel.parcela, 3);
  assert.equal(por.alu.situacao, "a-pagar");
  assert.deepEqual(ocs.map(o => o.fixa.id), ["net", "cel", "alu"]);
});

test("resumo do mês", () => {
  const ocs = F.ocorrencias([celular, aluguel], [], "2026-11", "2026-11-12");
  assert.deepEqual(F.resumoDoMes(ocs), { total: 1050, pago: 0, aPagar: 1050, atrasado: 150 });
});

test("faixa de meses até dez/2027", () => {
  const m = F.mesesDaFaixa("2026-11-05");
  assert.equal(m.length, 14);
  assert.equal(m[0], "2026-11");
  assert.equal(m[13], "2027-12");
  assert.deepEqual(F.mesesDaFaixa("2028-03-01"), ["2028-03"]);
});

test("pendentes de meses anteriores", () => {
  const p = F.pendentesAnteriores([celular], [], "2026-11-05");
  assert.deepEqual(p.map(o => o.mes), ["2026-09", "2026-10"]);
  assert.deepEqual(F.pendentesAnteriores([], [], "2026-11-05"), []);
});

test("descrição do pagamento", () => {
  const [o] = F.ocorrencias([celular], [], "2026-11", "2026-11-01");
  assert.equal(F.descricaoPagamento(o), "Celular (3/10)");
  const [a] = F.ocorrencias([aluguel], [], "2026-11", "2026-11-01");
  assert.equal(F.descricaoPagamento(a), "Aluguel");
});

test("pagar cria um lançamento e não duplica (toque duplo)", () => {
  const estado = { fixas:[celular], lancamentos:[] };
  const l = F.pagar(estado, "cel", "2026-11", "2026-11-05", "id1", 77);
  assert.deepEqual(l, { id:"id1", tipo:"gasto", data:"2026-11-10", categoria:"Coisas pra mim", descricao:"Celular (3/10)", valor:150, fixaId:"cel", fixaMes:"2026-11", editadoEm:77 });
  estado.lancamentos.push(l);
  assert.equal(F.pagar(estado, "cel", "2026-11", "2026-11-05", "id2", 78), null);
});

test("pagar atrasado usa a data de hoje; mês fora da fixa não paga", () => {
  const estado = { fixas:[celular], lancamentos:[] };
  assert.equal(F.pagar(estado, "cel", "2026-10", "2026-11-05", "x", 1).data, "2026-11-05");
  assert.equal(F.pagar(estado, "cel", "2027-07", "2026-11-05", "x", 1), null);
});

test("casar linha do extrato com a fixa", () => {
  const chave = d => d.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(t => t.length > 2).slice(0, 2).join(" ");
  const ocs = F.ocorrencias([celular, aluguel], [], "2026-11", "2026-11-01");
  assert.equal(F.casarComFixa({ descricao:"LOJA XYZ PARCELA 03/10", valor:150 }, ocs, chave)?.fixa.id, "cel");
  assert.equal(F.casarComFixa({ descricao:"PIX ALUGUEL APTO", valor:900.3 }, ocs, chave)?.fixa.id, "alu");
  assert.equal(F.casarComFixa({ descricao:"PIX ALUGUEL APTO", valor:950 }, ocs, chave), null);
  assert.equal(F.casarComFixa({ descricao:"MERCADO", valor:150 }, ocs, chave), null);
});
```

Run: `npm test` → Expected: FAIL

- [ ] **Step 2: Implementar `js/fixas.js`**

```js
import { somarMeses, mesesEntre, diasNoMes, mesDe, normalizar } from "./base.js";

export const ATE_PADRAO = "2027-12";

export function ultimoMes(f){
  return f.tipo === "parcelado" ? somarMeses(f.inicio, f.parcelas - 1) : (f.fim || null);
}

export function parcelaNoMes(f, mes){
  if (f.tipo !== "parcelado") return null;
  const k = mesesEntre(f.inicio, mes) + 1;
  return k >= 1 && k <= f.parcelas ? k : null;
}

export function ativaNoMes(f, mes){
  if (mesesEntre(f.inicio, mes) < 0) return false;
  const fim = ultimoMes(f);
  return !fim || mesesEntre(mes, fim) >= 0;
}

export function vencimento(f, mes){
  const [a, m] = mes.split("-").map(Number);
  return mes + "-" + String(Math.min(f.dia, diasNoMes(a, m))).padStart(2, "0");
}

export function ocorrencias(fixas, lancamentos, mes, hoje){
  const out = [];
  for (const f of fixas){
    if (!ativaNoMes(f, mes)) continue;
    const pago = lancamentos.find(l => l.fixaId === f.id && l.fixaMes === mes) || null;
    const venc = vencimento(f, mes);
    out.push({
      fixa: f, mes,
      parcela: parcelaNoMes(f, mes),
      valor: pago ? pago.valor : f.valor,
      vencimento: venc,
      situacao: pago ? "pago" : venc < hoje ? "atrasado" : "a-pagar",
      lancamento: pago,
    });
  }
  return out.sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.fixa.nome.localeCompare(b.fixa.nome));
}

export function resumoDoMes(ocs){
  const r = { total: 0, pago: 0, aPagar: 0, atrasado: 0 };
  for (const o of ocs){
    r.total += o.valor;
    if (o.situacao === "pago") r.pago += o.valor;
    else { r.aPagar += o.valor; if (o.situacao === "atrasado") r.atrasado += o.valor; }
  }
  for (const k of Object.keys(r)) r[k] = Math.round(r[k] * 100) / 100;
  return r;
}

export function mesesDaFaixa(hoje, ate = ATE_PADRAO){
  const ini = mesDe(hoje);
  const fim = mesesEntre(ini, ate) >= 0 ? ate : ini;
  const out = [];
  for (let m = ini; mesesEntre(m, fim) >= 0; m = somarMeses(m, 1)) out.push(m);
  return out;
}

export function pendentesAnteriores(fixas, lancamentos, hoje){
  if (!fixas.length) return [];
  const atual = mesDe(hoje);
  let m = fixas.map(f => f.inicio).sort()[0];
  const out = [];
  for (; mesesEntre(m, atual) > 0; m = somarMeses(m, 1))
    out.push(...ocorrencias(fixas, lancamentos, m, hoje).filter(o => o.situacao !== "pago"));
  return out;
}

export function descricaoPagamento(o){
  return o.parcela ? `${o.fixa.nome} (${o.parcela}/${o.fixa.parcelas})` : o.fixa.nome;
}

/* devolve o lançamento a criar, ou null se já está pago (protege do toque duplo) */
export function pagar(estado, fixaId, mes, hoje, id, agora){
  if (estado.lancamentos.some(l => l.fixaId === fixaId && l.fixaMes === mes)) return null;
  const f = estado.fixas.find(x => x.id === fixaId);
  if (!f || !ativaNoMes(f, mes)) return null;
  const [o] = ocorrencias([f], [], mes, hoje);
  return {
    id, tipo: "gasto",
    data: o.vencimento < hoje ? hoje : o.vencimento,
    categoria: f.categoria,
    descricao: descricaoPagamento(o),
    valor: f.valor,
    fixaId: f.id, fixaMes: mes,
    editadoEm: agora,
  };
}

/* linha do extrato que é uma fixa ainda não paga daquele mês */
export function casarComFixa(linha, ocs, chave){
  const desc = normalizar(linha.descricao);
  const k = chave(linha.descricao);
  const mParc = String(linha.descricao).match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
  return ocs.find(o => {
    if (o.situacao === "pago" || Math.abs(o.fixa.valor - linha.valor) > 0.5) return false;
    const nome = normalizar(o.fixa.nome);
    if (k && k === chave(o.fixa.nome)) return true;
    if (nome && desc.includes(nome)) return true;
    return !!(mParc && o.parcela && +mParc[1] === o.parcela && +mParc[2] === o.fixa.parcelas);
  }) || null;
}
```

Run: `npm test` → Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: cálculo de fixas e parcelas"
```

---

### Tarefa 7: Aba "Fixas e parcelas"

**Files:**
- Modify: `js/painel.js` (aba, formulário, ações), `index.html` (CSS)

**Interfaces:**
- Consumes: tudo de `js/fixas.js` (Tarefa 6); `somarDias`, `somarMeses` (base.js)
- Produces (para Tarefas 8, 10, 11): `abrirFormFixa(id: string|null, pre?: Partial<Fixa>)`, `abrevMes("AAAA-MM"): "nov/2026"`

- [ ] **Step 1: CSS** (em `index.html`, antes de `.oculto{...}`)

```css
.meses{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(270px,1fr))}
.mes h3{font-size:14px;font-weight:700;display:flex;justify-content:space-between;gap:8px}
.mes h3 span{font-family:var(--fonte-num);font-weight:600}
.mes .pe-mes{font-size:12px;color:var(--tinta-3);margin:2px 0 6px}
.fx{display:grid;grid-template-columns:1fr auto;gap:3px 10px;padding:9px 0;border-bottom:1px solid var(--linha);align-items:center}
.fx:last-child{border-bottom:0}
.fx b{font-size:13.5px;font-weight:600}
.fx small{font-size:11.5px;color:var(--tinta-3)}
.fx .valor{font-family:var(--fonte-num);font-variant-numeric:tabular-nums;text-align:right;font-size:13.5px}
.fx .btn{padding:5px 10px;font-size:12px;margin-top:4px}
.selo-sit{font-size:11px;font-weight:700;padding:2px 7px;border-radius:5px;margin-left:6px;white-space:nowrap}
.selo-sit[data-s="pago"]{background:var(--bom-suave);color:var(--bom)}
.selo-sit[data-s="a-pagar"]{background:var(--marca-suave);color:var(--marca-tinta)}
.selo-sit[data-s="atrasado"]{background:var(--grave-suave);color:var(--grave)}
.aviso{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:12px 14px;border-radius:12px;background:var(--alerta-suave);color:var(--alerta);font-size:13.5px;font-weight:600}
.aviso[data-t="grave"]{background:var(--grave-suave);color:var(--grave)}
```

- [ ] **Step 2: Imports e utilidades em `js/painel.js`**

```js
import { ATE_PADRAO, ultimoMes, parcelaNoMes, ocorrencias, resumoDoMes, mesesDaFaixa,
         pendentesAnteriores, descricaoPagamento, pagar, casarComFixa } from "./fixas.js";
```
Acrescentar `somarDias, somarMeses` ao import de `./base.js`.

Junto das utilidades:
```js
const abrevMes = p => MESES[+p.slice(5) - 1].slice(0, 3) + "/" + p.slice(0, 4);
const ICONE_EDITAR = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const ICONE_APAGAR = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>`;
```
Em `itemHTML`, trocar os dois `<svg ...>...</svg>` por `${ICONE_EDITAR}` e `${ICONE_APAGAR}`.

- [ ] **Step 3: A aba**

Depois de `itemHTML`:
```js
/* ========================= ABA: FIXAS E PARCELAS ========================= */
const ROT_SIT = { "pago": "pago", "a-pagar": "a pagar", "atrasado": "atrasado" };

function abaFixas(){
  const hj = hoje();
  const botao = `<button class="btn btn-forte" type="button" data-acao="nova-fixa">+ Nova fixa ou parcela</button>`;
  if (!estado.fixas.length) return `
    <section class="cartao"><div class="vazio">
      <h3>Nenhuma conta fixa ou parcela ainda</h3>
      <p>Cadastre uma vez o aluguel, a internet ou aquela compra em 10x. O painel mostra quanto já está comprometido em cada mês até dezembro de 2027 e avisa perto do vencimento.</p>
      <div style="margin-top:18px">${botao}</div>
    </div></section>`;

  const meses = mesesDaFaixa(hj);
  const porMes = meses.map(m => {
    const ocs = ocorrencias(estado.fixas, estado.lancamentos, m, hj);
    return { m, ocs, r: resumoDoMes(ocs) };
  });
  const maior = Math.max(...porMes.map(x => x.r.total), 0);
  const faixa = blocoColunas(
    "Comprometido por mês",
    "de " + rotuloMes(meses[0]) + " a " + rotuloMes(meses[meses.length - 1]) + " · laranja = mês mais pesado",
    porMes.map(x => ({
      h: pct(x.r.total, maior || 1),
      rot: MESES[+x.m.slice(5) - 1].slice(0, 3),
      dica: rotuloMes(x.m) + ": " + brl(x.r.total),
      hoje: maior > 0 && x.r.total === maior,
    })),
    1
  );

  const pend = pendentesAnteriores(estado.fixas, estado.lancamentos, hj);
  const blocoPend = pend.length ? `
    <section class="cartao">
      <h2>Pendentes de meses anteriores <small>${pend.length} sem marcar como pago</small></h2>
      <div>${pend.map(fxHTML).join("")}</div>
    </section>` : "";

  const cartoes = porMes.map(({ m, ocs, r }) => `
    <section class="cartao mes">
      <h3>${rotuloMes(m)} <span>${brl(r.total)}</span></h3>
      <div class="pe-mes">${ocs.length ? `pago ${brl(r.pago)} · falta ${brl(r.aPagar)}` : "nada previsto"}</div>
      <div>${ocs.map(fxHTML).join("")}</div>
    </section>`).join("");

  return faixa + blocoPend + `<div class="meses">${cartoes}</div>` + blocoCadastradas(botao);
}

function fxHTML(o){
  const u = ultimoMes(o.fixa);
  const termina = u && u > ATE_PADRAO ? " · termina em " + abrevMes(u) : "";
  const acao = o.situacao === "pago"
    ? `<button class="btn btn-txt" type="button" data-acao="desfazer-fixa" data-fixa="${o.fixa.id}" data-mes="${o.mes}">Desfazer</button>`
    : `<button class="btn" type="button" data-acao="paguei" data-fixa="${o.fixa.id}" data-mes="${o.mes}">Paguei</button>`;
  return `
    <div class="fx">
      <div>
        <b>${esc(descricaoPagamento(o))}</b><span class="selo-sit" data-s="${o.situacao}">${ROT_SIT[o.situacao]}</span><br>
        <small>${esc(o.fixa.categoria)} · vence ${rotuloData(o.vencimento)}${termina}</small>
      </div>
      <div style="text-align:right"><div class="valor">${brl(o.valor)}</div>${acao}</div>
    </div>`;
}

function resumoFixa(f){
  const atual = mesDe(hoje()), u = ultimoMes(f);
  if (f.tipo === "parcelado"){
    const k = parcelaNoMes(f, atual);
    const agora = k ? ` · ${k}ª em ${abrevMes(atual)}` : atual < f.inicio ? ` · começa em ${abrevMes(f.inicio)}` : " · já terminou";
    return `${f.parcelas}x de ${brl(f.valor)}${agora} · última em ${abrevMes(u)} · dia ${f.dia}`;
  }
  return `todo mês desde ${abrevMes(f.inicio)}${u ? " até " + abrevMes(u) : ""} · dia ${f.dia}`;
}

function blocoCadastradas(botao){
  const ls = estado.fixas.slice().sort((a, b) => a.nome.localeCompare(b.nome));
  return `
    <section class="cartao">
      <h2>Suas fixas e parcelas <small>${ls.length} cadastrada${ls.length === 1 ? "" : "s"}</small></h2>
      <div class="lista">${ls.map(f => `
        <div class="item">
          <i class="pastilha" style="--c:${corDe(f.categoria)}"></i>
          <div class="item-txt"><b>${esc(f.nome)}</b><small>${esc(resumoFixa(f))}</small></div>
          <span class="valor">${brl(f.valor)}</span>
          <span class="acoes">
            <button class="icone" type="button" data-acao="editar-fixa" data-id="${f.id}" aria-label="Editar ${esc(f.nome)}">${ICONE_EDITAR}</button>
            <button class="icone perigo" type="button" data-acao="apagar-fixa" data-id="${f.id}" aria-label="Apagar ${esc(f.nome)}">${ICONE_APAGAR}</button>
          </span>
        </div>`).join("")}</div>
      <div style="margin-top:14px">${botao}</div>
    </section>`;
}
```

Em `ABAS`, depois de `lancamentos`:
```js
{ id:"fixas",       rot:"Fixas e parcelas", fn:abaFixas },
```

- [ ] **Step 4: Formulário**

Depois de `abrirForm`:
```js
function dicaFixa(d){
  if (!(d.valor > 0) || !/^\d{4}-\d{2}$/.test(d.inicio || "")) return "";
  if (d.tipo === "parcelado"){
    if (!(d.parcelas >= 2)) return "";
    const f = { tipo: "parcelado", inicio: d.inicio, parcelas: Math.floor(d.parcelas) };
    const atual = mesDe(hoje()), k = parcelaNoMes(f, atual);
    return `${f.parcelas}x de ${brl(d.valor)}${k ? ` · ${k}ª em ${abrevMes(atual)}` : ""} · última em ${abrevMes(ultimoMes(f))} · total ${brl(d.valor * f.parcelas)}`;
  }
  return `${brl(d.valor)} todo mês a partir de ${abrevMes(d.inicio)}${d.fim ? " até " + abrevMes(d.fim) : ""}`;
}

function abrirFormFixa(id, pre = {}){
  const f = id ? estado.fixas.find(x => x.id === id) : null;
  const v = { tipo: "mensal", nome: "", valor: "", categoria: "Contas fixas", dia: 10, inicio: mesDe(hoje()), fim: "", parcelas: "", ...(f || {}), ...pre };
  const opcoes = estado.categorias.map(c => `<option value="${esc(c)}"${v.categoria === c ? " selected" : ""}>${esc(c)}</option>`).join("");
  const parc = v.tipo === "parcelado";

  $("#modal").innerHTML = `
    <div class="veu" data-acao="fechar">
      <form class="folha" id="form-fixa" novalidate>
        <h2>${f ? "Editar fixa ou parcela" : "Nova fixa ou parcela"}</h2>
        <div class="seletor-tipo">
          <button type="button" data-tipo-fixa="mensal" aria-pressed="${!parc}">Todo mês</button>
          <button type="button" data-tipo-fixa="parcelado" aria-pressed="${parc}">Parcelado</button>
        </div>
        <input type="hidden" name="tipo" value="${v.tipo}">
        <div class="campo">
          <label for="x-nome">Nome</label>
          <input id="x-nome" name="nome" type="text" maxlength="40" required placeholder="Ex.: Aluguel, Celular" value="${esc(v.nome)}">
        </div>
        <div class="duo">
          <div class="campo">
            <label for="x-valor" id="rot-valor">${parc ? "Valor de cada parcela" : "Valor por mês"}</label>
            <input id="x-valor" name="valor" type="number" step="0.01" min="0" inputmode="decimal" required value="${v.valor}">
          </div>
          <div class="campo">
            <label for="x-dia">Dia do vencimento</label>
            <input id="x-dia" name="dia" type="number" min="1" max="31" inputmode="numeric" required value="${v.dia}">
          </div>
        </div>
        <div class="campo">
          <label for="x-cat">Categoria</label>
          <select id="x-cat" name="categoria">${opcoes}</select>
        </div>
        <div class="duo">
          <div class="campo">
            <label for="x-inicio" id="rot-inicio">${parc ? "Mês da 1ª parcela" : "Começa em"}</label>
            <input id="x-inicio" name="inicio" type="month" required value="${v.inicio}">
          </div>
          <div class="campo" data-so="mensal" ${parc ? "hidden" : ""}>
            <label for="x-fim">Termina em (opcional)</label>
            <input id="x-fim" name="fim" type="month" value="${v.fim || ""}">
          </div>
          <div class="campo" data-so="parcelado" ${parc ? "" : "hidden"}>
            <label for="x-parc">Quantas parcelas</label>
            <input id="x-parc" name="parcelas" type="number" min="2" max="120" inputmode="numeric" value="${v.parcelas || ""}">
          </div>
        </div>
        <p class="sub" id="x-dica" style="margin:4px 0 0"></p>
        <div class="folha-pe">
          <button type="button" class="btn" data-acao="fechar">Cancelar</button>
          <button type="submit" class="btn btn-forte">${f ? "Salvar" : "Cadastrar"}</button>
        </div>
      </form>
    </div>`;

  const form = $("#form-fixa");
  const lerForm = () => {
    const d = Object.fromEntries(new FormData(form));
    return { ...d, valor: Number(String(d.valor).replace(",", ".")), dia: Number(d.dia), parcelas: Number(d.parcelas) };
  };
  const dica = () => { $("#x-dica").textContent = dicaFixa(lerForm()); };

  form.addEventListener("click", ev => {
    const b = ev.target.closest("[data-tipo-fixa]");
    if (!b) return;
    const t = b.dataset.tipoFixa;
    form.tipo.value = t;
    form.querySelectorAll("[data-tipo-fixa]").forEach(x => x.setAttribute("aria-pressed", x.dataset.tipoFixa === t));
    form.querySelectorAll("[data-so]").forEach(x => { x.hidden = x.dataset.so !== t; });
    $("#rot-valor").textContent = t === "parcelado" ? "Valor de cada parcela" : "Valor por mês";
    $("#rot-inicio").textContent = t === "parcelado" ? "Mês da 1ª parcela" : "Começa em";
    dica();
  });
  form.addEventListener("input", dica);
  dica();
  setTimeout(() => $("#x-nome").focus(), 40);

  form.addEventListener("submit", ev => {
    ev.preventDefault();
    const d = lerForm();
    if (!String(d.nome).trim()) return torrada("Dê um nome.");
    if (!(d.valor > 0)) return torrada("Coloque um valor maior que zero.");
    if (!(d.dia >= 1 && d.dia <= 31)) return torrada("O dia vai de 1 a 31.");
    if (!/^\d{4}-\d{2}$/.test(d.inicio)) return torrada("Escolha o mês de início.");
    if (d.tipo === "parcelado" && !(d.parcelas >= 2 && d.parcelas <= 120)) return torrada("Parcelas: de 2 a 120.");
    if (d.tipo === "mensal" && d.fim && d.fim < d.inicio) return torrada("O fim não pode ser antes do início.");

    const reg = { nome: String(d.nome).trim(), valor: Math.round(d.valor * 100) / 100, categoria: d.categoria,
                  dia: Math.floor(d.dia), tipo: d.tipo, inicio: d.inicio, editadoEm: Date.now() };
    if (d.tipo === "mensal"){ if (d.fim) reg.fim = d.fim; }
    else reg.parcelas = Math.floor(d.parcelas);

    if (f){
      const i = estado.fixas.findIndex(x => x.id === f.id);
      estado.fixas[i] = { id: f.id, ...reg };
    } else estado.fixas.push({ id: uid(), ...reg });
    fecharModal();
    ui.aba = "fixas";
    mudou();
    torrada(f ? "Atualizado." : "Cadastrado. Já aparece nos meses.");
  });
}
```

- [ ] **Step 5: Ações no `switch` do clique**

```js
case "nova-fixa":   abrirFormFixa(null); break;
case "editar-fixa": abrirFormFixa(alvo.dataset.id); break;
case "apagar-fixa": {
  const f = estado.fixas.find(x => x.id === alvo.dataset.id);
  if (!f) break;
  confirmar("Apagar esta fixa?", `<b>${esc(f.nome)}</b> some dos meses ainda não pagos. O que você já marcou como pago continua nos lançamentos.`, () => {
    estado.fixas = estado.fixas.filter(x => x.id !== f.id);
    estado.apagados[f.id] = Date.now();
    mudou(); torrada("Apagada.");
  });
  break;
}
case "paguei": {
  const l = pagar(estado, alvo.dataset.fixa, alvo.dataset.mes, hoje(), uid(), Date.now());
  if (!l) break;
  estado.lancamentos.push(l);
  mudou(); torrada(esc(l.descricao) + " marcado como pago.");
  break;
}
case "desfazer-fixa": {
  const l = estado.lancamentos.find(x => x.fixaId === alvo.dataset.fixa && x.fixaMes === alvo.dataset.mes);
  if (!l) break;
  estado.lancamentos = estado.lancamentos.filter(x => x.id !== l.id);
  estado.apagados[l.id] = Date.now();
  mudou(); torrada("Pronto, voltou pra a pagar.");
  break;
}
```

- [ ] **Step 6: Conferir no navegador**

Na prévia: aba "Fixas e parcelas" vazia mostra o convite. Cadastrar "Celular", parcelado, R$ 150, dia 10, 1ª em set/2026, 10 parcelas → a dica mostra "10x de R$ 150,00 · 3ª em nov/2026 · última em jun/2027 · total R$ 1.500,00". Cadastrar "Aluguel", mensal, R$ 900, dia 31.
Expected: 14 cartões (nov/2026 a dez/2027); novembro com Celular (3/10) e Aluguel (vence 30 de novembro); fevereiro/2027 com aluguel no dia 28; "Pendentes de meses anteriores" com set e out do celular; barra mais alta destacada. "Paguei" no Celular de novembro → selo "pago" e aparece em Lançamentos como "Celular (3/10)"; "Desfazer" → some. Clique duplo rápido em "Paguei" cria só um lançamento. Editar o valor do aluguel muda só meses não pagos. Console sem erros. Testar também na largura de celular (`resize_window` preset `mobile`) e voltar com `desktop`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: aba Fixas e parcelas com Paguei e Desfazer"
```

---

### Tarefa 8: Aviso de vencimento e "A pagar" na Visão geral

**Files:**
- Modify: `js/painel.js` (`abaVisao`, nova `avisoFixas`)

**Interfaces:**
- Consumes: `ocorrencias`, `resumoDoMes`, `pendentesAnteriores` (fixas.js); `somarDias`, `somarMeses` (base.js)

- [ ] **Step 1: `avisoFixas()`** (antes de `abaVisao`)

```js
function avisoFixas(){
  if (!estado.fixas.length) return "";
  const hj = hoje(), limite = somarDias(hj, 5);
  const atual = mesDe(hj);
  const ocs = [
    ...ocorrencias(estado.fixas, estado.lancamentos, atual, hj),
    ...ocorrencias(estado.fixas, estado.lancamentos, somarMeses(atual, 1), hj),
  ];
  const vencendo = ocs.filter(o => o.situacao === "a-pagar" && o.vencimento <= limite);
  const atrasadas = [...pendentesAnteriores(estado.fixas, estado.lancamentos, hj), ...ocs.filter(o => o.situacao === "atrasado")];
  if (!vencendo.length && !atrasadas.length) return "";
  const partes = [];
  if (atrasadas.length) partes.push(`${atrasadas.length} atrasada${atrasadas.length === 1 ? "" : "s"} (${brl(somar(atrasadas))})`);
  if (vencendo.length) partes.push(`${vencendo.length} conta${vencendo.length === 1 ? " vence" : "s vencem"} nos próximos 5 dias (${brl(somar(vencendo))})`);
  return `<div class="aviso" data-t="${atrasadas.length ? "grave" : ""}" role="status">
    <span>${partes.join(" · ")}</span>
    <button class="btn btn-txt" type="button" data-acao="ir" data-aba="fixas" style="margin-left:auto">Ver fixas</button>
  </div>`;
}
```

- [ ] **Step 2: Ligar em `abaVisao`**

1. Logo depois de `const cats = porCategoria(gastos);`:
```js
const aviso = avisoFixas();
const prev = ui.periodo !== "tudo" && estado.fixas.length
  ? resumoDoMes(ocorrencias(estado.fixas, estado.lancamentos, ui.periodo, hoje())) : null;
```
2. O retorno do mês vazio vira `return aviso + vazio(...)` (mesmos textos).
3. Dentro de `<section class="kpis">`, depois do cartão "Guardado":
```js
${prev && prev.aPagar ? `
  <div class="kpi" style="--faixa:var(--alerta)">
    <div class="rot">A pagar</div><div class="val">${brl(prev.aPagar)}</div>
    <div class="pe">fixas e parcelas do mês${prev.atrasado ? " · " + brl(prev.atrasado) + " atrasado" : ""}</div>
  </div>` : ""}
```
4. Último `return` vira `return aviso + kpis + ...` (resto igual).

- [ ] **Step 3: Conferir no navegador**

Com as fixas da Tarefa 7 e o celular de novembro **não** pago: Visão geral de novembro mostra o aviso vermelho com atrasadas (set/out) e o cartão "A pagar". Mudar o período para dezembro/2026: "A pagar" de dezembro. Pagar tudo → aviso some. Período "Todos os meses" → sem cartão "A pagar".

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: aviso de vencimento e total a pagar na Visão geral"
```

---

### Tarefa 9: Leitor da linha rápida (puro, testado)

**Files:**
- Create: `js/rapido.js`, `testes/rapido.test.js`

**Interfaces:**
- Consumes: `normalizar`, `RE_ENTRADA`, `diasNoMes`, `somarDias` (base.js)
- Produces: `lerLinha(texto, hoje, classificar): null | { tipo:"gasto"|"entrada", valor:number, data:"AAAA-MM-DD", descricao:string, categoria:string, origem:string, parcelas:number|null }` com `classificar(desc) => { categoria, origem }`. `valor` é o total digitado (com parcelas, a divisão fica para a interface).

- [ ] **Step 1: Testes (falham)**

`testes/rapido.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { lerLinha } from "../js/rapido.js";

const H = "2026-11-05";
const cls = d => /uber/i.test(d) ? { categoria:"Transporte", origem:"reconheci “uber”" }
             : /ifood/i.test(d) ? { categoria:"Comida/Fast Food", origem:"reconheci “ifood”" }
             : { categoria:"", origem:"" };
const ler = t => lerLinha(t, H, cls);

test("uber 15", () => {
  assert.deepEqual(ler("uber 15"), { tipo:"gasto", valor:15, data:H, descricao:"uber", categoria:"Transporte", origem:"reconheci “uber”", parcelas:null });
});
test("vírgula e ontem", () => {
  const r = ler("ifood 42,90 ontem");
  assert.equal(r.valor, 42.9); assert.equal(r.data, "2026-11-04"); assert.equal(r.descricao, "ifood"); assert.equal(r.categoria, "Comida/Fast Food");
});
test("anteontem no começo", () => {
  const r = ler("anteontem padaria 8");
  assert.equal(r.data, "2026-11-03"); assert.equal(r.descricao, "padaria"); assert.equal(r.valor, 8);
});
test("dia N do mês e limite do mês", () => {
  assert.equal(ler("farmácia 30 dia 3").data, "2026-11-03");
  assert.equal(ler("farmácia 30 dia 3").descricao, "farmácia");
  assert.equal(ler("luz 90 dia 31").data, "2026-11-30");
});
test("data dd/mm e dd/mm/aaaa não viram valor", () => {
  const r = ler("mercado 120 2/11");
  assert.equal(r.valor, 120); assert.equal(r.data, "2026-11-02"); assert.equal(r.descricao, "mercado");
  assert.equal(ler("pizza 50 3/1").data, "2026-01-03");
  assert.equal(ler("pizza 50 03/01/2027").data, "2027-01-03");
});
test("milhar", () => {
  assert.equal(ler("aluguel 1.495,54").valor, 1495.54);
  assert.equal(ler("tv 1.500").valor, 1500);
  assert.equal(ler("tv 42.90").valor, 42.9);
});
test("número colado em palavra não é valor", () => {
  const r = ler("99app 20");
  assert.equal(r.valor, 20); assert.equal(r.descricao, "99app");
});
test("entradas", () => {
  const a = ler("+1500 freela");
  assert.equal(a.tipo, "entrada"); assert.equal(a.valor, 1500); assert.equal(a.descricao, "freela"); assert.equal(a.categoria, "");
  assert.equal(ler("salário 1500").tipo, "entrada");
});
test("parcelado", () => {
  const r = ler("celular 1500 em 10x");
  assert.equal(r.parcelas, 10); assert.equal(r.valor, 1500); assert.equal(r.descricao, "celular");
  assert.equal(ler("tênis 300 3x").parcelas, 3);
});
test("sem valor ou vazio → null", () => {
  assert.equal(ler("uber"), null);
  assert.equal(ler("   "), null);
  assert.equal(ler("uber 0"), null);
});
test("descrição vazia ganha nome padrão", () => {
  assert.equal(ler("15").descricao, "Gasto");
  assert.equal(ler("+15").descricao, "Entrada");
});
```

Run: `npm test` → Expected: FAIL

- [ ] **Step 2: Implementar `js/rapido.js`**

```js
import { normalizar, RE_ENTRADA, diasNoMes, somarDias } from "./base.js";

const RE_ENTRADA_RAPIDO = new RegExp(RE_ENTRADA.source + "|freela|recebi");
const RE_VALOR = /(?:r\$\s*)?(?<![\p{L}\d.,\/])(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\p{L}\d\/])/giu;
const pad = n => String(n).padStart(2, "0");

function lerNumero(s){
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  return Number(s);
}

/* "ifood 42,90 ontem" → { tipo, valor, data, descricao, categoria, origem, parcelas } */
export function lerLinha(texto, hoje, classificar){
  let t = " " + String(texto || "").trim() + " ";
  if (!t.trim()) return null;

  let entrada = false;
  if (/^\s*\+/.test(t)){ entrada = true; t = t.replace(/^\s*\+/, " "); }

  let parcelas = null;
  t = t.replace(/\s(?:em\s+)?(\d{1,3})\s*x(?=\s)/i, (_, n) => { parcelas = +n; return " "; });

  const [a, m] = hoje.split("-").map(Number);
  let data = hoje, achou = false;
  t = t.replace(/\s(anteontem|ontem|hoje)(?=\s)/i, (_, w) => {
    achou = true; const x = w.toLowerCase();
    data = x === "hoje" ? hoje : somarDias(hoje, x === "ontem" ? -1 : -2);
    return " ";
  });
  if (!achou) t = t.replace(/\sdia\s+(\d{1,2})(?=\s)/i, (_, d) => {
    achou = true;
    data = `${a}-${pad(m)}-${pad(Math.min(Math.max(+d, 1), diasNoMes(a, m)))}`;
    return " ";
  });
  if (!achou) t = t.replace(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/, (tudo, d, mm, aa) => {
    const ano = aa ? (aa.length === 2 ? 2000 + +aa : +aa) : a;
    if (+mm < 1 || +mm > 12 || +d < 1 || +d > diasNoMes(ano, +mm)) return tudo;
    data = `${ano}-${pad(mm)}-${pad(d)}`;
    return " ";
  });

  const achados = [...t.matchAll(RE_VALOR)];
  if (!achados.length) return null;
  const ult = achados[achados.length - 1];
  const valor = Math.round(lerNumero(ult[1]) * 100) / 100;
  if (!(valor > 0)) return null;
  t = t.slice(0, ult.index) + " " + t.slice(ult.index + ult[0].length);

  let descricao = t.replace(/\s+/g, " ").trim()
    .replace(/^(de|em|no|na)\s+/i, "").replace(/\s+(de|em|no|na)$/i, "");
  const tipo = entrada || RE_ENTRADA_RAPIDO.test(normalizar(descricao)) ? "entrada" : "gasto";
  if (!descricao) descricao = tipo === "entrada" ? "Entrada" : "Gasto";
  const { categoria, origem } = tipo === "gasto" ? classificar(descricao) : { categoria: "", origem: "" };
  return { tipo, valor, data, descricao, categoria, origem, parcelas };
}
```

Run: `npm test` → Expected: PASS. Se `99app 20` falhar, conferir o lookbehind `(?<![\p{L}\d.,\/])` com a flag `u`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: leitor da linha de lançamento rápido"
```

---

### Tarefa 10: Campo "Lançar rápido" na interface

**Files:**
- Modify: `index.html` (marcação + CSS), `js/painel.js`

**Interfaces:**
- Consumes: `lerLinha` (rapido.js); `classificar`, `chaveComerciante` (painel.js); `abrirFormFixa(id, pre)` (Tarefa 7)

- [ ] **Step 1: Marcação** (em `index.html`, dentro de `<header class="topo">`, entre `</div>` da `.topo-linha` e o `<nav class="abas"...>`)

```html
<form class="rapido" id="rapido" autocomplete="off">
  <input id="rapido-txt" type="text" enterkeyhint="done" placeholder="Lançar rápido… ex.: uber 15 · ifood 42,90 ontem" aria-label="Lançar rápido" aria-describedby="rapido-previa">
</form>
<div class="rapido-previa" id="rapido-previa" aria-live="polite"></div>
```

- [ ] **Step 2: CSS** (antes de `.oculto{...}`)

```css
.rapido{display:flex;gap:8px;margin-top:12px}
.rapido input{flex:1;min-width:0;padding:10px 12px;border-radius:10px;border:1px solid var(--linha-forte);background:var(--superficie);font:inherit;font-size:14.5px;color:var(--tinta)}
.rapido input:focus{outline:0;border-color:var(--marca)}
.rapido-previa{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:7px;font-size:12.5px;color:var(--tinta-2)}
.rapido-previa:empty{display:none}
.chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;background:var(--superficie-2);border:1px solid var(--linha);font:inherit;font-weight:600;color:var(--tinta)}
.chip.mais{color:var(--bom)}
button.chip{cursor:pointer}
.rapido-previa select{padding:3px 8px;border-radius:999px;border:1px solid var(--linha-forte);background:var(--superficie);font:inherit;font-size:12.5px}
.rapido-previa select[data-vazio="1"]{border-color:var(--grave);color:var(--grave);font-weight:600}
.rapido-previa .falta{color:var(--grave);font-weight:600}
```

- [ ] **Step 3: Lógica em `js/painel.js`**

`import { lerLinha } from "./rapido.js";`

Antes de `iniciar()`:
```js
/* ============================ LANÇAR RÁPIDO ============================= */
let rascunho = null, rapidoCat = null, rapidoTipo = null;

function lerRapido(){
  const t = $("#rapido-txt").value;
  rascunho = t.trim() ? lerLinha(t, hoje(), classificar) : null;
  if (rascunho && rapidoTipo){
    rascunho.tipo = rapidoTipo;
    if (rapidoTipo === "entrada"){ rascunho.categoria = ""; rascunho.origem = ""; }
    else if (!rascunho.categoria) Object.assign(rascunho, classificar(rascunho.descricao));
  }
  if (rascunho && rascunho.tipo === "gasto" && rapidoCat !== null){ rascunho.categoria = rapidoCat; rascunho.origem = "você escolheu"; }
  pintarRapido(!!t.trim());
}

function pintarRapido(temTexto){
  const p = $("#rapido-previa");
  if (!temTexto){ p.innerHTML = ""; return; }
  if (!rascunho){ p.innerHTML = `<span class="falta">faltou o valor</span>`; return; }
  const r = rascunho, mais = r.tipo === "entrada";
  if (r.parcelas){
    p.innerHTML = `<span class="chip">${r.parcelas}x de ${brl(r.valor / r.parcelas)}</span><span>Enter abre o cadastro do parcelado</span>`;
    return;
  }
  const opcoes = estado.categorias.map(c => `<option value="${esc(c)}"${r.categoria === c ? " selected" : ""}>${esc(c)}</option>`).join("");
  const quando = r.data === hoje() ? "hoje" : r.data === somarDias(hoje(), -1) ? "ontem" : rotuloData(r.data);
  p.innerHTML = `
    <button type="button" class="chip ${mais ? "mais" : ""}" data-acao="rapido-tipo" title="Trocar entre gasto e entrada">${mais ? "Entrada" : "Gasto"}</button>
    <span class="chip ${mais ? "mais" : ""}">${brl(r.valor)}</span>
    ${mais ? "" : `<select id="rapido-cat" data-vazio="${r.categoria ? 0 : 1}" aria-label="Categoria"><option value="">— escolher categoria —</option>${opcoes}</select>`}
    <span class="chip">${quando}</span>
    <span>${esc(r.descricao)}</span>`;
}

function limparRapido(){
  $("#rapido-txt").value = "";
  rascunho = null; rapidoCat = null; rapidoTipo = null;
  pintarRapido(false);
}

function salvarRapido(){
  lerRapido();
  const r = rascunho;
  if (!r) return torrada("Faltou o valor. Ex.: uber 15");
  if (r.parcelas){
    abrirFormFixa(null, { tipo: "parcelado", nome: r.descricao, valor: Math.round(r.valor / r.parcelas * 100) / 100,
                          parcelas: r.parcelas, inicio: mesDe(r.data), dia: +r.data.slice(8), categoria: r.categoria || "Outros" });
    limparRapido();
    return;
  }
  if (r.tipo === "gasto" && !r.categoria){ $("#rapido-cat")?.focus(); return torrada("Escolha a categoria antes de salvar."); }
  if (r.tipo === "gasto"){
    if (!estado.categorias.includes(r.categoria)) estado.categorias.push(r.categoria);
    if (rapidoCat){ const k = chaveComerciante(r.descricao); if (k) estado.regras[k] = r.categoria; }
  }
  estado.lancamentos.push({ id: uid(), tipo: r.tipo, data: r.data, categoria: r.tipo === "gasto" ? r.categoria : "",
                            descricao: r.descricao, valor: r.valor, editadoEm: Date.now() });
  if (ui.periodo !== "tudo" && mesDe(r.data) !== ui.periodo) ui.periodo = mesDe(r.data);
  limparRapido();
  mudou();
  torrada((r.tipo === "entrada" ? "Entrada de " : "Gasto de ") + brl(r.valor) + " registrado.");
}

function ligarRapido(){
  const inp = $("#rapido-txt");
  inp.addEventListener("input", () => { if (!inp.value.trim()){ rapidoCat = null; rapidoTipo = null; } lerRapido(); });
  $("#rapido-previa").addEventListener("change", ev => {
    if (ev.target.id !== "rapido-cat") return;
    rapidoCat = ev.target.value || null;
    lerRapido();
    inp.focus();
  });
  $("#rapido").addEventListener("submit", ev => { ev.preventDefault(); salvarRapido(); });
}
```

No `switch` do clique:
```js
case "rapido-tipo":
  rapidoTipo = rascunho?.tipo === "entrada" ? "gasto" : "entrada";
  lerRapido();
  break;
```

No `keydown`, antes do atalho `n`:
```js
if (ev.key === "/" && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName) && !$("#modal").children.length){
  ev.preventDefault(); $("#rapido-txt").focus(); return;
}
```

Em `iniciar()`, depois de `ligarEntrar();`: `ligarRapido();`

- [ ] **Step 4: Conferir no navegador**

Na prévia:
1. `/` foca o campo. `uber 15` → resumo "Gasto · R$ 15,00 · Transporte · hoje · uber"; Enter → torrada e o gasto aparece em Lançamentos.
2. `açaí da esquina 18` → categoria vermelha "— escolher —"; Enter → torrada pedindo categoria. Escolher "Comida/Fast Food" e Enter → salva. Digitar `açaí da esquina 20` → já vem "Comida/Fast Food" (aprendeu).
3. `+1500 freela` → "Entrada", sem categoria; tocar no chip troca para Gasto.
4. `celular 1500 em 10x` + Enter → abre "Nova fixa ou parcela" com parcelado, 10 parcelas, R$ 150,00, nome "celular".
5. `uber` → "faltou o valor".
6. Largura de celular: o campo cabe e o resumo quebra linha sem estourar.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: campo Lançar rápido no topo"
```

---

### Tarefa 11: Importação reconhece fixas

**Files:**
- Modify: `js/painel.js` (`montarLote`, `revHTML`, casos `virar` e `importar`)

**Interfaces:**
- Consumes: `ocorrencias`, `casarComFixa`, `descricaoPagamento` (fixas.js); `chaveComerciante`, `classificar` (painel.js)

- [ ] **Step 1: `montarLote`**

Substituir a função por:
```js
function montarLote(brutos){
  /* se o arquivo usa sinal negativo pra débito, positivo = entrada */
  const temNegativo = brutos.some(b => b.valor < 0);
  const hj = hoje(), ocsPorMes = new Map(), usadas = new Set();
  const lote = [];
  for (const b of brutos){
    const n = normalizar(b.descricao);
    if (IGNORAR.some(p => n.includes(p))) continue;
    const tipo = b.valor < 0 ? "gasto"
               : (temNegativo || RE_ENTRADA.test(n)) ? "entrada" : "gasto";
    const valor = Math.round(Math.abs(b.valor) * 100) / 100;

    let fixa = null;
    if (tipo === "gasto" && estado.fixas.length){
      const mes = mesDe(b.data);
      if (!ocsPorMes.has(mes)) ocsPorMes.set(mes, ocorrencias(estado.fixas, estado.lancamentos, mes, hj));
      const livres = ocsPorMes.get(mes).filter(o => !usadas.has(o.fixa.id + "|" + mes));
      const o = casarComFixa({ descricao: b.descricao, valor }, livres, chaveComerciante);
      if (o){
        usadas.add(o.fixa.id + "|" + mes);
        fixa = { fixaId: o.fixa.id, fixaMes: mes, rotulo: descricaoPagamento(o), categoria: o.fixa.categoria };
      }
    }

    const { categoria, origem } = fixa ? { categoria: fixa.categoria, origem: "é " + fixa.rotulo }
      : tipo === "gasto" ? classificar(b.descricao) : { categoria: "", origem: "" };
    const repetido = estado.lancamentos.some(l =>
      l.data === b.data && Math.abs(l.valor - valor) < 0.005 &&
      (normalizar(l.descricao) === n || (chaveComerciante(l.descricao) && chaveComerciante(l.descricao) === chaveComerciante(b.descricao))));
    lote.push({ data: b.data, descricao: b.descricao, valor, tipo, categoria, origem, repetido, incluir: !repetido, fixa });
  }
  return lote.sort((a, b) => a.data.localeCompare(b.data));
}
```

- [ ] **Step 2: Caso `virar`**

Logo depois de `r.tipo = r.tipo === "gasto" ? "entrada" : "gasto";` acrescentar:
```js
if (r.tipo === "entrada" && r.fixa){ r.fixa = null; r.categoria = ""; r.origem = ""; }
```

- [ ] **Step 3: Caso `importar`**

Trocar o `estado.lancamentos.push({...})` do laço por:
```js
const ehFixa = r.tipo === "gasto" && r.fixa &&
  !estado.lancamentos.some(l => l.fixaId === r.fixa.fixaId && l.fixaMes === r.fixa.fixaMes);
estado.lancamentos.push({
  id: uid(), tipo: r.tipo, data: r.data,
  categoria: r.tipo === "gasto" ? r.categoria : "",
  descricao: ehFixa ? r.fixa.rotulo : r.descricao,
  valor: r.valor, editadoEm: Date.now(),
  ...(ehFixa ? { fixaId: r.fixa.fixaId, fixaMes: r.fixa.fixaMes } : {}),
});
```

- [ ] **Step 4: Conferir no navegador**

Com o Celular (parcelado, R$ 150, 1ª em set/2026, 10x) cadastrado e novembro não pago, colar na aba Importar:
```
10/11/2026   LOJA CEL PARCELA 03/10   -150,00
12/11/2026   UBER *TRIP                -6,50
```
Expected: a primeira linha mostra "é Celular (3/10)" com a categoria da fixa; Importar → em Fixas, novembro do Celular fica "pago"; em Lançamentos aparece "Celular (3/10)". Importar o mesmo texto de novo → a linha vem marcada "já existe no painel" e não casa com a fixa (já paga).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: importação de extrato reconhece parcelas e contas fixas"
```

---

### Tarefa 12: Verificação final, prévia e publicação

**Files:** nenhum novo (só publicação)

- [ ] **Step 1: Testes e varredura**

Run: `npm test` → Expected: todos PASS.
Run: `grep -rnE "TODO|TBD|<valor" js/ index.html` → nada.
Na prévia local: percorrer todas as abas em desktop e `mobile`, console sem erros (`read_console_messages` com `onlyErrors: true`).

- [ ] **Step 2: Revisão do ramo inteiro**

Rodar uma revisão do diff `main...feat/nuvem-fixas-lancar-rapido` (skill `superpowers:requesting-code-review`) e corrigir o que for confirmado. Commit das correções.

- [ ] **Step 3: Deploy de prévia**

Preferido: Vercel CLI. Se não houver login, pedir ao Rafael para rodar uma vez no terminal: `npx vercel@latest login`. Depois, na pasta do projeto:
```bash
npx vercel@latest link --yes --project painel-do-meu-dinheiro --scope rafaangelaos-projects
npx vercel@latest deploy --yes
```
(O `.vercelignore` deixa de fora docs, testes, ferramentas e package.json.)
Alternativa sem CLI: `create_deployment` do MCP da Vercel com `files` inline (`index.html`, `vercel.json`, `js/*.js`, encoding `utf-8`), `name`/`project: "painel-do-meu-dinheiro"`, `projectSettings: { framework: null }`, sem `target` (vira prévia).

Conferir com `get_deployment` → `READY`. Abrir a URL e checar se `/js/painel.js` carrega (200).

- [ ] **Step 4: Rafael testa a prévia**

Passar o link. Lembrar: a prévia tem proteção da Vercel (ele entra com a conta da Vercel) e começa **sem** os dados dele (outro endereço). Pedir que ele:
1. faça login com o e-mail (código chega pelo modelo da Tarefa 4);
2. cadastre uma fixa e um lançamento rápido;
3. abra a mesma prévia no outro aparelho, faça login e veja os mesmos dados;
4. diga "ok" para produção.
Depois do teste, os dados de teste ficam no caderno dele; avisar que dá para apagá-los pelo próprio painel.

- [ ] **Step 5: Produção (só com o "ok")**

```bash
npx vercel@latest deploy --prod --yes
```
(ou `create_deployment` com `target: "production"`). Conferir `https://painel-do-meu-dinheiro.vercel.app` carregando a versão nova.

- [ ] **Step 6: Migração dos dados reais**

Pedir ao Rafael: abrir `painel-do-meu-dinheiro.vercel.app` **no aparelho que tem os dados**, fazer login. O painel junta o que está no aparelho com o caderno (que já tem os dados de teste da prévia) e sobe tudo. Conferir com ele que os lançamentos antigos aparecem no outro aparelho.

- [ ] **Step 7: Fechar o cadastro**

Pedir ao Rafael: Supabase → Authentication → Sign In / Providers → desligar **Allow new users to sign up**.
Avisar: projeto gratuito do Supabase pausa depois de 7 dias sem uso; se isso acontecer, o painel continua funcionando no aparelho ("Sem conexão") e basta clicar em "Restore" no painel do Supabase.

- [ ] **Step 8: Commit final**

```bash
git add -A
git commit -m "chore: publicação da nuvem, fixas e lançar rápido"
```
