# ---------- CLIMA (automático) ----------
import json, urllib.request
from datetime import datetime, timezone, timedelta, date

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

linhas = ["| | Ala | Temp | Humor do bloco |", "|---|---|---|---|"]
for c, d in zip(CIDADES, dados):
    cur = d["current"]
    e, frase = humor(cur["temperature_2m"], cur["precipitation"], cur["weather_code"])
    linhas.append(f"| {e} | {c[0]} ({c[3]}) | {cur['temperature_2m']:.0f}°C | {frase} |")

quente = max(zip(CIDADES, dados), key=lambda x: x[1]["current"]["temperature_2m"])
fuso = timezone(timedelta(hours=-3))
agora = datetime.now(fuso).strftime("%d/%m/%Y %H:%M")
bloco = "\n".join(linhas) + f"\n\n🔥 Ala mais quente agora: {quente[0][3]}\n\n_Atualizado em {agora} (Recife)_"

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

hoje = datetime.now(fuso).date()
CARNAVAL = sabado_carnaval(hoje.year)
if hoje > CARNAVAL + timedelta(days=3):
    CARNAVAL = sabado_carnaval(hoje.year + 1)
dias = (CARNAVAL - hoje).days
periodo = f"{CARNAVAL:%d/%m} a {CARNAVAL + timedelta(days=3):%d/%m/%Y}"

if dias > 1:
    carnaval = f"🎭 Faltam {dias} dias pro bloco sair! ({periodo})"
elif dias == 1:
    carnaval = f"🎭 É amanhã! Separa a sombrinha! ({periodo})"
elif dias == 0:
    carnaval = f"🎉 É HOJE! O bloco está na rua! ({periodo})"
else:
    carnaval = f"🥁 O bloco está na rua, o Carnaval não para! ({periodo})"

t = open("README.template.md", encoding="utf-8").read()
saida = t.replace("{{CLIMA}}", bloco).replace("{{CARNAVAL}}", carnaval)
open("README.md", "w", encoding="utf-8").write(saida)
