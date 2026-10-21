# Espresso Kompass ☕🧭

Espresso nach Geschmack einstellen: Shot ziehen, Geschmack auf dem Kompass
einordnen, konkrete Empfehlung für den nächsten Shot bekommen
(Mahlgrad, Dosis, Bezug, Zielzeit).

Basiert auf dem *Brewed Coffee Compass* von Barista Hustle, adaptiert für Espresso.

## Funktionen

- **Einstellen** – Rezept des letzten Shots per Drehrad (wie der iPhone-Timer, mit Haptik) eingeben, Geschmack per Begriffen
  oder Tipp auf den Kompass wählen, Empfehlung mit „Jetzt → Nächster Shot“.
- **Neue Bohne** – direkt beim Espresso anlegen; ein Tipp schlägt aus Röstgrad, Sieb und „pur/mit Milch“ Dosis, Bezug, Zeit und Temperatur vor.
- **Bohnen** – Zielrezepte (eigene oder von der Rösterei), als Link teilen und importieren.
- **Brühen** – 19 Rezepte für AeroPress, French Press, V60, Chemex, Mokkakanne, Clever Dripper, Cold Brew und Eiskaffee
  mit Mengen-Regler und geführtem Timer (Schritt-Ansagen, Ton, Vibration). Eigene Rezepte anlegen, aus Vorlagen anpassen,
  per Link teilen und importieren.
- **Verkosten** – Kaffees bewerten (Tüte scannen oder eintragen, Aromarad, Struktur und Urteil per Drehrad)
  und das eigene Geschmacksrad: welche Aromafamilien, Herkünfte und Aufbereitungen dir am besten schmecken.
- **Cafés** – Stadt oder Standort, Umkreis 1–10 km, „Nur geöffnet“ und „Nur Specialty“. Ergebnisse als Karte (Leaflet +
  OpenStreetMap), als Wisch-Karten (rechts = hin, mit Routenwahl zu Fuß/Rad/ÖPNV/Auto; links = weiter) und als Liste.
  Komplett kostenlos: Daten von OpenStreetMap, Fotos von Wikimedia Commons (über OSM-Tags oder Wikidata), sonst ein
  Kartenausschnitt mit Pin. Statt fremder Sterne bewertest du besuchte Cafés selbst; schlecht bewertete tauchen nicht mehr auf.
- **Verlauf** – der Weg deiner Shots über den Kompass, pro Bohne (unter „Bohnen“).
- **Wissen** – Anleitung „So nutzt du die App“, Espresso Schritt für Schritt einstellen und das Prinzip dahinter.

Rezepte: AeroPress-Rezepte nach [AeroPrecipe](https://aeroprecipe.com), weitere nach den angegebenen Quellen. Die Anleitungen sind eigene Formulierungen.

Der Tüten-Scan nutzt Claude und steht nur in der auf claude.ai veröffentlichten Fassung zur Verfügung; sonst werden die Angaben von Hand eingetragen.

Alles läuft lokal im Browser (Daten in `localStorage`), offline-fähig, installierbar als PWA.

## Starten

```bash
npm start        # statischer Server auf http://localhost:8080
npm test         # Tests der Empfehlungs-Logik
```

Kein Build-Schritt nötig – die Seite lässt sich direkt z. B. über GitHub Pages hosten.

## Aufbau

| Datei | Inhalt |
|---|---|
| `js/engine.js` | Kompass-Begriffe und Empfehlungs-Logik (ohne DOM, testbar in Node) |
| `js/brew-data.js` | Brühmethoden, Rezepte, Skalierung (testbar in Node) |
| `js/cafes.js` | Café-Suche über OpenStreetMap, Specialty-Einstufung (testbar in Node) |
| `js/tasting-data.js` | Aromafamilien (nach SCA Flavor Wheel), Geschmacksprofil, Scan-Auswertung (testbar in Node) |
| `js/ui.js` | Gemeinsame DOM-Helfer, Icons, Haptik, Speicherung |
| `js/tickdial.js` | Drehrad-Regler (Strich-Lineal mit Einrasten und Klick-Feedback) |
| `js/app.js` | Navigation, Espresso-Ansicht, Bohnen, Teilen/Import |
| `js/brew-ui.js`, `js/cafes-ui.js`, `js/tasting-ui.js` | Ansichten „Brühen“, „Cafés“ und „Verkosten“ |
| `css/style.css` | Gestaltung inkl. Dark Mode |
| `sw.js`, `manifest.webmanifest` | Offline & Installation |
| `docs/KONZEPT.md` | Konzept, Profil-Format für Röstereien, Roadmap |
