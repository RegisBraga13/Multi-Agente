from fastapi import APIRouter

rotas = APIRouter()


@rotas.get("/saude")
def saude() -> dict[str, bool]:
    return {"ok": True}
