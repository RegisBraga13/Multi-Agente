import sys, re

src, dst = sys.argv[1], sys.argv[2]
html = open(src, encoding="utf-8").read()

def troca(velho, novo, conta=None):
    global html
    n = html.count(velho)
    if n == 0 or (conta is not None and n != conta):
        sys.exit(f"padrão encontrado {n}x: {velho[:70]!r}")
    html = html.replace(velho, novo)

# 1. tipografia: Source Serif 4 (títulos e marca) + Inter (texto)
troca("https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap",
      "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400..800&family=Inter:wght@400..700&display=swap", 1)
troca("--display:'Archivo', 'Arial Narrow', system-ui, sans-serif;", "--display:'Source Serif 4', Georgia, serif;", 1)
troca("--body:'Archivo', system-ui, -apple-system, 'Segoe UI', sans-serif;", "--body:'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;", 1)
html = html.replace("font-stretch:125%;", "")
troca("h1,h2,h3{font-family:var(--display);letter-spacing:-.04em;", "h1,h2,h3{font-family:var(--display);letter-spacing:-.015em;", 1)


# 2. marca: letras nas cores do logo (variáveis, para o tema noturno clarear), "IA" na cor da tinta
LOGO = ["#8E3B5C", "#A85A2E", "#B07A1F", "#3F7352", "#0E7C7B", "#2F5D9E", "#5B4FA0", "#8A4F9E", "#4F6B7A", "#B0485F"]
letras = list("espec") + ["IA"] + list("lista")
k = 0; partes = []
for l in letras:
    if l == "IA":
        partes.append('<b class="ia">IA</b>')
    else:
        k += 1; partes.append(f'<span style="color:var(--l{k})">{l}</span>')
html, n = re.subn(r'(class="marca"[^>]*>)espec<b>IA</b>lista', lambda m: m.group(1) + "".join(partes), html)
if n != 3: sys.exit(f"marca encontrada {n}x")

troca('endocrinolog<b style="color:var(--pet)">IA</b>', 'endocrinolog<b style="color:var(--l3)">IA</b>', 1)

dia = ";".join(f"--l{i+1}:{c}" for i, c in enumerate(LOGO))
noite = ";".join(f"--l{i+1}:color-mix(in oklab,{c} 55%,#fff)" for i, c in enumerate(LOGO))
espectro = ",".join(f"var(--l{i+1}) {i*10}% {(i+1)*10}%" for i in range(10))
INDIGO_NOITE = ("--bg:#17152A;--alt:#1C1A33;--surface:#232040;--soft:#2A2748;--ink:#EEEAF6;--muted:#B4AECB;--line:#37335A;"
                "--pet:#A49DEB;--onpet:#17152A;--onpes:#17152A;--trac:#5A5578;"
                "--dark:#110F20;--ondark:#EEEAF6;--darkmuted:#A39DC0;--darkline:#2C2950;--darkcard:#1E1B38;--papel:none;color-scheme:dark;" + noite)

estilo = f"""
/* ---- especIAlista: modo claro Petróleo, modo noturno Índigo, + cores do logo ---- */
:root{{--ink:#13302F;--muted:#55665F;--line:#E0DDD5;--soft:#EEECE5;--trac:#AEB3A8;
  --pet:#174A48;--onpet:#F9F8F5;--dark:#13302F;--ondark:#ECF3F0;--darkmuted:#A3BAB3;--darkline:#24504D;--darkcard:#1B3E3C;
  --pes:color-mix(in oklab,var(--esp) 42%,#F9F8F5);--onpes:var(--ink);--ter:var(--esp);--onter:#FFFFFF;{dia}}}
@media (prefers-color-scheme: dark){{ :root:not([data-theme="light"]){{{INDIGO_NOITE}}} }}
:root[data-theme="dark"]{{{INDIGO_NOITE}}}
@media (prefers-color-scheme: dark){{ :root:not([data-theme="light"]) .trilho button{{opacity:.75}} }}
:root[data-theme="dark"] .trilho button{{opacity:.75}}
.trilho button:hover,.trilho button.sel{{opacity:1}}
:root{{--espectro:linear-gradient(90deg,{espectro})}}
.marca b.ia{{color:var(--ink)!important}}
.topo::after{{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--espectro);opacity:0;transition:opacity .3s}}
.topo.rolou::after{{opacity:.8}}
.escuro,.faixa-num{{border-top:3px solid;border-image:var(--espectro) 1;
  background-image:radial-gradient(55% 90% at 0% 0%,#5B4FA01f,transparent 70%),radial-gradient(55% 90% at 100% 100%,#0E7C7B1f,transparent 70%)}}
.faixa-num div:nth-child(1){{border-left-color:var(--l2)}}.faixa-num div:nth-child(2){{border-left-color:var(--l4)}}
.faixa-num div:nth-child(3){{border-left-color:var(--l6)}}.faixa-num div:nth-child(4){{border-left-color:var(--l1)}}
/* landing = cores do logo; tudo que mostra o módulo por dentro = cor da especialidade */
.janela,.demo,.documento,.ia-painel{{--ter:var(--esp);--pes:color-mix(in oklab,var(--esp) 42%,#F9F8F5)}}
/* rodapé no papel, para o "IA" aparecer */
.rodape{{background:var(--bg);background-image:var(--papel);background-size:512px 512px;color:var(--ink);border-top:3px solid;border-image:var(--espectro) 1}}
.rodape p,.rodape .rot,.copy{{color:var(--muted)}}
.copy{{border-top-color:var(--line)}}
.rodape nav a:hover{{color:var(--esp)}}
"""
troca("</style>", estilo + "</style>", 1)

# modo claro por padrão; o botão ◐ continua alternando para o noturno
html = html.replace("<style>", "<script>document.documentElement.dataset.theme='light'</script>\n<style>", 1)

script = """
<script>
(function(){
  // cada seção da landing recebe uma cor do logo, na ordem das letras
  [...document.querySelectorAll('section.secao, section.faixa-num, section.escuro')].forEach((s,i)=>{
    const c='var(--l'+(i%10+1)+')';
    s.style.setProperty('--ter', c);
    s.style.setProperty('--pes', 'color-mix(in oklab,'+c+' 55%,#F9F8F5)');
  });
})();
</script>
"""
if "</body>" in html:
    troca("</body>", script + "</body>", 1)
else:
    html = html.rstrip() + "\n" + script

open(dst, "w", encoding="utf-8").write(html)
print("ok", len(html))
