# Espresso Kompass – Konzept & Roadmap

## Problem

Neue Bohnen bedeuten an der Siebträgermaschine jedes Mal: Mühle neu einstellen,
probieren, grübeln. Man muss gleichzeitig an Mahlgrad, Dosis, Bezug, Zeit und
Temperatur denken – und weiß oft nicht, an welcher Schraube man drehen soll.

## Idee

1. **Geschmack statt Theorie:** Der Nutzer beschreibt, wie der Shot schmeckt
   (Begriffe antippen oder auf den Kompass tippen).
2. **Konkrete Antwort:** Die App sagt genau, was beim nächsten Shot anders
   sein soll – „2 Stufen feiner, Bezug 36 g → 32 g, Ziel ≈ 27 s“.
3. **Hersteller-Profile:** Röstereien liefern ein Zielrezept für ihre Bohne
   (per Link/QR-Code auf der Tüte). Die App führt dann zu genau diesem Rezept.

Grundlage ist der *Brewed Coffee Compass* (Barista Hustle): zwei Achsen –
Extraktion (sauer ↔ bitter) und Stärke (schwach ↔ stark) – mit dem grünen
Bereich in der Mitte.

## Wie die Empfehlung entsteht (`js/engine.js`)

| Schritt | Logik |
|---|---|
| Position | Mittelwert der gewählten Begriffe auf der Karte (x = Extraktion, y = Stärke, je −1…1) oder direkter Tipp. |
| Zone | Zentrum (r ≤ 0,22): nichts ändern · grüner Bereich (r ≤ 0,74): halbe Korrektur · außerhalb: volle Korrektur. |
| Extraktion | Korrektur −x → Mahlgrad in 1–3 Stufen (Schrittweite und Richtung der Mühle einstellbar). |
| Stärke | Korrektur −y → Brühverhältnis × (1 − 0,25·Korrektur). Dosis **oder** Bezug wird fix gehalten. |
| Zeit-Check | Durchlaufzeit gegen Zielfenster (Profil oder 25–32 s) – bestätigt oder relativiert die Mahlgrad-Empfehlung. |
| Channeling | Sauer **und** bitter gleichzeitig → zuerst Puck-Vorbereitung (WDT, Tampern), Mahlgrad-Korrektur gedämpft. |
| Röstgrad | Helle Röstung bleibt sauer → +1–2 °C; dunkle bleibt bitter → −1–2 °C. |

Espresso-Besonderheit: Ein längerer Bezug extrahiert automatisch mehr – die App
weist darauf hin, wenn eine Stärke-Korrektur die Extraktion mitverschiebt.

## Bohnen-Profil-Format (für Röstereien)

```json
{
  "name": "Hausmischung",
  "roaster": "Beispielrösterei",
  "roast": "mittel",
  "notes": "Schokolade, Haselnuss",
  "restDays": 7,
  "recipe": { "dose": 18, "yield": 38, "timeMin": 26, "timeMax": 30, "temp": 93 }
}
```

`roast` ist `hell` | `mittel` | `dunkel`. Teilbar als Link:
`https://<app>/#bean=<base64url(JSON)>` – ideal für einen QR-Code auf der Verpackung.

## Entscheidung: Web-App zuerst

Eine installierbare Web-App (PWA) statt sofort einer nativen App, weil

- sie ohne App-Store sofort auf jedem Handy läuft (auch offline an der Maschine),
- Profil-Links/QR-Codes direkt die App öffnen,
- dieselbe Seite das Prinzip erklärt („Wissen“) – Website und App in einem.

Später lässt sich derselbe Code mit Capacitor o. Ä. als native App verpacken.

## Roadmap

**Phase 1 – MVP (dieser Stand)**
- Kompass + Begriffe, Empfehlung, Rezept-Übernahme, Verlauf pro Bohne
- Bohnen-Profile anlegen, teilen (Link), importieren (Link/JSON/Datei)
- Offline-fähig, Hell/Dunkel, mobil optimiert

**Phase 2 – Besser einstellen**
- Mühlen-Datenbank (Stufen, Richtung, typische Bereiche) zur Auswahl
- Shot-Timer mit Waage-Eingabe direkt in der App
- Lernende Schrittweite: wie stark wirkte die letzte Mahlgrad-Änderung auf die Zeit?
- Röstdatum → Hinweis auf Ruhezeit/Alterung, Nachjustieren über Wochen

**Phase 3 – Röstereien**
- Kleines Röster-Portal: Profil erstellen, QR-Code erzeugen
- Öffentliches Profil-Verzeichnis (Suche nach Bohne/Rösterei)
- Rückkanal (anonym): Mit welchen Rezepten landen Nutzer im Zentrum?

**Phase 4 – Erweiterungen**
- Milchgetränke-Modus (stärkere Shots), Filterkaffee-Modus (originaler Brewed Compass)
- Konto/Sync zwischen Geräten, Export
