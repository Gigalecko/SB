# Simple Buildings – Digital tvilling

En Airtable-liknande arbetsyta för fastighetsbestånd. Körs som en statisk sida på GitHub Pages med Supabase som databas och inloggning. Ingenting behöver installeras på din dator – allt görs i webbläsaren.

## Filerna

| Fil | Vad den gör |
|---|---|
| `index.html` | Startsidan. Hämtar React, ikoner och Supabase från nätet. Rör den inte. |
| `app.jsx` | Hela applikationen. |
| `db.js` | Kopplingen mot Supabase: inloggning, sparning, realtid. |
| `config.js` | **Den enda fil du fyller i.** Dina två Supabase-värden. |
| `supabase-setup.sql` | Klistras in i Supabase en gång. Ligger kvar som dokumentation. |

## 1. Lägg upp koden på GitHub

1. Gå till [github.com/new](https://github.com/new). Ge repot ett namn, välj **Public** och skapa det.
2. Klicka **Add file → Upload files** och dra in alla fem filerna. Klicka **Commit changes**.
3. Gå till **Settings → Pages**. Under *Build and deployment* väljer du Source: **Deploy from a branch**, Branch: **main** och mappen **/ (root)**. Spara.
4. Efter en minut visas adressen högst upp på samma sida: `https://<ditt-användarnamn>.github.io/<repo>/`

Öppna adressen. Appen ska starta med demodata och en gul markering **Endast lokalt** uppe till höger – den sparar i din egen webbläsare tills Supabase är inkopplat.

> Repot är publikt, så koden är synlig för alla. Det gör ingenting: era uppgifter ligger i Supabase bakom inloggning, och inga hemligheter finns i koden.

## 2. Skapa databasen i Supabase

1. Skapa ett konto på [supabase.com](https://supabase.com) och klicka **New project**. Välj region Frankfurt eller Stockholm. Lösenordet du anger är databasens huvudlösenord – spara det, men det används inte av appen.
2. Öppna **SQL Editor → New query**, klistra in hela innehållet i `supabase-setup.sql` och klicka **Run**.
3. Gå till **Authentication → Sign In / Providers → Email**. Se till att e-post är påslaget och att **Confirm email** är **avstängt**. Då slipper ni bekräftelsemejl, som Supabase begränsar hårt på gratisnivån.
4. Gå till **Authentication → Users → Add user → Create new user**. Fyll i e-post och lösenord för dig själv och dina kollegor. Kryssa i *Auto Confirm User* om rutan finns. Det är så ni skapar konton – det finns ingen självregistrering, vilket är precis vad ni vill.

## 3. Koppla ihop dem

1. I Supabase: **Project Settings → API**. Där finns *Project URL* och nyckeln **anon / public**.
2. På GitHub: öppna `config.js`, klicka pennikonen och klistra in värdena:

```js
export const SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

3. **Commit changes**. Vänta en minut och ladda om sidan.

Nu möts du av en inloggningsruta. Logga in med kontot du skapade i steg 2.4. Den gula markeringen är borta och ändringar sparas till Supabase.

> Kopiera aldrig in nyckeln som heter **service_role** – den ger full åtkomst förbi alla säkerhetsregler. `anon`-nyckeln är byggd för att ligga öppet och skyddas av reglerna i SQL-filen.

## Så fungerar sparningen

Hela arbetsytan sparas som ett JSON-dokument på en rad i tabellen `twin_bases`. Ändringar skickas iväg cirka en sekund efter att du slutat skriva, och statusen syns uppe till höger. Är någon annan inne samtidigt hämtas deras ändringar in automatiskt och en liten notis visas nederst.

Det innebär också en begränsning värd att känna till: sparningen är **sist vinner**. Om två personer ändrar i samma sekund kan den enas ändring skrivas över. För en handfull användare som jobbar i olika delar av beståndet är det sällan ett problem, men undvik att alla redigerar samma tabell samtidigt. Behöver ni tåla det senare får varje post bli en egen databasrad i stället – säg till så skissar jag om datalagret.

## Om något inte fungerar

Appen visar felmeddelanden direkt på sidan i stället för att bara bli vit.

**”Appen kunde inte starta”** – nätverket blockerar troligen `esm.sh` eller `unpkg.com`. Be IT släppa igenom dem, eller hör av dig så visar jag hur biblioteken läggs i repot i stället.

**”Når inte Supabase”** – kontrollera adressen i `config.js` och att `*.supabase.co` inte är blockerat.

**”Fel e-post eller lösenord”** – kontot finns inte, eller så är det inte bekräftat. Skapa om användaren under Authentication → Users.

**Vit sida efter en ändring i koden** – öppna sidan, felrutan visar vilken rad Babel klagar på.

## Att tänka på framåt

Supabase pausar gratisprojekt som inte använts på en vecka. Det räcker att någon loggar in för att väcka det, men blir appen viktig är betalnivån billig försäkring.

Demodatan ligger kvar tills någon ändrar den. Under basnamnet uppe till vänster finns **Återställ demodata** om ni vill börja om från ett rent bord – den raderar det som finns i Supabase, så använd den med försiktighet när ni väl lagt in riktiga uppgifter.
