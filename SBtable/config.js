/* ------------------------------------------------------------------
   Simple Buildings – inställningar

   Det här är den ENDA filen du behöver ändra i efter uppladdningen.
   Klistra in dina två värden från Supabase (Project Settings → API).

   Lämnar du dem tomma körs appen ändå, men sparar då bara lokalt i
   din egen webbläsare. Bra för att testa innan Supabase är på plats.

   Anon-nyckeln är avsedd att vara publik – den skyddas av
   säkerhetsreglerna (RLS) i databasen. Klistra ALDRIG in
   service_role-nyckeln här; den ger full åtkomst till allt.
------------------------------------------------------------------- */

export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

/* Vilken arbetsyta filen pekar på. Byt bara om ni vill köra flera
   separata bestånd i samma Supabase-projekt. */
export const BASE_ID = "simple-buildings";
