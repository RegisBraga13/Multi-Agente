"""Gera `src/dados/cid10.json` a partir do CID-10 do DATASUS (CID10CSV.zip, tabela oficial do SUS, versão 2008).

Uso:  python -I scripts/cid10_do_datasus.py CAMINHO/CID10CSV.zip
Fonte: http://www2.datasus.gov.br/cid10/V2008/downloads/CID10CSV.zip (CID-10-CATEGORIAS.CSV e CID-10-SUBCATEGORIAS.CSV).
Só lê os dois CSV de dentro do zip (texto em latin-1, separado por ponto e vírgula); nada do zip é executado.
Saída: lista de pares [código, nome], por exemplo ["L40", "Psoríase"] e ["L40.0", "Psoríase vulgar"].
"""

import json
import sys
import zipfile
from pathlib import Path


def pares(zip_: zipfile.ZipFile, arquivo: str, coluna_codigo: str) -> list[list[str]]:
    linhas = zip_.read(arquivo).decode("latin-1").splitlines()
    cabecalho = linhas[0].split(";")
    i_cod, i_nome = cabecalho.index(coluna_codigo), cabecalho.index("DESCRICAO")
    saida = []
    for linha in linhas[1:]:
        campos = linha.split(";")
        if len(campos) <= i_nome or not campos[i_cod].strip():
            continue
        codigo = campos[i_cod].strip()
        if len(codigo) == 4:  # subcategoria: A000 -> A00.0
            codigo = f"{codigo[:3]}.{codigo[3]}"
        saida.append([codigo, campos[i_nome].strip()])
    return saida


def main(caminho: str) -> None:
    with zipfile.ZipFile(caminho) as z:
        todos = pares(z, "CID-10-CATEGORIAS.CSV", "CAT") + pares(z, "CID-10-SUBCATEGORIAS.CSV", "SUBCAT")
    vistos: set[str] = set()
    unicos = []
    for codigo, nome in todos:  # U99 ("revisão não disponível") vem repetido e não é diagnóstico
        if codigo not in vistos and not codigo.startswith("U99"):
            vistos.add(codigo)
            unicos.append([codigo, nome])
    todos = sorted(unicos, key=lambda p: p[0])
    destino = Path(__file__).resolve().parent.parent / "src" / "dados" / "cid10.json"
    destino.write_text(json.dumps(todos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(todos)} códigos em {destino}")


if __name__ == "__main__":
    main(sys.argv[1])
