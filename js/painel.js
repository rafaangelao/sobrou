import { normalizar, RE_ENTRADA, CATS_BASE, mesDe, diasNoMes, hojeLocal, somarDias, somarMeses } from "./base.js";
import { estadoVazio, migrarV2, juntar } from "./juntar.js";
import { lerLinha } from "./rapido.js";
import * as nuvem from "./nuvem.js";
import { novoCodigo, urlDeRetorno, codigoDaUrl, pedidoValido } from "./pareamento.js";
import { sincronizar as sincronizarCom } from "./sincronia.js";
import { ATE_PADRAO, ultimoMes, parcelaNoMes, ocorrencias, resumoDoMes, mesesDaFaixa,
         pendentesAnteriores, descricaoPagamento, pagar, casarComFixa, jaPagaNoExtrato } from "./fixas.js";

/* ==========================================================================
   Painel do Meu Dinheiro
   Estado -> localStorage (imediato) + Supabase (nuvem)
   ========================================================================== */

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const DIAS_SEM = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];

/* Não sugerimos cortar estas: dízimo é decisão pessoal, poupança não é gasto. */
const NAO_CORTAR = ["Igreja","Guardar dinheiro"];


/* ------------------------------ utilidades ------------------------------ */
const $  = (s, r=document) => r.querySelector(s);
const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
const moeda = new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" });
const brl = v => moeda.format(Number(v) || 0);
const brlCurto = v => {
  const n = Number(v) || 0;
  return n >= 1000 ? "R$ " + (n/1000).toFixed(1).replace(".",",") + "k" : brl(n);
};
const pct = (a,b) => (!b ? 0 : (a/b)*100);
const pctTxt = n => (n < 10 ? n.toFixed(1).replace(".",",") : Math.round(n)) + "%";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const hoje = () => hojeLocal();
const partes = d => d.split("-").map(Number);
const diaSemana = d => { const [a,m,dd] = partes(d); return new Date(a, m-1, dd).getDay(); };
const rotuloMes = p => { const [a,m] = p.split("-"); return MESES[+m-1] + " de " + a; };
const rotuloData = d => { const [a,m,dd] = partes(d); return String(dd).padStart(2,"0") + " de " + MESES[m-1]; };
const abrevMes = p => MESES[+p.slice(5) - 1].slice(0, 3) + "/" + p.slice(0, 4);
const ICONE_EDITAR = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const ICONE_APAGAR = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>`;
const corDe = nome => (CATS_BASE.find(c => c.nome === nome) || { cor:"var(--c0)" }).cor;

/* ------------------------------ estado ---------------------------------- */
const CHAVE_DADOS = "painel-dinheiro:dados";
const CHAVE_UI    = "painel-dinheiro:ui";

let estado = null;
let ui = { aba:"visao", periodo:null, tipoForm:"gasto", cortes:{}, lote:null };
let sujo = false, publicando = false, falhou = false, timerSync = 0, mudancas = 0;
let usuario = null;
let ultimoToqueFixa = 0;   /* "Paguei" e "Desfazer" trocam de lugar: um toque duplo não pode pagar e desfazer */

function lerLocal(chave){ try { const t = localStorage.getItem(chave); return t ? JSON.parse(t) : null; } catch { return null; } }
function gravarLocal(chave, valor){ try { localStorage.setItem(chave, JSON.stringify(valor)); } catch {} }

function carregarEstado(){
  estado = migrarV2(lerLocal(CHAVE_DADOS) || estadoVazio());
  for (const l of estado.lancamentos)
    if (l.categoria && !estado.categorias.includes(l.categoria)) estado.categorias.push(l.categoria);
  gravarLocal(CHAVE_DADOS, estado);
}

function mudou(){
  estado.atualizadoEm = Date.now();
  mudancas++;
  gravarLocal(CHAVE_DADOS, estado);
  sujo = true;
  pintarEstado();
  render();
  agendarSync();
}

/* --------------------------- persistência ------------------------------- */
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

/* ------------------------------ seleção --------------------------------- */
/* todos os 12 meses de cada ano em jogo — inclusive os que ainda não têm nada,
   pra dar pra lançar conta futura e navegar o ano inteiro */
function periodosDisponiveis(){
  const anos = new Set(estado.lancamentos.map(l => +l.data.slice(0,4)));
  anos.add(+hoje().slice(0,4));
  const out = [];
  for (const a of anos)
    for (let m = 1; m <= 12; m++) out.push(a + "-" + String(m).padStart(2,"0"));
  return out.sort().reverse();
}

function contagemPorMes(){
  const m = new Map();
  for (const l of estado.lancamentos) m.set(mesDe(l.data), (m.get(mesDe(l.data)) || 0) + 1);
  return m;
}
/* abre no mês mais recente que tem lançamento — não num mês vazio */
function periodoPadrao(){
  const comDados = [...new Set(estado.lancamentos.map(l => mesDe(l.data)))].sort().reverse();
  const agora = mesDe(hoje());
  return comDados.includes(agora) ? agora : (comDados[0] || agora);
}
function doPeriodo(){
  if (ui.periodo === "tudo") return estado.lancamentos.slice();
  return estado.lancamentos.filter(l => mesDe(l.data) === ui.periodo);
}
const gastosDe   = arr => arr.filter(l => l.tipo === "gasto");
const entradasDe = arr => arr.filter(l => l.tipo === "entrada");
const somar      = arr => arr.reduce((t,l) => t + (Number(l.valor)||0), 0);

function porCategoria(gastos){
  const m = new Map();
  for (const g of gastos){
    const k = g.categoria || "Outros";
    m.set(k, (m.get(k)||0) + (Number(g.valor)||0));
  }
  return [...m].map(([nome,total]) => ({ nome, total, cor:corDe(nome) })).sort((a,b) => b.total - a.total);
}

/* ========================= LEITURA DE EXTRATO ============================
   Tudo acontece aqui no navegador: o arquivo do banco não sai do seu aparelho.
   Regra de ouro — o que o painel não reconhecer, ele NÃO chuta: fica parado
   esperando você escolher a categoria.
   ======================================================================== */

const DICIONARIO = [
  ["Comida/Fast Food", ["ifood","rappi","mcdonald","burger king","bk","subway","habib","bobs","giraffas","spoleto","outback","domino","pizza","pizzaria","padaria","panificadora","lanchonete","restaurante","churrascaria","acai","sorveteria","cafe","cafeteria","starbucks","hamburgueria","espetinho","supermercado","mercadinho","atacadao","assai","carrefour","pao de acucar","hortifruti","acougue","doceria","confeitaria","cheirin","burguer","lanche","marmita","delivery","food"]],
  ["Transporte",      ["uber","99app","99 pop","99pop","cabify","indriver","posto","ipiranga","shell","petrobras","combustivel","gasolina","etanol","estacionamento","zona azul","pedagio","sem parar","conectcar","veloe","onibus","busao","metro","cptm","bilhete unico","riocard","brt","mecanica","oficina","autopecas","borracharia","taxi"]],
  ["Contas fixas",    ["aluguel","condominio","energia","cemig","enel","light","copel","celpe","coelba","neoenergia","cpfl","equatorial","sabesp","copasa","embasa","sanepar","caesb","cagece","internet","vivo","claro","tim","sky","comgas","iptu","ipva","seguro","netflix","spotify","disney","hbo","prime video","amazon prime","youtube premium","deezer","globoplay","paramount","icloud","google one","microsoft","academia","smartfit","bluefit","mensalidade","faculdade","telefonica","recarga"]],
  ["Saúde",           ["farmacia","drogaria","droga raia","drogasil","pacheco","pague menos","extrafarma","nissei","panvel","venancio","clinica","laboratorio","exame","dentista","medico","hospital","consulta","psicolog","terapia","oftalmo","otica","unimed","amil","hapvida","sulamerica"]],
  ["Lazer",           ["cinema","cinemark","kinoplex","ingresso","show","teatro","bar","boteco","cervejaria","balada","festa","hotel","pousada","airbnb","booking","decolar","latam","parque","boliche","steam","playstation","xbox","nintendo","riot","epic games","twitch","fut","futebol"]],
  ["Coisas pra mim",  ["riachuelo","renner","c&a","cea","marisa","zara","hering","pernambucanas","havaianas","nike","adidas","centauro","netshoes","dafiti","shein","shopee","aliexpress","mercado livre","mercadolivre","magazine luiza","magalu","americanas","casas bahia","ponto frio","amazon","kalunga","barbearia","cabeleireiro","salao","manicure","perfumaria","boticario","natura","sephora"]],
  ["Igreja",          ["dizimo","oferta","igreja","congregacao","ministerio","celula","missao"]],
  ["Presentes",       ["presente","lembrancinha","floricultura"]],
  ["Guardar dinheiro",["poupanca","aplicacao","investimento","tesouro direto","reserva","cofrinho","caixinha","nuinvest"]],
];

/* linhas que não são gasto de verdade — dinheiro só mudando de lugar */
const IGNORAR = ["pagamento de fatura","pagamento fatura","fatura cartao","transferencia entre contas","aplicacao rdb","resgate rdb","saldo anterior","saldo do dia","saldo final","saldo em conta"];

/* palavra curta precisa bater inteira ("bar" não pode casar com "barbearia") */
const bate = (n, p) => p.length <= 4
  ? new RegExp("(^|[^a-z0-9])" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)").test(n)
  : n.includes(p);

/* reduz "COMPRA CARTAO IFOOD *IFOOD 4829" a "ifood" — é a chave do aprendizado */
function chaveComerciante(desc){
  let n = normalizar(desc)
    .replace(/\b(compra|no|na|nos|debito|credito|cartao|cart|pix|enviado|recebido|para|de|do|da|pagamento|pag|parcela|em|cp|tarifa|transferencia|ted|doc|final|elo|visa|master|mastercard|pagto|com)\b/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const toks = [...new Set(n.split(" ").filter(t => t.length > 2))];
  return toks.slice(0, 3).join(" ");
}

function classificar(desc){
  const n = normalizar(desc);
  const chave = chaveComerciante(desc);
  if (chave && estado.regras[chave]) return { categoria: estado.regras[chave], origem: "você já classificou isso" };
  for (const l of estado.lancamentos){
    if (l.tipo !== "gasto" || !l.categoria || !l.descricao) continue;
    if (chave && chaveComerciante(l.descricao) === chave)
      return { categoria: l.categoria, origem: "igual a um lançamento seu" };
  }
  for (const [cat, palavras] of DICIONARIO)
    for (const p of palavras)
      if (bate(n, p)) return { categoria: cat, origem: "reconheci “" + p + "”" };
  return { categoria: "", origem: "" };
}

/* ---------- conversores ---------- */
function lerValorBR(s){
  if (s == null) return null;
  let t = String(s).replace(/\s| /g, "").replace(/R\$/gi, "");
  const neg = /^\(.*\)$/.test(t) || /^-/.test(t) || /-$/.test(t) || /D$/.test(t);
  t = t.replace(/[()]/g, "").replace(/-/g, "").replace(/[DC]$/, "");
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(/,/g, "");
  const n = parseFloat(t);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

function lerDataBR(s){
  if (!s) return null;
  const t = String(s);
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + "-" + m[2] + "-" + m[3];
  m = t.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m){
    const a = m[3].length === 2 ? "20" + m[3] : m[3];
    return a + "-" + m[2].padStart(2,"0") + "-" + m[1].padStart(2,"0");
  }
  m = t.match(/^(\d{4})(\d{2})(\d{2})/);          /* formato do OFX */
  if (m) return m[1] + "-" + m[2] + "-" + m[3];
  return null;
}

function partirLinha(l, d){
  const out = []; let cur = "", aspas = false;
  for (let i = 0; i < l.length; i++){
    const c = l[i];
    if (c === '"'){ if (aspas && l[i+1] === '"'){ cur += '"'; i++; } else aspas = !aspas; }
    else if (c === d && !aspas){ out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function lerOFX(t){
  const out = [];
  for (const b of t.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || []){
    const tag = n => (b.match(new RegExp("<" + n + ">([^<\r\n]*)", "i")) || [])[1]?.trim();
    const data = lerDataBR(tag("DTPOSTED"));
    const valor = lerValorBR(tag("TRNAMT"));
    if (!data || valor == null || valor === 0) continue;
    const desc = [tag("MEMO"), tag("NAME")].filter(Boolean).join(" ").trim();
    out.push({ data, descricao: desc || "Lançamento", valor });
  }
  return out;
}

function lerDelimitado(texto){
  const linhas = texto.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return null;
  const [delim, qtd] = [";", ",", "\t"]
    .map(x => [x, linhas[0].split(x).length])
    .sort((a,b) => b[1] - a[1])[0];
  if (qtd < 2) return null;
  const cab = partirLinha(linhas[0], delim).map(normalizar);
  const iData = cab.findIndex(c => /^data|^date|data do lancamento|data compra/.test(c));
  const iVal  = cab.findIndex(c => /valor|amount|quantia|montante/.test(c) && !/saldo|balance/.test(c));
  const iDesc = cab.findIndex(c => /desc|hist|lancamento|estabelecimento|titulo|title|nome|name|memo|detalhe|movimenta/.test(c));
  if (iData < 0 || iVal < 0) return null;
  const out = [];
  for (const l of linhas.slice(1)){
    const c = partirLinha(l, delim);
    const data = lerDataBR(c[iData]), valor = lerValorBR(c[iVal]);
    if (!data || valor == null || valor === 0) continue;
    const desc = (iDesc >= 0 ? c[iDesc] : c.filter((_,k) => k !== iData && k !== iVal).join(" ")) || "Lançamento";
    out.push({ data, descricao: desc, valor });
  }
  return out.length ? out : null;
}

/* aceita 1.495,54 e também 1495,54 — sem o "\d+" solto o milhar sem ponto vira 495,54 */
const RE_DINHEIRO = /-?\s?R?\$?\s?-?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}|-?\s?R?\$?\s?-?\d+\.\d{2}(?!\d)/g;

function lerTextoSolto(texto){
  const out = [];
  for (const bruta of texto.split(/\r?\n/)){
    const l = bruta.trim();
    if (!l) continue;
    const mData = l.match(/\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/);
    if (!mData) continue;
    const data = lerDataBR(mData[0]);
    if (!data) continue;
    const semData = l.replace(mData[0], " ");          /* tira a data antes de caçar o valor */
    const dinheiros = semData.match(RE_DINHEIRO);
    if (!dinheiros) continue;
    const valor = lerValorBR(dinheiros[0]);
    if (valor == null || valor === 0) continue;
    let desc = semData;
    for (const d of dinheiros) desc = desc.replace(d, " ");
    desc = desc.replace(/\s{2,}/g, " ").replace(/^[\s\-–|;,]+|[\s\-–|;,]+$/g, "").trim();
    out.push({ data, descricao: desc || "Lançamento", valor });
  }
  return out;
}

function analisarExtrato(texto){
  if (/<STMTTRN>/i.test(texto)) return lerOFX(texto);
  return lerDelimitado(texto) || lerTextoSolto(texto);
}

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

    let fixa = null, fixaJaPaga = false;
    if (tipo === "gasto" && estado.fixas.length){
      const mes = mesDe(b.data);
      if (!ocsPorMes.has(mes)) ocsPorMes.set(mes, ocorrencias(estado.fixas, estado.lancamentos, mes, hj));
      const livres = ocsPorMes.get(mes).filter(o => !usadas.has(o.fixa.id + "|" + mes));
      const o = casarComFixa({ descricao: b.descricao, valor }, livres, chaveComerciante);
      if (o){
        usadas.add(o.fixa.id + "|" + mes);
        fixa = { fixaId: o.fixa.id, fixaMes: mes, rotulo: descricaoPagamento(o), categoria: o.fixa.categoria };
      } else {
        const p = jaPagaNoExtrato({ descricao: b.descricao, valor }, livres, chaveComerciante);
        if (p){ usadas.add(p.fixa.id + "|" + mes); fixaJaPaga = true; }
      }
    }

    const { categoria, origem } = fixa ? { categoria: fixa.categoria, origem: "é " + fixa.rotulo }
      : tipo === "gasto" ? classificar(b.descricao) : { categoria: "", origem: "" };
    const repetido = fixaJaPaga || estado.lancamentos.some(l =>
      l.data === b.data && Math.abs(l.valor - valor) < 0.005 &&
      (normalizar(l.descricao) === n || (chaveComerciante(l.descricao) && chaveComerciante(l.descricao) === chaveComerciante(b.descricao))));
    lote.push({ data: b.data, descricao: b.descricao, valor, tipo, categoria, origem, repetido, incluir: !repetido, fixa });
  }
  return lote.sort((a,b) => a.data.localeCompare(b.data));
}

/* ============================ ABA: VISÃO GERAL =========================== */
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

function abaVisao(){
  const itens = doPeriodo();
  const gastos = gastosDe(itens), entradas = entradasDe(itens);
  const tg = somar(gastos), te = somar(entradas);
  const guardado = somar(gastos.filter(g => g.categoria === "Guardar dinheiro"));
  const saldo = te - tg;
  const cats = porCategoria(gastos);
  const aviso = avisoFixas();
  const prev = ui.periodo !== "tudo" && estado.fixas.length
    ? resumoDoMes(ocorrencias(estado.fixas, estado.lancamentos, ui.periodo, hoje())) : null;

  if (!itens.length) return aviso + vazio(
    "Nada lançado " + (ui.periodo === "tudo" ? "ainda" : "em " + rotuloMes(ui.periodo)),
    "Toque no botão + e registre o primeiro gasto ou recebimento deste período. O painel calcula o resto sozinho."
  );

  const kpis = `
    <section class="kpis">
      <div class="kpi" style="--faixa:var(--bom)" data-t="bom">
        <div class="rot">Entrou</div><div class="val">${brl(te)}</div>
        <div class="pe">${entradas.length} recebimento${entradas.length===1?"":"s"}</div>
      </div>
      <div class="kpi" style="--faixa:var(--c2)">
        <div class="rot">Saiu</div><div class="val">${brl(tg)}</div>
        <div class="pe">${gastos.length} gasto${gastos.length===1?"":"s"}${te?" · "+pctTxt(pct(tg,te))+" do que entrou":""}</div>
      </div>
      <div class="kpi" data-heroi style="--faixa:${saldo>=0?"var(--marca)":"var(--grave)"}" data-t="${saldo>=0?"":"grave"}">
        <div class="rot">${saldo>=0?"Sobrou":"Faltou"}</div><div class="val">${brl(Math.abs(saldo))}</div>
        <div class="pe">${te ? pctTxt(pct(Math.abs(saldo),te)) + " do que entrou" : "sem entradas no período"}</div>
      </div>
      <div class="kpi" style="--faixa:var(--c9)">
        <div class="rot">Guardado</div><div class="val">${brl(guardado)}</div>
        <div class="pe">${guardado ? "bom trabalho" : "nada separado ainda"}</div>
      </div>
      ${prev && prev.aPagar ? `
      <div class="kpi" style="--faixa:var(--alerta)">
        <div class="rot">A pagar</div><div class="val">${brl(prev.aPagar)}</div>
        <div class="pe">fixas e parcelas do mês${prev.atrasado ? " · " + brl(prev.atrasado) + " atrasado" : ""}</div>
      </div>` : ""}
    </section>`;

  /* ---- barras por categoria ---- */
  const maior = cats[0]?.total || 1;
  const linhasCat = cats.map(c => `
    <div>
      <div class="cat-topo">
        <span class="cat-nome"><i class="pastilha" style="--c:${c.cor}"></i><span>${esc(c.nome)}</span></span>
        <span class="cat-val">${brl(c.total)}<em>${pctTxt(pct(c.total,tg))}</em></span>
      </div>
      <div class="trilho"><div class="barra" style="--w:${pct(c.total,maior).toFixed(1)}%;--c:${c.cor}"></div></div>
    </div>`).join("");

  const painelCats = `
    <section class="cartao">
      <h2>Pra onde foi o dinheiro <small>${cats.length} categoria${cats.length===1?"":"s"} · maior barra = maior gasto</small></h2>
      <div class="cats">${linhasCat || '<p class="sub">Nenhum gasto neste período.</p>'}</div>
      ${tabelaCats(cats, tg, te)}
    </section>`;

  /* ---- ritmo (dias ou meses) ---- */
  let ritmo = "";
  if (ui.periodo === "tudo"){
    const porMes = new Map();
    for (const g of gastos) porMes.set(mesDe(g.data), (porMes.get(mesDe(g.data))||0) + g.valor);
    const chaves = [...porMes.keys()].sort();
    const topo = Math.max(...porMes.values(), 1);
    ritmo = blocoColunas(
      "Gasto mês a mês", chaves.length + " meses com lançamento",
      chaves.map(k => ({ h:pct(porMes.get(k),topo), rot:MESES[+k.slice(5)-1].slice(0,3), dica:rotuloMes(k)+": "+brl(porMes.get(k)) })),
      Math.max(1, Math.ceil(chaves.length/8))
    );
  } else {
    const [ano, mes] = ui.periodo.split("-").map(Number);
    const nd = diasNoMes(ano, mes);
    const porDia = new Array(nd + 1).fill(0);
    for (const g of gastos) porDia[partes(g.data)[2]] += g.valor;
    const topo = Math.max(...porDia, 1);
    const hj = hoje();
    const barras = [];
    for (let d = 1; d <= nd; d++){
      const iso = ui.periodo + "-" + String(d).padStart(2,"0");
      barras.push({ h:pct(porDia[d],topo), rot:String(d), dica:rotuloData(iso)+": "+(porDia[d]?brl(porDia[d]):"nada gasto"), hoje: iso === hj });
    }
    const comGasto = porDia.filter(v => v > 0).length;
    const sub = !comGasto ? "nenhum gasto lançado neste mês"
      : comGasto === 1 ? "1 dia com gasto no mês inteiro"
      : comGasto + " dias com gasto · média de " + brl(tg/comGasto) + " nos dias em que você gastou";
    ritmo = blocoColunas("Dia a dia do mês", sub, barras, nd > 20 ? 5 : 2);
  }

  return aviso + kpis + `<div class="grade grade-2">${painelCats}${ritmo}</div>` + blocoUltimos(itens);
}

function tabelaCats(cats, tg, te){
  if (!cats.length) return "";
  return `
    <details style="margin-top:16px">
      <summary style="cursor:pointer;font-size:12.5px;color:var(--tinta-3);font-weight:600">Ver como tabela</summary>
      <div class="rolar">
        <table>
          <thead><tr><th>Categoria</th><th class="n">Gasto</th><th class="n">% do gasto</th><th class="n">% da renda</th></tr></thead>
          <tbody>${cats.map(c => `<tr>
            <td><i class="pastilha" style="--c:${c.cor};display:inline-block;vertical-align:middle;margin-right:7px"></i>${esc(c.nome)}</td>
            <td class="n">${brl(c.total)}</td>
            <td class="n">${pctTxt(pct(c.total,tg))}</td>
            <td class="n">${te ? pctTxt(pct(c.total,te)) : "—"}</td>
          </tr>`).join("")}</tbody>
          <tfoot><tr><td>Total</td><td class="n">${brl(tg)}</td><td class="n">100%</td><td class="n">${te?pctTxt(pct(tg,te)):"—"}</td></tr></tfoot>
        </table>
      </div>
    </details>`;
}

function blocoColunas(titulo, sub, barras, passo){
  return `
    <section class="cartao">
      <h2>${titulo} <small>${esc(sub)}</small></h2>
      <div class="colunas">
        ${barras.map(b => `<div class="col" title="${esc(b.dica)}" ${b.hoje?'data-hoje':''}><i style="--h:${Math.max(b.h,0).toFixed(1)}%"></i></div>`).join("")}
      </div>
      <div class="eixo">
        ${barras.map((b,i) => `<span>${(i % passo === 0 || i === barras.length-1) ? esc(b.rot) : ""}</span>`).join("")}
      </div>
    </section>`;
}

function blocoUltimos(itens){
  const ult = itens.slice().sort((a,b) => b.data.localeCompare(a.data)).slice(0,6);
  if (!ult.length) return "";
  return `
    <section class="cartao">
      <h2>Últimos lançamentos <small>do período selecionado</small></h2>
      <div class="lista">${ult.map(itemHTML).join("")}</div>
      <div style="margin-top:14px"><button class="btn" type="button" data-acao="ir" data-aba="lancamentos">Ver todos os lançamentos</button></div>
    </section>`;
}

/* ============================ ABA: LANÇAMENTOS =========================== */
function abaLancamentos(){
  const itens = doPeriodo().slice().sort((a,b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
  if (!itens.length) return vazio("Nenhum lançamento aqui", "Escolha outro período no topo ou toque no + para registrar algo novo.");

  const grupos = new Map();
  for (const l of itens){
    if (!grupos.has(l.data)) grupos.set(l.data, []);
    grupos.get(l.data).push(l);
  }
  const blocos = [...grupos].map(([data, ls]) => {
    const g = somar(gastosDe(ls)), e = somar(entradasDe(ls));
    const resumo = [g ? "−" + brl(g) : "", e ? "+" + brl(e) : ""].filter(Boolean).join("  ");
    return `<div class="dia-rot"><span>${rotuloData(data)}</span><span style="text-transform:none;letter-spacing:0;font-weight:500">${DIAS_SEM[diaSemana(data)]}</span><b>${resumo}</b></div>
            ${ls.map(itemHTML).join("")}`;
  }).join("");

  return `
    <section class="cartao">
      <h2>Todos os lançamentos <small>${itens.length} registro${itens.length===1?"":"s"} · ${ui.periodo==="tudo"?"todos os meses":rotuloMes(ui.periodo)}</small></h2>
      <div class="lista">${blocos}</div>
      <div class="brisa" style="margin-top:20px">
        <button class="btn btn-forte" type="button" data-acao="novo">+ Novo lançamento</button>
        <button class="btn" type="button" data-acao="csv" id="btn-csv">Baixar planilha (CSV)</button>
      </div>
    </section>`;
}

function itemHTML(l){
  const mais = l.tipo === "entrada";
  return `
    <div class="item">
      <i class="pastilha" style="--c:${mais ? "var(--bom)" : corDe(l.categoria)}"></i>
      <div class="item-txt">
        <b>${esc(l.descricao || (mais ? "Entrada" : "Gasto"))}</b>
        <small>${mais ? "Entrada" : esc(l.categoria || "Outros")} · ${rotuloData(l.data)}</small>
      </div>
      <span class="valor ${mais ? "mais" : ""}">${mais ? "+" : "−"}${brl(l.valor)}</span>
      <span class="acoes">
        <button class="icone" type="button" data-acao="editar" data-id="${l.id}" aria-label="Editar ${esc(l.descricao)}">
          ${ICONE_EDITAR}
        </button>
        <button class="icone perigo" type="button" data-acao="apagar" data-id="${l.id}" aria-label="Apagar ${esc(l.descricao)}">
          ${ICONE_APAGAR}
        </button>
      </span>
    </div>`;
}

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
    "de " + rotuloMes(meses[0]) + " a " + rotuloMes(meses[meses.length - 1]) + " · dourado = mês mais pesado",
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


/* =========================== ABA: ECONOMIZAR ============================= */
function abaEconomizar(){
  const itens = doPeriodo();
  const gastos = gastosDe(itens);
  const tg = somar(gastos), te = somar(entradasDe(itens));
  if (!gastos.length) return vazio("Ainda não dá pra analisar", "Registre alguns gastos que eu aponto exatamente onde o dinheiro está vazando.");

  const insights = gerarInsights({ itens, gastos, tg, te });
  const cats = porCategoria(gastos).filter(c => !NAO_CORTAR.includes(c.nome));

  const cartoes = insights.map(i => `
    <article class="insight" data-n="${i.nivel}">
      <span class="chip">${i.rotulo}</span>
      <h3>${i.titulo}</h3>
      <p>${i.texto}</p>
      ${i.ganho ? `<div class="ganho">${i.ganho}</div>` : ""}
    </article>`).join("");

  const linhasSim = cats.slice(0,5).map(c => {
    const p = ui.cortes[c.nome] ?? 0;
    return `
      <div class="sim-linha">
        <div class="sim-topo">
          <i class="pastilha" style="--c:${c.cor}"></i><b>${esc(c.nome)}</b>
          <span class="atual">${brl(c.total)} no período</span>
        </div>
        <div class="sim-ctrl">
          <input type="range" min="0" max="60" step="5" value="${p}" data-corte="${esc(c.nome)}" aria-label="Cortar ${esc(c.nome)}">
          <span class="sim-res" data-res="${esc(c.nome)}">${p ? "−" + pctTxt(p) + " · " + brl(c.total*p/100) : "manter"}</span>
        </div>
      </div>`;
  }).join("");

  const economia = cats.reduce((t,c) => t + c.total * ((ui.cortes[c.nome]||0)/100), 0);

  return `
    <section class="cartao">
      <h2>Onde dá pra economizar <small>${ui.periodo==="tudo"?"todos os meses":rotuloMes(ui.periodo)}</small></h2>
      <p class="sub">Cada cartão vem de um padrão real nos seus lançamentos — não é regra genérica de internet.</p>
      <div class="insights">${cartoes}</div>
    </section>

    <section class="cartao">
      <h2>Simulador de corte <small>arraste e veja quanto sobra</small></h2>
      <p class="sub">Igreja e Guardar dinheiro ficam de fora: dízimo é decisão sua e poupança não é gasto.</p>
      <div style="margin-top:6px">${linhasSim || '<p class="sub">Sem categorias cortáveis neste período.</p>'}</div>
      <div class="sim-total">
        <div>
          <div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--tinta-3)">Sobraria por mês</div>
          <div class="g" id="sim-mes">${brl(economia)}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--tinta-3)">Em 12 meses</div>
          <div class="g" id="sim-ano">${brl(economia*12)}</div>
        </div>
        <div class="r" id="sim-nota" style="flex:1;min-width:180px">${economia ? "Isso sem mexer em conta fixa nenhuma." : "Arraste alguma barra pra ver o efeito."}</div>
      </div>
    </section>`;
}

function gerarInsights({ itens, gastos, tg, te }){
  const out = [];
  const cats = porCategoria(gastos);
  const guardado = cats.find(c => c.nome === "Guardar dinheiro")?.total || 0;
  const cortaveis = cats.filter(c => !NAO_CORTAR.includes(c.nome));

  /* 1. maior categoria */
  if (cortaveis[0]){
    const c = cortaveis[0];
    const fatia = pct(c.total, tg);
    const alvo = c.total * 0.25;
    out.push({
      nivel: fatia > 35 ? "alto" : fatia > 22 ? "medio" : "info",
      rotulo: "maior ralo",
      titulo: esc(c.nome) + " leva " + pctTxt(fatia) + " de tudo que você gasta",
      texto: `Foram <b>${brl(c.total)}</b> em ${gastos.filter(g=>g.categoria===c.nome).length} lançamentos` +
             (te ? `, o equivalente a <b>${pctTxt(pct(c.total,te))}</b> de tudo que entrou.` : "."),
      ganho: "Cortar 25% aqui libera " + brl(alvo) + "/mês · " + brl(alvo*12) + " no ano",
    });
  }

  /* 2. gastos que se repetem (mesma descrição) */
  const grupos = new Map();
  for (const g of gastos){
    const k = normalizar(g.descricao);
    if (!k) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(g);
  }
  const repetidos = [...grupos.values()].filter(v => v.length >= 2).sort((a,b) => somar(b) - somar(a))[0];
  if (repetidos){
    const t = somar(repetidos);
    out.push({
      nivel: "medio",
      rotulo: "hábito repetido",
      titulo: `"${esc(repetidos[0].descricao)}" apareceu ${repetidos.length} vezes`,
      texto: `Somando tudo dá <b>${brl(t)}</b>, com média de ${brl(t/repetidos.length)} por vez. Gasto que repete é o mais fácil de negociar ou substituir — muda uma vez e a economia se repete sozinha todo mês.`,
      ganho: "Cortando pela metade: " + brl(t/2) + "/mês",
    });
  }

  /* 3. mordidas pequenas */
  const pequenos = gastos.filter(g => g.valor > 0 && g.valor < 30);
  if (pequenos.length >= 3){
    const t = somar(pequenos);
    out.push({
      nivel: pct(t,tg) > 20 ? "medio" : "info",
      rotulo: "mordidas pequenas",
      titulo: pequenos.length + " compras de menos de R$ 30 somaram " + brl(t),
      texto: `São ${pctTxt(pct(t,tg))} do seu gasto total, em pedaços de ${brl(t/pequenos.length)} em média. Cada uma parece inofensiva — o estrago é a soma. Vale juntar essas compras num limite semanal fixo em vez de decidir uma por uma.`,
      ganho: "Um limite 30% menor devolve " + brl(t*0.3) + "/mês",
    });
  }

  /* 4. ritmo — projeção só faz sentido no mês que ainda está correndo */
  if (ui.periodo !== "tudo"){
    const [ano, mes] = ui.periodo.split("-").map(Number);
    const nd = diasNoMes(ano, mes);
    const eAtual = ui.periodo === mesDe(hoje());
    if (eAtual){
      const diaHoje = partes(hoje())[2];
      const porDia = tg / Math.max(diaHoje, 1);
      const proj = porDia * nd;
      const restam = Math.max(nd - diaHoje, 1);
      const teto = Math.max((te - tg) / restam, 0);
      if (diaHoje < nd) out.push({
        nivel: te && proj > te ? "alto" : "info",
        rotulo: "ritmo",
        titulo: "No ritmo atual, o mês fecha em " + brl(proj),
        texto: `Você já gastou ${brl(tg)} em ${diaHoje} dia${diaHoje===1?"":"s"} — <b>${brl(porDia)} por dia</b>. Mantendo esse passo até o dia ${nd}` +
               (te ? (proj > te
                 ? `, o gasto passa das entradas em <b>${brl(proj-te)}</b>.`
                 : `, ainda sobram <b>${brl(te-proj)}</b>.`)
                 : "."),
        ganho: te ? "Teto de " + brl(teto) + "/dia nos " + restam + " dias que faltam pra fechar no azul" : null,
      });
    } else {
      const diasComGasto = new Set(gastos.map(g => g.data)).size;
      const caro = [...new Set(gastos.map(g => g.data))]
        .map(d => ({ d, t: somar(gastos.filter(g => g.data === d)) }))
        .sort((a,b) => b.t - a.t)[0];
      out.push({
        nivel: "info",
        rotulo: "fechamento",
        titulo: rotuloMes(ui.periodo) + " fechou em " + brl(tg),
        texto: `Foram ${gastos.length} gastos espalhados por ${diasComGasto} dia${diasComGasto===1?"":"s"}, uma média de <b>${brl(tg/nd)} por dia do mês</b>.` +
               (caro ? ` O dia mais caro foi ${rotuloData(caro.d)}, com ${brl(caro.t)} — sozinho, ${pctTxt(pct(caro.t,tg))} do mês.` : ""),
        ganho: te ? "Um mês 10% mais leve teria devolvido " + brl(tg*0.1) : null,
      });
    }
  }

  /* 5. fim de semana */
  const fds = gastos.filter(g => [0,5,6].includes(diaSemana(g.data)));
  if (fds.length >= 2 && tg > 0){
    const t = somar(fds), p = pct(t,tg);
    if (p >= 30) out.push({
      nivel: p > 55 ? "medio" : "info",
      rotulo: "padrão de dia",
      titulo: pctTxt(p) + " do gasto acontece de sexta a domingo",
      texto: `São <b>${brl(t)}</b> em ${fds.length} lançamentos concentrados no fim de semana. Definir antes um valor pro rolê (e sair com ele separado) costuma segurar mais que tentar frear na hora.`,
      ganho: "Um teto 20% menor no fim de semana: " + brl(t*0.2) + "/mês",
    });
  }

  /* 6. metas estouradas */
  const estouradas = porCategoria(gastos)
    .filter(c => estado.metas[c.nome] > 0 && c.total > estado.metas[c.nome])
    .map(c => ({ ...c, meta: estado.metas[c.nome] }));
  if (estouradas.length){
    const exc = estouradas.reduce((t,c) => t + (c.total - c.meta), 0);
    out.push({
      nivel: "alto",
      rotulo: "meta estourada",
      titulo: estouradas.length + " meta" + (estouradas.length===1?"":"s") + " passou do limite",
      texto: estouradas.map(c => `<b>${esc(c.nome)}</b>: ${brl(c.total)} de ${brl(c.meta)}`).join(" · ") + ".",
      ganho: "Voltar ao combinado economiza " + brl(exc),
    });
  }

  /* 7. poupança */
  const sobra = te - tg;
  if (te > 0){
    if (guardado === 0 && sobra > 0){
      out.push({
        nivel: "medio",
        rotulo: "reserva",
        titulo: "Sobraram " + brl(sobra) + " e nada foi separado",
        texto: `Dinheiro que fica na conta tende a virar gasto. Lançar a reserva como um gasto de <b>Guardar dinheiro</b> logo que o salário cai transforma a sobra em decisão, não em resto.`,
        ganho: "Separando 10% da entrada: " + brl(te*0.1) + "/mês · " + brl(te*0.1*12) + " no ano",
      });
    } else if (guardado > 0){
      out.push({
        nivel: "bom",
        rotulo: "no caminho",
        titulo: "Você guardou " + brl(guardado) + " — " + pctTxt(pct(guardado,te)) + " do que entrou",
        texto: pct(guardado,te) >= 10
          ? "Está acima da faixa de 10% que costuma ser usada como referência de reserva. Mantendo o ritmo, são " + brl(guardado*12) + " em um ano."
          : "Dá pra subir: chegando a 10% da entrada seriam " + brl(te*0.1) + " por mês.",
        ganho: null,
      });
    }
  }

  /* 8. comparação com o mês anterior */
  if (ui.periodo !== "tudo"){
    const [a,m] = ui.periodo.split("-").map(Number);
    const ant = (m === 1 ? (a-1) + "-12" : a + "-" + String(m-1).padStart(2,"0"));
    const gAnt = estado.lancamentos.filter(l => l.tipo === "gasto" && mesDe(l.data) === ant);
    if (gAnt.length){
      const catsAnt = new Map(porCategoria(gAnt).map(c => [c.nome, c.total]));
      const subiu = porCategoria(gastos)
        .map(c => ({ ...c, dif: c.total - (catsAnt.get(c.nome) || 0) }))
        .filter(c => c.dif > 0).sort((x,y) => y.dif - x.dif)[0];
      const tAnt = somar(gAnt);
      out.push({
        nivel: tg > tAnt * 1.15 ? "medio" : tg < tAnt ? "bom" : "info",
        rotulo: "vs mês anterior",
        titulo: tg === tAnt ? "Gasto igual ao mês passado"
              : tg > tAnt ? "Você gastou " + brl(tg-tAnt) + " a mais que em " + rotuloMes(ant)
              : "Você gastou " + brl(tAnt-tg) + " a menos que em " + rotuloMes(ant),
        texto: `${brl(tg)} contra ${brl(tAnt)}` + (subiu ? `. A categoria que mais subiu foi <b>${esc(subiu.nome)}</b>, com ${brl(subiu.dif)} a mais.` : "."),
        ganho: tg > tAnt && subiu ? "Voltar ao patamar anterior em " + esc(subiu.nome) + ": " + brl(subiu.dif) : null,
      });
    }
  }

  return out;
}

/* ============================== ABA: METAS =============================== */
function abaMetas(){
  const doMes = gastosDe(doPeriodo());
  const usados = new Map(porCategoria(doMes).map(c => [c.nome, c.total]));
  const te = somar(entradasDe(doPeriodo()));
  const lista = estado.categorias.filter(n => n !== "Guardar dinheiro");
  const totalMetas = lista.reduce((t,n) => t + (Number(estado.metas[n])||0), 0);

  const linhas = lista.map(n => {
    const meta = Number(estado.metas[n]) || 0;
    const uso = usados.get(n) || 0;
    const p = meta ? pct(uso, meta) : 0;
    const cor = !meta ? "var(--c0)" : p > 100 ? "var(--grave)" : p > 80 ? "var(--alerta)" : corDe(n);
    return `
      <div class="meta-linha">
        <div>
          <div class="cat-topo">
            <span class="cat-nome"><i class="pastilha" style="--c:${corDe(n)}"></i><span>${esc(n)}</span></span>
            <span class="cat-val">${brl(uso)}${meta ? `<em>de ${brl(meta)}</em>` : `<em>sem limite</em>`}</span>
          </div>
          <div class="trilho"><div class="barra" style="--w:${Math.min(p,100).toFixed(1)}%;--c:${cor}"></div></div>
        </div>
        <label class="meta-in">
          <span>R$</span>
          <input type="number" min="0" step="10" inputmode="decimal" value="${meta || ""}" placeholder="—" data-meta="${esc(n)}" aria-label="Limite mensal de ${esc(n)}">
        </label>
      </div>`;
  }).join("");

  return `
    <section class="cartao">
      <h2>Limites por categoria <small>${ui.periodo==="tudo"?"comparando com o total de todos os meses":rotuloMes(ui.periodo)}</small></h2>
      <p class="sub">Defina quanto você aceita gastar por mês em cada coisa. A barra fica laranja em 80% e vermelha quando passa — e o painel avisa na aba <b>Economizar</b>.</p>
      <div style="margin-top:14px">${linhas}</div>
      ${totalMetas ? `<div class="sim-total"><div>
        <div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--tinta-3)">Soma dos limites</div>
        <div class="g">${brl(totalMetas)}</div></div>
        <div class="r" style="flex:1;min-width:200px">${te
          ? (totalMetas > te
             ? "Seus limites somam <b>" + brl(totalMetas - te) + "</b> a mais do que entra por mês. Vale baixar algum."
             : "Cabe no que entra, com <b>" + brl(te - totalMetas) + "</b> de folga pra guardar.")
          : "Registre uma entrada pra comparar com o que você recebe."}</div>
      </div>` : ""}
    </section>

    <section class="cartao">
      <h2>Minhas categorias <small>${estado.categorias.length} no total</small></h2>
      <div class="brisa">
        ${estado.categorias.map(n => `<span class="filtro" style="cursor:default"><i class="pastilha" style="--c:${corDe(n)};display:inline-block;vertical-align:middle;margin-right:6px"></i>${esc(n)}</span>`).join("")}
      </div>
      <p class="sub" style="margin-top:14px">Pra criar uma categoria nova, escolha <b>Outra…</b> no formulário de lançamento.</p>
    </section>`;
}

/* ============================ ABA: IMPORTAR ============================= */
function abaImportar(){
  if (!ui.lote) return `
    <section class="cartao">
      <h2>Importar extrato <small>solte o arquivo ou cole o texto</small></h2>
      <p class="sub">Aceita <b>CSV</b> e <b>OFX</b> baixados do banco, ou o extrato copiado direto do app. O painel separa por categoria sozinho — e o que ele não reconhecer fica parado esperando <b>você</b> escolher. Ele nunca chuta.</p>
      <div class="solta" id="solta">
        <b>Solte o arquivo do extrato aqui</b>
        <p>.csv · .ofx · .txt</p>
        <label class="btn" style="cursor:pointer;margin-top:13px">Escolher arquivo
          <input type="file" id="arq" accept=".csv,.ofx,.qfx,.txt,text/*" hidden>
        </label>
      </div>
      <textarea class="extrato" id="txt-extrato" spellcheck="false" placeholder="…ou cole aqui o extrato copiado do app do banco:

