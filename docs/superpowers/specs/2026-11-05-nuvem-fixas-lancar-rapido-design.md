# Painel do Meu Dinheiro — nuvem, fixas e parcelas, lançar rápido

Data: 05/11/2026 · Status: aguardando revisão do Rafael

## 1. Objetivo

Deixar o painel menos manual e parar de depender de um único navegador.

O que o Rafael pediu:
- parar de lançar gasto por gasto no formulário;
- ideias de automação (escolheu: contas fixas automáticas, lançar numa linha só, mesmos dados no celular e no PC);
- uma aba com os meses de novembro/2026 a dezembro/2027 para colocar as parcelas fixas de cada mês.

Decisões tomadas na conversa:
- uso de uma pessoa só;
- login por código enviado por e-mail;
- dados num projeto Supabase novo, numa organização gratuita e pessoal (não na org "Mizuta", não no projeto apex);
- os dados reais de hoje estão em um único aparelho;
- a aba de fixas aceita os dois tipos: conta mensal sem fim e compra parcelada com fim;
- fixas aparecem como "a pagar" até ele marcar "Paguei";
- nuvem no formato "caderno por pessoa" (abordagem A).

Fica de fora (não pedido ou recusado): leitura de foto/print por IA, Open Finance, uso compartilhado com outra pessoa, tabelas normalizadas.

## 2. Situação atual (o que o código tem hoje)

- Site estático na Vercel (projeto `painel-do-meu-dinheiro`, sem Git ligado): `index.html` com ~1.800 linhas (HTML, CSS e JS juntos), `Painel-do-Meu-Dinheiro.html` (cópia idêntica) e `vercel.json` (`cleanUrls`, `trailingSlash: false`).
- Estado num objeto só (`estado`): `lancamentos`, `categorias`, `metas`, `regras` (comerciante → categoria aprendido), `atualizadoEm`. Guardado em `localStorage` (`painel-dinheiro:dados`).
- Havia sincronização via `artifact.publish` (só funciona dentro do Claude). Na Vercel nunca roda: os dados ficam presos ao navegador.
- Abas: Visão geral, Lançamentos, Importar (CSV/OFX/texto com classificação automática e aprendizado), Economizar, Metas.

## 3. Arquitetura

Continua um site estático, sem build. Separado em arquivos com uma responsabilidade cada:

| Arquivo | Responsabilidade | Depende de |
|---|---|---|
| `index.html` | layout, CSS, tela de login, `<script type="module" src="js/painel.js">` | — |
| `js/painel.js` | app atual (abas, formulários, importação) + abas e campos novos | todos abaixo |
| `js/fixas.js` | **funções puras**: parcela de um mês, ocorrências por mês, situação (a pagar / pago / atrasado), total comprometido | nada |
| `js/rapido.js` | **função pura** `lerLinha(texto, hoje, classificar)` → rascunho de lançamento | nada (classificar é injetado) |
| `js/juntar.js` | **função pura** `juntar(local, nuvem)` → estado unido | nada |
| `js/nuvem.js` | login (OTP por e-mail), ler/gravar o caderno, agenda de sincronização | supabase-js, `juntar.js` |
| `js/config.js` | URL do Supabase e chave publicável (pública por natureza; a proteção é a RLS) | — |
| `testes/*.test.js` | testes com `node --test` das três funções puras | — |
| `vercel.json` | igual a hoje + redirecionar `/Painel-do-Meu-Dinheiro` para `/` | — |

`supabase-js` vem por CDN com versão fixa (`https://esm.sh/@supabase/supabase-js@2.119.0`).
Sai: o código de `artifact.publish`, `FONTE`, `montarDocumento` e o bloco `<script id="dados-app">`.

## 4. Modelo de dados (estado v2)

```js
{
  v: 2,
  atualizadoEm: 1793928364470,
  lancamentos: [{ id, tipo:"gasto"|"entrada", data:"AAAA-MM-DD", categoria, descricao, valor,
                  editadoEm, fixaId?, fixaMes?:"AAAA-MM" }],
  fixas: [{ id, nome, valor, categoria, dia: 1..31,
            tipo: "mensal" | "parcelado",
            inicio: "AAAA-MM",          // mensal: 1º mês; parcelado: mês da 1ª parcela
            fim?: "AAAA-MM",            // só mensal, opcional
            parcelas?: n,               // só parcelado
            editadoEm }],
  apagados: { [id]: timestamp },        // marca de apagado, pra junção não ressuscitar item
  categorias: [...], metas: {...}, regras: {...}
}
```

Migração v1 → v2 ao carregar: `fixas = []`, `apagados = {}`, `editadoEm = atualizadoEm` em cada lançamento sem ele.

