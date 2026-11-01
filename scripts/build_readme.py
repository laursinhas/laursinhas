import json, math, textwrap, urllib.request
from pathlib import Path
from datetime import datetime, timezone, timedelta, date
from xml.sax.saxutils import escape as esc

CIDADES = [
    ("Bezerros", -8.23, -35.80, "Ala dos Papangus"),
    ("Recife", -8.05, -34.88, "Ala do Frevo"),
    ("Olinda", -8.01, -34.86, "Ala dos Bonecos"),
]

url = ("https://api.open-meteo.com/v1/forecast"
       "?latitude=" + ",".join(str(c[1]) for c in CIDADES)
       + "&longitude=" + ",".join(str(c[2]) for c in CIDADES)
       + "&current=temperature_2m,precipitation,weather_code"
       "&timezone=America/Recife")
dados = json.load(urllib.request.urlopen(url))

def humor(t, chuva, code):
    if code >= 95:
        return "⛈️", "Trovoada! Bloco recolhido, frevo só dentro de casa."
    if chuva > 0 or 51 <= code <= 67 or 80 <= code <= 82:
        return "🌧️", "Choveu! Abre a sombrinha que o frevo não para."
    if t >= 32:
        return "🥵", "Quente demais! Bloco na sombra com água de coco."
    if t <= 22:
        return "🧣", "Fresquinho! Papangu de casaco hoje."
    return "😎", "Tempo bom, bloco liberado pra sair."

fuso = timezone(timedelta(hours=-3))
agora = datetime.now(fuso)
hoje = agora.date()
hora = agora.strftime("%d/%m/%Y %H:%M")

clima = []
for c, d in zip(CIDADES, dados):
    cur = d["current"]
    e, frase = humor(cur["temperature_2m"], cur["precipitation"], cur["weather_code"])
    clima.append({"nome": c[0], "ala": c[3], "temp": cur["temperature_2m"], "emoji": e, "frase": frase})
quente = max(clima, key=lambda x: x["temp"])["nome"]

