# Espresso Kompass ☕🧭

Espresso nach Geschmack einstellen: Shot ziehen, Geschmack auf dem Kompass
einordnen, konkrete Empfehlung für den nächsten Shot bekommen
(Mahlgrad, Dosis, Bezug, Zielzeit).

Basiert auf dem *Brewed Coffee Compass* von Barista Hustle, adaptiert für Espresso.

## Funktionen

- **Einstellen** – Rezept des letzten Shots eingeben, Geschmack per Begriffen
  oder Tipp auf den Kompass wählen, Empfehlung mit „Jetzt → Nächster Shot“.
- **Bohnen** – Zielrezepte (eigene oder von der Rösterei), als Link teilen und importieren.
- **Verlauf** – der Weg deiner Shots über den Kompass, pro Bohne.
- **Wissen** – das Prinzip kurz erklärt.

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
| `js/app.js` | Oberfläche, Speicherung, Teilen/Import |
| `css/style.css` | Gestaltung inkl. Dark Mode |
| `sw.js`, `manifest.webmanifest` | Offline & Installation |
| `docs/KONZEPT.md` | Konzept, Profil-Format für Röstereien, Roadmap |