## 5. Nuvem e login

**Supabase**
- Projeto novo `painel-do-meu-dinheiro`, região `sa-east-1`, na organização gratuita do Rafael.
- Tabela:
  ```sql
  create table public.cadernos (
    user_id uuid primary key references auth.users on delete cascade,
    dados jsonb not null,
    atualizado_em timestamptz not null default now()
  );
  alter table public.cadernos enable row level security;
  -- select / insert / update somente onde auth.uid() = user_id (sem delete)
  ```
- Auth: OTP por e-mail. Passos do Rafael no painel do Supabase (guiados na hora):
  1. modelo de e-mail "Magic Link" passa a mostrar `{{ .Token }}`;
  2. Site URL = `https://painel-do-meu-dinheiro.vercel.app`;
  3. depois do 1º login, desligar "Allow new users to sign up".
- Limite do SMTP padrão do Supabase (poucos e-mails por hora) basta para uma pessoa.

**Fluxo de login**
- Sem sessão: tela "Entrar" com e-mail → `signInWithOtp` → campo de 6 dígitos → `verifyOtp`. A sessão fica guardada no aparelho (padrão do supabase-js).
- Botão "Sair" no menu do topo.
- Sem internet e sem sessão: o painel abre com a cópia local e mostra "Sem conexão — entrando quando voltar".

**Sincronização**
- Toda mudança grava no `localStorage` na hora (como hoje) e agenda envio em 3 s.
- Envio = ler a linha da nuvem → `juntar(local, nuvem)` → gravar com trava otimista (`update ... where atualizado_em = <lido>`). Se ninguém foi atualizado, outro aparelho gravou antes: repete (até 3 vezes).
- Primeira vez (sem linha na nuvem): `insert` com o estado local. É assim que os dados do aparelho atual sobem.
- Também sincroniza ao abrir o painel e quando a aba volta a ficar visível (`visibilitychange`).
- Indicador do topo: "Salvando…", "Tudo salvo", "Sem conexão — salvo neste aparelho".

**Regras de `juntar(local, nuvem)`**
- `lancamentos` e `fixas`: união por `id`. Se os dois lados têm o mesmo id, fica o de `editadoEm` maior.
- `apagados`: união; no empate de id, fica o maior timestamp. Item com `apagados[id] >= editadoEm` sai.
- `categorias`: união mantendo a ordem do local e acrescentando as novas da nuvem.
- `metas` e `regras`: união de chaves; na mesma chave, vale o lado com `atualizadoEm` maior.
- `atualizadoEm` = maior dos dois.
- Precisa ser idempotente: `juntar(a, juntar(a, b))` = `juntar(a, b)`.

## 6. Aba "Fixas e parcelas"

**Cadastro** (modal "+ Nova fixa ou parcela"): nome, valor, categoria, dia do vencimento, tipo.
- Mensal: mês de início (padrão: mês atual) e mês de fim opcional.
- Parcelado: número de parcelas e mês da 1ª parcela. Mostra na hora: "10x de R$ 150,00 · 3ª em nov/2026 · última em jun/2027".
- Editar: valor, nome, categoria e dia valem para meses ainda não pagos. Meses pagos ficam com o lançamento que já existe.
- Apagar fixa: some dos meses não pagos; lançamentos já pagos ficam.

**Cálculo** (`js/fixas.js`)
- Parcela de uma fixa parcelada no mês M = (meses entre `inicio` e M) + 1; vale se estiver entre 1 e `parcelas`.
- Mensal vale de `inicio` até `fim` (ou para sempre).
- Vencimento = dia `dia` do mês, limitado ao último dia (31 em fevereiro → 28/29).
- Situação no mês: **pago** se existe lançamento com `fixaId` e `fixaMes` do mês; senão **atrasado** se o vencimento já passou; senão **a pagar**.

**Tela**
- Faixa no topo: total comprometido em cada mês, do mês atual até dezembro/2027 (barras), com o maior destacado.
- Bloco "Pendentes de meses anteriores", só se houver atrasados antes do mês atual.
- Um cartão por mês: itens com nome, "3/10" quando parcelado, valor, dia e situação; total do mês e quanto já foi pago.
- Parcelamento que passa de dezembro/2027 mostra "termina em mmm/aaaa".

**Paguei / desfazer**
- "Paguei" cria lançamento `{tipo:"gasto", categoria, valor, data: vencimento (ou hoje, se já passou), descricao: "Celular (3/10)" ou "Aluguel", fixaId, fixaMes}`.
- "Desfazer" apaga esse lançamento (com marca em `apagados`).

