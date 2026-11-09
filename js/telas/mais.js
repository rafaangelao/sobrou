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
