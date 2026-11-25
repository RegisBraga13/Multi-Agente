from uuid import UUID

from app.identidade import MedicoLocal

LOCAL = UUID(int=1)
REUMATO = UUID(int=2)


def test_sem_pagina_e_o_medico_local():
    assert MedicoLocal(LOCAL).medico_atual() == LOCAL
    assert MedicoLocal(LOCAL, paginas={"paulo-mendes": REUMATO}.get).medico_atual(None) == LOCAL


def test_pagina_conhecida_troca_para_o_medico_dela_e_desconhecida_nao():
    m = MedicoLocal(LOCAL, paginas={"paulo-mendes": REUMATO}.get)
    assert m.medico_atual("paulo-mendes") == REUMATO
    assert m.medico_atual("nao-existe") == LOCAL
