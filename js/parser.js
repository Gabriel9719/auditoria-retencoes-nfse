// Leitura da DANFSe em texto com escopo por seção.
//
// O desafio: rótulos como "CNPJ:" e "Município:" aparecem tanto no PRESTADOR quanto no
// TOMADOR. Uma busca global pegaria sempre o primeiro. Por isso o texto é dividido em
// seções (pelos títulos) e cada campo é procurado SOMENTE dentro da seção certa.

export const SECOES = {
  prestador: /^PRESTADOR DO SERVI[CÇ]O/i,
  tomador: /^TOMADOR DO SERVI[CÇ]O/i,
  servico: /^SERVI[CÇ]O PRESTADO/i,
  valores: /^VALORES E TRIBUTA[CÇ][AÃ]O/i,
};

/** Agrupa os itens de texto do pdf.js em linhas (mesma coordenada Y), da esquerda para a direita. */
export function itensParaLinhas(itens, tolerancia = 2) {
  const linhas = [];
  for (const it of itens) {
    if (!it.str || !it.str.trim()) continue;
    const y = it.transform[5], x = it.transform[4];
    let l = linhas.find((ln) => Math.abs(ln.y - y) <= tolerancia);
    if (!l) linhas.push((l = { y, partes: [] }));
    l.partes.push({ x, s: it.str });
  }
  return linhas
    .sort((a, b) => b.y - a.y)
    .map((l) => l.partes.sort((a, b) => a.x - b.x).map((p) => p.s).join(" ").replace(/\s+/g, " ").trim());
}

export function dividirSecoes(linhas) {
  const secoes = { cabecalho: [] };
  let atual = "cabecalho";
  for (const l of linhas) {
    const nome = Object.keys(SECOES).find((k) => SECOES[k].test(l));
    if (nome) { atual = nome; secoes[nome] = []; continue; }
    secoes[atual].push(l);
  }
  return secoes;
}

export function numeroBR(txt) {
  if (txt == null) return null;
  const m = String(txt).match(/-?[\d.]+,\d{2}|-?\d+(?:,\d+)?/);
  return m ? Number(m[0].replace(/\./g, "").replace(",", ".")) : null;
}

function campo(linhas = [], rotulo) {
  const re = new RegExp(rotulo + "\\s*:\\s*(.+?)(?=\\s{2,}|\\s+[A-ZÀ-Ú][\\wÀ-ú /().-]{2,40}:|$)", "i");
  for (const l of linhas) {
    const m = l.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

export function extrairDanfse(linhas) {
  const s = dividirSecoes(linhas);
  const v = (r) => numeroBR(campo(s.valores, r));
  const item = (campo(s.servico, "C[oó]digo de tributa[cç][aã]o nacional") || "").match(/\d{2}\.\d{2}/);
  return {
    numero: campo(s.cabecalho, "N[uú]mero da NFS-e"),
    prestador: {
      cnpj: campo(s.prestador, "CNPJ"),
      nome: campo(s.prestador, "Nome / Raz[aã]o social"),
      municipio: campo(s.prestador, "Munic[ií]pio"),
      simples: /^sim/i.test(campo(s.prestador, "Optante pelo Simples Nacional") || ""),
    },
    tomador: {
      cnpj: campo(s.tomador, "CNPJ"),
      nome: campo(s.tomador, "Nome / Raz[aã]o social"),
      municipio: campo(s.tomador, "Munic[ií]pio"),
    },
    item: item ? item[0] : null,
    descricao: campo(s.servico, "Descri[cç][aã]o do servi[cç]o"),
    localIncidencia: campo(s.servico, "Munic[ií]pio de incid[eê]ncia do ISSQN"),
    valor: v("Valor do servi[cç]o"),
    aliquotaIss: v("Al[ií]quota do ISSQN"),
    informado: {
      iss: v("ISSQN retido"), irrf: v("IRRF retido"), pis: v("PIS retido"), cofins: v("COFINS retido"),
      csll: v("CSLL retido"), inss: v("Reten[cç][aã]o previdenci[aá]ria \\(INSS\\)"),
    },
    valorLiquido: v("Valor l[ií]quido da NFS-e"),
  };
}
