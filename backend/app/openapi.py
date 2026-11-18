"""Exporta o contrato OpenAPI do servidor (base dos tipos TypeScript do frontend, gerados no marco 3).

python -m app.openapi   → grava backend/openapi.json
"""

import json
from pathlib import Path
from typing import Any
from uuid import UUID

from app.aplicacao import Dependencias, criar_app
from app.identidade import MedicoLocal
from app.pacientes.repositorio import RepositorioPacientesMemoria


def esquema_openapi() -> dict[str, Any]:
    app = criar_app(Dependencias(identidade=MedicoLocal(UUID(int=0)), pacientes=RepositorioPacientesMemoria()))
    return app.openapi()


if __name__ == "__main__":
    destino = Path(__file__).parent.parent / "openapi.json"
    destino.write_text(json.dumps(esquema_openapi(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"gravado {destino}")
