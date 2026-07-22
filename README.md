# ⛺ CampingNotizen

Geteilte Notizen zu Wohnwagen auf einem Campingplatz – auf einer Karte.

- **Wohnwagen auf der Karte** platzieren (OpenStreetMap oder Luftbild).
- Pro Wohnwagen **Kommentare** erfassen, jeweils als **Fakt** oder **Vermutung**.
- Pro Wohnwagen **Personen** erfassen (Name, Alter, Kommentar).
- **Geteilt** über einen gemeinsamen Zugangscode – alle mit demselben Code
  sehen und bearbeiten dieselben Notizen.
- **Assistierte Erkennung**: schlägt im aktuellen Kartenausschnitt
  wohnwagenähnliche Formen aus dem Luftbild vor (Bestätigung nötig).

## Technik

- Reines Frontend (React + Vite + TypeScript), deploybar auf **GitHub Pages**.
- Karte mit **Leaflet** (OpenStreetMap + Esri-Luftbild).
- Geteilte Daten über **Supabase** (kostenloses Postgres). Ohne Supabase läuft
  die App im **lokalen Modus** (Daten nur auf diesem Gerät).
- Erkennung mit **OpenCV.js** (bei Bedarf vom CDN geladen).

## Lokal starten

```bash
npm install
npm run dev
```

Ohne weitere Konfiguration startet die App im **lokalen Modus**.

## Geteilter Modus mit Supabase

1. Auf [supabase.com](https://supabase.com) ein kostenloses Projekt anlegen.
2. Im **SQL Editor** den Inhalt von [`supabase/schema.sql`](supabase/schema.sql)
   ausführen (legt Tabellen + Policies an).
3. Unter **Project Settings → API** die Werte kopieren.
4. Lokal: `.env.example` nach `.env` kopieren und ausfüllen:

   ```bash
   cp .env.example .env
   ```

   ```
   VITE_SUPABASE_URL=https://dein-projekt.supabase.co
   VITE_SUPABASE_ANON_KEY=dein-anon-key
   ```

Der `anon`-Key ist ein öffentlicher Client-Key und darf im Frontend liegen.

## Deployment auf GitHub Pages

1. Repository-Einstellungen → **Pages** → Source: **GitHub Actions**.
2. Für den geteilten Modus unter **Settings → Secrets and variables → Actions**
   zwei Secrets anlegen: `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`.
3. Auf `main` pushen – der Workflow
   [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) baut und
   veröffentlicht die App unter `https://<user>.github.io/<repo>/`.

## Zugangscode & Sicherheit

Der Zugangscode wird lokal per SHA-256 gehasht; der Hash dient als
Platz-Kennung (`board`). Der Klartext-Code wird nie gespeichert oder übertragen.
Wer denselben Code eingibt, landet auf demselben Platz.

Das ist bewusst einfach gehalten (ein Freundeskreis auf dem Campingplatz), aber
**keine starke Zugriffskontrolle**: Wer den `anon`-Key und einen Code kennt, hat
Zugriff auf diesen Platz. Für sensiblere Szenarien wären echte Logins und
strengere RLS-Policies nötig.

## Zur automatischen Erkennung – ehrliche Einordnung

Eine perfekte, vollautomatische Wohnwagen-Erkennung aus Kartendaten ist **nicht**
umgesetzt und wäre mit vertretbarem Aufwand auch nicht zuverlässig möglich:
OpenStreetMap kennt keine einzelnen Wohnwagen, und echte Objekterkennung auf
Luftbildern bräuchte ein trainiertes ML-Modell.

Umgesetzt ist eine **assistierte** Variante: Für den aktuellen Ausschnitt wird
ein Luftbild geholt und mit klassischer Bildverarbeitung nach rechteckigen,
wohnwagengrossen Formen durchsucht. Das Ergebnis sind **Vorschläge**, die per
Tap übernommen werden. Am besten funktioniert es nah herangezoomt bei gut
sichtbaren, einzeln stehenden Wagen.
