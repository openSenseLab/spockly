"""SPOCKLY: zeigt Daten in der App an – als Tabelle, auf der Karte oder als Zeitverlauf.

Die Blöcke "zeige …" werden zu diesen Funktionen. Sie schicken die Tabelle an
die App, die sie dann zeichnet; an den Daten ändern sie nichts.
"""
import json

import pandas as pd

import spockly_app  # von der App bereitgestellt: nimmt die Daten entgegen

# So viele Zeilen gehen höchstens an die App (die Daten selbst bleiben ganz).
HOECHSTENS = 50_000


def _paket(daten):
    """Die Tabelle als Text (JSON), den die App lesen kann."""
    if not isinstance(daten, pd.DataFrame):
        raise TypeError(
            "Das ist noch keine Tabelle. Mach zuerst mit „mache eine Tabelle aus …“ eine Tabelle daraus."
        )
    teil = daten.head(HOECHSTENS)
    return json.dumps(
        {
            "spalten": [str(spalte) for spalte in teil.columns],
            "typen": {str(spalte): str(typ) for spalte, typ in teil.dtypes.items()},
            "zeilen": json.loads(teil.to_json(orient="values", date_format="iso", default_handler=str)),
            "anzahl": len(daten),
        }
    )


def in_teile(wert):
    """Ein Wert als Liste seiner Teile, für „teile die Spalte … auf“.

    Eine Liste wie [7.62, 51.96] bleibt, wie sie ist. Text wird getrennt: am
    Semikolon, wenn eins darin steht ("51,96; 7,62"), sonst am Komma
    ("51.96, 7.62"). Teile, die wie Zahlen aussehen, werden Zahlen.
    """
    if not isinstance(wert, str):
        return wert
    teile = wert.split(";") if ";" in wert else wert.split(",")
    return [_zahl_oder_text(teil.strip()) for teil in teile]


def _zahl_oder_text(teil):
    try:
        return float(teil.replace(",", "."))
    except ValueError:
        return teil


def _pruefe_spalten(daten, *spalten):
    fehlen = [spalte for spalte in spalten if spalte and spalte not in daten.columns]
    if fehlen:
        raise KeyError(f"Diese Spalte gibt es nicht: {', '.join(fehlen)}. Vorhanden: {', '.join(map(str, daten.columns))}")


def zeige_tabelle(daten, titel=""):
    """Zeigt die Tabelle in der App."""
    spockly_app.zeige("tabelle", titel, _paket(daten), "{}")


def _wenn_da(daten, spalte, sonst):
    """Eine Spalte, die man auch weglassen kann: fehlt sie, gibt es einen Hinweis statt eines Fehlers."""
    if spalte and isinstance(daten, pd.DataFrame) and spalte not in daten.columns:
        hinweis(f"Die Spalte „{spalte}“ gibt es hier nicht, {sonst} Vorhanden: {', '.join(map(str, daten.columns))}")
        return None
    return spalte


def zeige_karte(daten, breite=None, laenge=None, farbe=None, titel="", form=None, info=None):
    """Zeigt jede Zeile auf der Karte, gefärbt nach einer Spalte.

    Die Lage kommt aus zwei Spalten (breite, laenge: ein Punkt je Zeile) oder
    aus einer Spalte mit ganzen Formen (form: Punkt, Linie oder Fläche, wie in GeoJSON).
    info: die Spalten, die man sieht, wenn man mit der Maus über einen Ort fährt.
    """
    if form:
        _pruefe_spalten(daten, form)
    else:
        _pruefe_spalten(daten, breite, laenge)
    farbe = _wenn_da(daten, farbe, f"darum haben auf der Karte „{titel}“ alle eine Farbe. Wähl bei „Farbe nach“ eine andere Spalte.")
    info = [spalte for spalte in (info or []) if _wenn_da(daten, spalte, f"darum fehlt sie beim Darüberfahren mit der Maus auf der Karte „{titel}“.")]
    optionen = {"breite": breite, "laenge": laenge, "form": form, "farbe": farbe, "info": info}
    spockly_app.zeige("karte", titel, _paket(daten), json.dumps(optionen))


def zeige_zeitverlauf(daten, zeit, wert, je=None, titel=""):
    """Zeigt, wie sich ein Wert mit der Zeit ändert – eine Linie je Gruppe."""
    _pruefe_spalten(daten, zeit, wert)
    je = _wenn_da(daten, je, f"darum zeigt der Zeitverlauf „{titel}“ eine Linie für alle Zeilen. Wähl bei „eine Linie je“ eine andere Spalte.")
    optionen = {"zeit": zeit, "wert": wert, "je": je}
    spockly_app.zeige("zeitverlauf", titel, _paket(daten), json.dumps(optionen))


def hinweis(text):
    """Zeigt einen Hinweis über den Ergebnissen, z. B. warum eine Tabelle leer ist."""
    spockly_app.hinweis(str(text))


def merke(block, wert):
    """Für die App: wie die Daten nach einem Block aussehen (der Zwischenstand).

    Die App fügt diese Zeilen beim Ausführen nach jedem Schritt ein; im
    Python-Code, den du siehst, stehen sie nicht. An den Daten ändern sie nichts.
    """
    spockly_app.merke(block, _zwischenstand(wert))


def _verschieden(daten):
    """Wie viele verschiedene Werte jede Spalte hat, in allen Zeilen (für die Auswahl „eine Linie je …“)."""
    anzahl = {}
    for spalte in daten.columns:
        try:
            anzahl[str(spalte)] = int(daten[spalte].nunique())
        except TypeError:  # Listen (z. B. Koordinaten) lassen sich nicht zählen
            pass
    return anzahl


def _zwischenstand(wert):
    if isinstance(wert, pd.DataFrame):
        kopf = wert.head(20)
        return json.dumps(
            {
                "art": "tabelle",
                "spalten": [str(spalte) for spalte in kopf.columns],
                "typen": {str(spalte): str(typ) for spalte, typ in kopf.dtypes.items()},
                "zeilen": json.loads(kopf.to_json(orient="values", date_format="iso", default_handler=str)),
                "anzahl": len(wert),
                "verschieden": _verschieden(wert),
            }
        )
    if isinstance(wert, str):
        return json.dumps({"art": "text", "text": wert[:3000], "anzahl": len(wert)})
    if isinstance(wert, (list, dict)):
        text = json.dumps(wert, ensure_ascii=False, indent=2, default=str)
        return json.dumps({"art": "json", "text": text[:3000], "anzahl": len(wert)})
    return json.dumps({"art": "anderes", "text": repr(wert)[:1000], "anzahl": None})