**Ligação com outras abas**
- Visão geral do mês: linha "a pagar: R$ X" e aviso "N contas vencem nos próximos 5 dias / N atrasadas", com link para a aba.
- Importar: para cada linha de gasto, procura fixa não paga do mesmo mês com valor igual (diferença até R$ 0,50) e nome parecido (mesma `chaveComerciante`, ou descrição contendo o nome da fixa, ou padrão "k/n" igual à parcela). Se achar, a linha aparece como "é o Celular 3/10" e, ao importar, vira o lançamento pago da fixa em vez de um gasto solto.

## 7. Lançar rápido

Campo fixo no topo, em todas as abas ("Lançar rápido… ex.: uber 15"). A tecla `/` foca o campo.

`lerLinha(texto, hoje, classificar)` devolve `{ tipo, valor, data, descricao, categoria, origem, parcelas? }` ou `null`:
- **valor:** último número da linha (`15`, `42,90`, `1.495,54`, `42.90`). Sem número → `null`.
- **data:** `hoje` (padrão), `ontem`, `anteontem`, `dia 5` (deste mês), `5/11` ou `05/11/2026`.
- **entrada:** começa com `+` ou casa com as palavras de entrada já usadas na importação (`RE_ENTRADA` + `salario`/`salário`, `freela`).
- **parcelas:** `em 10x` ou `10x` → `parcelas: 10`. O painel sugere criar um parcelado com `valor / parcelas` a partir do mês da data.
- **descrição:** o texto sem valor, data e marcadores.
- **categoria:** `classificar(descricao)` (regras aprendidas → lançamentos parecidos → dicionário). Não achou → vazio.

Comportamento:
- Enquanto digita, aparece o resumo ("Gasto · R$ 15,00 · Transporte · hoje").
- Enter salva; a categoria vazia fica destacada e bloqueia o Enter até ser escolhida.
- Trocar a categoria no resumo grava em `regras` (mesmo aprendizado da importação).

## 8. Erros e casos de borda

- Falha de rede ao sincronizar: mantém local, mostra "Sem conexão — salvo neste aparelho", tenta de novo ao voltar a conexão (`online`) ou ao reabrir.
- Sessão expirada: supabase-js renova sozinho; se não der, volta a tela "Entrar" sem apagar a cópia local.
- Código errado ou vencido: mensagem e botão "mandar outro código".
- Dois aparelhos gravando juntos: trava otimista + `juntar` (seção 5).
- Fixa com dia 29–31: limita ao último dia do mês.
- Linha rápida sem valor: o resumo diz "faltou o valor" e não salva.

## 9. Testes

`node --test testes/` antes de cada função ser escrita (TDD):
- `fixas.test.js`: número da parcela por mês (antes, primeira, meio, última, depois); mensal com e sem fim; dia 31 em fevereiro e em ano bissexto; situação pago/atrasado/a pagar; total por mês.
- `rapido.test.js`: `uber 15`, `ifood 42,90 ontem`, `farmácia 30 dia 3`, `mercado 120 2/11`, `+1500 freela`, `salário 1500`, `celular 1500 em 10x`, `1.495,54`, linha sem número.
- `juntar.test.js`: novo dos dois lados; mesmo id com edição mais nova vencendo; apagado não volta; idempotência; categorias e regras.

No navegador (painel de prévia local): login aparece; modo sem conexão funciona com a cópia local; cadastrar fixa e parcelado; "Paguei"/"Desfazer"; aviso na Visão geral; linha rápida; importar extrato que contém "PARCELA 3/10". O login real com e-mail é feito pelo Rafael (Claude não cria conta nem entra em serviço externo).

## 10. Publicação

1. Rafael cria a organização gratuita no Supabase; Claude cria o projeto, a tabela e as regras e preenche `js/config.js`.
2. Rafael ajusta modelo de e-mail e Site URL (guiado).
3. Deploy de **prévia** na Vercel (link separado) para o Rafael testar o login no celular e no PC.
4. Com o "ok" dele, deploy de **produção** em `painel-do-meu-dinheiro.vercel.app`.
5. Rafael abre o endereço oficial **no aparelho que tem os dados** e faz login: os dados sobem. Depois faz login nos outros aparelhos.
6. Rafael desliga "Allow new users to sign up".

A prévia tem outro endereço, então começa sem os dados locais. Isso não afeta o endereço oficial.

## 11. Critérios de pronto

- Lançamento feito no celular aparece no PC depois de reabrir, e vice-versa.
- Dados do aparelho atual aparecem completos na nuvem após o 1º login.
- Aba Fixas mostra nov/2026 a dez/2027 com totais certos e situação certa; "Paguei" cria o gasto e "Desfazer" remove.
- `uber 15` + Enter cria o gasto certo em menos de 5 segundos.
- `node --test` passa.
