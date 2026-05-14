# Vogelverzamelaar Belgie

Mobiele PWA voor een persoonlijke Belgische vogellijst. De app werkt als statische website en bewaart vinkjes, notities en foto's lokaal in de browser via IndexedDB.

## Online zetten

Publiceer alleen deze bestanden en mappen:

- `index.html`
- `styles.css`
- `app.js`
- `supabase-config.js`
- `manifest.webmanifest`
- `service-worker.js`
- `.nojekyll`
- `data/`
- `icons/`

De bestanden `server.mjs`, `avibase_belgium.html`, `avibase_belgium_nl.html`, `supabase-schema.sql` en de R-scripts zijn niet nodig voor online hosting.

`data/example-photos.js` bevat externe Wikimedia Commons voorbeeldfoto-links met bronpagina's. De foto's zelf worden niet in de repository opgeslagen.

## Delen met 2 accounts via Supabase

1. Maak een gratis project op Supabase.
2. Open `SQL Editor` in Supabase.
3. Plak de inhoud van `supabase-schema.sql` en klik `Run`.
4. Ga naar `Project Settings` -> `API`.
5. Kopieer de project URL en de public/anon key.
6. Vul die in `supabase-config.js` in:

```js
export const SUPABASE_URL = "https://jouw-project.supabase.co";
export const SUPABASE_ANON_KEY = "jouw-public-anon-key";
```

7. Upload `supabase-config.js` opnieuw naar GitHub/Netlify.
8. Beide gebruikers maken in de app een account aan en loggen in.
9. Een van jullie vult de e-mail van de ander in bij `Partner koppelen`.

De gedeelde online sync bewaart vinkjes, datum, uur, plaats, notitie en foto's. Foto's gaan naar een private Supabase Storage bucket `bird-photos` en zijn alleen zichtbaar voor de eigenaar en gekoppelde partner.

Als je eerder al een oudere versie van `supabase-schema.sql` hebt uitgevoerd, voer de nieuwe versie opnieuw uit in de SQL Editor. Het script voegt ontbrekende kolommen, bucket en policies toe zonder je bestaande records te wissen.

## Supabase redirect URL instellen

Ga in Supabase naar `Authentication` -> `URL Configuration`.

Zet `Site URL` op je echte app-link, bijvoorbeeld:

```text
https://jouwnaam.github.io/vogelverzamelaar/
```

Voeg bij `Redirect URLs` ook je app-link toe. Voor GitHub Pages mag je bijvoorbeeld gebruiken:

```text
https://jouwnaam.github.io/vogelverzamelaar/**
```

Als dit nog op `http://localhost:3000` staat, gaan bevestigingsmails naar localhost en werken ze niet op je gsm.

## GitHub Pages

1. Maak een nieuwe repository op GitHub.
2. Upload de bestanden en mappen hierboven naar de repository.
3. Ga naar `Settings` -> `Pages`.
4. Kies bij `Build and deployment` voor `Deploy from a branch`.
5. Kies branch `main` en map `/root`.
6. Klik `Save`.
7. Open de link die GitHub Pages toont.

## Netlify

1. Ga naar Netlify.
2. Kies `Add new site` -> `Deploy manually`.
3. Sleep de bestanden en mappen hierboven naar Netlify.
4. Open de gratis Netlify-link.

## Lokale test

Start lokaal:

```powershell
node server.mjs
```

Open daarna:

```text
http://127.0.0.1:5173
```
