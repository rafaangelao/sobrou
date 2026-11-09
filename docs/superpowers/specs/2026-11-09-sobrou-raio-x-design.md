# Sobrou com cara de app de banco + Raio-X do mês

Data: 2026-11-09 · Branch: `feat/sobrou-banco`

## 1. Objetivo

Fazer o Sobrou parecer um app de banco profissional (referência: Nubank/Inter) e dar a ele um diferencial prático: **descobrir em um toque para onde foi o dinheiro do mês, pelo nome do lugar, e se isso cresceu**. Tudo o que existe hoje continua funcionando.

**O que o Rafael disse**
- Ao abrir, quer saber primeiro **para onde foi o dinheiro**.
- Visual de **app de banco**: limpo, número grande no topo, lista por dia, direto.
- Gastos entram **lançados na hora** ("ifood 35").
- Quer **animações**, com referência no PromptMotion (pedido "UI-morph": mola, botão → carregando → check, gráfico que se desenha, pílula tipo ilha do iPhone).
- Aprovou: Parte 1 (tela inicial + detalhe), as 9 animações e a Parte 2 (extrato + navegação).

**Suposições (podem ser corrigidas na revisão)**
- O foco é o celular (iPhone, app instalado). No computador só precisa continuar bom.
- Nada de serviço pago novo: continua Vercel + Supabase. Nenhuma mudança no banco de dados.
- As 10 categorias atuais ficam e ganham um ícone cada.
- Continua escuro, com o verde (`--papel #0F241B`) e o dourado (`--marca #D8B45A`) do Sobrou. A serifa Fraunces fica só na marca "Sobrou"; números e textos passam a usar Figtree, com algarismos de largura fixa, que é o padrão dos apps de banco.

**Pronto quando**
- Abrir o app mostra, sem rolar: quanto saiu, a faixa por categoria e os 3 lugares que mais pesaram.
- Tocar num lugar ou num pedaço da faixa abre o detalhe com total, semanas e lançamentos.
- Lançar pelo "+" leva no máximo 2 toques + digitar.
- Todos os testes antigos e os novos passam; nenhuma função atual some.

## 2. O que muda e o que fica

| Hoje | Novo |
|---|---|
| 6 abas em cima (no celular, embaixo) | Barra de baixo com 5: **Início, Extrato, +, Fixas, Mais** |
| Campo "Lançar rápido" no topo + botão redondo | O **+** do meio abre a folha de lançar rápido com o teclado aberto |
| Visão geral: 4–5 cartões + 10 barras + gráfico dia a dia | **Raio-X**: número grande, faixa única, "Os 3 que mais pesaram", aviso de fixas |
| Aba Lançamentos | **Extrato** por dia, com busca, filtros e arrastar para editar/apagar |
| Abas Importar, Economizar, Metas | Dentro de **Mais**, sem mudança de lógica |
| Aviso (torrada) embaixo | **Pílula no topo** que cresce, com "Desfazer" quando fizer sentido |
| Pastilha de cor por categoria | Círculo com **ícone** + cor da categoria |

Fica igual: sincronia com a nuvem, login do app (pareamento), fixas e parcelas, leitura de extrato, aprendizado de categorias, metas, economia, CSV, modo offline.

## 3. Telas

### 3.1 Início (Raio-X)
De cima para baixo:
1. **Topo:** "Olá" (sem nome, o app não guarda nome), seletor de mês (o mesmo de hoje) e o **olho**.
2. **Número grande:** "Saiu em {mês}" + total de gastos do período (mesma soma de hoje, incluindo "Guardar dinheiro").
   - Linha de comparação (ver §4.2): "R$ 410 a menos que até 9 de outubro" (verde) ou "a mais" (vermelho). Some no período "tudo" ou sem dados do mês anterior.
   - Linha fina: "Entrou R$ X · Sobrou R$ Y" (ou "Faltou").
3. **Faixa por categoria:** barra única dividida pela participação de cada categoria. Abaixo, pílulas com as 4 maiores ("Comida 38%") e "+N" para o resto. Tocar num pedaço ou numa pílula abre o detalhe da categoria. "+N" abre uma folha com a lista completa de categorias (a tabela de hoje).
4. **Os 3 que mais pesaram:** os 3 lugares com maior total no período (§4.1), excluindo "Guardar dinheiro". Cada linha: ícone da categoria, nome do lugar, "12 pedidos · média R$ 35", total e variação contra o mesmo trecho do mês anterior. Tocar abre o detalhe do lugar. Com menos de 3 lugares, mostra os que houver.
5. **Aviso de fixas:** "3 fixas a pagar · R$ 890 até dia 15" (atrasadas em vermelho). Só aparece se houver; tocar leva para Fixas.
6. **Sem lançamentos no período:** convite "Toque no + e lance o primeiro gasto de {mês}".

