# Konten & Speichern mit Supabase einrichten

Die Kaffee-App nutzt **dasselbe Supabase-Projekt wie die Wein-App**, aber einen
**eigenen Bereich** (Schema `coffee`) mit eigenen Tabellen. Die Wein-Tabellen
werden nicht angefasst. Einmalig, ca. 10 Minuten.

## 1. Tabellen anlegen

1. <https://supabase.com/dashboard> → das **Wein-Projekt** öffnen.
2. **SQL Editor → New query**, den Inhalt von [`supabase/schema.sql`](../supabase/schema.sql)
   einfügen und **Run** drücken.

Danach gibt es `coffee.profiles` (Name in der Kaffee-App) und `coffee.user_data`
(alle Kaffee-Daten). Row Level Security sorgt dafür, dass jede Person nur ihre
eigenen Daten sieht. Im Bereich `public` (Wein) ändert das Skript nichts.

## 2. Den Bereich für die App freigeben

**Integrations → Data API → Reiter „Settings“ → Exposed schemas**: `coffee`
**anhaken** (`public` und `graphql_public` angehakt lassen) → **Save**.
(In älteren Dashboards: Project Settings → Data API.) Fehlt `coffee` in der Liste,
ist Schritt 1 noch nicht (fehlerfrei) gelaufen.

## 3. Anmelde-Link auf die Kaffee-App zeigen lassen

**Authentication → URL Configuration**

- **Site URL nicht ändern** – die gehört der Wein-App.
- Unter **Redirect URLs** → **Add URL**: `https://jg4vhz52tn-droid.github.io/CoffeeApp/`
  (zum lokalen Testen zusätzlich `http://localhost:8080/`).

Ohne diesen Eintrag würde der Link aus der Mail auf der Wein-App landen.

## 4. Code in die Anmelde-Mail aufnehmen (empfohlen)

Der 6-stellige Code hilft, wenn der Link im falschen Browser aufgeht – z. B. bei der
App vom iPhone-Home-Bildschirm. **Authentication → Email Templates → Magic Link**.

Die Vorlage gilt für **beide Apps**, darum neutral formulieren. Steht dort schon
ein eigener Text der Wein-App, nur die Zeile mit dem Code ergänzen:

```html
<h2>Dein Anmelde-Link</h2>
<p><a href="{{ .ConfirmationURL }}">Jetzt anmelden</a></p>
<p>Oder gib diesen Code in der App ein: <strong>{{ .Token }}</strong></p>
```

Dasselbe gern auch im Template **Confirm signup**.

## 5. Schlüssel in die App eintragen

**Project Settings → API Keys**: **Project URL** und **Publishable key**
(`sb_publishable_…`) – dieselben Werte, die auch die Wein-App nutzt. In
[`js/config.js`](../js/config.js) eintragen:

```js
window.CLOUD_CONFIG = {
  url: 'https://DEINPROJEKT.supabase.co',
  key: 'sb_publishable_…',
  schema: 'coffee'
};
```

Beide Werte sind für den Browser gedacht und dürfen öffentlich im Repo stehen.
**Niemals** den `secret`-/`service_role`-Schlüssel eintragen.

## Was sich beide Apps teilen

- **Anmelde-Konten:** Wer sich in der Kaffee-App anmeldet, hat damit auch ein Konto
  für die Wein-App (dieselbe E-Mail-Adresse, ein Login). Die Daten bleiben getrennt.
- **Wein-Profil wird mit angelegt:** Die Wein-Datenbank legt bei jeder neuen
  Anmeldung automatisch ein (leeres) Wein-Profil an – auch bei Kaffee-Nutzern.
  Das stört nicht; wer später die Wein-App öffnet, ist dort schon eingerichtet.
- **Mailversand:** Beide Apps teilen sich das Kontingent für Anmelde-Mails (im
  kostenlosen Tarif nur wenige pro Stunde). Für mehr Nutzer unter
  **Project Settings → Authentication → SMTP Settings** einen eigenen Mailversand
  eintragen (z. B. Resend oder Brevo, beide mit kostenlosem Kontingent).
- **Pausieren:** Wird das Projekt wegen Inaktivität pausiert, sind beide Apps betroffen.

## Wieder entfernen

Alles von der Kaffee-App liegt im Schema `coffee`. Im SQL Editor
`drop schema coffee cascade;` löscht es vollständig, ohne die Wein-App zu berühren.
