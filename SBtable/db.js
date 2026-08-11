/* ------------------------------------------------------------------
   Datalager för Simple Buildings.

   Sköter tre saker:
     1. inloggning mot Supabase
     2. läsa och skriva hela arbetsytan som ett JSON-dokument
     3. lyssna på ändringar från andra som är inne samtidigt

   Om config.js är tom faller allt tillbaka på webbläsarens
   localStorage, så appen fungerar direkt utan Supabase.
------------------------------------------------------------------- */

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, BASE_ID } from "./config.js";

const TABLE = "twin_bases";
const LOCAL_KEY = "sb-twin:base:v1";

export const CONFIGURED =
  typeof SUPABASE_URL === "string" && SUPABASE_URL.startsWith("https://") &&
  typeof SUPABASE_ANON_KEY === "string" && SUPABASE_ANON_KEY.length > 30;

export const supabase = CONFIGURED ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/* Slumpat id per flik, så vi kan ignorera våra egna ändringar när de
   studsar tillbaka via realtidskanalen. */
const clientId = Math.random().toString(36).slice(2, 12);

/* ---------------------------- Inloggning -------------------------- */

export async function getSession() {
  if (!CONFIGURED) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export function onAuthChange(cb) {
  if (!CONFIGURED) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session ?? null));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email, password) {
  if (!CONFIGURED) throw new Error("Supabase är inte konfigurerat i config.js");
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(translate(error.message));
  return true;
}

export async function signOut() {
  if (CONFIGURED) await supabase.auth.signOut();
}

function translate(msg = "") {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Fel e-post eller lösenord.";
  if (m.includes("email not confirmed")) return "Kontot är inte bekräftat. Be administratören stänga av e-postbekräftelse i Supabase.";
  if (m.includes("failed to fetch")) return "Når inte Supabase. Kontrollera adressen i config.js och att nätverket släpper igenom.";
  return msg;
}

/* ------------------------------ Data ------------------------------ */

export async function loadBase() {
  if (!CONFIGURED) {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  }
  const { data, error } = await supabase.from(TABLE).select("data").eq("id", BASE_ID).maybeSingle();
  if (error) throw new Error(translate(error.message));
  return data?.data ?? null;
}

export async function saveBase(base) {
  if (!CONFIGURED) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(base));
    return;
  }
  const { error } = await supabase.from(TABLE).upsert({
    id: BASE_ID,
    data: base,
    updated_at: new Date().toISOString(),
    updated_by: clientId,
  });
  if (error) throw new Error(translate(error.message));
}

export async function clearBase() {
  if (!CONFIGURED) { localStorage.removeItem(LOCAL_KEY); return; }
  await supabase.from(TABLE).delete().eq("id", BASE_ID);
}

/* Anropar cb(base) när någon ANNAN har sparat. Returnerar en
   avslutningsfunktion. */
export function subscribe(cb) {
  if (!CONFIGURED) return () => {};
  const channel = supabase
    .channel("twin-" + BASE_ID)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: "id=eq." + BASE_ID },
      (payload) => {
        const row = payload.new;
        if (!row || row.updated_by === clientId) return;
        if (row.data?.tables?.length) cb(row.data);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export const MODE = CONFIGURED ? "supabase" : "local";
