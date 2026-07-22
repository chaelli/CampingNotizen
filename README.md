# ⛺ CampingNotizen

Geteilte Notizen zu Wohnwagen auf einem Campingplatz – auf einer Karte.

- **Wohnwagen auf der Karte** platzieren (OpenStreetMap oder Luftbild).
- Pro Wohnwagen **Kommentare** erfassen, jeweils als **Fakt** oder **Vermutung**.
- Pro Wohnwagen **Personen** erfassen (Name, Alter, Kommentar).
- **Geteilt** über einen gemeinsamen Zugangscode – alle mit demselben Code
  sehen und bearbeiten dieselben Notizen.
- **Assistierte Erkennung** (in der GitHub Action): sucht im Luftbild des
  Platzes wohnwagenähnliche Formen und schlägt sie in der App vor
  (Bestätigung nötig).

Aktuell fest auf **Camping Ruderbaum, Altnau (TG)** konfiguriert
(siehe `src/config.ts`). Die Karte startet direkt dort.

## Technik

- Reines Frontend (React + Vite + TypeScript), deploybar auf **GitHub Pages**.
- Karte mit **Leaflet** (OpenStreetMap + Esri-Luftbild).
- Geteilte Daten über **Supabase** (kostenloses Postgres). Ohne Supabase läuft
  die App im **lokalen Modus** (Daten nur auf diesem Gerät).
- Erkennung mit **Python + OpenCV** in der GitHub Action
  (`scripts/detect_caravans.py`), Ergebnis als JSON im Deploy.

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

Umgesetzt ist eine **assistierte** Variante, die in der **GitHub Action** läuft
(nicht im Browser – dort scheiterte es an CORS/CDN):
[`scripts/detect_caravans.py`](scripts/detect_caravans.py) lädt beim Deploy ein
hochauflösendes Luftbild des Platzes und sucht mit OpenCV (helle Dächer +
Kanten, gefiltert nach Grösse/Seitenverhältnis) nach wohnwagenförmigen
Rechtecken. Das Ergebnis wird als `public/detections/ruderbaum.json` in den
Deploy gelegt; in der App holt man die **Vorschläge** über den Button
«🔍 Vorschläge» und übernimmt sie per Tap.

Das ist bewusst heuristisch: Es findet Treffer **und** Fehltreffer. Den Bereich
des Platzes und die Filter kann man in `scripts/detect_caravans.py` (bbox) und
[`src/config.ts`](src/config.ts) anpassen. Neu erkennen lassen = Deploy-Workflow
erneut ausführen.
