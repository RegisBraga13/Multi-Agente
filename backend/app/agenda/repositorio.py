"""Agenda atrás de interface (Postgres em produção; memória nos testes de API).

Datas e horas que entram e saem são as do consultório; o banco guarda o instante.
"""

from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Protocol
from uuid import UUID, uuid4

from app.contratos.agenda import FormularioRecebido, Horario, NovoPedido, Pedido, Retorno, RetornoMarcado
from app.fuso import FUSO_CONSULTORIO, no_consultorio


class HorarioOcupado(Exception):
    """Outro pedido ou retorno já ficou com este horário."""


class PedidoNaoEncontrado(Exception):
    """Pedido de outro médico ou que não existe."""


@dataclass(frozen=True)
class FotoGuardada:
    tipo: str
    conteudo: bytes


def instante(data: date, inicio: str) -> datetime:
    return datetime.combine(data, time.fromisoformat(inicio), tzinfo=FUSO_CONSULTORIO)


def horario(momento: datetime) -> Horario:
    local = no_consultorio(momento)
    return Horario(data=local.date(), inicio=local.strftime("%H:%M"))


class RepositorioAgenda(Protocol):
    def medico_da_pagina(self, slug: str) -> UUID | None: ...

    def slug_do_medico(self, medico_id: UUID) -> str | None: ...

    def ocupados(self, medico_id: UUID, de: date, ate: date) -> list[Horario]: ...

    def criar_pedido(self, medico_id: UUID, novo: NovoPedido, token: str) -> Pedido: ...

    def pedidos(self, medico_id: UUID, de: date, ate: date) -> list[Pedido]: ...

    def pedido_do_token(self, token: str) -> tuple[UUID, Pedido] | None:
        """Busca sem saber o médico (o link do formulário só tem o token); devolve o dono e o pedido."""
        ...

    def pedido(self, medico_id: UUID, pedido_id: UUID) -> Pedido: ...

    def marcar_link_enviado(self, medico_id: UUID, pedido_id: UUID) -> Pedido: ...

    def confirmar(self, medico_id: UUID, pedido_id: UUID) -> Pedido:
        """Pedido novo vira confirmado (tocar de novo não muda nada)."""
        ...

    def cancelar(self, medico_id: UUID, pedido_id: UUID) -> Pedido:
        """Avisar: o médico não pode atender; o pedido sai da agenda e o horário volta a ficar livre."""
        ...

    def gravar_formulario(
        self, medico_id: UUID, pedido_id: UUID, recebido: FormularioRecebido, fotos: dict[str, FotoGuardada]
    ) -> Pedido: ...

    def foto(self, medico_id: UUID, pedido_id: UUID, pergunta: str) -> FotoGuardada | None: ...

    def criar_retorno(
        self, medico_id: UUID, paciente_id: UUID, paciente_nome: str, consulta_origem_id: UUID, marcado: RetornoMarcado
    ) -> Retorno:
        """Cartão "Retorno" na agenda. HorarioOcupado se o instante já tem pedido não cancelado ou retorno de outra
        consulta. Marcar de novo na mesma consulta substitui o retorno anterior."""
        ...

    def retornos(self, medico_id: UUID, de: date, ate: date) -> list[Retorno]:
        """Ordenados por data e hora."""
        ...

    def desfazer_retorno(self, medico_id: UUID, consulta_origem_id: UUID) -> None:
        """Remove o retorno que nasceu desta consulta (não faz nada se não houver)."""
        ...


