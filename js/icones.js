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