O gráfico dia a dia sai do Início (o detalhe por semana substitui sua função).

### 3.2 Folha de detalhe (lugar ou categoria)
Sobe de baixo, fecha com X, com toque fora ou arrastando para baixo.
- Ícone + nome; total grande; "12 pedidos em novembro · 13% de tudo que saiu"; comparação.
- **Por semana:** 4 colunas (1–7, 8–14, 15–21, 22–fim). Tocar numa coluna mostra o valor.
- **Lançamentos** do período, mais recentes primeiro, com data no formato do extrato ("Hoje", "Ontem", "7 de novembro"). Tocar abre a edição de hoje.
- **Dica** (só se o lugar tiver 4+ lançamentos e a categoria não estiver em `NAO_CORTAR`): "Se cortar N pedidos, sobram uns R$ X a mais no mês", com N = arredondar(qtd/3) e X = média × N.

### 3.3 Folha "+" (lançar)
Campo do lançar rápido com foco e teclado aberto, a mesma leitura de hoje (`lerLinha`), a mesma prévia ("iFood · Comida · hoje"). Botão "Lançar" e link "Formulário completo" (abre o formulário de hoje). Depois de lançar: botão vira check, folha fecha, pílula "iFood R$ 35,00 lançado · Desfazer".

### 3.4 Extrato
- Busca por texto (descrição, sem acento, sem maiúscula).
- Pílulas de filtro: Tudo, Saídas, Entradas e uma por categoria usada no período (rolagem horizontal).
- Grupos por dia: "Hoje", "Ontem", "7 de novembro", com o saldo do dia à direita.
- Linha: ícone, descrição, categoria (ou "Entrada"), valor (entrada em verde com "+").
- **Arrastar para a esquerda** mostra Editar e Apagar. Apagar confirma como hoje. No computador, os botões aparecem ao passar o mouse.

### 3.5 Fixas
Mesma lógica e ações de hoje, em lista: próximas por data, com situação (a pagar / atrasado / pago) e o botão de marcar como pago. As cadastradas ficam abaixo, como hoje.

### 3.6 Mais
Lista com: Economizar, Metas, Importar extrato, Baixar planilha, Conta e nuvem (estado da sincronia, e-mail, sair). Cada item abre a tela que já existe, com botão de voltar.

### 3.7 Computador (≥ 720px)
A barra vira uma coluna à esquerda com os mesmos 5 itens (o "+" vira botão "Lançar"). O conteúdo fica centralizado, até 560px.

## 4. Cálculos (módulo novo `js/raiox.js`, puro e testado)

### 4.1 Lugar
- A chave do lugar é a de `chaveComerciante` (hoje dentro de `painel.js`), que passa para `base.js` para poder ser testada e reaproveitada. Sem mudança de comportamento.
- Se a chave ficar vazia (descrição "Gasto" ou só números), o lugar é a descrição normalizada.
- O nome exibido é a descrição do lançamento mais recente daquele lugar, com a primeira letra maiúscula.
- `agruparPorLugar(gastos)` devolve `[{ chave, nome, categoria, total, qtd, media, itens }]` em ordem de total. A categoria do lugar é a mais frequente entre os itens.

### 4.2 Comparação com o mesmo trecho
`trechoComparavel(periodo, hoje)`:
- Mês atual: dia 1 até hoje, contra dia 1 até o mesmo dia do mês anterior (limitado ao último dia daquele mês). Ex.: 31/03 → 01/02 a 28/02.
- Mês passado (já fechado): mês inteiro contra o mês inteiro anterior.
- Mês futuro ou "tudo": sem comparação.
`comparar(atual, anterior)` → `{ diferenca, sentido: "mais" | "menos" | "igual" }`; "igual" quando a diferença for menor que R$ 1.

### 4.3 Faixa e semanas
- `faixaCategorias(gastos)`: participações que somam 100%; categorias abaixo de 3% juntam em "Outros" na faixa (a lista completa continua mostrando todas).
- `porSemana(gastos, periodo)`: 4 grupos fixos (1–7, 8–14, 15–21, 22–fim).

