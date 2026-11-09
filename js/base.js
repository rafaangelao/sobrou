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
