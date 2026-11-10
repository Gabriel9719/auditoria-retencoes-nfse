// Motor de regras de retenção na fonte para NFS-e de serviços tomados por pessoa jurídica.
//
// ATENÇÃO: regras SIMPLIFICADAS e parametrizáveis para fins de portfólio. Cada caso real
// depende da legislação vigente (federal e do município), do enquadramento do prestador e
// de exceções não cobertas aqui. Não substitui a análise da área tributária.

export const ITENS = {
  // item LC 116: irrf = alíquota IRRF; csrf = sujeito a PIS/COFINS/CSLL; inss = cessão de mão de obra/empreitada;
  // localPrestacao = ISS devido no local da prestação (exceções do art. 3º); anexoIV = Simples Nacional Anexo IV
  "07.02": { nome: "Execução de obras de construção civil", irrf: 0, csrf: false, inss: true, localPrestacao: true, anexoIV: true },
  "07.10": { nome: "Limpeza, manutenção e conservação de imóveis", irrf: 0.01, csrf: true, inss: true, localPrestacao: true, anexoIV: true },
  "11.02": { nome: "Vigilância, segurança ou monitoramento", irrf: 0.01, csrf: true, inss: true, localPrestacao: true, anexoIV: true },
  "14.01": { nome: "Manutenção de máquinas e equipamentos", irrf: 0, csrf: true, inss: false, localPrestacao: false, anexoIV: false },
  "17.01": { nome: "Assessoria ou consultoria", irrf: 0.015, csrf: true, inss: false, localPrestacao: false, anexoIV: false },
  "01.01": { nome: "Análise e desenvolvimento de sistemas", irrf: 0.015, csrf: true, inss: false, localPrestacao: false, anexoIV: false },
};

export const ALIQ = { pis: 0.0065, cofins: 0.03, csll: 0.01, inss: 0.11, issMin: 0.02, issMax: 0.05 };
export const DISPENSA = 10; // retenções federais iguais ou inferiores a R$ 10,00 não são retidas

// Tabela municipal FICTÍCIA de alíquotas de ISS por item (a extensão planejada no projeto real:
// conferir a alíquota ANTES do pagamento, e não só no mês seguinte).
export const TABELA_ISS = {
  "Porto Claro/GO": { "07.10": 0.03, "11.02": 0.03, "07.02": 0.025 },
  "Campo Azul/GO": { "07.10": 0.025, "11.02": 0.04, "07.02": 0.03 },
  "Vila Serena/GO": { "07.10": 0.02, "11.02": 0.035, "07.02": 0.02 },
};

// Reforma tributária: em 2026 a CBS (0,9%) e o IBS (0,1%) são apenas destacados (ano de teste).
export const REFORMA_2026 = { cbs: 0.009, ibs: 0.001 };

const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export function auditar(nf, opcoes = {}) {
  const item = ITENS[nf.item];
  if (!item) throw new Error(`Item ${nf.item} não parametrizado`);
  const simples = !!nf.prestador.simples;
  const v = nf.valor;
  const esperado = {}, motivos = {};

  // IRRF
  let irrf = simples ? 0 : r2(v * item.irrf);
  motivos.irrf = simples ? "Prestador do Simples Nacional: sem retenção de IRRF."
    : item.irrf ? `${(item.irrf * 100).toLocaleString("pt-BR")}% sobre o valor do serviço (item ${nf.item}).` : "Serviço fora das listas de retenção de IRRF.";
  if (irrf > 0 && irrf <= DISPENSA) { motivos.irrf += " Valor ≤ R$ 10,00: dispensado."; irrf = 0; }
  esperado.irrf = irrf;

  // PIS/COFINS/CSLL (CSRF)
  const sujeitoCsrf = item.csrf && !simples;
  let pis = sujeitoCsrf ? r2(v * ALIQ.pis) : 0, cofins = sujeitoCsrf ? r2(v * ALIQ.cofins) : 0, csll = sujeitoCsrf ? r2(v * ALIQ.csll) : 0;
  motivos.csrf = simples ? "Prestador do Simples Nacional: sem retenção de PIS/COFINS/CSLL."
    : item.csrf ? "4,65% (PIS 0,65% + COFINS 3% + CSLL 1%)." : "Serviço fora da lista de retenção de PIS/COFINS/CSLL.";
  if (sujeitoCsrf && pis + cofins + csll <= DISPENSA) { pis = cofins = csll = 0; motivos.csrf += " Total ≤ R$ 10,00: dispensado."; }
  Object.assign(esperado, { pis, cofins, csll });

  // INSS (cessão de mão de obra / empreitada)
  const sujeitoInss = item.inss && (!simples || item.anexoIV);
  esperado.inss = sujeitoInss ? r2(v * ALIQ.inss) : 0;
  motivos.inss = !item.inss ? "Serviço sem retenção previdenciária."
    : simples && !item.anexoIV ? "Simples Nacional fora do Anexo IV: sem retenção."
    : "11% sobre o valor (cessão de mão de obra/empreitada)" + (simples ? "; Simples Anexo IV também sofre retenção." : ".");

  // ISS
  const munIncid = item.localPrestacao ? nf.localIncidencia : nf.prestador.municipio;
  const tabela = TABELA_ISS[munIncid]?.[nf.item];
  const aliqInf = (nf.aliquotaIss ?? 0) / 100;
  let aliqEsperada = tabela ?? aliqInf;
  if (simples) aliqEsperada = aliqInf; // no Simples, a alíquota vem da faixa do Anexo informada na nota
  const retemIss = (item.localPrestacao && munIncid !== nf.prestador.municipio)
    || (opcoes.tomadorSubstituto && nf.tomador.municipio === munIncid && nf.prestador.municipio !== munIncid);
  esperado.iss = retemIss ? r2(v * aliqEsperada) : 0;
  motivos.iss = `ISS devido a ${munIncid}` + (item.localPrestacao ? " (local da prestação, art. 3º LC 116)" : " (estabelecimento do prestador)") +
    (retemIss ? "; o tomador deve reter." : "; sem retenção pelo tomador.") +
    (tabela != null && !simples ? ` Alíquota municipal do item: ${(tabela * 100).toFixed(2).replace(".", ",")}%.` : "");

  const alertas = [];
  if (aliqInf && (aliqInf < ALIQ.issMin || aliqInf > ALIQ.issMax)) alertas.push("Alíquota de ISS fora do intervalo legal de 2% a 5%.");
  if (!simples && tabela != null && Math.abs(aliqInf - tabela) > 1e-9)
    alertas.push(`Alíquota de ISS informada (${(aliqInf * 100).toFixed(2).replace(".", ",")}%) difere da tabela de ${munIncid} (${(tabela * 100).toFixed(2).replace(".", ",")}%).`);

  const linhas = ["iss", "irrf", "pis", "cofins", "csll", "inss"].map((k) => {
    const inf = nf.informado?.[k] ?? 0;
    return { tributo: k.toUpperCase(), esperado: esperado[k], informado: inf, diferenca: r2(inf - esperado[k]),
             ok: Math.abs(inf - esperado[k]) < 0.01, motivo: motivos[k] ?? motivos.csrf };
  });
  const totalRet = r2(linhas.reduce((s, l) => s + l.esperado, 0));
  return {
    linhas, alertas,
    valorLiquidoEsperado: r2(v - totalRet),
    conforme: linhas.every((l) => l.ok) && alertas.length === 0,
    reforma2026: { cbs: r2(v * REFORMA_2026.cbs), ibs: r2(v * REFORMA_2026.ibs) },
  };
}
