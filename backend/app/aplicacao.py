"""Monta o servidor a partir das dependências (os testes passam versões em memória)."""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.agenda.repositorio import HorarioOcupado, PedidoNaoEncontrado, RetornoNaoEncontrado
from app.agenda.servico import ErroAgenda, FormularioNaoEncontrado, PaginaNaoEncontrada
from app.api import agenda, consultas, especialidades, pacientes, prontuario, saude
from app.api.dependencias import Dependencias
from app.consulta.repositorio import ConsultaAberta, ConsultaFinalizada, ConsultaNaoEncontrada
from app.consulta.servico import ErroEtapa, SinalDesconhecido
from app.motores.chamada import ErroPrivacidade

__all__ = ["Dependencias", "criar_app"]

# erro de domínio → resposta HTTP (a mensagem é para o médico)
_ERROS: dict[type[Exception], tuple[int, str | None]] = {
    ConsultaNaoEncontrada: (status.HTTP_404_NOT_FOUND, "consulta não encontrada"),
    ConsultaFinalizada: (status.HTTP_409_CONFLICT, "consulta finalizada; use adendo"),
    ConsultaAberta: (status.HTTP_409_CONFLICT, "adendo só em consulta finalizada"),
    SinalDesconhecido: (status.HTTP_422_UNPROCESSABLE_CONTENT, "Sinal de alerta desconhecido nesta especialidade"),
    ErroEtapa: (status.HTTP_409_CONFLICT, None),  # None = a própria mensagem do erro
    ErroPrivacidade: (status.HTTP_422_UNPROCESSABLE_CONTENT, "dado de identidade no pedido à IA; nada foi enviado"),
    # agenda: as mensagens aparecem para o paciente
    HorarioOcupado: (status.HTTP_409_CONFLICT, "Esse horário acabou de ser ocupado. Escolha outro."),
    PaginaNaoEncontrada: (status.HTTP_404_NOT_FOUND, "página não encontrada"),
    FormularioNaoEncontrado: (status.HTTP_404_NOT_FOUND, "Este link de formulário não existe."),
    PedidoNaoEncontrado: (status.HTTP_404_NOT_FOUND, "pedido não encontrado"),
    RetornoNaoEncontrado: (status.HTTP_404_NOT_FOUND, "retorno não encontrado"),
    ErroAgenda: (status.HTTP_422_UNPROCESSABLE_CONTENT, None),
}


def _tratador(codigo: int, mensagem: str | None):  # type: ignore[no-untyped-def]
    async def tratar(_: Request, erro: Exception) -> JSONResponse:
        return JSONResponse({"detail": mensagem or str(erro)}, status_code=codigo)

    return tratar


def criar_app(dep: Dependencias) -> FastAPI:
    app = FastAPI(title="especIAlista — servidor da consulta", version="0.3.0")
    app.state.dependencias = dep
    for erro, (codigo, mensagem) in _ERROS.items():
        app.add_exception_handler(erro, _tratador(codigo, mensagem))
    app.include_router(saude.rotas)
    app.include_router(pacientes.rotas)
    app.include_router(consultas.rotas)
    app.include_router(especialidades.rotas)
    app.include_router(prontuario.rotas)
    app.include_router(agenda.publico)
    app.include_router(agenda.medico_rotas)
    return app
