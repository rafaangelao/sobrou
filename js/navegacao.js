/* abas da barra de baixo; "+" é o botão de lançar, não uma tela */
export const BARRA = ["inicio", "extrato", "+", "fixas", "mais"];
export const SUBTELAS = ["economizar", "metas", "importar", "conta"];
const ANTIGAS = { visao: "inicio", lancamentos: "extrato" };

export function abaValida(id){
  const n = ANTIGAS[id] || id;
  return (n !== "+" && BARRA.includes(n)) || SUBTELAS.includes(n) ? n : "inicio";
}
export const posicaoNaBarra = id => SUBTELAS.includes(id) ? 4 : Math.max(0, BARRA.indexOf(id));
