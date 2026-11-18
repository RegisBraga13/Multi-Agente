"""Linha de comando dos casos de teste.

python -m casos_de_teste validar          confere todos os casos (sai 1 se houver erro)
python -m casos_de_teste folha [--abrir]  gera a folha de revisão (revisao.html) e, com --abrir, abre no navegador
python -m casos_de_teste medir [--caso ID]... [--falso] [--pasta DIR]
                                          roda os motores nos casos aprovados e grava o relatório (custa dinheiro
                                          sem --falso: usa a chave da Anthropic em ANTHROPIC_API_KEY)
python -m casos_de_teste calibrar [--falso]
                                          mede a IA avaliadora nos pares de calibração
"""

import argparse
import os
import sys
import webbrowser
from datetime import datetime
from pathlib import Path

from app.especialidades.condutas import carregar_protocolos
from app.especialidades.pacote import carregar_sinais
from app.provedores.ia import ProvedorIA
from app.provedores.ia_demonstracao import ProvedorDemonstracao
from app.provedores.relogio import RelogioSistema
from casos_de_teste import carregar
from casos_de_teste.avaliadora import calibrar
from casos_de_teste.folha import contagem, montar_folha
from casos_de_teste.medir import medir, texto_do_resumo

PASTA_RESULTADOS = Path(__file__).parent / "resultados"


def _provedor(falso: bool) -> ProvedorIA | None:
    if falso:
        return ProvedorDemonstracao()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("falta a chave da Anthropic (ANTHROPIC_API_KEY)")
        return None
    from app.provedores.ia_anthropic import criar_provedor_anthropic

    return criar_provedor_anthropic()


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # acentos no terminal do Windows
    parser = argparse.ArgumentParser(prog="python -m casos_de_teste")
    comandos = parser.add_subparsers(dest="comando", required=True)
    comandos.add_parser("validar", help="confere todos os casos")
    folha = comandos.add_parser("folha", help="gera a folha de revisão")
    folha.add_argument("--abrir", action="store_true", help="abre a folha no navegador")
    m = comandos.add_parser("medir", help="roda os motores nos casos aprovados")
    m.add_argument("--caso", action="append", default=[], help="só este caso (pode repetir)")
    m.add_argument("--falso", action="store_true", help="provedor de demonstração, sem gastar")
    m.add_argument("--pasta", type=Path, default=PASTA_RESULTADOS, help="onde gravar o relatório")
    c = comandos.add_parser("calibrar", help="mede a IA avaliadora")
    c.add_argument("--falso", action="store_true", help="provedor de demonstração, sem gastar")
    args = parser.parse_args(argv)

    if args.comando == "calibrar":
        provedor = _provedor(args.falso)
        if provedor is None:
            return 1
        acertos, total, discordancias = calibrar(provedor, RelogioSistema())
        print(f"avaliadora: {acertos}/{total} pares como o esperado")
        print("\n".join(f"  {d}" for d in discordancias))
        return 0

    pasta = carregar.PASTA_CASOS
    sinais = carregar_sinais("dermatologia")
    relatorio = carregar.validar_pasta(pasta, sinais)
    if not relatorio.ok:
        print("\n".join(relatorio.erros))
        return 1

    if args.comando == "medir":
        casos = relatorio.casos
        if args.caso:
            faltam = sorted(set(args.caso) - {x.id for x in casos})
            if faltam:
                print(f"caso não encontrado: {', '.join(faltam)}")
                return 1
            casos = [x for x in casos if x.id in args.caso]
        provedor = _provedor(args.falso)
        if provedor is None:
            return 1
        resultado = medir(
            provedor, casos, sinais, carregar_protocolos("dermatologia"), RelogioSistema(), falso=args.falso
        )
        args.pasta.mkdir(parents=True, exist_ok=True)
        sufixo = "-demonstracao" if args.falso else ""
        destino = args.pasta / f"{datetime.now():%Y-%m-%d-%H%M%S}{sufixo}.json"
        destino.write_text(resultado.model_dump_json(by_alias=True, indent=2), encoding="utf-8")
        print(texto_do_resumo(resultado))
        print(f"relatório gravado em {destino}")
        return 0

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
