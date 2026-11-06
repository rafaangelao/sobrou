/* No iPhone o app da tela inicial não enxerga a sessão do Safari, e o link do
   e-mail sempre abre no Safari. Então o app pede o link com um código secreto
   (?par=...), o Safari entrega a sessão para esse código e o app a busca. */

/* quanto tempo o app fica esperando o Safari (o servidor guarda a sessão entregue só por 20 min) */
export const VALIDADE_PEDIDO = 2 * 60 * 60 * 1000;
const FORMATO = /^[0-9a-f]{48}$/;

export function novoCodigo(){
  const b = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
}

export const urlDeRetorno = (origem, codigo) => origem + "/?par=" + codigo;

export function codigoDaUrl(search){
  const c = new URLSearchParams(search).get("par") || "";
  return FORMATO.test(c) ? c : "";
}

export const pedidoValido = (p, agora) =>
  !!p && FORMATO.test(p.codigo || "") && agora - p.em >= 0 && agora - p.em < VALIDADE_PEDIDO;
