/* escolher o mês: folha do próprio app no lugar da lista do navegador */
import { MESES, rotuloMes } from "../formato.js";
import { iconeUI } from "../icones.js";

export const rotuloPeriodo = p => p === "tudo" ? "Todos os meses" : rotuloMes(p);

export function folhaPeriodo({ periodos, atual, contagem, total, hoje }){
  const mesHoje = hoje.slice(0, 7);
  const anos = [...new Set(periodos.map(p => p.slice(0, 4)))].sort().reverse();
  const qtd = n => n ? `<small>${n}</small>` : "";
  const blocos = anos.map(a => {
    const meses = periodos.filter(p => p.startsWith(a + "-")).sort();
    return `<h3 class="per-ano">${a}</h3><div class="per-grade">${meses.map(p =>
      `<button type="button" class="per-mes" data-acao="escolher-periodo" data-p="${p}" aria-pressed="${p === atual}"${p === mesHoje ? " data-hoje" : ""}${contagem.get(p) ? " data-tem" : ""} aria-label="${rotuloMes(p)}">${MESES[+p.slice(5) - 1].slice(0, 3)}${qtd(contagem.get(p))}</button>`).join("")}</div>`;
  }).join("");
  return `<div class="folha folha-periodo" role="dialog" aria-modal="true" aria-labelledby="per-tit">
    <div class="alca" aria-hidden="true"></div>
    <div class="det-topo" data-puxa><h2 id="per-tit">Escolher o mês</h2>
      <button type="button" class="icone" data-acao="fechar" aria-label="Fechar">${iconeUI("fechar", 20)}</button></div>
    ${blocos}
    <button type="button" class="per-tudo" data-acao="escolher-periodo" data-p="tudo" aria-pressed="${atual === "tudo"}">Todos os meses${qtd(total)}</button>
  </div>`;
}
