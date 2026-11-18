"""Linha de comando dos casos de teste.

python -m casos_de_teste validar          confere todos os casos (sai 1 se houver erro)
python -m casos_de_teste folha [--abrir]  gera a folha de revisão (revisao.html) e, com --abrir, abre no navegador
"""

import argparse
import sys
import webbrowser

from app.especialidades.pacote import carregar_sinais
from casos_de_teste import carregar
from casos_de_teste.folha import contagem, montar_folha


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # acentos no terminal do Windows
    parser = argparse.ArgumentParser(prog="python -m casos_de_teste")
    comandos = parser.add_subparsers(dest="comando", required=True)
    comandos.add_parser("validar", help="confere todos os casos")
    folha = comandos.add_parser("folha", help="gera a folha de revisão")
    folha.add_argument("--abrir", action="store_true", help="abre a folha no navegador")
    args = parser.parse_args(argv)

    pasta = carregar.PASTA_CASOS
    sinais = carregar_sinais("dermatologia")
    relatorio = carregar.validar_pasta(pasta, sinais)
    if not relatorio.ok:
        print("\n".join(relatorio.erros))
        return 1
    print(contagem(relatorio.casos))
    if args.comando == "folha":
        destino = pasta / "revisao.html"
        destino.write_text(montar_folha(relatorio.casos, sinais), encoding="utf-8")
        print(f"folha gravada em {destino}")
        if args.abrir:
            webbrowser.open(destino.resolve().as_uri())
    return 0


if __name__ == "__main__":
    sys.exit(main())
