# Konten & Speichern mit Supabase einrichten

Einmalig, ca. 10 Minuten. Für eine private App reicht der kostenlose Tarif von
Supabase locker (die aktuellen Grenzen stehen auf <https://supabase.com/pricing>).
Kostenlose Projekte werden nach längerer Zeit ohne Nutzung pausiert; im Dashboard
lassen sie sich mit einem Klick wieder starten.

## 1. Projekt anlegen

1. Auf <https://supabase.com/dashboard> anmelden (dasselbe Konto wie für die Wein-App geht).
2. **New project** → Name z. B. `espresso-kompass`, Region **Frankfurt (eu-central-1)**,
   ein Datenbank-Passwort vergeben (wird für die App nicht gebraucht) → **Create new project**.

## 2. Tabellen anlegen

**SQL Editor → New query**, den Inhalt von [`supabase/schema.sql`](../supabase/schema.sql)
einfügen und **Run** drücken. Danach gibt es die Tabellen `profiles` und `user_data`,
jeweils mit Row Level Security: Jede Person sieht nur ihre eigenen Daten.

## 3. Anmeldung per E-Mail einstellen

**Authentication → URL Configuration**

- **Site URL:** `https://jg4vhz52tn-droid.github.io/CoffeeApp/`
- **Redirect URLs:** dieselbe Adresse eintragen (zum lokalen Testen zusätzlich `http://localhost:8080/`).

**Authentication → Sign In / Providers → Email:** „Enable Email provider“ an,
„Confirm email“ an. Ein Passwort braucht niemand – die App schickt einen Anmelde-Link.

**Authentication → Email Templates → Magic Link** – damit auch der 6-stellige Code
in der Mail steht (wichtig, wenn die App vom iPhone-Home-Bildschirm aus genutzt wird):

```html
<h2>Dein Anmelde-Link für Espresso Kompass</h2>
<p><a href="{{ .ConfirmationURL }}">Jetzt anmelden</a></p>
<p>Oder gib diesen Code in der App ein: <strong>{{ .Token }}</strong></p>
```

Dasselbe gern auch im Template **Confirm signup** ergänzen.

## 4. Schlüssel in die App eintragen

**Project Settings → API Keys**: die **Project URL** und den **Publishable key**
(`sb_publishable_…`) kopieren und in [`js/config.js`](../js/config.js) eintragen:

```js
window.CLOUD_CONFIG = {
  url: 'https://DEINPROJEKT.supabase.co',
  key: 'sb_publishable_…'
};
```

Beide Werte sind für den Browser gedacht und dürfen öffentlich im Repo stehen.
**Niemals** den `secret`-/`service_role`-Schlüssel eintragen.

## Gut zu wissen

- **E-Mail-Limit:** Supabase verschickt mit dem eingebauten Mailserver nur wenige
  Anmelde-Mails pro Stunde. Für dich und ein paar Freunde reicht das. Für mehr
  Nutzer unter **Project Settings → Authentication → SMTP Settings** einen eigenen
  Mailversand eintragen (z. B. Resend oder Brevo, beide mit kostenlosem Kontingent).
- **Was gespeichert wird:** Bohnen, Shots, Bewertungen, eigene Rezepte, das
  Brüh-Tagebuch und Einstellungen – als ein Datensatz pro Person in `user_data`.
- **Ohne Internet** arbeitet die App lokal weiter und speichert beim nächsten Mal.
