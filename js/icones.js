/* ícones e cores das categorias e da interface */
import { CATS_BASE } from "./base.js";

export const corDe = nome => (CATS_BASE.find(c => c.nome === nome) || { cor:"var(--c0)" }).cor;
