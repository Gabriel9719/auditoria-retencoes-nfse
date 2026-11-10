"""Gera DANFSe FICTÍCIAS em PDF para testar o app (exemplos/*.pdf).

Os documentos imitam apenas a ESTRUTURA de seções de um documento auxiliar de NFS-e
(prestador, tomador, serviço, valores) — com rótulos repetidos entre seções, que é
justamente o desafio do parser. Empresas, CNPJs, municípios e valores são inventados.
"""
from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

TOMADOR = ("11.222.333/0001-81", "COOPERATIVA DE CREDITO ALFA LTDA", "Porto Claro/GO")

EXEMPLOS = [
    # nome, prestador(cnpj, nome, municipio, simples), item, descricao, local, valor, aliq, retencoes informadas
    ("01_limpeza_correta", ("45.723.174/0001-10", "LIMPA BEM SERVICOS LTDA", "Vila Serena/GO", "Não"),
     "07.10.01", "Limpeza e conservação de imóveis", "Porto Claro/GO", 10000.00, 3.00,
     {"iss": 300.00, "irrf": 100.00, "pis": 65.00, "cofins": 300.00, "csll": 100.00, "inss": 1100.00}),
    ("02_vigilancia_aliquota_errada", ("27.865.757/0001-02", "PROTEGE VIGILANCIA LTDA", "Porto Claro/GO", "Não"),
     "11.02.01", "Vigilância e segurança patrimonial", "Campo Azul/GO", 25000.00, 2.00,
     {"iss": 0.00, "irrf": 250.00, "pis": 162.50, "cofins": 750.00, "csll": 250.00, "inss": 2750.00}),
    ("03_consultoria_simples_nacional", ("12.345.678/0001-95", "CONSULTORIA AGIL ME", "Vila Serena/GO", "Sim"),
     "17.01.01", "Assessoria e consultoria empresarial", "Porto Claro/GO", 4800.00, 2.79,
     {"iss": 0.00, "irrf": 72.00, "pis": 0.00, "cofins": 0.00, "csll": 0.00, "inss": 0.00}),
]


def brl(v: float) -> str:
    return "R$ " + f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def gerar(pasta: Path) -> None:
    pasta.mkdir(parents=True, exist_ok=True)
    for n, (nome, prest, item, desc, local, valor, aliq, ret) in enumerate(EXEMPLOS, start=1):
        c = canvas.Canvas(str(pasta / f"{nome}.pdf"), pagesize=A4)
        c.setAuthor("Gabriel Antônio Ribeiro"); c.setCreator("Gabriel Antônio Ribeiro")
        c.setTitle("DANFSe fictícia para testes")
        w, h = A4
        y = h - 18 * mm

        def t(txt, x=15 * mm, bold=False, size=9, dy=5.2):
            nonlocal y
            c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
            c.drawString(x, y, txt)
            y -= dy * mm

        t("DOCUMENTO AUXILIAR DA NFS-e - EXEMPLO FICTÍCIO PARA TESTES", bold=True, size=11, dy=6)
        t(f"Número da NFS-e: {2026000 + n}    Competência: 10/2026    Data de emissão: 0{n}/10/2026", dy=8)
        for titulo, (cnpj, razao, mun), extra in (
            ("PRESTADOR DO SERVIÇO", prest[:3], f"Optante pelo Simples Nacional: {prest[3]}"),
            ("TOMADOR DO SERVIÇO", TOMADOR, None),
        ):
            t(titulo, bold=True, size=10)
            t(f"CNPJ: {cnpj}")
            t(f"Nome / Razão social: {razao}")
            t(f"Município: {mun}")
            if extra:
                t(extra)
            y -= 3 * mm
        t("SERVIÇO PRESTADO", bold=True, size=10)
        t(f"Código de tributação nacional: {item}")
        t(f"Descrição do serviço: {desc}")
        t(f"Município de incidência do ISSQN: {local}", dy=8)
        t("VALORES E TRIBUTAÇÃO", bold=True, size=10)
        total_ret = sum(ret.values())
        for rot, v in (("Valor do serviço", brl(valor)), ("Alíquota do ISSQN", f"{aliq:.2f}%".replace(".", ",")),
                       ("ISSQN retido", brl(ret["iss"])), ("IRRF retido", brl(ret["irrf"])),
                       ("PIS retido", brl(ret["pis"])), ("COFINS retido", brl(ret["cofins"])),
                       ("CSLL retido", brl(ret["csll"])), ("Retenção previdenciária (INSS)", brl(ret["inss"])),
                       ("Valor líquido da NFS-e", brl(valor - total_ret))):
            t(f"{rot}: {v}")
        c.setFont("Helvetica-Oblique", 7)
        c.drawString(15 * mm, 12 * mm, "Documento sem validade fiscal - gerado para demonstração de software.")
        c.save()
    print(f"{len(EXEMPLOS)} DANFSe fictícias em {pasta}")


if __name__ == "__main__":
    gerar(Path(__file__).resolve().parents[1] / "exemplos")