## 5. Ícones das categorias
SVG de traço no mesmo estilo dos ícones das abas, um por categoria: Comida (talheres), Transporte (carro), Contas fixas (casa), Lazer (ingresso), Presentes (presente), Igreja (igreja), Coisas pra mim (sacola), Saúde (coração com cruz), Guardar dinheiro (cofrinho), Outros (pontos), Entrada (seta para baixo e esquerda). Categorias criadas pelo usuário usam o de "Outros". Fundo do círculo: a cor da categoria a 18%; ícone: a cor cheia.

## 6. Animações
Regras: nenhuma passa de **500ms**; nada bloqueia o toque; com "Reduzir movimento" (`prefers-reduced-motion`) tudo vira troca simples. Só CSS, Web Animations e View Transitions do próprio navegador, sem biblioteca. Curva de mola padrão: `cubic-bezier(.3,1.3,.5,1)`.

1. **Número contando** ao abrir e ao trocar de mês (reaproveita `contarValores`, 700ms com desaceleração; é a única exceção de duração, porque não bloqueia nada).
2. **Faixa se desenha** pedaço por pedaço (90ms de atraso entre eles); ao trocar de mês, os pedaços mudam de largura sem piscar.
3. **Lançar:** botão → carregando → check (mola), o item novo desliza para a lista e o número sobe.
4. **Pílula no topo:** cresce do centro com mola, fica 3,4s, encolhe. Respeita a área segura do iPhone.
5. **Item vira folha:** o ícone tocado "voa" até o topo da folha (View Transitions; sem suporte, a folha só sobe com mola). Arrastar para baixo fecha a folha.
6. **Barra de baixo:** destaque desliza com mola até a aba tocada.
7. **Semanas** crescem de baixo para cima, uma após a outra.
8. **Olho:** valores desfocam e viram "R$ •••". A escolha fica guardada no aparelho (`localStorage`, chave `sobrou:ocultar`).
9. **Arrastar no extrato:** a linha acompanha o dedo; soltando além de 40% abre as ações, senão volta.

## 7. Dados
Nenhuma mudança no formato salvo nem no Supabase. Só uma preferência nova no aparelho (`sobrou:ocultar`). A aba aberta continua no mesmo lugar de hoje, com os ids novos (`inicio`, `extrato`, `fixas`, `mais`, e as sub-telas `economizar`, `metas`, `importar`). Um id antigo salvo (`visao`, `lancamentos`) é convertido para o novo.

## 8. Testes
- `testes/raiox.test.js`:
  - `agruparPorLugar`: "ifood 35" e "IFOOD 42,90" caem no mesmo lugar; desempate; categoria mais frequente; descrição vazia ou genérica.
  - `trechoComparavel`: mês atual no dia 9; dia 31 contra mês de 28 dias; mês passado; "tudo".
  - `comparar`: mais, menos, igual (< R$ 1).
  - `faixaCategorias`: soma 100%; menores de 3% viram "Outros".
  - `porSemana`: dia 7 cai na 1ª, dia 22 e 31 na 4ª.
  - Dica: mostra só com 4+ itens e fora de `NAO_CORTAR`; conta N e X.
- `testes/base.test.js`: `chaveComerciante` movida, com os casos de hoje ("COMPRA CARTAO IFOOD *IFOOD 4829" → "ifood").
- Conversão de id de aba antigo → novo.
- Os 55 testes atuais continuam passando.
- Conferência no navegador (celular 390px e computador): cada tela, folha, animação e o modo "Reduzir movimento".

## 9. Fora do escopo
- Orçamento tipo envelope (as Metas de hoje continuam como estão).
- Previsão de fim de mês, notificações, gráfico de rosca, relatórios.
- Mudar categorias, a leitura de extrato ou a sincronia.

## 10. Riscos
- **View Transitions** só existe no Safari 18+. Sem ele, a folha sobe com mola (já funciona assim hoje).
- **Arrastar** pode brigar com a rolagem da página: o arrasto só começa se o movimento for mais horizontal que vertical.
- **`painel.js` já tem ~1.860 linhas.** A tela inicial e o extrato novos vão para `js/telas/inicio.js` e `js/telas/extrato.js`, e os cálculos para `js/raiox.js`, em vez de crescer o arquivo.
