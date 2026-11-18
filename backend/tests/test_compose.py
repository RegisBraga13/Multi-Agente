from pathlib import Path

import yaml


def test_portas_do_compose_so_no_computador_local():
    compose = yaml.safe_load(Path("docker-compose.yml").read_text(encoding="utf-8"))
    portas = [p for servico in compose["services"].values() for p in servico.get("ports", [])]
    assert portas and all(p.startswith("127.0.0.1:") for p in portas)
