"""Folha de revisão: os casos em linguagem de médico, para o autor ler e aprovar no navegador.

HTML autocontido (sem script nem recurso externo). Todo texto vindo dos casos é escapado.
"""
from html import escape

from app.especialidades.pacote import SinalAlerta
from casos_de_teste.formato import Caso, Diagnostico, Paciente

SECOES = {"qp": "QP", "hda": "HDA", "ap": "AP", "hp": "HP", "hf": "HF", "exame_fisico": "Exame físico", "exames": "Exames"}
CAMPOS_EXAME = {"morfologia": "Morfologia", "localizacao": "Localização", "extensao": "Extensão", "gravidade": "Gravidade estimada", "achados": "Achados associados"}
SITUACAO = {"pendente": "Pendente", "aprovado": "Aprovado", "corrigir": "Corrigir"}

CSS = """
:root { --papel:#f7f4ee; --tinta:#1f2a2e; --suave:#5d6b70; --linha:#ddd6c8; --cartao:#fffdf9;
  --petroleo:#1f5f6b; --pendente:#b7791f; --aprovado:#2f7d4f; --corrigir:#b42318; }
* { box-sizing:border-box; }
body { margin:0; background:var(--papel); color:var(--tinta);
  font:15px/1.55 Inter, "Segoe UI", system-ui, sans-serif; }
main { max-width:860px; margin:0 auto; padding:32px 16px 64px; }
h1, h2 { font-family:"Source Serif 4", Georgia, serif; font-weight:600; }
h1 { font-size:28px; margin:0 0 4px; color:var(--petroleo); }
h2 { font-size:20px; margin:0; }
h3 { font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:var(--suave); margin:18px 0 6px; }
.contagem { color:var(--suave); margin:0 0 28px; }
section { background:var(--cartao); border:1px solid var(--linha); border-radius:10px; padding:20px 22px; margin:0 0 20px; }
.topo { display:flex; justify-content:space-between; gap:12px; align-items:baseline; }
.selo { font-size:12px; font-weight:600; color:#fff; border-radius:999px; padding:2px 10px; white-space:nowrap; }
.pendente { background:var(--pendente); } .aprovado { background:var(--aprovado); } .corrigir { background:var(--corrigir); }
.nota { color:var(--corrigir); }
p { margin:4px 0; }
ul { margin:4px 0; padding-left:20px; }
.conversa p { margin:2px 0; }
.quem { font-weight:600; color:var(--petroleo); }
.esperado { border-left:3px solid var(--petroleo); padding-left:12px; }
table { border-collapse:collapse; width:100%; }
td { border-top:1px solid var(--linha); padding:6px 8px 6px 0; vertical-align:top; }
td:first-child { width:40%; font-weight:600; }
"""


def _e(x: object) -> str:
    return escape(str(x))


def _plural(n: int, singular: str, plural: str) -> str:
    return f"{n} {singular if n == 1 else plural}"


def contagem(casos: list[Caso]) -> str:
    """'20 casos válidos — 0 aprovados, 20 pendentes, 0 a corrigir'"""
    por = {s: sum(c.revisao.situacao == s for c in casos) for s in SITUACAO}
    return (f"{_plural(len(casos), 'caso válido', 'casos válidos')} — {_plural(por['aprovado'], 'aprovado', 'aprovados')}, "
            f"{_plural(por['pendente'], 'pendente', 'pendentes')}, {por['corrigir']} a corrigir")


def _paciente(p: Paciente) -> str:
    partes = [f"Paciente, {p.idade} anos", "feminino" if p.sexo == "F" else "masculino", p.estado_civil, p.profissao]
    linhas = [f"<p>{_e(', '.join(x for x in partes if x))}</p>"]
    if p.em_uso:
        linhas.append(f"<p>Em uso: {_e('; '.join(p.em_uso))}</p>")
    if p.antecedentes:
        linhas.append(f"<p>Antecedentes: {_e('; '.join(p.antecedentes))}</p>")
    if p.alergias:
        linhas.append(f"<p>Alergias: {_e('; '.join(f'{a.substancia} ({a.reacao})' for a in p.alergias))}</p>")
    return "".join(linhas)


def _diag(d: Diagnostico) -> str:
    return f"{d.nome} ({d.cid})"


