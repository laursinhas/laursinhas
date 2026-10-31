import json, urllib.request
from datetime import datetime, timezone, timedelta

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
agora = datetime.now(timezone(timedelta(hours=-3))).strftime("%d/%m/%Y %H:%M")
bloco = "\n".join(linhas) + f"\n\n🔥 Ala mais quente agora: {quente[0][3]}\n\n_Atualizado em {agora} (Recife)_"

t = open("README.template.md", encoding="utf-8").read()
open("README.md", "w", encoding="utf-8").write(t.replace("{{CLIMA}}", bloco))