class RepositorioAgendaMemoria:
    def __init__(self, paginas: dict[str, UUID] | None = None) -> None:
        self._paginas = dict(paginas or {})
        self._pedidos: dict[UUID, tuple[UUID, Pedido]] = {}
        self._fotos: dict[tuple[UUID, str], FotoGuardada] = {}
        self._retornos: dict[UUID, tuple[UUID, Retorno]] = {}

    def medico_da_pagina(self, slug: str) -> UUID | None:
        return self._paginas.get(slug)

    def slug_do_medico(self, medico_id: UUID) -> str | None:
        return next((s for s, m in self._paginas.items() if m == medico_id), None)

    def _do_medico(self, medico_id: UUID) -> list[Pedido]:
        return [p for dono, p in self._pedidos.values() if dono == medico_id]

    def ocupados(self, medico_id: UUID, de: date, ate: date) -> list[Horario]:
        pedidos = [
            Horario(data=p.data, inicio=p.inicio)
            for p in self._do_medico(medico_id)
            if p.status != "cancelado" and de <= p.data <= ate
        ]
        retornos = [Horario(data=r.data, inicio=r.inicio) for r in self.retornos(medico_id, de, ate)]
        return pedidos + retornos

    def criar_pedido(self, medico_id: UUID, novo: NovoPedido, token: str) -> Pedido:
        if any(h.inicio == novo.inicio for h in self.ocupados(medico_id, novo.data, novo.data)):
            raise HorarioOcupado
        pedido = Pedido(
            **novo.model_dump(),
            id=uuid4(),
            token_formulario=token,
            situacao_ficha="sem-ficha",
            status="novo",
            criado_em=datetime.now(FUSO_CONSULTORIO),
        )
        self._pedidos[pedido.id] = (medico_id, pedido)
        return pedido

    def pedidos(self, medico_id: UUID, de: date, ate: date) -> list[Pedido]:
        lista = [p for p in self._do_medico(medico_id) if de <= p.data <= ate]
        return sorted(lista, key=lambda p: (p.data, p.inicio))

    def pedido_do_token(self, token: str) -> tuple[UUID, Pedido] | None:
        return next(((dono, p) for dono, p in self._pedidos.values() if p.token_formulario == token), None)

    def _buscar(self, medico_id: UUID, pedido_id: UUID) -> Pedido:
        registro = self._pedidos.get(pedido_id)
        if registro is None or registro[0] != medico_id:
            raise PedidoNaoEncontrado
        return registro[1]

    def pedido(self, medico_id: UUID, pedido_id: UUID) -> Pedido:
        return self._buscar(medico_id, pedido_id)

    def marcar_link_enviado(self, medico_id: UUID, pedido_id: UUID) -> Pedido:
        pedido = self._buscar(medico_id, pedido_id)
        if pedido.situacao_ficha == "sem-ficha":
            pedido = pedido.model_copy(update={"situacao_ficha": "link-enviado"})
            self._pedidos[pedido_id] = (medico_id, pedido)
        return pedido

    def confirmar(self, medico_id: UUID, pedido_id: UUID) -> Pedido:
        pedido = self._buscar(medico_id, pedido_id)
        if pedido.status == "novo":
            pedido = pedido.model_copy(update={"status": "confirmado"})
            self._pedidos[pedido_id] = (medico_id, pedido)
        return pedido

    def cancelar(self, medico_id: UUID, pedido_id: UUID) -> Pedido:
        pedido = self._buscar(medico_id, pedido_id).model_copy(update={"status": "cancelado"})
        self._pedidos[pedido_id] = (medico_id, pedido)
        return pedido

    def gravar_formulario(
        self, medico_id: UUID, pedido_id: UUID, recebido: FormularioRecebido, fotos: dict[str, FotoGuardada]
    ) -> Pedido:
        pedido = self._buscar(medico_id, pedido_id).model_copy(
            update={"situacao_ficha": "pronta", "formulario": recebido}
        )
        self._pedidos[pedido_id] = (medico_id, pedido)
        for chave in [k for k in self._fotos if k[0] == pedido_id]:
            del self._fotos[chave]
        for pergunta, foto in fotos.items():
            self._fotos[(pedido_id, pergunta)] = foto
        return pedido

    def foto(self, medico_id: UUID, pedido_id: UUID, pergunta: str) -> FotoGuardada | None:
        self._buscar(medico_id, pedido_id)
        return self._fotos.get((pedido_id, pergunta))

    def criar_retorno(
        self, medico_id: UUID, paciente_id: UUID, paciente_nome: str, consulta_origem_id: UUID, marcado: RetornoMarcado
    ) -> Retorno:
        # marcar de novo na mesma consulta substitui o retorno anterior (o horário antigo não conta como tomado)
        de_outros = [
            r
            for r in self.retornos(medico_id, marcado.data, marcado.data)
            if r.consulta_origem_id != consulta_origem_id
        ]
        pedidos = [p for p in self._do_medico(medico_id) if p.status != "cancelado" and p.data == marcado.data]
        if any(x.inicio == marcado.inicio for x in (*de_outros, *pedidos)):
            raise HorarioOcupado
        for id_, (dono, r) in list(self._retornos.items()):
            if dono == medico_id and r.consulta_origem_id == consulta_origem_id:
                del self._retornos[id_]
        retorno = Retorno(
            id=uuid4(),
            paciente_id=paciente_id,
            paciente_nome=paciente_nome,
            consulta_origem_id=consulta_origem_id,
            **marcado.model_dump(),
        )
        self._retornos[retorno.id] = (medico_id, retorno)
        return retorno

    def retornos(self, medico_id: UUID, de: date, ate: date) -> list[Retorno]:
        lista = [r for dono, r in self._retornos.values() if dono == medico_id and de <= r.data <= ate]
        return sorted(lista, key=lambda r: (r.data, r.inicio))

    def desfazer_retorno(self, medico_id: UUID, consulta_origem_id: UUID) -> None:
        for id_, (dono, r) in list(self._retornos.items()):
            if dono == medico_id and r.consulta_origem_id == consulta_origem_id:
                del self._retornos[id_]
