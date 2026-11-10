import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extrairDanfse, itensParaLinhas, numeroBR } from "../js/parser.js";
import { auditar } from "../js/regras.js";

async function lerPdf(caminho) {
  const pdf = await getDocument({ data: new Uint8Array(readFileSync(caminho)), verbosity: 0 }).promise;
  const pg = await pdf.getPage(1);
  return extrairDanfse(itensParaLinhas((await pg.getTextContent()).items));
}

test("números no formato brasileiro", () => {
  assert.equal(numeroBR("R$ 1.234,56"), 1234.56);
  assert.equal(numeroBR("3,00%"), 3);
});

test("parser separa prestador e tomador apesar dos rótulos repetidos", async () => {
  const nf = await lerPdf("exemplos/01_limpeza_correta.pdf");
  assert.equal(nf.prestador.cnpj, "45.723.174/0001-10");
  assert.equal(nf.tomador.cnpj, "11.222.333/0001-81");
  assert.equal(nf.prestador.municipio, "Vila Serena/GO");
  assert.equal(nf.tomador.municipio, "Porto Claro/GO");
  assert.equal(nf.item, "07.10");
  assert.equal(nf.valor, 10000);
  assert.equal(nf.informado.inss, 1100);
});

test("nota de limpeza correta fica conforme", async () => {
  const r = auditar(await lerPdf("exemplos/01_limpeza_correta.pdf"));
  assert.ok(r.conforme, JSON.stringify(r.linhas.filter((l) => !l.ok)));
  assert.equal(r.valorLiquidoEsperado, 10000 - 300 - 100 - 65 - 300 - 100 - 1100);
});

test("vigilância: ISS devido no local da prestação, não retido e com alíquota abaixo da tabela", async () => {
  const r = auditar(await lerPdf("exemplos/02_vigilancia_aliquota_errada.pdf"));
  const iss = r.linhas.find((l) => l.tributo === "ISS");
  assert.equal(iss.esperado, 1000);
  assert.equal(iss.ok, false);
  assert.ok(r.alertas.some((a) => a.includes("difere da tabela")));
});

test("Simples Nacional: IRRF retido indevidamente", async () => {
  const r = auditar(await lerPdf("exemplos/03_consultoria_simples_nacional.pdf"));
  const irrf = r.linhas.find((l) => l.tributo === "IRRF");
  assert.equal(irrf.esperado, 0);
  assert.equal(irrf.diferenca, 72);
  assert.ok(r.linhas.filter((l) => l.tributo !== "IRRF").every((l) => l.ok));
});

test("dispensa de retenção federal até R$ 10,00", () => {
  const nf = { item: "17.01", valor: 500, aliquotaIss: 2, localIncidencia: "X", informado: {},
               prestador: { simples: false, municipio: "X" }, tomador: { municipio: "Y" } };
  const r = auditar(nf);
  assert.equal(r.linhas.find((l) => l.tributo === "IRRF").esperado, 0);   // 1,5% de 500 = 7,50
  assert.equal(r.linhas.find((l) => l.tributo === "COFINS").esperado, 15); // CSRF total 23,25 > 10
});
