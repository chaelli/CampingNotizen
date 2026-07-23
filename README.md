# ⛺ CampingNotizen

Geteilte Notizen zu Wohnwagen auf einem Campingplatz – auf einer Karte.

- **Wohnwagen auf der Karte** platzieren – lange auf die Karte drücken. Ein so
  angelegter Wohnwagen wird nur behalten, wenn Name geändert, Kommentar oder
  Person hinzugefügt wurde.
- Pro Wohnwagen **Kommentare** erfassen, jeweils als **Fakt** oder **Vermutung**.
- Pro Wohnwagen **Personen** erfassen (Name, Jahrgang, Kommentar).
- **Geteilt** über einen gemeinsamen Zugangscode – alle mit demselben Code
  sehen und bearbeiten dieselben Notizen.
- **Installierbar als PWA** (Manifest + Service Worker): «Installieren»-Button
  bzw. «Zum Startbildschirm hinzufügen».

Aktuell fest auf **Camping Ruderbaum, Altnau (TG)** konfiguriert
(siehe `src/config.ts`). Die Karte startet direkt dort, standardmässig im Luftbild.

## Technik

- Reines Frontend (React + Vite + TypeScript), deploybar auf **GitHub Pages**.
- Karte mit **Leaflet** (OpenStreetMap + Esri-Luftbild).
- Geteilte Daten über **Supabase** (kostenloses Postgres). Ohne Supabase läuft
  die App im **lokalen Modus** (Daten nur auf diesem Gerät).

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

## Wohnwagen erfassen

Wohnwagen werden **manuell** gesetzt: lange auf die Karte drücken. Zu jedem
Wohnwagen lassen sich Kommentare (Fakt/Vermutung) und Personen erfassen. Eine automatische Erkennung aus dem Luftbild wurde erprobt, aber
wieder entfernt – klassische Bildverarbeitung war zu unzuverlässig (0 oder
hunderte Fehltreffer), und für einen einzelnen Platz ist manuelles Setzen
schneller und zuverlässiger.