03/07/2026   CHEIRIN BAO CAFE          -38,24
04/07/2026   UBER *TRIP                 -6,50
04/07/2026   PIX ENVIADO MARIA         -100,00"></textarea>
      <div class="brisa">
        <button class="btn btn-forte" type="button" data-acao="ler-extrato">Ler extrato</button>
      </div>
      ${blocoAprendido()}
    </section>`;

  const lote = ui.lote;
  const pendentes = lote.filter(r => r.incluir && r.tipo === "gasto" && !r.categoria);
  const prontos   = lote.filter(r => !(r.incluir && r.tipo === "gasto" && !r.categoria));

  return `
    <section class="cartao">
      <h2>Confira antes de importar <small>${lote.length} linha${lote.length===1?"":"s"} lida${lote.length===1?"":"s"}</small></h2>
      <p class="sub">Desmarque o que não quiser trazer. Pagamentos de fatura e transferências entre suas contas já foram descartados.</p>

      ${pendentes.length ? `
        <div class="rev-grupo">
          <div class="rev-cab" data-p><span class="tag">${pendentes.length}</span> Não reconheci — escolha a categoria</div>
          ${pendentes.map(r => revHTML(r, lote.indexOf(r))).join("")}
        </div>` : `
        <div class="rev-grupo"><div class="rev-cab"><span class="tag" style="background:var(--bom);color:#fff">✓</span> Tudo categorizado</div></div>`}

      ${prontos.length ? `
        <details class="rev-grupo" ${pendentes.length ? "" : "open"}>
          <summary class="rev-cab" style="cursor:pointer"><span class="tag">${prontos.length}</span> Já classificados — dá pra mudar</summary>
          ${prontos.map(r => revHTML(r, lote.indexOf(r))).join("")}
        </details>` : ""}

      <div class="barra-acao">
        <span class="conta" id="conta-import"></span>
        <label style="display:flex;gap:7px;align-items:center;font-size:13px">
          <input type="checkbox" id="lembrar" checked style="width:16px;height:16px;accent-color:var(--marca)"> Lembrar minhas escolhas
        </label>
        <button class="btn" type="button" data-acao="cancelar-lote">Descartar</button>
        <button class="btn btn-forte" type="button" data-acao="importar" id="btn-importar">Importar</button>
      </div>
    </section>`;
}

function revHTML(r, i){
  const precisa = r.incluir && r.tipo === "gasto" && !r.categoria;
  const opcoes = estado.categorias.map(c =>
    `<option value="${esc(c)}"${r.categoria === c ? " selected" : ""}>${esc(c)}</option>`).join("");
  const nota = [r.repetido ? "já existe no painel" : "", r.origem].filter(Boolean).join(" · ");
  return `
    <div class="rev ${precisa ? "pendente" : ""} ${r.incluir ? "" : "fora"}" data-rev="${i}">
      <input type="checkbox" data-linha="${i}" data-campo="incluir" ${r.incluir ? "checked" : ""} aria-label="Incluir ${esc(r.descricao)}">
      <div class="rev-txt">
        <b>${esc(r.descricao)}</b>
        <small>${rotuloData(r.data)}${nota ? " · " + esc(nota) : ""}</small>
      </div>
      <span class="rev-val ${r.tipo === "entrada" ? "mais" : ""}">${r.tipo === "entrada" ? "+" : "−"}${brl(r.valor)}</span>
      <div class="rev-cat">
        <button class="btn btn-txt" type="button" data-linha="${i}" data-acao="virar" style="padding:6px 10px;font-size:12px">${r.tipo === "entrada" ? "é entrada" : "é gasto"}</button>
        ${r.tipo === "gasto"
          ? `<select data-linha="${i}" data-campo="categoria" data-vazio="${r.categoria ? 0 : 1}" aria-label="Categoria de ${esc(r.descricao)}">
               <option value="">— escolher categoria —</option>${opcoes}
             </select>`
          : `<span class="mini">entrada não precisa de categoria</span>`}
      </div>
    </div>`;
}

function blocoAprendido(){
  const n = Object.keys(estado.regras || {}).length;
  if (!n) return "";
  return `<p class="sub" style="margin-top:18px;padding-top:14px;border-top:1px solid var(--linha)">
    O painel já guardou <b>${n}</b> ${n===1?"regra":"regras"} das suas escolhas anteriores — esses lugares ele reconhece sozinho da próxima vez.
    <button class="btn btn-txt" type="button" data-acao="esquecer" style="padding:4px 9px;font-size:12px;margin-left:6px">Esquecer tudo</button>
  </p>`;
}

function atualizarBarraImport(){
  const lote = ui.lote || [];
  const inc = lote.filter(r => r.incluir);
  const pend = inc.filter(r => r.tipo === "gasto" && !r.categoria);
  const c = $("#conta-import"), b = $("#btn-importar");
  if (c) c.innerHTML = inc.length + " pra importar · " +
    (pend.length ? `<b style="color:var(--grave)">${pend.length} esperando categoria</b>` : "tudo pronto");
  if (b){
    b.disabled = pend.length > 0 || !inc.length;
    b.textContent = inc.length ? "Importar " + inc.length : "Nada selecionado";
  }
}

function ligarSolta(){
  const z = $("#solta");
  if (!z) return;
  const parar = ev => { ev.preventDefault(); ev.stopPropagation(); };
  ["dragenter","dragover"].forEach(e => z.addEventListener(e, ev => { parar(ev); z.classList.add("sobre"); }));
  ["dragleave","drop"].forEach(e => z.addEventListener(e, ev => { parar(ev); z.classList.remove("sobre"); }));
  z.addEventListener("drop", ev => { const f = ev.dataTransfer?.files?.[0]; if (f) lerArquivo(f); });
  $("#arq")?.addEventListener("change", ev => { const f = ev.target.files?.[0]; if (f) lerArquivo(f); });
}

async function lerArquivo(f){
  try {
    let t = await f.text();
    /* muito CSV de banco vem em ISO-8859-1; se vier acento quebrado, relê */
    if (/\uFFFD/.test(t)) t = await new Promise((ok, err) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result)); r.onerror = err;
      r.readAsText(f, "ISO-8859-1");
    });
    const cx = $("#txt-extrato"); if (cx) cx.value = t;
    processarExtrato(t);
  } catch { torrada("Não consegui ler esse arquivo."); }
}

function processarExtrato(texto){
  const brutos = analisarExtrato(texto || "");
  if (!brutos || !brutos.length)
    return torrada("Não achei lançamentos aí. Cada linha precisa ter uma data e um valor.");
  const lote = montarLote(brutos);
  if (!lote.length)
    return torrada("Só encontrei transferências e pagamentos de fatura — nada pra importar.");
  ui.lote = lote;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  const p = lote.filter(r => r.incluir && r.tipo === "gasto" && !r.categoria).length;
  torrada(lote.length + " lançamentos lidos" + (p ? " · " + p + " precisam de você" : " · todos reconhecidos"));
}

function vazio(t, p){
  return `<section class="cartao"><div class="vazio"><h3>${esc(t)}</h3><p>${esc(p)}</p>
    <div style="margin-top:18px"><button class="btn btn-forte" type="button" data-acao="novo">+ Novo lançamento</button></div>
  </div></section>`;
}

/* =============================== RENDER ================================= */
const ABAS = [
  { id:"visao",       rot:"Visão geral",  fn:abaVisao },
  { id:"lancamentos", rot:"Lançamentos",  fn:abaLancamentos },
  { id:"fixas",       rot:"Fixas e parcelas", fn:abaFixas },
  { id:"importar",    rot:"Importar",     fn:abaImportar },
  { id:"economizar",  rot:"Economizar",   fn:abaEconomizar },
  { id:"metas",       rot:"Metas",        fn:abaMetas },
];

function render(){
  const periodos = periodosDisponiveis();
  if (ui.periodo !== "tudo" && !periodos.includes(ui.periodo)) ui.periodo = periodos[0];

  const cont = contagemPorMes();
  $("#sel-periodo").innerHTML =
    periodos.map(p => {
      const n = cont.get(p) || 0;
      return `<option value="${p}"${p===ui.periodo?" selected":""}>${rotuloMes(p)}${n ? " · " + n : ""}</option>`;
    }).join("") +
    `<option value="tudo"${ui.periodo==="tudo"?" selected":""}>Todos os meses · ${estado.lancamentos.length}</option>`;

  const n = doPeriodo().length;
  $("#rot-periodo").textContent = ui.periodo === "tudo"
    ? estado.lancamentos.length + " lançamentos no total"
    : n + " lançamento" + (n===1?"":"s") + " neste mês";

  $("#abas").innerHTML = ABAS.map(a => {
    const c = a.id === "lancamentos" ? `<span class="cont">${doPeriodo().length}</span>` : "";
    return `<button role="tab" type="button" aria-selected="${a.id===ui.aba}" data-acao="ir" data-aba="${a.id}">${a.rot}${c}</button>`;
  }).join("");

  $("#conteudo").innerHTML = (ABAS.find(a => a.id === ui.aba) || ABAS[0]).fn();
  /* na revisão do extrato o + atrapalha: ele cobriria o botão Importar */
  document.querySelector(".fab").classList.toggle("oculto", ui.aba === "importar");
  animarEntrada();
  if (ui.aba === "importar"){ ligarSolta(); atualizarBarraImport(); }
  gravarLocal(CHAVE_UI, { aba: ui.aba, periodo: ui.periodo });
}

/* ============================== MOVIMENTO ============================== */
function pulsarRapido(){
  const f = $("#rapido"); if (!f) return;
  f.classList.remove("salvo"); void f.offsetWidth; f.classList.add("salvo");
}
/* só enfeite: entrada escalonada ao trocar de aba/mês, números que contam, selo do Paguei */
const semMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let ultimaVista = "", carimbar = "";
const valoresAntes = new Map();
function lerBrl(t){
  const n = Number(String(t).replace(/[^\d,]/g, "").replace(",", "."));
  return isFinite(n) ? n : 0;
}
function contarValores(novaVista){
  document.querySelectorAll("#conteudo .kpi .val").forEach(el => {
    const chave = el.previousElementSibling?.textContent || "";
    const final = el.textContent, alvo = lerBrl(final);
    const de = novaVista ? 0 : (valoresAntes.get(chave) ?? alvo);
    valoresAntes.set(chave, alvo);
    if (semMovimento() || de === alvo) return;
    const t0 = performance.now(), dur = 800;
    const passo = agora => {
      if (!el.isConnected) return;
      const p = Math.min(1, (agora - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? brl(de + (alvo - de) * e) : final;
      if (p < 1) requestAnimationFrame(passo);
    };
    el.textContent = brl(de);
    requestAnimationFrame(passo);
  });
}
function animarEntrada(){
  const c = $("#conteudo");
  const vista = ui.aba + "|" + ui.periodo, nova = vista !== ultimaVista;
  ultimaVista = vista;
  if (nova && !semMovimento()){
    for (const g of [".kpis > *", ".lista > *", ".meses > *", ".insights > *", ".cats > *", ":scope > *"])
      c.querySelectorAll(g).forEach((el, i) => el.style.setProperty("--i", Math.min(i, 12)));
    c.querySelectorAll(".colunas .col").forEach((el, i) => el.style.setProperty("--k", i));
    c.classList.remove("anima"); void c.offsetWidth; c.classList.add("anima");
    clearTimeout(c._fimAnima);
    c._fimAnima = setTimeout(() => c.classList.remove("anima"), 1800);
  }
  contarValores(nova);
  if (carimbar){
    const [f, m] = carimbar.split("|"); carimbar = "";
    if (semMovimento()) return;
    const b = c.querySelector(`[data-acao="desfazer-fixa"][data-fixa="${CSS.escape(f)}"][data-mes="${CSS.escape(m)}"]`);
    const fx = b?.closest(".fx");
    fx?.querySelector(".selo-sit")?.classList.add("carimbo");
    fx?.classList.add("acabou-de-pagar");
  }
}

/* ============================== FORMULÁRIO ============================== */
function abrirForm(id){
  const l = id ? estado.lancamentos.find(x => x.id === id) : null;
  const tipo = l ? l.tipo : ui.tipoForm;
  const opcoes = estado.categorias.map(c =>
    `<option value="${esc(c)}"${l && l.categoria === c ? " selected" : ""}>${esc(c)}</option>`).join("");

  $("#modal").innerHTML = `
    <div class="veu" data-acao="fechar">
      <form class="folha" id="form-lanc" novalidate>
        <h2>${l ? "Editar lançamento" : "Novo lançamento"}</h2>
        <div class="seletor-tipo">
          <button type="button" data-tipo="gasto"   aria-pressed="${tipo==="gasto"}">Gasto</button>
          <button type="button" data-tipo="entrada" aria-pressed="${tipo==="entrada"}">Entrada</button>
        </div>
        <input type="hidden" name="tipo" value="${tipo}">
        <input type="hidden" name="id" value="${l ? l.id : ""}">
        <div class="duo">
          <div class="campo">
            <label for="f-valor">Valor</label>
            <input id="f-valor" name="valor" type="number" step="0.01" min="0" inputmode="decimal" required
                   placeholder="0,00" value="${l ? l.valor : ""}">
          </div>
          <div class="campo">
            <label for="f-data">Data</label>
            <input id="f-data" name="data" type="date" required value="${l ? l.data : hoje()}">
          </div>
        </div>
        <div class="campo" id="bloco-cat" ${tipo==="entrada"?'hidden':''}>
          <label for="f-cat">Categoria</label>
          <select id="f-cat" name="categoria">${opcoes}<option value="__nova">Outra…</option></select>
        </div>
        <div class="campo oculto" id="bloco-nova">
          <label for="f-nova">Nome da nova categoria</label>
          <input id="f-nova" name="nova" type="text" placeholder="Ex.: Academia" maxlength="30">
        </div>
        <div class="campo">
          <label for="f-desc">${tipo==="entrada"?"De onde veio":"O que foi"}</label>
          <input id="f-desc" name="descricao" type="text" maxlength="60" required
                 placeholder="${tipo==="entrada"?"Salário líquido":"Ex.: lanche, busão, presente"}"
                 value="${l ? esc(l.descricao) : ""}">
        </div>
        <div class="folha-pe">
          <button type="button" class="btn" data-acao="fechar">Cancelar</button>
          <button type="submit" class="btn btn-forte">${l ? "Salvar" : "Lançar"}</button>
        </div>
      </form>
    </div>`;

  const f = $("#form-lanc");
  setTimeout(() => $("#f-valor").focus(), 40);

  f.addEventListener("click", ev => {
    const b = ev.target.closest("[data-tipo]");
    if (!b) return;
    const t = b.dataset.tipo;
    ui.tipoForm = t;
    f.tipo.value = t;
    f.querySelectorAll("[data-tipo]").forEach(x => x.setAttribute("aria-pressed", x.dataset.tipo === t));
    $("#bloco-cat").hidden = t === "entrada";
    if (t === "entrada") $("#bloco-nova").classList.add("oculto");
    f.querySelector('label[for="f-desc"]').textContent = t === "entrada" ? "De onde veio" : "O que foi";
    $("#f-desc").placeholder = t === "entrada" ? "Salário líquido" : "Ex.: lanche, busão, presente";
  });

  $("#f-cat").addEventListener("change", e => {
    $("#bloco-nova").classList.toggle("oculto", e.target.value !== "__nova");
    if (e.target.value === "__nova") $("#f-nova").focus();
  });

  f.addEventListener("submit", ev => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const valor = Number(String(d.valor).replace(",", "."));
    if (!valor || valor <= 0) return torrada("Coloque um valor maior que zero.");
    if (!d.data) return torrada("Escolha a data.");
    if (!String(d.descricao).trim()) return torrada("Escreva o que foi esse lançamento.");

    let categoria = "";
    if (d.tipo === "gasto"){
      categoria = d.categoria === "__nova" ? String(d.nova || "").trim() : d.categoria;
      if (!categoria) return torrada("Dê um nome pra nova categoria.");
      if (!estado.categorias.includes(categoria)) estado.categorias.push(categoria);
    }

    const reg = { tipo:d.tipo, data:d.data, categoria, descricao:String(d.descricao).trim(), valor:Math.round(valor*100)/100, editadoEm: Date.now() };
    if (d.id){
      const i = estado.lancamentos.findIndex(x => x.id === d.id);
      estado.lancamentos[i] = { ...estado.lancamentos[i], ...reg };
    } else {
      estado.lancamentos.push({ id:uid(), ...reg });
      if (ui.periodo !== "tudo" && mesDe(reg.data) !== ui.periodo) ui.periodo = mesDe(reg.data);
    }
    fecharModal();
    mudou();
    torrada(d.id ? "Lançamento atualizado." : (reg.tipo === "entrada" ? "Entrada de " : "Gasto de ") + brl(reg.valor) + " registrado.");
  });
}

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
      estado.fixas[i] = { id: f.id, ...(f.desde ? { desde: f.desde } : {}), ...reg };
    } else estado.fixas.push({ id: uid(), desde: mesDe(hoje()), ...reg });
    fecharModal();
    ui.aba = "fixas";
    mudou();
    torrada(f ? "Atualizado." : "Cadastrado. Já aparece nos meses.");
  });
}

const fecharModal = () => { $("#modal").innerHTML = ""; };

function confirmar(titulo, texto, aoConfirmar){
  $("#modal").innerHTML = `
    <div class="veu" data-acao="fechar">
      <div class="folha" style="max-width:380px" role="alertdialog" aria-modal="true">
        <h2>${esc(titulo)}</h2>
        <p class="sub" style="margin:0">${texto}</p>
        <div class="folha-pe">
          <button type="button" class="btn" data-acao="fechar">Cancelar</button>
          <button type="button" class="btn btn-forte" id="ok-confirmar" style="background:var(--grave);border-color:var(--grave)">Apagar</button>
        </div>
      </div>
    </div>`;
  const ok = $("#ok-confirmar");
  ok.focus();
  ok.addEventListener("click", () => { fecharModal(); aoConfirmar(); });
}

/* =============================== CSV ==================================== */
function montarCSV(){
  const linhas = [["Data","Tipo","Categoria","Descrição","Valor"]];
  for (const l of estado.lancamentos.slice().sort((a,b) => a.data.localeCompare(b.data)))
    linhas.push([l.data, l.tipo, l.categoria || "", l.descricao || "", String(l.valor).replace(".", ",")]);
  /* BOM + ponto-e-vírgula: abre certinho no Excel em português */
  return "﻿" + linhas.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(";")).join("\r\n");
}

async function baixarCSV(){
  const csv = montarCSV();
  /* cópia local do painel: o próprio navegador salva */
  try {
    const url = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "meu-painel-financeiro.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { torrada("Não deu pra baixar por aqui."); }
}

/* ============================== EVENTOS ================================= */
function torrada(msg){
  const t = $("#torrada");
  t.innerHTML = msg;
  t.classList.add("vem");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("vem"), 3400);
}

document.addEventListener("click", ev => {
  const alvo = ev.target.closest("[data-acao]");
  if (!alvo) return;
  const a = alvo.dataset.acao;

  if (a === "fechar" && ev.target !== alvo) return;   /* só o véu / o botão */

  const periodos = periodosDisponiveis();
  switch (a){
    case "novo":     abrirForm(null); break;
    case "editar":   abrirForm(alvo.dataset.id); break;
    case "apagar": {
      const l = estado.lancamentos.find(x => x.id === alvo.dataset.id);
      if (!l) break;
      confirmar("Apagar lançamento?", `<b>${esc(l.descricao)}</b> — ${brl(l.valor)} em ${rotuloData(l.data)}. Isso não volta.`, () => {
        estado.apagados[l.id] = Date.now();
        estado.lancamentos = estado.lancamentos.filter(x => x.id !== l.id);
        mudou(); torrada("Lançamento apagado.");
      });
      break;
    }
    case "ir":       ui.aba = alvo.dataset.aba; render(); window.scrollTo({ top:0, behavior:"smooth" }); break;
    case "fechar":   fecharModal(); break;
    case "csv":      baixarCSV(); break;
    case "sair": {
      nuvem.sair().catch(() => {});
      usuario = null;
      $("#btn-sair").classList.add("oculto");
      pintarEstado();
      torrada("Você saiu. Os dados continuam neste aparelho.");
      break;
    }
    case "rapido-tipo":
      rapidoTipo = rascunho?.tipo === "entrada" ? "gasto" : "entrada";
      lerRapido();
      break;
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
      if (Date.now() - ultimoToqueFixa < 700) break;
      ultimoToqueFixa = Date.now();
      const l = pagar(estado, alvo.dataset.fixa, alvo.dataset.mes, hoje(), uid(), Date.now());
      if (!l) break;
      estado.lancamentos.push(l);
      carimbar = alvo.dataset.fixa + "|" + alvo.dataset.mes;
      mudou(); torrada(esc(l.descricao) + " marcado como pago.");
      break;
    }
    case "desfazer-fixa": {
      if (Date.now() - ultimoToqueFixa < 700) break;
      ultimoToqueFixa = Date.now();
      const l = estado.lancamentos.find(x => x.fixaId === alvo.dataset.fixa && x.fixaMes === alvo.dataset.mes);
      if (!l) break;
      estado.lancamentos = estado.lancamentos.filter(x => x.id !== l.id);
      estado.apagados[l.id] = Date.now();
      mudou(); torrada("Pronto, voltou pra a pagar.");
      break;
    }

    case "ler-extrato": processarExtrato($("#txt-extrato")?.value || ""); break;
    case "cancelar-lote": ui.lote = null; render(); break;
    case "virar": {
      const r = ui.lote?.[+alvo.dataset.linha];
      if (!r) break;
      r.tipo = r.tipo === "gasto" ? "entrada" : "gasto";
      if (r.tipo === "entrada" && r.fixa){ r.fixa = null; r.categoria = ""; r.origem = ""; }
      if (r.tipo === "gasto" && !r.categoria){
        const c = classificar(r.descricao);
        r.categoria = c.categoria; r.origem = c.origem;
      }
      render();
      break;
    }
    case "esquecer": {
      const n = Object.keys(estado.regras || {}).length;
      confirmar("Esquecer o que foi aprendido?", `São <b>${n}</b> ${n===1?"regra":"regras"} de categoria. Seus lançamentos continuam intactos — só o reconhecimento automático volta à estaca zero.`, () => {
        estado.regras = {}; estado.regrasEm = Date.now(); mudou(); torrada("Regras apagadas.");
      });
      break;
    }
    case "importar": {
      const escolhidos = (ui.lote || []).filter(r => r.incluir);
      if (!escolhidos.length){ torrada("Nada selecionado."); break; }
      if (escolhidos.some(r => r.tipo === "gasto" && !r.categoria)){
        torrada("Ainda tem lançamento esperando categoria.");
        break;
      }
      const lembrar = $("#lembrar")?.checked;
      for (const r of escolhidos){
        if (r.tipo === "gasto"){
          if (!estado.categorias.includes(r.categoria)) estado.categorias.push(r.categoria);
          const k = lembrar ? chaveComerciante(r.descricao) : "";
          if (k){ estado.regras[k] = r.categoria; estado.regrasEm = Date.now(); }
        }
        const ehFixa = r.tipo === "gasto" && r.fixa &&
          !estado.lancamentos.some(l => l.fixaId === r.fixa.fixaId && l.fixaMes === r.fixa.fixaMes);
        estado.lancamentos.push({
          id: uid(), tipo: r.tipo, data: r.data,
          categoria: r.tipo === "gasto" ? r.categoria : "",
          descricao: ehFixa ? r.fixa.rotulo : r.descricao,
          valor: r.valor, editadoEm: Date.now(),
          ...(ehFixa ? { fixaId: r.fixa.fixaId, fixaMes: r.fixa.fixaMes } : {}),
        });
      }
      const n = escolhidos.length;
      ui.periodo = mesDe(escolhidos[escolhidos.length - 1].data);
      ui.lote = null;
      ui.aba = "lancamentos";
      mudou();
      torrada(n + (n === 1 ? " lançamento importado" : " lançamentos importados") + ".");
      break;
    }
    case "mes-ant":
    case "mes-prox": {
      if (ui.periodo === "tudo") break;
      const i = periodos.indexOf(ui.periodo);
      const j = a === "mes-ant" ? i + 1 : i - 1;   /* lista vem do mais novo pro mais velho */
      if (periodos[j]) { ui.periodo = periodos[j]; render(); }
      break;
    }
  }
});

$("#estado").addEventListener("click", () => { if (!usuario) mostrarEntrar(); else sincronizar(); });
$("#sel-periodo").addEventListener("change", e => { ui.periodo = e.target.value; render(); });

document.addEventListener("input", ev => {
  const s = ev.target.closest("[data-corte]");
  if (s){
    const nome = s.dataset.corte, p = Number(s.value);
    ui.cortes[nome] = p;
    const cats = porCategoria(gastosDe(doPeriodo())).filter(c => !NAO_CORTAR.includes(c.nome));
    const c = cats.find(x => x.nome === nome);
    const res = document.querySelector(`[data-res="${CSS.escape(nome)}"]`);
    if (res && c) res.textContent = p ? "−" + pctTxt(p) + " · " + brl(c.total*p/100) : "manter";
    const total = cats.reduce((t,x) => t + x.total * ((ui.cortes[x.nome]||0)/100), 0);
    $("#sim-mes").textContent = brl(total);
    $("#sim-ano").textContent = brl(total*12);
    $("#sim-nota").innerHTML = total
      ? "Guardando isso todo mês, em um ano são <b>" + brl(total*12) + "</b>."
      : "Arraste alguma barra pra ver o efeito.";
    return;
  }
});

document.addEventListener("change", ev => {
  /* revisão do extrato: atualiza só a linha tocada, sem redesenhar a lista */
  const campo = ev.target.closest("[data-linha][data-campo]");
  if (campo && ui.lote){
    const r = ui.lote[+campo.dataset.linha];
    if (!r) return;
    if (campo.dataset.campo === "incluir") r.incluir = campo.checked;
    else r.categoria = campo.value;
    const linha = campo.closest(".rev");
    const precisa = r.incluir && r.tipo === "gasto" && !r.categoria;
    linha.classList.toggle("fora", !r.incluir);
    linha.classList.toggle("pendente", precisa);
    const sel = linha.querySelector("select");
    if (sel) sel.dataset.vazio = r.categoria ? "0" : "1";
    atualizarBarraImport();
    return;
  }

  const m = ev.target.closest("[data-meta]");
  if (!m) return;
  const v = Number(m.value);
  if (v > 0) estado.metas[m.dataset.meta] = Math.round(v*100)/100;
  else delete estado.metas[m.dataset.meta];
  estado.metasEm = Date.now();
  mudou();
});

document.addEventListener("keydown", ev => {
  if (ev.key === "Escape") fecharModal();
  if (ev.key === "/" && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName) && !$("#modal").children.length){
    ev.preventDefault(); $("#rapido-txt").focus(); return;
  }
  if (ev.key === "n" && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName) && !$("#modal").children.length){
    ev.preventDefault(); abrirForm(null);
  }
});


/* =============================== INÍCIO ================================= */
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
    if (rapidoCat){ const k = chaveComerciante(r.descricao); if (k){ estado.regras[k] = r.categoria; estado.regrasEm = Date.now(); } }
  }
  estado.lancamentos.push({ id: uid(), tipo: r.tipo, data: r.data, categoria: r.tipo === "gasto" ? r.categoria : "",
                            descricao: r.descricao, valor: r.valor, editadoEm: Date.now() });
  if (ui.periodo !== "tudo" && mesDe(r.data) !== ui.periodo) ui.periodo = mesDe(r.data);
  limparRapido();
  mudou(); pulsarRapido();
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

/* ================================ LOGIN ================================= */
/* volta do link do e-mail: o supabase-js lê o #access_token e limpa o endereço */
const veioDoLink = /access_token=/.test(location.hash);
const erroDoLink = /error_code=([\w-]+)/.exec(location.hash)?.[1] || "";
/* app da tela inicial (iPhone): o link do e-mail abre no Safari, então o app pede
   o link com um código e o Safari devolve a sessão por ele (ver js/pareamento.js) */
const noApp = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
const codigoNaVolta = codigoDaUrl(location.search);
const CHAVE_PAR = "painel.pareamento";
let timerPar = 0;

function esperarSafari(){
  clearTimeout(timerPar);
  const p = lerLocal(CHAVE_PAR);
  if (usuario || !pedidoValido(p, Date.now())) return;
  if (document.visibilityState === "visible" && navigator.onLine){
    nuvem.buscarSessao(p.codigo).then(async u => {
      if (!u) return;
      localStorage.removeItem(CHAVE_PAR);
      await entrou(u);
      torrada("Pronto! Seus dados agora ficam salvos na nuvem.");
    }).catch(() => {});
  }
  timerPar = setTimeout(esperarSafari, 3000);
}

function mostrarProntoNoSafari(){
  $("#modal").innerHTML = `<div class="veu"><div class="folha pronto-app" role="dialog" aria-modal="true" aria-labelledby="pronto-tit">
    <div class="selo" aria-hidden="true">$</div>
    <h2 id="pronto-tit">Pronto, pode voltar pro app</h2>
    <p class="sub">Abra o <b>Sobrou</b> na tela inicial: ele entra sozinho em alguns segundos. Pode fechar esta aba.</p>
  </div></div>`;
}

function mostrarEntrar(){
  $("#entrar").classList.remove("oculto");
  setTimeout(() => $("#e-email").focus(), 40);
}
function esconderEntrar(){ $("#entrar").classList.add("oculto"); }

async function entrou(u){
  usuario = u;
  $("#btn-sair").classList.remove("oculto");
  esconderEntrar();
  pintarEstado();
  await sincronizar();
}

function ligarEntrar(){
  const msg = $("#entrar-msg"), ok = $("#e-ok");
  if (erroDoLink){
    msg.textContent = codigoNaVolta
      ? "Esse link já venceu ou já foi usado. Volte para o app e peça outro por lá."
      : erroDoLink === "otp_expired"
      ? "Esse link já venceu ou já foi usado. Peça outro abaixo."
      : "Não deu pra entrar com esse link. Peça outro abaixo.";
    history.replaceState(null, "", location.pathname + location.search);
  }
  $("#form-entrar").addEventListener("submit", async ev => {
    ev.preventDefault();
    const email = $("#e-email").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)){ msg.textContent = "Confira o e-mail."; return; }
    ok.disabled = true;
    try {
      if (noApp){
        const p = { codigo: novoCodigo(), em: Date.now() };
        gravarLocal(CHAVE_PAR, p);
        await nuvem.pedirCodigo(email, urlDeRetorno(location.origin, p.codigo));
        esperarSafari();
      } else await nuvem.pedirCodigo(email);
      ok.textContent = "Mandar de novo";
      msg.textContent = noApp
        ? "Mandamos um link para " + email + ". Toque nele no e-mail (ele abre no Safari) e depois volte para cá: o app entra sozinho. Pode levar um minuto — olhe também o spam."
        : "Mandamos um link para " + email + ". Abra o e-mail neste aparelho e toque no link: o painel abre já conectado. Pode levar um minuto — olhe também o spam.";
    } catch (e) {
      msg.textContent = e?.status === 429
        ? "Muitos pedidos seguidos. Espere alguns minutos e tente de novo."
        : "Não deu pra mandar o link agora. Confira a internet e tente de novo.";
    } finally { ok.disabled = false; }
  });
  $("#e-depois").addEventListener("click", () => { esconderEntrar(); pintarEstado(); torrada("Tudo bem. Seus dados ficam só neste aparelho até você entrar."); });
}

function iniciar(){
  carregarEstado();
  const salvo = lerLocal(CHAVE_UI) || {};
  ui.aba = ABAS.some(a => a.id === salvo.aba) ? salvo.aba : "visao";
  ui.periodo = salvo.periodo || periodoPadrao();
  render();
  pintarEstado();
  ligarRapido();
  ligarEntrar();
  ligarNuvem();
}

async function ligarNuvem(){
  try { usuario = await nuvem.usuarioAtual(); } catch { usuario = null; }
  if (codigoNaVolta) history.replaceState(null, "", location.pathname + location.hash);
  if (codigoNaVolta && usuario && veioDoLink){
    try {
      await nuvem.entregarSessao(codigoNaVolta);
      usuario = null;
      mostrarProntoNoSafari();
      return;
    } catch { /* não deu pra entregar: segue entrando aqui mesmo */ }
  }
  if (usuario){
    await entrou(usuario);
    if (veioDoLink) torrada("Pronto! Seus dados agora ficam salvos na nuvem.");
  }
  else if (navigator.onLine) mostrarEntrar();
  pintarEstado();
  nuvem.aoMudarSessao(u => {
    if (!u && usuario){ usuario = null; $("#btn-sair").classList.add("oculto"); pintarEstado(); mostrarEntrar(); }
  }).catch(() => {});
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (usuario) sincronizar(); else esperarSafari();
  });
  esperarSafari();
  window.addEventListener("online", async () => {
    falhou = false;
    if (!usuario){ try { usuario = await nuvem.usuarioAtual(); } catch {} }
    if (usuario) await entrou(usuario); else mostrarEntrar();
  });
  window.addEventListener("offline", pintarEstado);
}

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost"))
  navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
else iniciar();
