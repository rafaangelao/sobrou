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