# ---------- CARNAVAL (automático) ----------
def pascoa(ano):
    a = ano % 19
    b, c = divmod(ano, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mes, dia = divmod(h + l - 7 * m + 114, 31)
    return date(ano, mes, dia + 1)

def sabado_carnaval(ano):
    return pascoa(ano) - timedelta(days=50)

CARNAVAL = sabado_carnaval(hoje.year)
if hoje > CARNAVAL + timedelta(days=3):
    CARNAVAL = sabado_carnaval(hoje.year + 1)
dias = (CARNAVAL - hoje).days
periodo = f"{CARNAVAL:%d/%m} a {CARNAVAL + timedelta(days=3):%d/%m/%Y}"

if dias > 1:
    grande, linha = str(dias), "dias pro bloco sair"
elif dias == 1:
    grande, linha = "1", "dia: é amanhã!"
elif dias == 0:
    grande, linha = "HOJE", "o bloco está na rua!"
else:
    grande, linha = "🥁", "o Carnaval não para!"

# ---------- ANIVERSÁRIOS ----------
ANIVERSARIOS = [
    ("Olinda", 3, 12, 1535),
    ("Recife", 3, 12, 1537),
    ("Bezerros", 5, 18, None),  # ano da emancipação: preencher quando confirmar
]

itens = []
card_aniv = {}
for nome, mes, dia, ano in ANIVERSARIOS:
    prox = date(hoje.year, mes, dia)
    if prox < hoje:
        prox = date(hoje.year + 1, mes, dia)
    faltam = (prox - hoje).days
    idade = f" ({prox.year - ano} anos)" if ano else ""
    if faltam == 0:
        texto = f"- 🎂 {nome}: parabéns, é hoje!{idade}"
        card_aniv[nome] = "🎂 parabéns, é hoje!"
    else:
        texto = f"- 🎂 {nome}: faltam {faltam} dias, em {prox:%d/%m}{idade}"
        card_aniv[nome] = f"🎂 {prox:%d/%m} · faltam {faltam} dias"
    itens.append((faltam, texto))
aniversarios = "\n".join(txt for _, txt in sorted(itens))

# ---------- PAINEL SVG (cores da bandeira de PE) ----------
AZUL, AZUL_ESC = "#2F6BD9", "#14284B"
AMARELO, VERMELHO, VERDE = "#F6C21B", "#D62839", "#2E9E48"
W, H = 900, 520
cx, base = 450, 215

def estrela(x, y, r, ri):
    pts = []
    for k in range(10):
        ang = math.pi / 2 + k * math.pi / 5
        rr = r if k % 2 == 0 else ri
        pts.append(f"{x + rr * math.cos(ang):.1f},{y - rr * math.sin(ang):.1f}")
    return " ".join(pts)

svg = [
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="Segoe UI, Helvetica, Arial, sans-serif">',
    f'<defs><clipPath id="c"><rect width="{W}" height="{H}" rx="22"/></clipPath></defs>',
    '<g clip-path="url(#c)">',
    f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>',
    f'<rect width="{W}" height="{base}" fill="{AZUL}"/>',
]

# arco-íris + sol + estrela, como na bandeira
for r, cor in ((118, VERMELHO), (100, AMARELO), (82, VERDE)):
    svg.append(f'<path d="M {cx-r} {base} A {r} {r} 0 0 1 {cx+r} {base}" fill="none" stroke="{cor}" stroke-width="16"/>')
svg.append(f'<path d="M {cx-62} {base} A 62 62 0 0 1 {cx+62} {base} Z" fill="{AMARELO}"/>')
svg.append(f'<polygon points="{estrela(cx, 36, 17, 7)}" fill="{AMARELO}"/>')

# contagem do Carnaval
tam = 84 if len(grande) <= 3 else 56
svg.append(f'<text x="48" y="118" font-size="{tam}" font-weight="800" fill="#FFFFFF">{esc(grande)}</text>')
for j, ln in enumerate(textwrap.wrap(linha, 22)[:2]):
    svg.append(f'<text x="50" y="{152 + j * 22}" font-size="19" font-weight="600" fill="#FFFFFF">{esc(ln)}</text>')
svg.append(f'<text x="852" y="92" font-size="13" font-weight="700" fill="{AMARELO}" text-anchor="end" letter-spacing="2">CARNAVAL</text>')
svg.append(f'<text x="852" y="124" font-size="24" font-weight="700" fill="#FFFFFF" text-anchor="end">{esc(periodo)}</text>')

# cards das alas
for i, c in enumerate(clima):
    x, y = 40 + i * 285, 240
    eh_quente = c["nome"] == quente
    borda = AMARELO if eh_quente else "#BBD3F5"
    svg.append(f'<rect x="{x}" y="{y}" width="250" height="225" rx="16" fill="#F3F8FF" stroke="{borda}" stroke-width="{4 if eh_quente else 1.5}"/>')
    if eh_quente:
        svg.append(f'<text x="{x+24}" y="{y+30}" font-size="12" font-weight="700" fill="{VERMELHO}">🔥 ALA MAIS QUENTE</text>')
    svg.append(f'<text x="{x+24}" y="{y+78}" font-size="36">{c["emoji"]}</text>')
    svg.append(f'<text x="{x+226}" y="{y+78}" font-size="38" font-weight="800" fill="{AZUL}" text-anchor="end">{c["temp"]:.0f}°C</text>')
    svg.append(f'<text x="{x+24}" y="{y+118}" font-size="22" font-weight="700" fill="{AZUL_ESC}">{esc(c["nome"])}</text>')
    svg.append(f'<text x="{x+24}" y="{y+140}" font-size="14" fill="#5B6B88">{esc(c["ala"])}</text>')
    for j, ln in enumerate(textwrap.wrap(c["frase"], 27)[:3]):
        svg.append(f'<text x="{x+24}" y="{y+168 + j * 18}" font-size="14" fill="#2B3A55">{esc(ln)}</text>')
    svg.append(f'<text x="{x+24}" y="{y+212}" font-size="14" font-weight="700" fill="{VERMELHO}">{esc(card_aniv[c["nome"]])}</text>')

# rodapé com a cruz vermelha da bandeira
svg.append(f'<rect x="47" y="486" width="6" height="22" fill="{VERMELHO}"/>')
svg.append(f'<rect x="40" y="494" width="20" height="6" fill="{VERMELHO}"/>')
svg.append(f'<text x="72" y="502" font-size="12" fill="#5B6B88">Atualizado em {hora} · a cada 30 minutos</text>')
svg.append("</g></svg>")

Path("assets").mkdir(exist_ok=True)
Path("assets/painel.svg").write_text("\n".join(svg), encoding="utf-8")

# ---------- README ----------
t = open("README.template.md", encoding="utf-8").read()
open("README.md", "w", encoding="utf-8").write(t.replace("{{ANIVERSARIOS}}", aniversarios))
