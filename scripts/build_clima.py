#!/usr/bin/env python3
"""Gera assets/clima.json — snapshot do clima das alas para uso offline.

O site busca o Open-Meteo ao vivo. Quando a API não responde (rede bloqueada,
Open-Meteo fora do ar, etc.), o app.js cai para o último snapshot salvo no
localStorage e, se não houver, para este arquivo versionado no repositório.

Uso:
    python scripts/build_clima.py

Só usa a biblioteca padrão — roda no GitHub Actions sem instalar nada.
"""

import json
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

FUSO = timezone(timedelta(hours=-3))
SAIDA = Path(__file__).resolve().parent.parent / "assets" / "clima.json"

# Mesma lista e mesmos rótulos usados no app.js.
ALAS = [
    ("Bezerros", -8.23, -35.80, "Ala dos Papangus"),
    ("Recife", -8.05, -34.88, "Ala do Frevo"),
    ("Olinda", -8.01, -34.86, "Ala dos Bonecos"),
]

URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude=" + ",".join(str(a[1]) for a in ALAS)
    + "&longitude=" + ",".join(str(a[2]) for a in ALAS)
    + "&current=temperature_2m,precipitation,weather_code"
    "&timezone=America/Recife"
)


def humor(t, chuva, code):
    """Mesma lógica do app.js — mantém as duas pontas iguais."""
    if code >= 95:
        return "⛈️", "Trovoada! Bloco recolhido, frevo só dentro de casa."
    if chuva > 0 or 51 <= code <= 67 or 80 <= code <= 82:
        return "🌧️", "Choveu! Abre a sombrinha que o frevo não para."
    if t >= 32:
        return "🥵", "Quente demais! Bloco na sombra com água de coco."
    if t <= 22:
        return "🧣", "Fresquinho! Papangu de casaco hoje."
    return "😎", "Tempo bom, bloco liberado pra sair."


def main():
    agora = datetime.now(FUSO)
    try:
        with urllib.request.urlopen(URL, timeout=20) as resp:
            dados = json.load(resp)
    except (urllib.error.URLError, TimeoutError, ValueError) as erro:
        print(f"falha ao consultar o Open-Meteo: {erro}")
        print("mantendo o assets/clima.json anterior")
        return 1

    if isinstance(dados, dict):
        dados = [dados]

    alas = []
    for (nome, _lat, _lon, ala), d in zip(ALAS, dados):
        atual = d.get("current", {})
        temp = atual.get("temperature_2m", 0)
        chuva = atual.get("precipitation", 0)
        code = atual.get("weather_code", 0)
        emoji, frase = humor(temp, chuva, code)
        alas.append(
            {
                "nome": nome,
                "ala": ala,
                "temp": temp,
                "chuva": chuva,
                "code": code,
                "emoji": emoji,
                "frase": frase,
            }
        )

    if not alas:
        print("resposta sem dados; mantendo o snapshot anterior")
        return 1

    saida = {
        "gerado_em": agora.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "atualizado": agora.strftime("%d/%m %H:%M"),
        "fuso": "America/Recife",
        "alas": alas,
    }

    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"assets/clima.json atualizado ({saida['atualizado']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