def _lista(itens: list[str]) -> str:
    return ", ".join(itens) if itens else "nenhum"


def _caso(c: Caso, textos_sinais: dict[str, str]) -> str:
    ent, esp = c.entrada, c.esperado
    situacao = c.revisao.situacao
    nota = f'<p class="nota">Correção pedida: {_e(c.revisao.nota)}</p>' if c.revisao.nota else ""
    conversa = "".join(f'<p><span class="quem">{_e(f.quem)}:</span> {_e(f.texto)}</p>' for f in ent.falas)
    sinais = "".join(f"<li>{_e(textos_sinais.get(s.sinal, s.sinal))} — {'Sim' if s.resposta == 'v' else 'Não'}</li>" for s in ent.sinais)
    exame = "".join(f"<li>{rotulo}: {_e(getattr(ent.exame, campo) or 'não examinado')}</li>" for campo, rotulo in CAMPOS_EXAME.items())
    complementares = "".join(
        f"<li>{_e(x.exame)} ({x.data:%d/%m/%Y}): {_e('; '.join(f'{i.nome} {i.valor or chr(8212)}' for i in x.itens))}</li>"
        for x in ent.complementares
    )
    conduta = esp.conduta
    protocolo = f"Conduta pela tabela: {_e(conduta.protocolo)}" if conduta.protocolo else "Sem protocolo na tabela (a IA sugere, marcado como sugestão)"
    historia = "".join(
        f"<li>{SECOES[s]} — {_e(', '.join(chr(34) + t + chr(34) for t in termos))}</li>" for s, termos in esp.historia.deve_conter.items()
    )
    esperado = [
        f"<p>Entre os 3 diagnósticos: {_e(_diag(esp.diagnosticos.principal))}</p>",
        f"<p>Não pode perder: {_e(_diag(esp.diagnosticos.nao_pode_perder))}</p>" if esp.diagnosticos.nao_pode_perder else "",
        f"<p>Sinais de alerta que a IA tem de pegar: {_e(_lista([textos_sinais.get(s, s) for s in esp.sinais.disparados]))}</p>",
        f"<p>{protocolo}</p>",
        f"<p>Tem de aparecer na conduta: {_e(', '.join(conduta.deve_incluir))}</p>" if conduta.deve_incluir else "",
        f"<p>Não pode aparecer na conduta: {_e(', '.join(conduta.proibidos))}</p>" if conduta.proibidos else "",
        f"<p>A história tem de conter:</p><ul>{historia}</ul>",
        f"<p>Devem ficar vazias (nada inventado): {_e(', '.join(SECOES[s] for s in esp.historia.vazias))}</p>" if esp.historia.vazias else "",
    ]
    return f"""<section id="{_e(c.id)}">
<div class="topo"><h2>{_e(c.titulo)}</h2><span class="selo {situacao}">{SITUACAO[situacao]}</span></div>
<p class="contagem">{_e(c.id)}</p>{nota}
<p><strong>O que este caso testa:</strong> {_e(c.objetivo)}</p>
<h3>Paciente</h3>{_paciente(ent.paciente)}
<h3>Conversa</h3><div class="conversa">{conversa}</div>
{f'<h3>Sinais de alerta perguntados</h3><ul>{sinais}</ul>' if sinais else ''}
<h3>Exame físico</h3><ul>{exame}</ul>
{f'<h3>Exames complementares</h3><ul>{complementares}</ul>' if complementares else ''}
<h3>Resposta esperada</h3><div class="esperado">{''.join(esperado)}</div>
</section>"""


def montar_folha(casos: list[Caso], sinais: list[SinalAlerta]) -> str:
    textos_sinais = {s.id: s.texto for s in sinais}
    tabela = "".join(f"<tr><td>{_e(s.texto)}</td><td>{_e(s.porque)}</td></tr>" for s in sinais)
    blocos = "\n".join(_caso(c, textos_sinais) for c in casos)
    return f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Casos de teste</title><style>{CSS}</style></head>
<body><main>
<h1>Casos de teste — Dermatologia</h1>
<p class="contagem">{_e(contagem(casos))}</p>
<section><h2>Sinais de alerta (lista fixa)</h2><p class="contagem">Sempre checados; não dependem só da IA.</p>
<table>{tabela}</table></section>
{blocos}
</main></body></html>
"""
