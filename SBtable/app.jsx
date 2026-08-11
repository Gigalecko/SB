<script type="module">
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

  const supabase = createClient(
    'https://ezzxmkjiutvkeskvfuxr.supabase.co',
    'sb_publishable_cXD57fdoGR_Yo5B0rBpTKg_KCA77zd5'
  )

  // Gör den global så resten av appen kan använda den
  window.supabase = supabase
</script>

import React, { useState, useMemo, useRef, useEffect, useCallback, createContext, useContext } from "react";
import {
  Search, Plus, X, Check, ChevronDown, ChevronRight, ChevronLeft, Trash2, Copy,
  MoreHorizontal, Maximize2, Filter, ArrowUpDown, EyeOff, Menu, Share2, HelpCircle,
  Bell, Star, Calendar, Hash, Type, AlignLeft, AlignJustify, Link2, Mail, User,
  CheckSquare, DollarSign, Table, LayoutGrid, Image, List, Layers, Palette,
  ArrowUp, ArrowDown, Phone, MessageSquare, Settings, Clock, Globe, Calculator,
  Sigma, Building2, Ruler, Cpu, Activity, Save, CloudOff, Gauge,
} from "lucide-react";

/* ================================================================== */
/*  Simple Buildings – Digital tvilling                                */
/*  Airtable-likt arbetsyta för fastighetsbestånd                      */
/* ================================================================== */

const uid = (p = "id") => p + Math.random().toString(36).slice(2, 9);
const STORAGE_KEY = "sb-twin:base:v1";

const COLORS = [
  { id: "blue", bg: "#cfdfff", text: "#2750ae", solid: "#2d7ff9" },
  { id: "cyan", bg: "#d0f0fd", text: "#0b76b7", solid: "#18bfff" },
  { id: "teal", bg: "#c2f5e9", text: "#08857e", solid: "#12b3a8" },
  { id: "green", bg: "#d1f7c4", text: "#338a17", solid: "#20c933" },
  { id: "yellow", bg: "#ffeab6", text: "#b87503", solid: "#fcb400" },
  { id: "orange", bg: "#fee2d5", text: "#d74d26", solid: "#ff6f2c" },
  { id: "red", bg: "#ffdce5", text: "#b02318", solid: "#f82b60" },
  { id: "pink", bg: "#ffdaf6", text: "#b2158b", solid: "#ff08c2" },
  { id: "purple", bg: "#ede2fe", text: "#6b1cb0", solid: "#8b46ff" },
  { id: "gray", bg: "#e5e9f0", text: "#4a5568", solid: "#697386" },
];
const colorOf = (id) => COLORS.find((c) => c.id === id) || COLORS[9];

const PEOPLE = [
  { name: "Anna Lind", color: "teal" },
  { name: "Erik Sjöberg", color: "blue" },
  { name: "Maja Nyström", color: "orange" },
  { name: "Omar Haddad", color: "purple" },
  { name: "Sara Ek", color: "pink" },
];

const TABLE_ICONS = { building: Building2, space: Ruler, sensor: Cpu, issue: Activity, table: Table };

const FIELD_TYPES = [
  { type: "text", label: "Enradig text", icon: Type },
  { type: "longText", label: "Lång text", icon: AlignLeft },
  { type: "number", label: "Tal", icon: Hash },
  { type: "currency", label: "Valuta", icon: DollarSign },
  { type: "select", label: "Enkelval", icon: ChevronDown },
  { type: "multiSelect", label: "Flerval", icon: List },
  { type: "date", label: "Datum", icon: Calendar },
  { type: "checkbox", label: "Kryssruta", icon: CheckSquare },
  { type: "person", label: "Medarbetare", icon: User },
  { type: "rating", label: "Betyg", icon: Star },
  { type: "url", label: "URL", icon: Globe },
  { type: "email", label: "E-post", icon: Mail },
  { type: "phone", label: "Telefon", icon: Phone },
  { type: "link", label: "Länk till post", icon: Link2 },
  { type: "rollup", label: "Rollup", icon: Sigma },
  { type: "formula", label: "Formel", icon: Calculator },
];
const typeMeta = (t) => FIELD_TYPES.find((f) => f.type === t) || FIELD_TYPES[0];
const isComputed = (f) => f.type === "formula" || f.type === "rollup";

const opt = (name, color) => ({ id: uid("opt"), name, color });

/* ------------------------------------------------------------------ */
/*  Formelmotor                                                        */
/* ------------------------------------------------------------------ */

const num = (v) => {
  if (v === true) return 1;
  if (v === false || v === null || v === undefined || v === "") return 0;
  if (Array.isArray(v)) return v.length;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};
const str = (v) => {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (v === true) return "Ja";
  if (v === false) return "";
  return String(v);
};
const flat = (a) => a.flatMap((x) => (Array.isArray(x) ? x : [x]));
const todayISO = () => new Date().toISOString().slice(0, 10);
const asDate = (v) => { const d = new Date(str(v)); return Number.isNaN(d.getTime()) ? null : d; };
const finite = (n) => (Number.isFinite(n) ? n : 0);

const FN = {
  IF: (a) => (a[0] ? a[1] : a.length > 2 ? a[2] : ""),
  AND: (a) => a.every(Boolean),
  OR: (a) => a.some(Boolean),
  NOT: (a) => !a[0],
  SUM: (a) => flat(a).reduce((s, x) => s + num(x), 0),
  AVERAGE: (a) => { const v = flat(a).map(num); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0; },
  MIN: (a) => { const v = flat(a).map(num); return v.length ? Math.min(...v) : 0; },
  MAX: (a) => { const v = flat(a).map(num); return v.length ? Math.max(...v) : 0; },
  ROUND: (a) => { const d = a.length > 1 ? num(a[1]) : 0; const m = Math.pow(10, d); return Math.round(finite(num(a[0])) * m) / m; },
  ABS: (a) => Math.abs(num(a[0])),
  LEN: (a) => str(a[0]).length,
  CONCAT: (a) => a.map(str).join(""),
  UPPER: (a) => str(a[0]).toUpperCase(),
  LOWER: (a) => str(a[0]).toLowerCase(),
  TRIM: (a) => str(a[0]).trim(),
  COUNT: (a) => (Array.isArray(a[0]) ? a[0].length : a[0] === null || a[0] === undefined || a[0] === "" ? 0 : 1),
  TODAY: () => todayISO(),
  YEAR: (a) => Number(str(a[0]).slice(0, 4)) || 0,
  DAYS: (a) => { const x = asDate(a[0]), y = asDate(a[1]); return x && y ? Math.round((y - x) / 86400000) : 0; },
  VALUE: (a) => num(a[0]),
  BLANK: () => "",
};
const FN_HELP = "IF · AND · OR · NOT · SUM · AVERAGE · MIN · MAX · ROUND · ABS · LEN · CONCAT · UPPER · LOWER · TRIM · COUNT · TODAY · YEAR · DAYS · VALUE";

function tokenize(s) {
  const out = [];
  let i = 0;
  const ident = (c) => /[A-Za-z0-9_ÅÄÖåäöÉé]/.test(c);
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "{") {
      const j = s.indexOf("}", i);
      if (j < 0) throw new Error("Saknar }");
      out.push({ t: "field", v: s.slice(i + 1, j) }); i = j + 1; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, buf = "";
      while (j < s.length && s[j] !== c) { if (s[j] === "\\") j++; buf += s[j]; j++; }
      out.push({ t: "str", v: buf }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(s[i + 1] || ""))) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      out.push({ t: "num", v: parseFloat(s.slice(i, j)) }); i = j; continue;
    }
    const two = s.slice(i, i + 2);
    if (["<=", ">=", "!=", "&&", "||", "=="].includes(two)) { out.push({ t: "op", v: two === "==" ? "=" : two }); i += 2; continue; }
    if ("+-*/%&(),<>=".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    if (ident(c)) { let j = i; while (j < s.length && ident(s[j])) j++; out.push({ t: "id", v: s.slice(i, j) }); i = j; continue; }
    throw new Error("Okänt tecken: " + c);
  }
  return out;
}

function compileFormula(src) {
  const tk = tokenize(src);
  let p = 0;
  const at = (v) => tk[p] && tk[p].t === "op" && tk[p].v === v;
  const eat = (v) => (at(v) ? (p++, true) : false);

  const expr = () => or();
  const or = () => { let l = and(); while (at("||")) { p++; const r = and(), a = l; l = (g) => a(g) || r(g); } return l; };
  const and = () => { let l = cmp(); while (at("&&")) { p++; const r = cmp(), a = l; l = (g) => a(g) && r(g); } return l; };
  const cmp = () => {
    let l = cat();
    while (at("=") || at("!=") || at("<") || at(">") || at("<=") || at(">=")) {
      const o = tk[p].v; p++; const r = cat(), a = l;
      l = (g) => {
        const x = a(g), y = r(g);
        const bothNum = typeof x !== "string" || typeof y !== "string";
        const [u, v2] = bothNum && !Number.isNaN(Number(x)) && !Number.isNaN(Number(y)) ? [num(x), num(y)] : [str(x), str(y)];
        return { "=": u === v2, "!=": u !== v2, "<": u < v2, ">": u > v2, "<=": u <= v2, ">=": u >= v2 }[o];
      };
    }
    return l;
  };
  const cat = () => { let l = add(); while (at("&")) { p++; const r = add(), a = l; l = (g) => str(a(g)) + str(r(g)); } return l; };
  const add = () => {
    let l = mul();
    while (at("+") || at("-")) { const o = tk[p].v; p++; const r = mul(), a = l; l = (g) => (o === "+" ? num(a(g)) + num(r(g)) : num(a(g)) - num(r(g))); }
    return l;
  };
  const mul = () => {
    let l = unary();
    while (at("*") || at("/") || at("%")) {
      const o = tk[p].v; p++; const r = unary(), a = l;
      l = (g) => { const x = num(a(g)), y = num(r(g)); return o === "*" ? x * y : y === 0 ? 0 : o === "/" ? x / y : x % y; };
    }
    return l;
  };
  const unary = () => { if (at("-")) { p++; const e = unary(); return (g) => -num(e(g)); } if (at("+")) { p++; return unary(); } return primary(); };
  const primary = () => {
    const t = tk[p];
    if (!t) throw new Error("Formeln slutar oväntat");
    if (t.t === "num" || t.t === "str") { p++; return () => t.v; }
    if (t.t === "field") { p++; return (g) => g(t.v); }
    if (t.t === "op" && t.v === "(") { p++; const e = expr(); if (!eat(")")) throw new Error("Saknar )"); return e; }
    if (t.t === "id") {
      const name = t.v.toUpperCase(); p++;
      if (eat("(")) {
        const args = [];
        if (!eat(")")) { do { args.push(expr()); } while (eat(",")); if (!eat(")")) throw new Error("Saknar )"); }
        const fn = FN[name];
        if (!fn) throw new Error("Okänd funktion: " + t.v);
        return (g) => fn(args.map((a) => a(g)));
      }
      if (name === "TRUE") return () => true;
      if (name === "FALSE") return () => false;
      throw new Error("Okänt namn: " + t.v);
    }
    throw new Error("Fel vid: " + t.v);
  };

  const fn = expr();
  if (p < tk.length) throw new Error("Oväntat: " + tk[p].v);
  return fn;
}

const formulaCache = new Map();
function getFormula(src) {
  if (!src || !src.trim()) return { err: "Tom formel" };
  if (formulaCache.has(src)) return formulaCache.get(src);
  let res;
  try { res = { fn: compileFormula(src) }; } catch (e) { res = { err: e.message }; }
  formulaCache.set(src, res);
  return res;
}

/* ------------------------------------------------------------------ */
/*  Värden: beräknade fält, länkar, formatering                        */
/* ------------------------------------------------------------------ */
async function loadBuildings() {
  const { data, error } = await window.supabase
    .from('buildings')
    .select('*')

  if (error) {
    console.error(error)
    return []
  }

  return data
}

async function saveBuilding(building) {
  const { error } = await window.supabase
    .from('buildings')
    .upsert(building)

  if (error) console.error(error)
}

const nf = new Intl.NumberFormat("sv-SE");
const cf = new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 });

function recordTitle(ctx, tableId, recId) {
  const t = ctx.tables.find((x) => x.id === tableId);
  if (!t) return "";
  const r = t.records.find((x) => x.id === recId);
  if (!r) return "";
  return str(getValue(ctx, t, r, t.fields[0])) || "Namnlös";
}

function getValue(ctx, table, rec, field, depth = 0) {
  if (!field || !rec) return null;
  if (depth > 6) return "#DJUP";
  if (field.type === "formula") {
    const c = getFormula(field.formula);
    if (c.err) return "#FEL";
    try {
      return c.fn((name) => {
        const f = table.fields.find((x) => x.name === name);
        if (!f) return null;
        return formulaValue(ctx, table, rec, f, depth + 1);
      });
    } catch (e) { return "#FEL"; }
  }
  if (field.type === "rollup") {
    const lf = table.fields.find((f) => f.id === field.linkFieldId);
    if (!lf || lf.type !== "link") return null;
    const lt = ctx.tables.find((t) => t.id === lf.linkedTableId);
    if (!lt) return null;
    const ids = rec.cells[lf.id] || [];
    const recs = ids.map((id) => lt.records.find((r) => r.id === id)).filter(Boolean);
    if (field.agg === "count") return recs.length;
    const tf = lt.fields.find((f) => f.id === field.targetFieldId);
    if (!tf) return null;
    const raw = recs.map((r) => getValue(ctx, lt, r, tf, depth + 1)).filter((v) => v !== null && v !== undefined && v !== "");
    if (field.agg === "concat") return raw.map((v) => cellText(tf, v, ctx)).join(", ");
    const nums = raw.map(num);
    if (!nums.length) return null;
    if (field.agg === "sum") return Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
    if (field.agg === "avg") return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
    if (field.agg === "min") return Math.min(...nums);
    if (field.agg === "max") return Math.max(...nums);
    return nums.length;
  }
  return rec.cells[field.id];
}

function formulaValue(ctx, table, rec, f, depth) {
  const v = getValue(ctx, table, rec, f, depth);
  switch (f.type) {
    case "select": return (f.options || []).find((o) => o.id === v)?.name || "";
    case "multiSelect": return (v || []).map((id) => (f.options || []).find((o) => o.id === id)?.name).filter(Boolean);
    case "link": return (v || []).map((id) => recordTitle(ctx, f.linkedTableId, id));
    case "checkbox": return !!v;
    default: return v ?? null;
  }
}

function cellText(field, v, ctx) {
  if (v === undefined || v === null || v === "") return "";
  switch (field.type) {
    case "select": return (field.options || []).find((o) => o.id === v)?.name || "";
    case "multiSelect": return (v || []).map((id) => (field.options || []).find((o) => o.id === id)?.name).filter(Boolean).join(", ");
    case "link": return (v || []).map((id) => recordTitle(ctx || { tables: [] }, field.linkedTableId, id)).join(", ");
    case "checkbox": return v ? "Ja" : "";
    case "currency": return cf.format(v);
    case "number": return nf.format(v);
    case "rollup": return typeof v === "number" ? nf.format(v) : str(v);
    case "formula": return typeof v === "number" ? nf.format(Math.round(v * 100) / 100) : str(v);
    default: return String(v);
  }
}

function isEmptyVal(field, v) {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (field.type === "checkbox" || field.type === "rating") return !v;
  return false;
}

function compareValues(field, a, b) {
  const t = field.type;
  if (["number", "currency", "rating", "rollup"].includes(t) || (t === "formula" && typeof a === "number")) {
    const av = a ?? null, bv = b ?? null;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return num(av) - num(bv);
  }
  if (t === "checkbox") return (a ? 1 : 0) - (b ? 1 : 0);
  if (t === "select") {
    const ix = (id) => { const i = (field.options || []).findIndex((o) => o.id === id); return i < 0 ? 999 : i; };
    return ix(a) - ix(b);
  }
  const at = str(a), bt = str(b);
  if (!at && bt) return 1;
  if (at && !bt) return -1;
  return at.localeCompare(bt, "sv");
}

const OPS = {
  textual: [["contains", "innehåller"], ["notContains", "innehåller inte"], ["is", "är"], ["isNot", "är inte"], ["empty", "är tom"], ["notEmpty", "är inte tom"]],
  numeric: [["eq", "="], ["neq", "≠"], ["gt", ">"], ["lt", "<"], ["gte", "≥"], ["lte", "≤"], ["empty", "är tom"], ["notEmpty", "är inte tom"]],
  select: [["is", "är"], ["isNot", "är inte"], ["empty", "är tom"], ["notEmpty", "är inte tom"]],
  multi: [["hasAny", "har någon av"], ["hasAll", "har alla av"], ["empty", "är tom"], ["notEmpty", "är inte tom"]],
  checkbox: [["is", "är"]],
  date: [["is", "är"], ["before", "är före"], ["after", "är efter"], ["empty", "är tom"], ["notEmpty", "är inte tom"]],
};
function opsFor(type) {
  if (["number", "currency", "rating", "rollup"].includes(type)) return OPS.numeric;
  if (type === "select" || type === "person") return OPS.select;
  if (type === "multiSelect" || type === "link") return OPS.multi;
  if (type === "checkbox") return OPS.checkbox;
  if (type === "date") return OPS.date;
  return OPS.textual;
}

function matchFilter(value, field, item, ctx) {
  const { op } = item;
  if (op === "empty") return isEmptyVal(field, value);
  if (op === "notEmpty") return !isEmptyVal(field, value);
  if (["number", "currency", "rating", "rollup"].includes(field.type)) {
    const q = Number(item.value);
    if (item.value === "" || item.value === undefined || Number.isNaN(q)) return true;
    if (value === undefined || value === null || value === "") return false;
    const n = num(value);
    return { eq: n === q, neq: n !== q, gt: n > q, lt: n < q, gte: n >= q, lte: n <= q }[op] ?? true;
  }
  if (field.type === "checkbox") return Boolean(value) === (item.value === "true" || item.value === true);
  if (field.type === "select" || field.type === "person") {
    if (!item.value) return true;
    return op === "is" ? value === item.value : value !== item.value;
  }
  if (field.type === "multiSelect" || field.type === "link") {
    const arr = value || [], sel = item.value || [];
    if (!sel.length) return true;
    return op === "hasAll" ? sel.every((s) => arr.includes(s)) : sel.some((s) => arr.includes(s));
  }
  if (field.type === "date") {
    if (!item.value) return true;
    if (!value) return false;
    return { is: value === item.value, before: value < item.value, after: value > item.value }[op] ?? true;
  }
  const txt = cellText(field, value, ctx).toLowerCase();
  const q = String(item.value ?? "").toLowerCase();
  if (!q) return true;
  return { contains: txt.includes(q), notContains: !txt.includes(q), is: txt === q, isNot: txt !== q }[op] ?? true;
}

/* ------------------------------------------------------------------ */
/*  Demodata: fastighetsbestånd                                        */
/* ------------------------------------------------------------------ */

function seed() {
  const ort = [opt("Stockholm", "blue"), opt("Göteborg", "teal"), opt("Malmö", "orange"), opt("Uppsala", "purple")];
  const bstatus = [opt("I drift", "green"), opt("Projektering", "yellow"), opt("Renovering", "orange"), opt("Avvecklad", "gray")];
  const klass = [opt("A", "green"), opt("B", "teal"), opt("C", "yellow"), opt("D", "orange"), opt("E", "red"), opt("F", "gray")];
  const utyp = [opt("Kontor", "blue"), opt("Lager", "gray"), opt("Teknikrum", "purple"), opt("Butik", "pink"), opt("Garage", "cyan"), opt("Trapphus", "teal")];
  const uthyr = [opt("Uthyrd", "green"), opt("Vakant", "red"), opt("Under renovering", "yellow")];
  const styp = [opt("Temperatur", "orange"), opt("CO₂", "teal"), opt("Fukt", "blue"), opt("Energi", "purple"), opt("Närvaro", "pink")];
  const sstatus = [opt("Online", "green"), opt("Offline", "red"), opt("Kalibreras", "yellow")];
  const atyp = [opt("Fel", "red"), opt("Underhåll", "blue"), opt("Ombyggnad", "purple"), opt("Besiktning", "teal")];
  const aprio = [opt("Akut", "red"), opt("Hög", "orange"), opt("Normal", "yellow"), opt("Låg", "cyan")];
  const atagg = [opt("Ventilation", "teal"), opt("El", "yellow"), opt("Stomme", "gray"), opt("Hyresgäst", "pink"), opt("Energi", "purple")];

  const bygg = [
    ["b1", "Kv. Skogsbrynet 3", "Skogsvägen 3, Solna", 0, 0, 1998, 9400, "Anna Lind", 412000, 2, "2026-04-12"],
    ["b2", "Hamnmagasinet 12", "Kajgatan 12, Göteborg", 1, 2, 1962, 14200, "Erik Sjöberg", 986000, 4, "2025-11-03"],
    ["b3", "Verkstaden Syd", "Industrigatan 8, Malmö", 2, 0, 2007, 6100, "Maja Nyström", 298000, 1, "2026-02-27"],
    ["b4", "Campus Nord Hus B", "Rackarbergsgatan 40, Uppsala", 3, 0, 2016, 11800, "Omar Haddad", 401000, 1, "2026-06-01"],
    ["b5", "Kv. Linjalen 7", "Sveavägen 118, Stockholm", 0, 1, 2027, 8300, "Sara Ek", 0, 3, "2026-07-18"],
  ];

  const utrym = [
    ["u1", "Plan 3 – Kontor Nord", "b1", 0, 3, 940, "Nordisk Data AB", 0],
    ["u2", "Plan 2 – Kontor Syd", "b1", 0, 2, 880, "Nordisk Data AB", 0],
    ["u3", "Källare – Fjärrvärmecentral", "b1", 2, -1, 120, "", 0],
    ["u4", "Magasin A", "b2", 1, 1, 3200, "Kajlogistik AB", 0],
    ["u5", "Magasin B", "b2", 1, 1, 2950, "", 1],
    ["u6", "Plan 4 – Kontorshotell", "b2", 0, 4, 1240, "Flera hyresgäster", 0],
    ["u7", "Butikslokal gatuplan", "b2", 3, 0, 410, "Café Kajen", 0],
    ["u8", "Verkstadshall", "b3", 1, 1, 2600, "Syd Mekaniska", 0],
    ["u9", "Teknikrum norr", "b3", 2, 1, 85, "", 0],
    ["u10", "Föreläsningssal B1", "b4", 0, 1, 620, "Universitetet", 0],
    ["u11", "Labb B4", "b4", 0, 4, 480, "Universitetet", 2],
    ["u12", "Garageplan -1", "b4", 4, -1, 2200, "", 0],
  ];

  const sens = [
    ["s1", "SB-TMP-001", "u1", 0, 21.4, "°C", "2026-08-11", 0, 84],
    ["s2", "SB-CO2-002", "u1", 1, 612, "ppm", "2026-08-11", 0, 77],
    ["s3", "SB-TMP-003", "u2", 0, 22.8, "°C", "2026-08-11", 0, 15],
    ["s4", "SB-ENE-004", "u3", 3, 41.2, "kW", "2026-08-11", 0, 100],
    ["s5", "SB-FKT-005", "u3", 2, 63, "%RF", "2026-08-10", 2, 58],
    ["s6", "SB-TMP-006", "u4", 0, 8.9, "°C", "2026-08-11", 0, 91],
    ["s7", "SB-FKT-007", "u4", 2, 71, "%RF", "2026-08-11", 0, 44],
    ["s8", "SB-TMP-008", "u5", 0, 9.6, "°C", "2026-08-05", 1, 12],
    ["s9", "SB-CO2-009", "u6", 1, 848, "ppm", "2026-08-11", 0, 66],
    ["s10", "SB-NRV-010", "u6", 4, 23, "pers", "2026-08-11", 0, 88],
    ["s11", "SB-TMP-011", "u7", 0, 24.1, "°C", "2026-08-11", 0, 31],
    ["s12", "SB-ENE-012", "u8", 3, 118.5, "kW", "2026-08-11", 0, 100],
    ["s13", "SB-TMP-013", "u9", 0, 27.6, "°C", "2026-08-09", 2, 19],
    ["s14", "SB-CO2-014", "u10", 1, 1140, "ppm", "2026-08-11", 0, 73],
    ["s15", "SB-FKT-015", "u11", 2, 45, "%RF", "2026-08-11", 0, 95],
    ["s16", "SB-NRV-016", "u12", 4, 41, "pers", "2026-08-04", 1, 8],
  ];

  const aren = [
    ["a1", "Kylan fallerar i labb B4", "b4", 0, 0, "Omar Haddad", "2026-08-08", "2026-08-14", 42000, false, [0], "Kylbafflarna når inte börvärdet. Serviceföretaget bokat."],
    ["a2", "Fuktmätning magasin A", "b2", 1, 1, "Erik Sjöberg", "2026-08-02", "2026-08-20", 18000, false, [2], "Förhöjd RF sedan juli. Kontrollera takavvattning."],
    ["a3", "Byte av sensorbatterier", "b2", 1, 2, "Erik Sjöberg", "2026-07-28", "2026-08-25", 6000, false, [1], "Fyra givare under 20 %."],
    ["a4", "OVK-besiktning", "b1", 3, 1, "Anna Lind", "2026-06-15", "2026-09-01", 35000, false, [0], "Protokoll från 2023 ska bifogas."],
    ["a5", "Hyresgästanpassning plan 4", "b2", 2, 2, "Maja Nyström", "2026-05-20", "2026-10-15", 890000, false, [3], "Nya kontorsrum och glaspartier."],
    ["a6", "Injustering värmesystem", "b3", 1, 2, "Maja Nyström", "2026-07-01", "2026-08-30", 74000, false, [4, 0], "Teknikrum norr går varmt."],
    ["a7", "Portöppnare garage", "b4", 0, 1, "Omar Haddad", "2026-08-09", "2026-08-16", 12500, false, [1], "Fastnar i öppet läge på morgnarna."],
    ["a8", "Energikartläggning", "b1", 1, 3, "Anna Lind", "2026-03-11", "2026-08-01", 55000, true, [4], "Rapport levererad och godkänd."],
    ["a9", "Projektering stomme", "b5", 2, 1, "Sara Ek", "2026-04-02", "2026-12-01", 2400000, false, [2], "Systemhandling pågår."],
    ["a10", "Läckage café gatuplan", "b2", 0, 0, "Erik Sjöberg", "2026-08-10", "2026-08-12", 21000, false, [3], "Vatten under diskbänk, akut."],
  ];

  const T = {
    bygg: {
      id: "t_bygg", name: "Byggnader", icon: "building",
      fields: [
        { id: "bg_namn", name: "Byggnad", type: "text", width: 210 },
        { id: "bg_adress", name: "Adress", type: "text", width: 220 },
        { id: "bg_ort", name: "Ort", type: "select", width: 130, options: ort },
        { id: "bg_status", name: "Status", type: "select", width: 140, options: bstatus },
        { id: "bg_utrymmen", name: "Utrymmen", type: "link", width: 240, linkedTableId: "t_utr", symmetricFieldId: "ut_byggnad" },
        { id: "bg_antal", name: "Antal utrymmen", type: "rollup", width: 130, linkFieldId: "bg_utrymmen", agg: "count" },
        { id: "bg_uthyrd", name: "Uthyrbar area (m²)", type: "rollup", width: 150, linkFieldId: "bg_utrymmen", targetFieldId: "ut_area", agg: "sum" },
        { id: "bg_bta", name: "Area BTA (m²)", type: "number", width: 130 },
        { id: "bg_grad", name: "Uthyrningsgrad", type: "formula", width: 140, formula: 'ROUND({Uthyrbar area (m²)} / {Area BTA (m²)} * 100, 1) & " %"' },
        { id: "bg_energi", name: "Energi (kWh/år)", type: "number", width: 140 },
        { id: "bg_tal", name: "Energital (kWh/m²)", type: "formula", width: 150, formula: "ROUND({Energi (kWh/år)} / {Area BTA (m²)}, 1)" },
        { id: "bg_klass", name: "Energiklass", type: "select", width: 120, options: klass },
        { id: "bg_arenden", name: "Ärenden", type: "link", width: 240, linkedTableId: "t_aren", symmetricFieldId: "ar_byggnad" },
        { id: "bg_chef", name: "Fastighetschef", type: "person", width: 170 },
        { id: "bg_ar", name: "Byggår", type: "number", width: 100 },
        { id: "bg_bes", name: "Senast besiktigad", type: "date", width: 150 },
      ],
      records: bygg.map((b) => ({
        id: b[0], comments: [],
        cells: { bg_namn: b[1], bg_adress: b[2], bg_ort: ort[b[3]].id, bg_status: bstatus[b[4]].id, bg_ar: b[5], bg_bta: b[6], bg_chef: b[7], bg_energi: b[8], bg_klass: klass[b[9]].id, bg_bes: b[10], bg_utrymmen: [], bg_arenden: [] },
      })),
      views: [
        { id: "v_b1", name: "Alla byggnader", type: "grid", filters: { conjunction: "and", items: [] }, sorts: [], groupBy: null, hidden: [], rowHeight: 32, colorFieldId: "bg_status" },
        { id: "v_b2", name: "Per ort", type: "kanban", filters: { conjunction: "and", items: [] }, sorts: [], groupBy: null, hidden: [], rowHeight: 32, colorFieldId: null, stackFieldId: "bg_ort" },
        { id: "v_b3", name: "Fastighetskort", type: "gallery", filters: { conjunction: "and", items: [] }, sorts: [], groupBy: null, hidden: [], rowHeight: 32, colorFieldId: "bg_status" },
      ],
    },
    utr: {
      id: "t_utr", name: "Utrymmen", icon: "space",
      fields: [
        { id: "ut_namn", name: "Utrymme", type: "text", width: 230 },
        { id: "ut_byggnad", name: "Byggnad", type: "link", width: 190, linkedTableId: "t_bygg", symmetricFieldId: "bg_utrymmen" },
        { id: "ut_typ", name: "Typ", type: "select", width: 130, options: utyp },
        { id: "ut_plan", name: "Plan", type: "number", width: 80 },
        { id: "ut_area", name: "Area (m²)", type: "number", width: 110 },
        { id: "ut_hyresgast", name: "Hyresgäst", type: "text", width: 180 },
        { id: "ut_uthyr", name: "Uthyrning", type: "select", width: 150, options: uthyr },
        { id: "ut_sensorer", name: "Sensorer", type: "link", width: 240, linkedTableId: "t_sens", symmetricFieldId: "se_utrymme" },
        { id: "ut_ant", name: "Antal sensorer", type: "rollup", width: 130, linkFieldId: "ut_sensorer", agg: "count" },
        { id: "ut_batt", name: "Lägsta batteri (%)", type: "rollup", width: 150, linkFieldId: "ut_sensorer", targetFieldId: "se_batteri", agg: "min" },
        { id: "ut_larm", name: "Batterilarm", type: "formula", width: 140, formula: 'IF({Antal sensorer} = 0, "—", IF({Lägsta batteri (%)} < 20, "Byt batteri", "OK"))' },
      ],
      records: utrym.map((u) => ({
        id: u[0], comments: [],
        cells: { ut_namn: u[1], ut_byggnad: [u[2]], ut_typ: utyp[u[3]].id, ut_plan: u[4], ut_area: u[5], ut_hyresgast: u[6], ut_uthyr: uthyr[u[7]].id, ut_sensorer: [] },
      })),
      views: [
        { id: "v_u1", name: "Alla utrymmen", type: "grid", filters: { conjunction: "and", items: [] }, sorts: [], groupBy: "ut_byggnad", hidden: [], rowHeight: 32, colorFieldId: "ut_uthyr" },
      ],
    },
    sens: {
      id: "t_sens", name: "Sensorer", icon: "sensor",
      fields: [
        { id: "se_id", name: "Sensor-ID", type: "text", width: 150 },
        { id: "se_utrymme", name: "Utrymme", type: "link", width: 220, linkedTableId: "t_utr", symmetricFieldId: "ut_sensorer" },
        { id: "se_typ", name: "Mätvärde", type: "select", width: 130, options: styp },
        { id: "se_varde", name: "Senaste värde", type: "number", width: 130 },
        { id: "se_enhet", name: "Enhet", type: "text", width: 90 },
        { id: "se_status", name: "Driftstatus", type: "select", width: 130, options: sstatus },
        { id: "se_batteri", name: "Batteri (%)", type: "number", width: 110 },
        { id: "se_avlast", name: "Avläst", type: "date", width: 120 },
        { id: "se_atgard", name: "Åtgärd", type: "formula", width: 190, formula: 'IF({Driftstatus} = "Offline", "Kontrollera anslutning", IF({Batteri (%)} < 20, "Byt batteri", "Inget just nu"))' },
      ],
      records: sens.map((s) => ({
        id: s[0], comments: [],
        cells: { se_id: s[1], se_utrymme: [s[2]], se_typ: styp[s[3]].id, se_varde: s[4], se_enhet: s[5], se_avlast: s[6], se_status: sstatus[s[7]].id, se_batteri: s[8] },
      })),
      views: [
        { id: "v_s1", name: "Alla sensorer", type: "grid", filters: { conjunction: "and", items: [] }, sorts: [], groupBy: null, hidden: [], rowHeight: 32, colorFieldId: "se_status" },
        { id: "v_s2", name: "Driftstatus", type: "kanban", filters: { conjunction: "and", items: [] }, sorts: [], groupBy: null, hidden: [], rowHeight: 32, colorFieldId: null, stackFieldId: "se_status" },
      ],
    },
    aren: {
      id: "t_aren", name: "Ärenden", icon: "issue",
      fields: [
        { id: "ar_namn", name: "Ärende", type: "text", width: 250 },
        { id: "ar_byggnad", name: "Byggnad", type: "link", width: 190, linkedTableId: "t_bygg", symmetricFieldId: "bg_arenden" },
        { id: "ar_typ", name: "Typ", type: "select", width: 130, options: atyp },
        { id: "ar_prio", name: "Prioritet", type: "select", width: 120, options: aprio },
        { id: "ar_ansvarig", name: "Ansvarig", type: "person", width: 170 },
        { id: "ar_deadline", name: "Deadline", type: "date", width: 120 },
        { id: "ar_dagar", name: "Dagar kvar", type: "formula", width: 110, formula: "DAYS(TODAY(), {Deadline})" },
        { id: "ar_kostnad", name: "Kostnad", type: "currency", width: 130 },
        { id: "ar_klar", name: "Klar", type: "checkbox", width: 70 },
        { id: "ar_taggar", name: "Taggar", type: "multiSelect", width: 200, options: atagg },
        { id: "ar_anmald", name: "Anmäld", type: "date", width: 120 },
        { id: "ar_besk", name: "Beskrivning", type: "longText", width: 260 },
      ],
      records: aren.map((a) => ({
        id: a[0], comments: [],
        cells: { ar_namn: a[1], ar_byggnad: [a[2]], ar_typ: atyp[a[3]].id, ar_prio: aprio[a[4]].id, ar_ansvarig: a[5], ar_anmald: a[6], ar_deadline: a[7], ar_kostnad: a[8], ar_klar: a[9], ar_taggar: a[10].map((i) => atagg[i].id), ar_besk: a[11] },
      })),
      views: [
        { id: "v_a1", name: "Alla ärenden", type: "grid", filters: { conjunction: "and", items: [] }, sorts: [], groupBy: null, hidden: [], rowHeight: 32, colorFieldId: "ar_prio" },
        { id: "v_a2", name: "Per prioritet", type: "kanban", filters: { conjunction: "and", items: [] }, sorts: [], groupBy: null, hidden: [], rowHeight: 32, colorFieldId: null, stackFieldId: "ar_prio" },
      ],
    },
  };

  // Bygg upp de omvända länkarna så att båda sidor stämmer
  T.utr.records.forEach((u) => {
    const b = T.bygg.records.find((x) => x.id === u.cells.ut_byggnad[0]);
    if (b) b.cells.bg_utrymmen.push(u.id);
  });
  T.aren.records.forEach((a) => {
    const b = T.bygg.records.find((x) => x.id === a.cells.ar_byggnad[0]);
    if (b) b.cells.bg_arenden.push(a.id);
  });
  T.sens.records.forEach((s) => {
    const u = T.utr.records.find((x) => x.id === s.cells.se_utrymme[0]);
    if (u) u.cells.ut_sensorer.push(s.id);
  });

  return { name: "Digital tvilling – bestånd", group: "Simple Buildings", tables: [T.bygg, T.utr, T.sens, T.aren] };
}

/* ------------------------------------------------------------------ */
/*  Byggstenar                                                         */
/* ------------------------------------------------------------------ */

const Ctx = createContext({ tables: [] });
const useCtx = () => useContext(Ctx);

function Popover({ rect, onClose, width = 320, align = "left", children, offsetY = 6 }) {
  if (!rect) return null;
  const left = align === "right"
    ? Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
    : Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const top = Math.min(rect.bottom + offsetY, Math.max(60, window.innerHeight - 140));
  return (
    <>
      <div className="sb-backdrop" onMouseDown={onClose} />
      <div className="sb-pop" style={{ left, top, width }} onMouseDown={(e) => e.stopPropagation()}>{children}</div>
    </>
  );
}

function Pill({ option, onRemove }) {
  const c = colorOf(option.color);
  return (
    <span className="sb-pill" style={{ background: c.bg, color: c.text }}>
      {option.name}
      {onRemove && <X size={11} className="sb-pill-x" onMouseDown={(e) => { e.stopPropagation(); onRemove(); }} />}
    </span>
  );
}

function LinkChip({ title, onRemove }) {
  return (
    <span className="sb-chip">
      <span className="sb-chip-dot" />
      <span className="sb-chip-t">{title || "Namnlös"}</span>
      {onRemove && <X size={11} className="sb-pill-x" onMouseDown={(e) => { e.stopPropagation(); onRemove(); }} />}
    </span>
  );
}

function Avatar({ name, size = 20 }) {
  const p = PEOPLE.find((x) => x.name === name);
  const c = colorOf(p?.color || "gray");
  const initials = String(name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("");
  return <span className="sb-avatar" style={{ background: c.solid, width: size, height: size, fontSize: size * 0.45 }}>{initials}</span>;
}

function Highlight({ text, query }) {
  if (!query || !text) return <>{text}</>;
  const i = String(text).toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return <>{text}</>;
  const t = String(text);
  return <>{t.slice(0, i)}<mark className="sb-mark">{t.slice(i, i + query.length)}</mark>{t.slice(i + query.length)}</>;
}

function Stars({ value = 0, onChange, size = 15 }) {
  return (
    <span className="sb-stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= (value || 0) ? "sb-star on" : "sb-star"}
          onMouseDown={onChange ? (e) => { e.stopPropagation(); onChange(n === value ? 0 : n); } : undefined} />
      ))}
    </span>
  );
}

function Logo({ size = 30 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-label="Simple Buildings">
      <rect width="32" height="32" rx="8" fill="#0f1b1a" />
      <path d="M6.5 23V12.2L12.5 8.6V23" fill="none" stroke="#5fd7c8" strokeWidth="1.2" strokeDasharray="2.6 2" strokeLinejoin="round" />
      <path d="M12.5 23V10.6L20 15V23Z" fill="#12b3a8" />
      <path d="M20 23v-5.4l5 2.9V23z" fill="#5fd7c8" />
      <path d="M4 23.6h24" stroke="#5fd7c8" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Cellvisning                                                        */
/* ------------------------------------------------------------------ */

function CellValue({ field, value, query, onQuickChange }) {
  const ctx = useCtx();
  if (field.type === "checkbox")
    return (
      <span className="sb-cell-center">
        <span className={"sb-check" + (value ? " on" : "")} onMouseDown={(e) => { e.stopPropagation(); onQuickChange && onQuickChange(!value); }}>
          {value && <Check size={11} strokeWidth={3.5} />}
        </span>
      </span>
    );
  if (field.type === "rating") return <Stars value={value} onChange={onQuickChange} />;
  if (field.type === "select") {
    const o = (field.options || []).find((x) => x.id === value);
    return o ? <Pill option={o} /> : null;
  }
  if (field.type === "multiSelect") {
    const opts = (value || []).map((id) => (field.options || []).find((o) => o.id === id)).filter(Boolean);
    return <span className="sb-pills">{opts.map((o) => <Pill key={o.id} option={o} />)}</span>;
  }
  if (field.type === "link") {
    const ids = value || [];
    return <span className="sb-pills">{ids.map((id) => <LinkChip key={id} title={recordTitle(ctx, field.linkedTableId, id)} />)}</span>;
  }
  if (field.type === "formula" || field.type === "rollup") {
    const t = cellText(field, value, ctx);
    if (t === "") return null;
    const isNum = typeof value === "number";
    return <span className={"sb-computed" + (isNum ? " num" : "")}>{t}</span>;
  }
  if (field.type === "person" && value) return <span className="sb-person"><Avatar name={value} /><span>{value}</span></span>;
  if (field.type === "url" && value) return <a className="sb-link" href={value} target="_blank" rel="noreferrer" onMouseDown={(e) => e.stopPropagation()}><Highlight text={value} query={query} /></a>;
  if (field.type === "email" && value) return <a className="sb-link" href={"mailto:" + value} onMouseDown={(e) => e.stopPropagation()}><Highlight text={value} query={query} /></a>;
  if (field.type === "number" || field.type === "currency") return <span className="sb-num">{cellText(field, value, ctx)}</span>;
  if (field.type === "date" && value) return <span>{value}</span>;
  return <span className="sb-txt"><Highlight text={value ? String(value) : ""} query={query} /></span>;
}

/* ------------------------------------------------------------------ */
/*  Redigerare                                                         */
/* ------------------------------------------------------------------ */

function SelectEditor({ field, value, multi, onChange, onClose, onAddOption }) {
  const [q, setQ] = useState("");
  const opts = (field.options || []).filter((o) => o.name.toLowerCase().includes(q.toLowerCase()));
  const sel = multi ? value || [] : value;
  const toggle = (id) => {
    if (multi) {
      const arr = value || [];
      onChange(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
    } else { onChange(value === id ? null : id); onClose(); }
  };
  return (
    <div className="sb-editor">
      <div className="sb-pop-search">
        <Search size={13} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök alternativ" />
      </div>
      <div className="sb-pop-list">
        {opts.map((o) => (
          <div key={o.id} className="sb-pop-item" onMouseDown={(e) => { e.preventDefault(); toggle(o.id); }}>
            <Pill option={o} />
            {(multi ? sel.includes(o.id) : sel === o.id) && <Check size={14} className="sb-pop-check" />}
          </div>
        ))}
        {!opts.length && q && (
          <div className="sb-pop-item" onMouseDown={(e) => { e.preventDefault(); const o = onAddOption(q); toggle(o.id); }}>
            <Plus size={13} /><span style={{ marginLeft: 6 }}>Skapa ”{q}”</span>
          </div>
        )}
        {!opts.length && !q && <div className="sb-pop-empty">Inga alternativ ännu</div>}
      </div>
    </div>
  );
}

function LinkEditor({ field, value, onChange, onCreate }) {
  const ctx = useCtx();
  const [q, setQ] = useState("");
  const lt = ctx.tables.find((t) => t.id === field.linkedTableId);
  if (!lt) return <div className="sb-pop-empty">Fältet pekar inte på någon tabell.</div>;
  const sel = value || [];
  const list = lt.records.filter((r) => recordTitle(ctx, lt.id, r.id).toLowerCase().includes(q.toLowerCase()));
  const second = lt.fields[2] || lt.fields[1];
  return (
    <div className="sb-editor">
      <div className="sb-pop-search">
        <Search size={13} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={"Sök i " + lt.name} />
      </div>
      <div className="sb-pop-list scroll">
        {list.map((r) => {
          const on = sel.includes(r.id);
          return (
            <div key={r.id} className={"sb-pop-item" + (on ? " selected" : "")}
              onMouseDown={(e) => { e.preventDefault(); onChange(on ? sel.filter((x) => x !== r.id) : [...sel, r.id]); }}>
              <div className="sb-linkrow">
                <div className="sb-linkrow-t">{recordTitle(ctx, lt.id, r.id)}</div>
                {second && <div className="sb-linkrow-s">{cellText(second, getValue(ctx, lt, r, second), ctx)}</div>}
              </div>
              {on && <Check size={14} className="sb-pop-check" />}
            </div>
          );
        })}
        {!list.length && <div className="sb-pop-empty">Inga träffar</div>}
      </div>
      {q && onCreate && (
        <div className="sb-pop-foot">
          <button onMouseDown={(e) => { e.preventDefault(); const id = onCreate(lt.id, q); onChange([...sel, id]); setQ(""); }}>
            <Plus size={13} /> Skapa ”{q}” i {lt.name}
          </button>
        </div>
      )}
    </div>
  );
}

function InlineEditor({ field, value, rect, onCommit, onCancel, onAddOption, onCreateLinked, initialChar }) {
  const [val, setVal] = useState(() => {
    if (initialChar !== undefined && ["text", "longText", "number", "currency", "url", "email", "phone"].includes(field.type)) return initialChar;
    return value ?? "";
  });
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    if (ref.current?.setSelectionRange) { const l = String(val ?? "").length; try { ref.current.setSelectionRange(l, l); } catch (e) {} }
  }, []);

  const parse = (v) => {
    if (field.type === "number" || field.type === "currency") {
      if (v === "" || v === null) return null;
      const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
      return Number.isNaN(n) ? null : n;
    }
    return v;
  };

  if (field.type === "select" || field.type === "multiSelect")
    return (
      <Popover rect={rect} onClose={onCancel} width={Math.max(250, rect.width)} offsetY={0}>
        <SelectEditor field={field} value={value} multi={field.type === "multiSelect"}
          onChange={(v) => onCommit(v, field.type === "multiSelect")} onClose={onCancel} onAddOption={onAddOption} />
      </Popover>
    );

  if (field.type === "link")
    return (
      <Popover rect={rect} onClose={onCancel} width={Math.max(300, rect.width)} offsetY={0}>
        <LinkEditor field={field} value={value} onChange={(v) => onCommit(v, true)} onCreate={onCreateLinked} />
      </Popover>
    );

  if (field.type === "person")
    return (
      <Popover rect={rect} onClose={onCancel} width={Math.max(240, rect.width)} offsetY={0}>
        <div className="sb-pop-list">
          {PEOPLE.map((p) => (
            <div key={p.name} className="sb-pop-item" onMouseDown={(e) => { e.preventDefault(); onCommit(p.name); }}>
              <span className="sb-person"><Avatar name={p.name} /><span>{p.name}</span></span>
              {value === p.name && <Check size={14} className="sb-pop-check" />}
            </div>
          ))}
          <div className="sb-pop-item sb-pop-clear" onMouseDown={(e) => { e.preventDefault(); onCommit(null); }}>Rensa</div>
        </div>
      </Popover>
    );

  if (field.type === "longText")
    return (
      <div className="sb-inline-tall" style={{ width: Math.max(rect.width, 300) }}>
        <textarea ref={ref} value={val} onChange={(e) => setVal(e.target.value)} onBlur={() => onCommit(val)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.stopPropagation(); onCancel(); }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onCommit(val);
          }} />
      </div>
    );

  return (
    <input ref={ref} className="sb-inline-input" type={field.type === "date" ? "date" : "text"} value={val ?? ""}
      onChange={(e) => setVal(e.target.value)} onBlur={() => onCommit(parse(val))}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.stopPropagation(); onCancel(); }
        if (e.key === "Enter") { e.preventDefault(); onCommit(parse(val), false, "down"); }
        if (e.key === "Tab") { e.preventDefault(); onCommit(parse(val), false, e.shiftKey ? "left" : "right"); }
      }} />
  );
}

/* ================================================================== */
/*  App                                                                */
/* ================================================================== */

export default function SimpleBuildingsTwin() {
  const [base, setBase] = useState(seed);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const [tableId, setTableId] = useState("t_bygg");
  const [viewByTable, setViewByTable] = useState({});
  const [sidebar, setSidebar] = useState(true);
  const [menu, setMenu] = useState(null);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [checkedRows, setCheckedRows] = useState([]);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState([]);
  const gridRef = useRef(null);

  /* ---- Sparning ---- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        if (alive && r?.value) {
          const parsed = JSON.parse(r.value);
          if (parsed?.tables?.length) { setBase(parsed); setTableId(parsed.tables[0].id); }
        }
      } catch (e) { /* ingen sparad data ännu – kör demodata */ }
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try { await window.storage.set(STORAGE_KEY, JSON.stringify(base)); setSaveState("saved"); }
      catch (e) { setSaveState("error"); }
    }, 600);
    return () => clearTimeout(t);
  }, [base, loaded]);

  const table = base.tables.find((t) => t.id === tableId) || base.tables[0];
  const viewId = viewByTable[table.id] || table.views[0].id;
  const view = table.views.find((v) => v.id === viewId) || table.views[0];
  const fields = table.fields;
  const primary = fields[0];
  const ctx = useMemo(() => ({ tables: base.tables }), [base.tables]);

  /* ---- muterare ---- */
  const updateTable = useCallback((tid, fn) => {
    setBase((b) => ({ ...b, tables: b.tables.map((t) => (t.id === tid ? fn(t) : t)) }));
  }, []);
  const updateView = useCallback((patch) => {
    updateTable(table.id, (t) => ({ ...t, views: t.views.map((v) => (v.id === view.id ? { ...v, ...(typeof patch === "function" ? patch(v) : patch) } : v)) }));
  }, [table.id, view.id, updateTable]);

  // Sätter ett cellvärde. Länkfält synkas åt båda håll, precis som i Airtable.
  const setCell = useCallback((recordId, fieldId, value, tid = table.id) => {
    setBase((b) => {
      const src = b.tables.find((t) => t.id === tid);
      if (!src) return b;
      const field = src.fields.find((f) => f.id === fieldId);
      if (field?.type === "link") {
        const before = src.records.find((r) => r.id === recordId)?.cells[fieldId] || [];
        const after = value || [];
        const added = after.filter((i) => !before.includes(i));
        const removed = before.filter((i) => !after.includes(i));
        return {
          ...b,
          tables: b.tables.map((tb) => {
            let nt = tb;
            if (tb.id === src.id)
              nt = { ...nt, records: nt.records.map((r) => (r.id === recordId ? { ...r, cells: { ...r.cells, [fieldId]: after } } : r)) };
            if (field.symmetricFieldId && tb.id === field.linkedTableId)
              nt = {
                ...nt,
                records: nt.records.map((r) => {
                  const cur = r.cells[field.symmetricFieldId] || [];
                  if (added.includes(r.id)) return { ...r, cells: { ...r.cells, [field.symmetricFieldId]: [...cur, recordId] } };
                  if (removed.includes(r.id)) return { ...r, cells: { ...r.cells, [field.symmetricFieldId]: cur.filter((x) => x !== recordId) } };
                  return r;
                }),
              };
            return nt;
          }),
        };
      }
      return {
        ...b,
        tables: b.tables.map((tb) => (tb.id === tid ? { ...tb, records: tb.records.map((r) => (r.id === recordId ? { ...r, cells: { ...r.cells, [fieldId]: value } } : r)) } : tb)),
      };
    });
  }, [table.id]);

  const addOptionTo = useCallback((fieldId, name) => {
    const o = opt(name, COLORS[Math.floor(Math.random() * COLORS.length)].id);
    updateTable(table.id, (t) => ({ ...t, fields: t.fields.map((f) => (f.id === fieldId ? { ...f, options: [...(f.options || []), o] } : f)) }));
    return o;
  }, [table.id, updateTable]);

  const addRecord = (presetCells = {}) => {
    const rec = { id: uid("rec"), comments: [], cells: { ...presetCells } };
    updateTable(table.id, (t) => ({ ...t, records: [...t.records, rec] }));
    return rec;
  };

  // Skapar en post i en annan tabell direkt från länkredigeraren
  const createLinked = (tid, title) => {
    const id = uid("rec");
    setBase((b) => ({
      ...b,
      tables: b.tables.map((t) => (t.id === tid ? { ...t, records: [...t.records, { id, comments: [], cells: { [t.fields[0].id]: title } }] } : t)),
    }));
    return id;
  };

  const deleteRecords = (ids) => {
    setBase((b) => ({
      ...b,
      tables: b.tables.map((t) => ({
        ...t,
        records: (t.id === table.id ? t.records.filter((r) => !ids.includes(r.id)) : t.records).map((r) => {
          let cells = r.cells, touched = false;
          t.fields.forEach((f) => {
            if (f.type !== "link") return;
            const cur = r.cells[f.id];
            if (Array.isArray(cur) && cur.some((x) => ids.includes(x))) {
              if (!touched) { cells = { ...cells }; touched = true; }
              cells[f.id] = cur.filter((x) => !ids.includes(x));
            }
          });
          return touched ? { ...r, cells } : r;
        }),
      })),
    }));
    setCheckedRows([]);
  };

  const duplicateRecord = (id) => {
    updateTable(table.id, (t) => {
      const i = t.records.findIndex((r) => r.id === id);
      const copy = { ...t.records[i], id: uid("rec"), cells: { ...t.records[i].cells } };
      const arr = [...t.records]; arr.splice(i + 1, 0, copy);
      return { ...t, records: arr };
    });
  };

  const addField = (type = "text") => {
    const other = base.tables.find((t) => t.id !== table.id);
    const f = {
      id: uid("f"), name: typeMeta(type).label, type, width: 170,
      options: type === "select" || type === "multiSelect" ? [] : undefined,
      linkedTableId: type === "link" ? other?.id : undefined,
      formula: type === "formula" ? "" : undefined,
      linkFieldId: type === "rollup" ? fields.find((x) => x.type === "link")?.id : undefined,
      agg: type === "rollup" ? "count" : undefined,
    };
    updateTable(table.id, (t) => ({ ...t, fields: [...t.fields, f] }));
    if (type === "link" && other) setTimeout(() => ensureSymmetric(f.id), 0);
    return f;
  };

  // Skapar det omvända länkfältet i måltabellen (som Airtables symmetriska länkar)
  const ensureSymmetric = (fieldId) => {
    setBase((b) => {
      let tables = b.tables;
      const t = tables.find((x) => x.id === table.id);
      const f = t?.fields.find((x) => x.id === fieldId);
      if (!f || f.type !== "link" || !f.linkedTableId) return b;
      const other = tables.find((x) => x.id === f.linkedTableId);
      if (!other) return b;
      if (f.symmetricFieldId && other.fields.some((x) => x.id === f.symmetricFieldId)) return b;
      const symId = uid("f");
      tables = tables.map((x) => {
        if (x.id === t.id) return { ...x, fields: x.fields.map((y) => (y.id === fieldId ? { ...y, symmetricFieldId: symId } : y)) };
        return x;
      });
      tables = tables.map((x) =>
        x.id === other.id
          ? { ...x, fields: [...x.fields, { id: symId, name: t.name, type: "link", width: 200, linkedTableId: t.id, symmetricFieldId: fieldId }] }
          : x
      );
      return { ...b, tables };
    });
  };

  const applyFieldEdit = (fieldId, patch) => {
    updateTable(table.id, (t) => ({ ...t, fields: t.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) }));
    if (patch.type === "link") setTimeout(() => ensureSymmetric(fieldId), 0);
    if ("formula" in patch || "name" in patch) formulaCache.clear();
  };

  const setFieldWidth = (fieldId, width) =>
    updateTable(table.id, (t) => ({ ...t, fields: t.fields.map((f) => (f.id === fieldId ? { ...f, width } : f)) }));

  const deleteField = (fid) => {
    if (fid === primary.id) return;
    updateTable(table.id, (t) => ({
      ...t,
      fields: t.fields.filter((f) => f.id !== fid),
      views: t.views.map((v) => ({
        ...v, hidden: v.hidden.filter((h) => h !== fid), sorts: v.sorts.filter((s) => s.fieldId !== fid),
        filters: { ...v.filters, items: v.filters.items.filter((i) => i.fieldId !== fid) },
        groupBy: v.groupBy === fid ? null : v.groupBy,
      })),
    }));
  };

  /* ---- härledda rader ---- */
  const visibleFields = useMemo(
    () => fields.filter((f) => f.id === primary.id || !view.hidden.includes(f.id)),
    [fields, view.hidden, primary.id]
  );
  const gv = useCallback((rec, field) => getValue(ctx, table, rec, field), [ctx, table]);

  const rows = useMemo(() => {
    let rs = table.records;
    const items = view.filters.items.filter((i) => i.fieldId);
    if (items.length) {
      rs = rs.filter((r) => {
        const res = items.map((i) => {
          const f = fields.find((x) => x.id === i.fieldId);
          return f ? matchFilter(getValue(ctx, table, r, f), f, i, ctx) : true;
        });
        return view.filters.conjunction === "or" ? res.some(Boolean) : res.every(Boolean);
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rs = rs.filter((r) => visibleFields.some((f) => cellText(f, getValue(ctx, table, r, f), ctx).toLowerCase().includes(q)));
    }
    if (view.sorts.length) {
      rs = [...rs].sort((a, b) => {
        for (const s of view.sorts) {
          const f = fields.find((x) => x.id === s.fieldId);
          if (!f) continue;
          const c = compareValues(f, getValue(ctx, table, a, f), getValue(ctx, table, b, f));
          if (c !== 0) return s.dir === "desc" ? -c : c;
        }
        return 0;
      });
    }
    return rs;
  }, [table, view.filters, view.sorts, search, fields, visibleFields, ctx]);

  const groupField = view.groupBy ? fields.find((f) => f.id === view.groupBy) : null;
  const groups = useMemo(() => {
    if (!groupField) return null;
    const map = new Map();
    rows.forEach((r) => {
      const v = getValue(ctx, table, r, groupField);
      const key = groupField.type === "select" ? v || "__empty" : cellText(groupField, v, ctx) || "__empty";
      if (!map.has(key)) map.set(key, { key, records: [] });
      map.get(key).records.push(r);
    });
    const arr = [...map.values()];
    if (groupField.type === "select") {
      const order = (groupField.options || []).map((o) => o.id);
      arr.sort((a, b) => (a.key === "__empty" ? 1 : b.key === "__empty" ? -1 : order.indexOf(a.key) - order.indexOf(b.key)));
    } else arr.sort((a, b) => (a.key === "__empty" ? 1 : b.key === "__empty" ? -1 : String(a.key).localeCompare(String(b.key), "sv")));
    return arr;
  }, [rows, groupField, ctx, table]);

  /* ---- kolumnbredd ---- */
  const resizing = useRef(null);
  const startResize = (e, field) => {
    e.preventDefault(); e.stopPropagation();
    resizing.current = { id: field.id, x: e.clientX, w: field.width };
    const move = (ev) => { const r = resizing.current; if (r) setFieldWidth(r.id, Math.max(80, r.w + ev.clientX - r.x)); };
    const up = () => { resizing.current = null; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };

  /* ---- tangentbord ---- */
  const move = (dir) => {
    if (!selected) return;
    const ri = rows.findIndex((r) => r.id === selected.recordId);
    const fi = visibleFields.findIndex((f) => f.id === selected.fieldId);
    if (ri < 0 || fi < 0) return;
    let nr = ri, nc = fi;
    if (dir === "down") nr = Math.min(rows.length - 1, ri + 1);
    if (dir === "up") nr = Math.max(0, ri - 1);
    if (dir === "right") nc = Math.min(visibleFields.length - 1, fi + 1);
    if (dir === "left") nc = Math.max(0, fi - 1);
    setSelected({ recordId: rows[nr].id, fieldId: visibleFields[nc].id });
  };

  const openEditor = (recordId, fieldId, char) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field || isComputed(field) || field.type === "checkbox" || field.type === "rating") return;
    const el = document.querySelector(`[data-cell="${recordId}:${fieldId}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setEditing({ recordId, fieldId, rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }, char });
  };

  const commitEdit = (value, keepOpen, moveDir) => {
    if (!editing) return;
    setCell(editing.recordId, editing.fieldId, value);
    if (!keepOpen) {
      setEditing(null);
      if (moveDir) setTimeout(() => move(moveDir), 0);
      gridRef.current?.focus();
    }
  };

  const onGridKeyDown = (e) => {
    if (editing || expanded || !selected) return;
    const field = fields.find((f) => f.id === selected.fieldId);
    const keys = { ArrowDown: "down", ArrowUp: "up", ArrowRight: "right", ArrowLeft: "left" };
    if (keys[e.key]) { e.preventDefault(); move(keys[e.key]); return; }
    if (e.key === "Tab") { e.preventDefault(); move(e.shiftKey ? "left" : "right"); return; }
    if (e.key === "Enter") { e.preventDefault(); openEditor(selected.recordId, selected.fieldId); return; }
    if (e.key === "Escape") { setSelected(null); return; }
    if (isComputed(field)) return;
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      setCell(selected.recordId, selected.fieldId, ["multiSelect", "link"].includes(field.type) ? [] : field.type === "checkbox" ? false : null);
      return;
    }
    if (e.key === " " && field.type === "checkbox") {
      e.preventDefault();
      const rec = table.records.find((r) => r.id === selected.recordId);
      setCell(selected.recordId, selected.fieldId, !rec.cells[selected.fieldId]);
      return;
    }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openEditor(selected.recordId, selected.fieldId, e.key); }
  };

  const openMenu = (name, e, data) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ name, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }, data });
  };
  const closeMenu = () => setMenu(null);

  const resetDemo = async () => {
    try { await window.storage.delete(STORAGE_KEY); } catch (e) {}
    const s = seed();
    setBase(s); setTableId(s.tables[0].id); setViewByTable({}); setSelected(null); setCheckedRows([]); closeMenu();
  };

  const nFilters = view.filters.items.filter((i) => i.fieldId).length;
  const nSorts = view.sorts.length;
  const nHidden = view.hidden.length;
  const rowH = view.rowHeight;
  const gutterW = 84;
  const totalWidth = gutterW + visibleFields.reduce((s, f) => s + f.width, 0) + 120;

  const renderRow = (rec, index) => {
    const isChecked = checkedRows.includes(rec.id);
    const colorField = view.colorFieldId ? fields.find((f) => f.id === view.colorFieldId) : null;
    const colorOpt = colorField ? (colorField.options || []).find((o) => o.id === rec.cells[colorField.id]) : null;
    return (
      <div key={rec.id} className={"sb-row" + (isChecked ? " checked" : "")} style={{ height: rowH }}>
        <div className="sb-gutter" style={{ width: gutterW }}>
          {colorOpt && <span className="sb-colorbar" style={{ background: colorOf(colorOpt.color).solid }} />}
          <span className="sb-rownum">{index + 1}</span>
          <span className="sb-rowcheck" onClick={() => setCheckedRows((c) => (c.includes(rec.id) ? c.filter((x) => x !== rec.id) : [...c, rec.id]))}>
            <span className={"sb-check" + (isChecked ? " on" : "")}>{isChecked && <Check size={11} strokeWidth={3.5} />}</span>
          </span>
          <span className="sb-expand" onClick={() => setExpanded(rec.id)} title="Expandera post"><Maximize2 size={13} /></span>
        </div>
        {visibleFields.map((f, i) => {
          const isSel = selected && selected.recordId === rec.id && selected.fieldId === f.id;
          const isEd = editing && editing.recordId === rec.id && editing.fieldId === f.id;
          return (
            <div key={f.id} data-cell={rec.id + ":" + f.id}
              className={"sb-cell" + (i === 0 ? " primary" : "") + (isSel ? " sel" : "") + (isEd ? " editing" : "") + (isComputed(f) ? " comp" : "") + (f.type === "longText" && rowH > 32 ? " wrap" : "")}
              style={{ width: f.width, left: i === 0 ? gutterW : undefined }}
              onMouseDown={() => { setSelected({ recordId: rec.id, fieldId: f.id }); gridRef.current?.focus(); }}
              onDoubleClick={() => openEditor(rec.id, f.id)}>
              {isEd ? (
                <InlineEditor field={f} value={rec.cells[f.id]} rect={editing.rect} initialChar={editing.char}
                  onCommit={commitEdit} onCancel={() => { setEditing(null); gridRef.current?.focus(); }}
                  onAddOption={(n) => addOptionTo(f.id, n)} onCreateLinked={createLinked} />
              ) : (
                <CellValue field={f} value={gv(rec, f)} query={search} onQuickChange={(v) => setCell(rec.id, f.id, v)} />
              )}
            </div>
          );
        })}
        <div className="sb-cell sb-cell-blank" style={{ width: 120 }} />
      </div>
    );
  };

  if (!loaded)
    return (
      <div className="sb"><style>{CSS}</style>
        <div className="sb-boot"><Logo size={40} /><div>Läser in din digitala tvilling…</div></div>
      </div>
    );

  return (
    <Ctx.Provider value={ctx}>
      <div className="sb" onKeyDown={(e) => { if (e.key === "Escape") { setMenu(null); setExpanded(null); } }}>
        <style>{CSS}</style>

        {/* Topprad */}
        <header className="sb-topbar">
          <div className="sb-topbar-left">
            <Logo />
            <div className="sb-brand" onClick={(e) => openMenu("base", e)}>
              <div className="sb-group">{base.group}</div>
              <div className="sb-basename">{base.name}<ChevronDown size={13} /></div>
            </div>
            <nav className="sb-nav">
              <button className="sb-nav-item active">Data</button>
              <button className="sb-nav-item">Automationer</button>
              <button className="sb-nav-item">Gränssnitt</button>
              <button className="sb-nav-item">Rapporter</button>
            </nav>
          </div>
          <div className="sb-topbar-right">
            <span className={"sb-save " + saveState}>
              {saveState === "error" ? <CloudOff size={14} /> : <Save size={14} />}
              {saveState === "saving" ? "Sparar…" : saveState === "error" ? "Kunde inte spara" : "Sparad"}
            </span>
            <button className="sb-ghost"><HelpCircle size={15} /></button>
            <button className="sb-ghost"><Bell size={15} /></button>
            <button className="sb-share"><Share2 size={13} /> Dela</button>
            <Avatar name="Anna Lind" size={26} />
          </div>
        </header>

        {/* Tabellflikar */}
        <div className="sb-tabs">
          <div className="sb-tabs-list">
            {base.tables.map((t) => {
              const Icon = TABLE_ICONS[t.icon] || Table;
              return (
                <button key={t.id} className={"sb-tab" + (t.id === table.id ? " active" : "")}
                  onClick={(e) => { if (t.id === table.id) openMenu("table", e, t); else { setTableId(t.id); setSelected(null); setCheckedRows([]); } }}>
                  <Icon size={14} /> {t.name}
                  {t.id === table.id && <ChevronDown size={13} />}
                </button>
              );
            })}
            <button className="sb-tab-add" onClick={() => {
              const t = {
                id: uid("t"), name: "Tabell " + (base.tables.length + 1), icon: "table",
                fields: [
                  { id: uid("f"), name: "Namn", type: "text", width: 220 },
                  { id: uid("f"), name: "Anteckningar", type: "longText", width: 240 },
                  { id: uid("f"), name: "Status", type: "select", width: 140, options: [opt("Att göra", "gray"), opt("Klar", "green")] },
                ],
                records: [1, 2, 3].map(() => ({ id: uid("rec"), comments: [], cells: {} })),
                views: [{ id: uid("v"), name: "Rutnät", type: "grid", filters: { conjunction: "and", items: [] }, sorts: [], groupBy: null, hidden: [], rowHeight: 32, colorFieldId: null }],
              };
              setBase((b) => ({ ...b, tables: [...b.tables, t] })); setTableId(t.id);
            }}><Plus size={14} /> Lägg till tabell</button>
          </div>
          <div className="sb-tabs-right"><span className="sb-twinbadge"><Gauge size={13} /> Tvilling synkad</span></div>
        </div>

        {/* Verktygsfält */}
        <div className="sb-toolbar">
          <button className={"sb-tool" + (sidebar ? " on" : "")} onClick={() => setSidebar((s) => !s)}><Menu size={15} /> Vyer</button>
          <span className="sb-tool-sep" />
          <span className="sb-viewname">
            {view.type === "grid" ? <Table size={14} className="sb-acc" /> : view.type === "kanban" ? <LayoutGrid size={14} className="sb-acc" /> : <Image size={14} className="sb-acc" />}
            {view.name}
          </span>
          <span className="sb-tool-sep" />
          <button className={"sb-tool" + (nHidden ? " active-blue" : "")} onClick={(e) => openMenu("hide", e)}>
            <EyeOff size={14} /> {nHidden ? `${nHidden} dolda fält` : "Dölj fält"}
          </button>
          <button className={"sb-tool" + (nFilters ? " active-green" : "")} onClick={(e) => openMenu("filter", e)}>
            <Filter size={14} /> {nFilters ? `Filtrerat på ${nFilters}` : "Filtrera"}
          </button>
          <button className={"sb-tool" + (view.groupBy ? " active-purple" : "")} onClick={(e) => openMenu("group", e)}>
            <Layers size={14} /> {view.groupBy ? "Grupperat" : "Gruppera"}
          </button>
          <button className={"sb-tool" + (nSorts ? " active-orange" : "")} onClick={(e) => openMenu("sort", e)}>
            <ArrowUpDown size={14} /> {nSorts ? `Sorterat på ${nSorts}` : "Sortera"}
          </button>
          <button className={"sb-tool" + (view.colorFieldId ? " active-pink" : "")} onClick={(e) => openMenu("color", e)}><Palette size={14} /> Färg</button>
          <button className="sb-tool icon" onClick={(e) => openMenu("rowheight", e)}><AlignJustify size={15} /></button>
          <div className="sb-toolbar-spacer" />
          {checkedRows.length > 0 && (
            <button className="sb-tool danger" onClick={() => deleteRecords(checkedRows)}><Trash2 size={14} /> Ta bort {checkedRows.length} poster</button>
          )}
          <div className={"sb-search" + (searchOpen ? " open" : "")}>
            {searchOpen && (
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sök i vyn"
                onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); setSearchOpen(false); } }} />
            )}
            <button className="sb-tool icon" onClick={() => { setSearchOpen((s) => !s); if (searchOpen) setSearch(""); }}>
              {searchOpen ? <X size={15} /> : <Search size={15} />}
            </button>
          </div>
        </div>

        {/* Kropp */}
        <div className="sb-body">
          {sidebar && (
            <aside className="sb-sidebar">
              <div className="sb-side-search"><Search size={13} /><input placeholder="Sök vyer" /></div>
              <div className="sb-side-list">
                {table.views.map((v) => (
                  <div key={v.id} className={"sb-side-item" + (v.id === view.id ? " active" : "")}
                    onClick={() => { setViewByTable((m) => ({ ...m, [table.id]: v.id })); setSelected(null); }}>
                    {v.type === "grid" ? <Table size={15} className="sb-acc" /> : v.type === "kanban" ? <LayoutGrid size={15} className="sb-acc" /> : <Image size={15} className="sb-acc" />}
                    <span>{v.name}</span>
                    {v.id === view.id && <MoreHorizontal size={14} className="sb-side-more" onClick={(e) => { e.stopPropagation(); openMenu("view", e, v); }} />}
                  </div>
                ))}
              </div>
              <div className="sb-side-create">
                <div className="sb-side-label">Skapa ny…</div>
                {[["grid", "Rutnät", Table], ["kanban", "Kanban", LayoutGrid], ["gallery", "Galleri", Image]].map(([t, label, Icon]) => (
                  <div key={t} className="sb-side-create-item" onClick={() => {
                    const nv = {
                      id: uid("v"), name: label + " " + (table.views.length + 1), type: t,
                      filters: { conjunction: "and", items: [] }, sorts: [], groupBy: null, hidden: [], rowHeight: 32,
                      colorFieldId: null, stackFieldId: fields.find((f) => f.type === "select")?.id || null,
                    };
                    updateTable(table.id, (tt) => ({ ...tt, views: [...tt.views, nv] }));
                    setViewByTable((m) => ({ ...m, [table.id]: nv.id }));
                  }}>
                    <Icon size={15} className="sb-acc" /><span>{label}</span><Plus size={13} className="sb-side-plus" />
                  </div>
                ))}
              </div>
            </aside>
          )}

          {view.type === "grid" && (
            <div className="sb-gridwrap" ref={gridRef} tabIndex={0} onKeyDown={onGridKeyDown}>
              <div className="sb-grid" style={{ width: totalWidth }}>
                <div className="sb-head" style={{ width: totalWidth }}>
                  <div className="sb-gutter head" style={{ width: gutterW }}>
                    <span className={"sb-check" + (checkedRows.length === rows.length && rows.length ? " on" : "")}
                      onClick={() => setCheckedRows(checkedRows.length === rows.length ? [] : rows.map((r) => r.id))}>
                      {checkedRows.length === rows.length && rows.length > 0 && <Check size={11} strokeWidth={3.5} />}
                    </span>
                  </div>
                  {visibleFields.map((f, i) => {
                    const Icon = typeMeta(f.type).icon;
                    return (
                      <div key={f.id} className={"sb-headcell" + (i === 0 ? " primary" : "")}
                        style={{ width: f.width, left: i === 0 ? gutterW : undefined }} onClick={(e) => openMenu("field", e, f)}>
                        <Icon size={13} className="sb-headicon" />
                        <span className="sb-headname">{f.name}</span>
                        <ChevronDown size={13} className="sb-headchev" />
                        <span className="sb-resize" onMouseDown={(e) => startResize(e, f)} />
                      </div>
                    );
                  })}
                  <div className="sb-headcell add" style={{ width: 120 }} onClick={(e) => openMenu("addfield", e)}><Plus size={15} /></div>
                </div>

                {!groups && rows.map((r, i) => renderRow(r, i))}
                {groups && groups.map((g) => {
                  const isCol = collapsed.includes(g.key);
                  const o = groupField.type === "select" ? (groupField.options || []).find((x) => x.id === g.key) : null;
                  return (
                    <div key={g.key}>
                      <div className="sb-grouphead" onClick={() => setCollapsed((c) => (isCol ? c.filter((x) => x !== g.key) : [...c, g.key]))}>
                        <span className="sb-groupchev">{isCol ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</span>
                        {o ? <Pill option={o} /> : <span className="sb-groupval">{g.key === "__empty" ? "Tom" : g.key}</span>}
                        <span className="sb-groupcount">{g.records.length} poster</span>
                      </div>
                      {!isCol && g.records.map((r, i) => renderRow(r, i))}
                      {!isCol && (
                        <div className="sb-addrow" style={{ height: 32 }}
                          onClick={() => addRecord(groupField.type === "select" && g.key !== "__empty" ? { [groupField.id]: g.key } : {})}>
                          <span className="sb-addrow-inner" style={{ width: gutterW }}><Plus size={15} /></span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!groups && (
                  <div className="sb-addrow" style={{ height: 32 }} onClick={() => addRecord()}>
                    <span className="sb-addrow-inner" style={{ width: gutterW }}><Plus size={15} /></span>
                  </div>
                )}
              </div>
            </div>
          )}

          {view.type === "kanban" && (
            <KanbanView table={table} view={view} rows={rows} fields={fields} visibleFields={visibleFields}
              onSetCell={setCell} onExpand={setExpanded} onAdd={addRecord} onUpdateView={updateView} gv={gv} />
          )}

          {view.type === "gallery" && (
            <div className="sb-gallery">
              {rows.map((r) => {
                const cField = view.colorFieldId ? fields.find((f) => f.id === view.colorFieldId) : null;
                const co = cField ? (cField.options || []).find((o) => o.id === r.cells[cField.id]) : null;
                return (
                  <div key={r.id} className="sb-card gallery" onClick={() => setExpanded(r.id)}>
                    <div className="sb-card-cover" style={{ background: co ? colorOf(co.color).bg : "#eef1f2" }}>
                      {React.createElement(TABLE_ICONS[table.icon] || Table, { size: 26, color: co ? colorOf(co.color).text : "#9aa3a8" })}
                    </div>
                    <div className="sb-card-body">
                      <div className="sb-card-title">{cellText(primary, gv(r, primary), ctx) || "Namnlös"}</div>
                      {visibleFields.slice(1, 6).map((f) => (
                        <div key={f.id} className="sb-card-field">
                          <div className="sb-card-label">{f.name}</div>
                          <div className="sb-card-value"><CellValue field={f} value={gv(r, f)} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="sb-card gallery add" onClick={() => addRecord()}><Plus size={20} /></div>
            </div>
          )}
        </div>

        {/* Fotrad */}
        <footer className="sb-footer">
          <button className="sb-foot-add" onClick={() => addRecord()}><Plus size={14} /> Lägg till post</button>
          <span className="sb-foot-count">{rows.length} poster{rows.length !== table.records.length ? ` (av ${table.records.length})` : ""}</span>
          <span className="sb-foot-spacer" />
          <span className="sb-foot-meta">{base.group} · {base.tables.length} tabeller · {base.tables.reduce((s, t) => s + t.records.length, 0)} poster i tvillingen</span>
        </footer>

        {/* Menyer */}
        {menu?.name === "base" && (
          <Popover rect={menu.rect} onClose={closeMenu} width={260}>
            <div className="sb-pop-pad" style={{ paddingBottom: 4 }}>
              <input className="sb-input" defaultValue={base.name} autoFocus
                onChange={(e) => setBase((b) => ({ ...b, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") closeMenu(); }} />
            </div>
            <div className="sb-pop-list">
              <div className="sb-pop-hintrow">Allt sparas automatiskt i den här webbläsaren.</div>
              <div className="sb-pop-item danger" onClick={resetDemo}><Trash2 size={13} className="sb-pop-icon" /> Återställ demodata</div>
            </div>
          </Popover>
        )}

        {menu?.name === "field" && (
          <FieldMenu rect={menu.rect} field={menu.data} table={table} tables={base.tables} isPrimary={menu.data.id === primary.id}
            onClose={closeMenu} onUpdate={(patch) => applyFieldEdit(menu.data.id, patch)}
            onDelete={() => { deleteField(menu.data.id); closeMenu(); }}
            onHide={() => { updateView((v) => ({ ...v, hidden: [...v.hidden, menu.data.id] })); closeMenu(); }}
            onSort={(dir) => { updateView({ sorts: [{ fieldId: menu.data.id, dir }] }); closeMenu(); }}
            onGroup={() => { updateView({ groupBy: menu.data.id }); closeMenu(); }} />
        )}

        {menu?.name === "addfield" && (
          <Popover rect={menu.rect} onClose={closeMenu} width={280} align="right">
            <div className="sb-pop-title">Lägg till fält</div>
            <div className="sb-pop-list scroll">
              {FIELD_TYPES.map((t) => (
                <div key={t.type} className="sb-pop-item" onClick={() => { addField(t.type); closeMenu(); }}>
                  <t.icon size={14} className="sb-pop-icon" /> {t.label}
                </div>
              ))}
            </div>
          </Popover>
        )}

        {menu?.name === "hide" && (
          <Popover rect={menu.rect} onClose={closeMenu} width={300}>
            <div className="sb-pop-list scroll">
              {fields.map((f) => {
                const on = f.id === primary.id || !view.hidden.includes(f.id);
                const Icon = typeMeta(f.type).icon;
                return (
                  <div key={f.id} className="sb-pop-item" onClick={() => {
                    if (f.id === primary.id) return;
                    updateView((v) => ({ ...v, hidden: v.hidden.includes(f.id) ? v.hidden.filter((x) => x !== f.id) : [...v.hidden, f.id] }));
                  }}>
                    <span className={"sb-toggle" + (on ? " on" : "")}><span /></span>
                    <Icon size={13} className="sb-pop-icon" /> {f.name}
                    {f.id === primary.id && <span className="sb-pop-hint">primär</span>}
                  </div>
                );
              })}
            </div>
            <div className="sb-pop-foot">
              <button onClick={() => updateView({ hidden: fields.slice(1).map((f) => f.id) })}>Dölj alla</button>
              <button onClick={() => updateView({ hidden: [] })}>Visa alla</button>
            </div>
          </Popover>
        )}

        {menu?.name === "filter" && (
          <Popover rect={menu.rect} onClose={closeMenu} width={640}>
            <FilterPanel view={view} fields={fields} onUpdate={updateView} />
          </Popover>
        )}
        {menu?.name === "sort" && (
          <Popover rect={menu.rect} onClose={closeMenu} width={470}>
            <SortPanel view={view} fields={fields} onUpdate={updateView} />
          </Popover>
        )}
        {menu?.name === "group" && (
          <Popover rect={menu.rect} onClose={closeMenu} width={320}>
            <div className="sb-pop-title">Gruppera efter</div>
            <div className="sb-pop-list scroll">
              <div className="sb-pop-item" onClick={() => { updateView({ groupBy: null }); closeMenu(); }}>Ingen gruppering</div>
              {fields.map((f) => {
                const Icon = typeMeta(f.type).icon;
                return (
                  <div key={f.id} className={"sb-pop-item" + (view.groupBy === f.id ? " selected" : "")} onClick={() => { updateView({ groupBy: f.id }); closeMenu(); }}>
                    <Icon size={13} className="sb-pop-icon" /> {f.name}
                    {view.groupBy === f.id && <Check size={14} className="sb-pop-check" />}
                  </div>
                );
              })}
            </div>
          </Popover>
        )}
        {menu?.name === "color" && (
          <Popover rect={menu.rect} onClose={closeMenu} width={300}>
            <div className="sb-pop-title">Färgkoda posterna</div>
            <div className="sb-pop-list scroll">
              <div className="sb-pop-item" onClick={() => { updateView({ colorFieldId: null }); closeMenu(); }}>Ingen färg</div>
              {fields.filter((f) => f.type === "select").map((f) => (
                <div key={f.id} className={"sb-pop-item" + (view.colorFieldId === f.id ? " selected" : "")} onClick={() => { updateView({ colorFieldId: f.id }); closeMenu(); }}>
                  <ChevronDown size={13} className="sb-pop-icon" /> {f.name}
                  {view.colorFieldId === f.id && <Check size={14} className="sb-pop-check" />}
                </div>
              ))}
            </div>
          </Popover>
        )}
        {menu?.name === "rowheight" && (
          <Popover rect={menu.rect} onClose={closeMenu} width={200} align="right">
            <div className="sb-pop-list">
              {[[32, "Kort"], [56, "Medel"], [88, "Hög"], [128, "Extra hög"]].map(([h, l]) => (
                <div key={h} className={"sb-pop-item" + (view.rowHeight === h ? " selected" : "")} onClick={() => { updateView({ rowHeight: h }); closeMenu(); }}>
                  <AlignJustify size={13} className="sb-pop-icon" /> {l}
                  {view.rowHeight === h && <Check size={14} className="sb-pop-check" />}
                </div>
              ))}
            </div>
          </Popover>
        )}
        {menu?.name === "view" && (
          <Popover rect={menu.rect} onClose={closeMenu} width={240}>
            <div className="sb-pop-pad" style={{ paddingBottom: 4 }}>
              <input className="sb-input" defaultValue={view.name} autoFocus onChange={(e) => updateView({ name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") closeMenu(); }} />
            </div>
            <div className="sb-pop-list">
              <div className="sb-pop-item" onClick={() => {
                const copy = { ...view, id: uid("v"), name: view.name + " kopia" };
                updateTable(table.id, (t) => ({ ...t, views: [...t.views, copy] }));
                setViewByTable((m) => ({ ...m, [table.id]: copy.id })); closeMenu();
              }}><Copy size={13} className="sb-pop-icon" /> Duplicera vy</div>
              {table.views.length > 1 && (
                <div className="sb-pop-item danger" onClick={() => {
                  const next = table.views.find((v) => v.id !== view.id).id;
                  updateTable(table.id, (t) => ({ ...t, views: t.views.filter((v) => v.id !== view.id) }));
                  setViewByTable((m) => ({ ...m, [table.id]: next })); closeMenu();
                }}><Trash2 size={13} className="sb-pop-icon" /> Ta bort vy</div>
              )}
            </div>
          </Popover>
        )}
        {menu?.name === "table" && (
          <Popover rect={menu.rect} onClose={closeMenu} width={240}>
            <div className="sb-pop-pad" style={{ paddingBottom: 4 }}>
              <input className="sb-input" defaultValue={table.name} autoFocus
                onChange={(e) => updateTable(table.id, (t) => ({ ...t, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") closeMenu(); }} />
            </div>
            {base.tables.length > 1 && (
              <div className="sb-pop-list">
                <div className="sb-pop-item danger" onClick={() => {
                  const rest = base.tables.filter((t) => t.id !== table.id);
                  setBase((b) => ({ ...b, tables: rest })); setTableId(rest[0].id); closeMenu();
                }}><Trash2 size={13} className="sb-pop-icon" /> Ta bort tabell</div>
              </div>
            )}
          </Popover>
        )}

        {expanded && (
          <RecordModal table={table} fields={fields} rows={rows} recordId={expanded} gv={gv}
            onClose={() => setExpanded(null)} onNavigate={setExpanded} onSetCell={setCell}
            onAddOption={addOptionTo} onCreateLinked={createLinked}
            onDelete={(id) => { deleteRecords([id]); setExpanded(null); }} onDuplicate={duplicateRecord}
            onComment={(id, text) => updateTable(table.id, (t) => ({
              ...t, records: t.records.map((r) => (r.id === id ? { ...r, comments: [...(r.comments || []), { id: uid("c"), who: "Anna Lind", text, when: "just nu" }] } : r)),
            }))} />
        )}
      </div>
    </Ctx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Fältmeny med formel- och rollupinställningar                       */
/* ------------------------------------------------------------------ */

function FieldMenu({ rect, field, table, tables, isPrimary, onClose, onUpdate, onDelete, onHide, onSort, onGroup }) {
  const [tab, setTab] = useState("menu");
  const [name, setName] = useState(field.name);
  const [type, setType] = useState(field.type);
  const [opts, setOpts] = useState(field.options || []);
  const [formula, setFormula] = useState(field.formula || "");
  const [linkedTableId, setLinkedTableId] = useState(field.linkedTableId || tables.find((t) => t.id !== table.id)?.id);
  const [linkFieldId, setLinkFieldId] = useState(field.linkFieldId || table.fields.find((f) => f.type === "link")?.id);
  const [targetFieldId, setTargetFieldId] = useState(field.targetFieldId);
  const [agg, setAgg] = useState(field.agg || "count");

  const formulaErr = type === "formula" && formula.trim() ? getFormula(formula).err : null;
  const rollupSource = tables.find((t) => t.id === table.fields.find((f) => f.id === linkFieldId)?.linkedTableId);

  if (tab === "edit")
    return (
      <Popover rect={rect} onClose={onClose} width={380}>
        <div className="sb-pop-pad">
          <input className="sb-input" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Fältnamn" />
          <div className="sb-pop-label">Fälttyp</div>
          <select className="sb-input" value={type} onChange={(e) => setType(e.target.value)}>
            {FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>

          {(type === "select" || type === "multiSelect") && (
            <>
              <div className="sb-pop-label">Alternativ</div>
              <div className="sb-optlist">
                {opts.map((o, i) => (
                  <div key={o.id} className="sb-optrow">
                    <span className="sb-optdot" style={{ background: colorOf(o.color).solid }}
                      onClick={() => {
                        const idx = COLORS.findIndex((c) => c.id === o.color);
                        setOpts(opts.map((x, j) => (j === i ? { ...x, color: COLORS[(idx + 1) % COLORS.length].id } : x)));
                      }} />
                    <input className="sb-optinput" value={o.name} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <X size={13} className="sb-optdel" onClick={() => setOpts(opts.filter((_, j) => j !== i))} />
                  </div>
                ))}
              </div>
              <button className="sb-linkbtn" onClick={() => setOpts([...opts, opt("Nytt alternativ", COLORS[opts.length % COLORS.length].id)])}>
                <Plus size={13} /> Lägg till alternativ
              </button>
            </>
          )}

          {type === "link" && (
            <>
              <div className="sb-pop-label">Länka till tabell</div>
              <select className="sb-input" value={linkedTableId} onChange={(e) => setLinkedTableId(e.target.value)}>
                {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div className="sb-pop-note">Ett omvänt fält skapas automatiskt i den valda tabellen, så att båda sidor hålls i synk.</div>
            </>
          )}

          {type === "rollup" && (
            <>
              <div className="sb-pop-label">Via länkfält</div>
              <select className="sb-input" value={linkFieldId || ""} onChange={(e) => { setLinkFieldId(e.target.value); setTargetFieldId(undefined); }}>
                <option value="">Välj länkfält…</option>
                {table.fields.filter((f) => f.type === "link").map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <div className="sb-pop-label">Beräkning</div>
              <select className="sb-input" value={agg} onChange={(e) => setAgg(e.target.value)}>
                <option value="count">Antal poster</option>
                <option value="sum">Summa</option>
                <option value="avg">Medelvärde</option>
                <option value="min">Minsta</option>
                <option value="max">Största</option>
                <option value="concat">Lista värden</option>
              </select>
              {agg !== "count" && (
                <>
                  <div className="sb-pop-label">Fält i {rollupSource?.name || "måltabellen"}</div>
                  <select className="sb-input" value={targetFieldId || ""} onChange={(e) => setTargetFieldId(e.target.value)}>
                    <option value="">Välj fält…</option>
                    {(rollupSource?.fields || []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </>
              )}
            </>
          )}

          {type === "formula" && (
            <>
              <div className="sb-pop-label">Formel</div>
              <textarea className="sb-input sb-formula" value={formula} onChange={(e) => setFormula(e.target.value)}
                placeholder={'ROUND({Area (m²)} / 100, 1) & " enheter"'} />
              {formulaErr && <div className="sb-err">{formulaErr}</div>}
              <div className="sb-pop-label">Infoga fält</div>
              <div className="sb-fieldchips">
                {table.fields.filter((f) => f.id !== field.id).map((f) => (
                  <button key={f.id} className="sb-fieldchip" onClick={() => setFormula((s) => s + "{" + f.name + "}")}>{f.name}</button>
                ))}
              </div>
              <div className="sb-pop-note">Funktioner: {FN_HELP}</div>
            </>
          )}

          <div className="sb-pop-actions">
            <button className="sb-btn ghost" onClick={onClose}>Avbryt</button>
            <button className="sb-btn primary" onClick={() => {
              onUpdate({
                name, type,
                options: type === "select" || type === "multiSelect" ? opts : field.options,
                formula: type === "formula" ? formula : field.formula,
                linkedTableId: type === "link" ? linkedTableId : field.linkedTableId,
                symmetricFieldId: type === "link" && linkedTableId !== field.linkedTableId ? undefined : field.symmetricFieldId,
                linkFieldId: type === "rollup" ? linkFieldId : field.linkFieldId,
                targetFieldId: type === "rollup" ? targetFieldId : field.targetFieldId,
                agg: type === "rollup" ? agg : field.agg,
              });
              onClose();
            }}>Spara</button>
          </div>
        </div>
      </Popover>
    );

  return (
    <Popover rect={rect} onClose={onClose} width={260}>
      <div className="sb-pop-list">
        <div className="sb-pop-item" onClick={() => setTab("edit")}><Settings size={13} className="sb-pop-icon" /> Redigera fält</div>
        <div className="sb-pop-item" onClick={() => onSort("asc")}><ArrowUp size={13} className="sb-pop-icon" /> Sortera stigande</div>
        <div className="sb-pop-item" onClick={() => onSort("desc")}><ArrowDown size={13} className="sb-pop-icon" /> Sortera fallande</div>
        <div className="sb-pop-item" onClick={onGroup}><Layers size={13} className="sb-pop-icon" /> Gruppera efter fältet</div>
        {!isPrimary && <div className="sb-pop-item" onClick={onHide}><EyeOff size={13} className="sb-pop-icon" /> Dölj fält</div>}
        {!isPrimary && <div className="sb-pop-item danger" onClick={onDelete}><Trash2 size={13} className="sb-pop-icon" /> Ta bort fält</div>}
        {isPrimary && <div className="sb-pop-hintrow">Primärfältet kan inte döljas eller tas bort.</div>}
      </div>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/*  Filter & sortering                                                 */
/* ------------------------------------------------------------------ */

function FilterPanel({ view, fields, onUpdate }) {
  const ctx = useCtx();
  const items = view.filters.items;
  const set = (next) => onUpdate({ filters: { ...view.filters, items: next } });

  return (
    <div className="sb-pop-pad">
      {!items.length && <div className="sb-pop-muted">Inga filter är aktiva i den här vyn.</div>}
      {items.map((it, i) => {
        const f = fields.find((x) => x.id === it.fieldId) || fields[0];
        const ops = opsFor(f.type);
        const needsValue = !["empty", "notEmpty"].includes(it.op);
        const linkedTable = f.type === "link" ? ctx.tables.find((t) => t.id === f.linkedTableId) : null;
        return (
          <div key={it.id} className="sb-filterrow">
            <span className="sb-filterlead">
              {i === 0 ? "Där" : i === 1 ? (
                <select className="sb-mini" value={view.filters.conjunction} onChange={(e) => onUpdate({ filters: { ...view.filters, conjunction: e.target.value } })}>
                  <option value="and">och</option><option value="or">eller</option>
                </select>
              ) : view.filters.conjunction === "and" ? "och" : "eller"}
            </span>
            <select className="sb-mini grow" value={it.fieldId} onChange={(e) => {
              const nf2 = fields.find((x) => x.id === e.target.value);
              set(items.map((x, j) => (j === i ? { ...x, fieldId: e.target.value, op: opsFor(nf2.type)[0][0], value: ["multiSelect", "link"].includes(nf2.type) ? [] : "" } : x)));
            }}>
              {fields.map((f2) => <option key={f2.id} value={f2.id}>{f2.name}</option>)}
            </select>
            <select className="sb-mini" value={it.op} onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))}>
              {ops.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <span className="sb-filterval">
              {!needsValue ? <span className="sb-mini disabled" />
                : f.type === "select" || f.type === "person" ? (
                  <select className="sb-mini grow" value={it.value || ""} onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}>
                    <option value="">Välj…</option>
                    {(f.type === "person" ? PEOPLE.map((p) => ({ id: p.name, name: p.name })) : f.options || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                ) : f.type === "multiSelect" || f.type === "link" ? (
                  <select className="sb-mini grow" multiple size={2} value={it.value || []}
                    onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, value: [...e.target.selectedOptions].map((o) => o.value) } : x)))}>
                    {(f.type === "link" ? (linkedTable?.records || []).map((r) => ({ id: r.id, name: recordTitle(ctx, linkedTable.id, r.id) })) : f.options || [])
                      .map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                ) : f.type === "checkbox" ? (
                  <select className="sb-mini grow" value={String(it.value)} onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}>
                    <option value="true">ikryssad</option><option value="false">ej ikryssad</option>
                  </select>
                ) : (
                  <input className="sb-mini grow" type={f.type === "date" ? "date" : "text"} value={it.value ?? ""} placeholder="Ange värde"
                    onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                )}
            </span>
            <X size={14} className="sb-rowdel" onClick={() => set(items.filter((_, j) => j !== i))} />
          </div>
        );
      })}
      <div className="sb-pop-actions left">
        <button className="sb-linkbtn" onClick={() => {
          const f = fields[0];
          set([...items, { id: uid("flt"), fieldId: f.id, op: opsFor(f.type)[0][0], value: ["multiSelect", "link"].includes(f.type) ? [] : f.type === "checkbox" ? "true" : "" }]);
        }}><Plus size={13} /> Lägg till villkor</button>
        {items.length > 0 && <button className="sb-linkbtn" onClick={() => set([])}>Rensa alla</button>}
      </div>
    </div>
  );
}

function SortPanel({ view, fields, onUpdate }) {
  const sorts = view.sorts;
  const set = (next) => onUpdate({ sorts: next });
  return (
    <div className="sb-pop-pad">
      {!sorts.length && <div className="sb-pop-muted">Ingen sortering är aktiv i den här vyn.</div>}
      {sorts.map((s, i) => {
        const f = fields.find((x) => x.id === s.fieldId) || fields[0];
        const lbl = ["number", "currency", "rating", "rollup"].includes(f.type) ? ["1 → 9", "9 → 1"] : f.type === "date" ? ["Först → sist", "Sist → först"] : ["A → Ö", "Ö → A"];
        return (
          <div key={i} className="sb-filterrow">
            <span className="sb-filterlead">{i === 0 ? "Sortera efter" : "sedan efter"}</span>
            <select className="sb-mini grow" value={s.fieldId} onChange={(e) => set(sorts.map((x, j) => (j === i ? { ...x, fieldId: e.target.value } : x)))}>
              {fields.map((f2) => <option key={f2.id} value={f2.id}>{f2.name}</option>)}
            </select>
            <div className="sb-segment">
              <button className={s.dir === "asc" ? "on" : ""} onClick={() => set(sorts.map((x, j) => (j === i ? { ...x, dir: "asc" } : x)))}>{lbl[0]}</button>
              <button className={s.dir === "desc" ? "on" : ""} onClick={() => set(sorts.map((x, j) => (j === i ? { ...x, dir: "desc" } : x)))}>{lbl[1]}</button>
            </div>
            <X size={14} className="sb-rowdel" onClick={() => set(sorts.filter((_, j) => j !== i))} />
          </div>
        );
      })}
      <div className="sb-pop-actions left">
        <button className="sb-linkbtn" onClick={() => set([...sorts, { fieldId: fields[0].id, dir: "asc" }])}><Plus size={13} /> Lägg till sortering</button>
        {sorts.length > 0 && <button className="sb-linkbtn" onClick={() => set([])}>Rensa</button>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Kanban                                                             */
/* ------------------------------------------------------------------ */

function KanbanView({ table, view, rows, fields, visibleFields, onSetCell, onExpand, onAdd, onUpdateView, gv }) {
  const ctx = useCtx();
  const stackField = fields.find((f) => f.id === view.stackFieldId) || fields.find((f) => f.type === "select");
  const [drag, setDrag] = useState(null);
  const primary = fields[0];
  if (!stackField) return <div className="sb-empty">Skapa ett enkelvalsfält för att kunna använda kanban.</div>;

  const stacks = [...(stackField.options || []).map((o) => ({ key: o.id, option: o })), { key: "__empty", option: null }];

  return (
    <div className="sb-kanban">
      <div className="sb-kanban-bar">
        <span>Stapla efter</span>
        <select className="sb-mini" value={stackField.id} onChange={(e) => onUpdateView({ stackFieldId: e.target.value })}>
          {fields.filter((f) => f.type === "select").map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div className="sb-kanban-cols">
        {stacks.map((s) => {
          const recs = rows.filter((r) => (r.cells[stackField.id] || "__empty") === s.key);
          return (
            <div key={s.key} className={"sb-kcol" + (drag && drag.over === s.key ? " over" : "")}
              onDragOver={(e) => { e.preventDefault(); setDrag((d) => (d ? { ...d, over: s.key } : d)); }}
              onDrop={() => { if (drag) onSetCell(drag.id, stackField.id, s.key === "__empty" ? null : s.key); setDrag(null); }}>
              <div className="sb-kcol-head">
                {s.option ? <Pill option={s.option} /> : <span className="sb-groupval">Utan värde</span>}
                <span className="sb-kcount">{recs.length}</span>
              </div>
              <div className="sb-kcol-body">
                {recs.map((r) => (
                  <div key={r.id} className="sb-card" draggable onDragStart={() => setDrag({ id: r.id, over: s.key })}
                    onDragEnd={() => setDrag(null)} onClick={() => onExpand(r.id)}>
                    <div className="sb-card-title">{cellText(primary, gv(r, primary), ctx) || "Namnlös"}</div>
                    {visibleFields.filter((f) => f.id !== primary.id && f.id !== stackField.id).slice(0, 4).map((f) => (
                      <div key={f.id} className="sb-card-line"><CellValue field={f} value={gv(r, f)} /></div>
                    ))}
                  </div>
                ))}
                <button className="sb-kadd" onClick={() => onAdd(s.key === "__empty" ? {} : { [stackField.id]: s.key })}><Plus size={14} /> Lägg till post</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Expanderad post                                                    */
/* ------------------------------------------------------------------ */

function RecordModal({ table, fields, rows, recordId, gv, onClose, onNavigate, onSetCell, onAddOption, onCreateLinked, onDelete, onDuplicate, onComment }) {
  const ctx = useCtx();
  const rec = table.records.find((r) => r.id === recordId);
  const idx = rows.findIndex((r) => r.id === recordId);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(null);
  if (!rec) return null;
  const primary = fields[0];

  return (
    <div className="sb-modal-back" onMouseDown={onClose}>
      <div className="sb-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sb-modal-head">
          <div className="sb-modal-nav">
            <button disabled={idx <= 0} onClick={() => onNavigate(rows[idx - 1].id)}><ChevronLeft size={16} /></button>
            <button disabled={idx < 0 || idx >= rows.length - 1} onClick={() => onNavigate(rows[idx + 1].id)}><ChevronRight size={16} /></button>
            <span className="sb-modal-crumb">{table.name}</span>
          </div>
          <div className="sb-modal-actions">
            <button onClick={() => onDuplicate(rec.id)} title="Duplicera"><Copy size={15} /></button>
            <button onClick={() => onDelete(rec.id)} title="Ta bort"><Trash2 size={15} /></button>
            <button onClick={onClose}><X size={17} /></button>
          </div>
        </div>
        <div className="sb-modal-title">{cellText(primary, gv(rec, primary), ctx) || "Namnlös post"}</div>
        <div className="sb-modal-body">
          <div className="sb-modal-fields">
            {fields.map((f) => {
              const Icon = typeMeta(f.type).icon;
              const value = gv(rec, f);
              const computed = isComputed(f);
              return (
                <div key={f.id} className="sb-mrow">
                  <div className="sb-mlabel"><Icon size={13} /> {f.name}</div>
                  <div className="sb-mvalue" onClick={(e) => {
                    if (computed || f.type === "checkbox" || f.type === "rating") return;
                    const r = e.currentTarget.getBoundingClientRect();
                    setOpen({ id: f.id, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width } });
                  }}>
                    {open?.id === f.id && (f.type === "select" || f.type === "multiSelect") ? (
                      <Popover rect={open.rect} onClose={() => setOpen(null)} width={Math.max(250, open.rect.width)}>
                        <SelectEditor field={f} value={rec.cells[f.id]} multi={f.type === "multiSelect"}
                          onChange={(v) => onSetCell(rec.id, f.id, v)} onClose={() => setOpen(null)} onAddOption={(n) => onAddOption(f.id, n)} />
                      </Popover>
                    ) : open?.id === f.id && f.type === "link" ? (
                      <Popover rect={open.rect} onClose={() => setOpen(null)} width={Math.max(300, open.rect.width)}>
                        <LinkEditor field={f} value={rec.cells[f.id]} onChange={(v) => onSetCell(rec.id, f.id, v)} onCreate={onCreateLinked} />
                      </Popover>
                    ) : open?.id === f.id && f.type === "person" ? (
                      <Popover rect={open.rect} onClose={() => setOpen(null)} width={240}>
                        <div className="sb-pop-list">
                          {PEOPLE.map((p) => (
                            <div key={p.name} className="sb-pop-item" onClick={() => { onSetCell(rec.id, f.id, p.name); setOpen(null); }}>
                              <span className="sb-person"><Avatar name={p.name} /><span>{p.name}</span></span>
                            </div>
                          ))}
                        </div>
                      </Popover>
                    ) : open?.id === f.id ? (
                      f.type === "longText" ? (
                        <textarea className="sb-mtextarea" autoFocus value={rec.cells[f.id] || ""}
                          onChange={(e) => onSetCell(rec.id, f.id, e.target.value)} onBlur={() => setOpen(null)} />
                      ) : (
                        <input className="sb-minput" autoFocus type={f.type === "date" ? "date" : "text"} value={rec.cells[f.id] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            onSetCell(rec.id, f.id, ["number", "currency"].includes(f.type) ? (v === "" ? null : Number(v.replace(",", "."))) : v);
                          }}
                          onBlur={() => setOpen(null)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setOpen(null); }} />
                      )
                    ) : (
                      <div className={"sb-mshow" + (computed ? " computed" : "")}>
                        {isEmptyVal(f, value) && !["checkbox", "rating"].includes(f.type)
                          ? <span className="sb-mempty">{computed ? "—" : "Tomt"}</span>
                          : <CellValue field={f} value={value} onQuickChange={(v) => onSetCell(rec.id, f.id, v)} />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="sb-modal-comments">
            <div className="sb-comments-head"><MessageSquare size={14} /> Kommentarer</div>
            <div className="sb-comments-list">
              {(rec.comments || []).length === 0 && <div className="sb-pop-muted">Inga kommentarer ännu.</div>}
              {(rec.comments || []).map((c) => (
                <div key={c.id} className="sb-comment">
                  <Avatar name={c.who} size={24} />
                  <div>
                    <div className="sb-comment-meta">{c.who} <span>{c.when}</span></div>
                    <div className="sb-comment-text">{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="sb-comment-box">
              <textarea placeholder="Skriv en kommentar…" value={comment} onChange={(e) => setComment(e.target.value)} />
              <button className="sb-btn primary" disabled={!comment.trim()} onClick={() => { onComment(rec.id, comment.trim()); setComment(""); }}>Kommentera</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stil – Simple Buildings                                            */
/* ------------------------------------------------------------------ */

const CSS = `
.sb, .sb * { box-sizing: border-box; }
.sb {
  --b: #e2e6e7; --b2: #cfd5d6; --muted: #67727a; --acc: #0f8d84; --acc-d: #0b6f68; --acc-l: #d7f2ee; --ink: #14201f;
  position: fixed; inset: 0; display: flex; flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px; color: var(--ink); background: #fff; overflow: hidden; -webkit-font-smoothing: antialiased;
}
.sb button { font: inherit; color: inherit; background: none; border: none; cursor: pointer; }
.sb input, .sb select, .sb textarea { font: inherit; color: inherit; }
.sb ::-webkit-scrollbar { width: 11px; height: 11px; }
.sb ::-webkit-scrollbar-thumb { background: #c6cccd; border-radius: 6px; border: 3px solid #fff; }
.sb ::-webkit-scrollbar-thumb:hover { background: #a6aeaf; }
.sb-acc { color: var(--acc); }
.sb-boot { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: var(--muted); }

.sb-topbar { height: 58px; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; border-bottom: 1px solid var(--b); flex: none; }
.sb-topbar-left { display: flex; align-items: center; gap: 12px; }
.sb-brand { cursor: pointer; line-height: 1.15; }
.sb-group { font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--acc); }
.sb-basename { display: flex; align-items: center; gap: 6px; font-weight: 675; font-size: 15px; }
.sb-nav { display: flex; gap: 2px; margin-left: 12px; }
.sb-nav-item { padding: 6px 11px; border-radius: 6px; color: var(--muted); font-weight: 500; }
.sb-nav-item:hover { background: #f1f4f4; }
.sb-nav-item.active { color: var(--ink); font-weight: 600; background: #eef3f3; }
.sb-topbar-right { display: flex; align-items: center; gap: 8px; }
.sb-ghost { display: flex; align-items: center; gap: 6px; padding: 6px 9px; border-radius: 6px; color: var(--muted); }
.sb-ghost:hover { background: #f1f4f4; }
.sb-share { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 6px; background: var(--acc); color: #fff; font-weight: 550; }
.sb-share:hover { background: var(--acc-d); }
.sb-save { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); padding: 4px 8px; border-radius: 20px; background: #f1f4f4; }
.sb-save.saving { color: #9a6b06; background: #fff5dc; }
.sb-save.error { color: #b02318; background: #ffdce5; }

.sb-tabs { height: 38px; display: flex; align-items: stretch; justify-content: space-between; background: #f5f7f7; border-bottom: 1px solid var(--b); flex: none; padding: 0 8px; }
.sb-tabs-list { display: flex; align-items: stretch; gap: 2px; overflow-x: auto; }
.sb-tab { display: flex; align-items: center; gap: 6px; padding: 0 13px; font-weight: 550; color: #4c565c; white-space: nowrap; border-radius: 6px 6px 0 0; }
.sb-tab:hover { background: #eceff0; }
.sb-tab.active { background: #fff; color: var(--ink); font-weight: 650; box-shadow: 0 -2px 0 var(--acc) inset; }
.sb-tab-add { display: flex; align-items: center; gap: 5px; padding: 0 12px; color: var(--muted); white-space: nowrap; }
.sb-tab-add:hover { color: var(--ink); }
.sb-tabs-right { display: flex; align-items: center; }
.sb-twinbadge { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--acc-d); background: var(--acc-l); padding: 4px 10px; border-radius: 20px; font-weight: 600; }

.sb-toolbar { height: 44px; display: flex; align-items: center; gap: 2px; padding: 0 12px; border-bottom: 1px solid var(--b); flex: none; }
.sb-tool { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 6px; color: #3d474d; font-weight: 500; white-space: nowrap; }
.sb-tool:hover { background: #f1f4f4; }
.sb-tool.icon { padding: 5px 6px; }
.sb-tool.on { background: #eaefef; }
.sb-tool.active-green { background: #d1f7c4; color: #2a6b13; }
.sb-tool.active-orange { background: #ffeab6; color: #8a5a02; }
.sb-tool.active-purple { background: #ede2fe; color: #5b17a0; }
.sb-tool.active-blue { background: #cfdfff; color: #24479c; }
.sb-tool.active-pink { background: #ffdaf6; color: #96117a; }
.sb-tool.danger { color: #d1352b; }
.sb-tool-sep { width: 1px; height: 18px; background: var(--b); margin: 0 8px; }
.sb-viewname { display: flex; align-items: center; gap: 7px; font-weight: 650; padding: 0 4px; }
.sb-toolbar-spacer { flex: 1; }
.sb-search { display: flex; align-items: center; }
.sb-search.open { border: 1px solid var(--b2); border-radius: 6px; padding-left: 8px; }
.sb-search input { border: none; outline: none; width: 190px; padding: 5px 0; background: transparent; }

.sb-body { flex: 1; display: flex; min-height: 0; }
.sb-sidebar { width: 258px; flex: none; border-right: 1px solid var(--b); display: flex; flex-direction: column; padding: 8px; }
.sb-side-search { display: flex; align-items: center; gap: 7px; padding: 6px 8px; border-bottom: 1px solid var(--b); color: var(--muted); margin-bottom: 6px; }
.sb-side-search input { border: none; outline: none; width: 100%; background: transparent; }
.sb-side-list { flex: 1; overflow-y: auto; }
.sb-side-item { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 6px; cursor: pointer; font-weight: 500; }
.sb-side-item:hover { background: #f1f4f4; }
.sb-side-item.active { background: var(--acc-l); font-weight: 620; }
.sb-side-item span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-side-more { opacity: .55; }
.sb-side-more:hover { opacity: 1; }
.sb-side-create { border-top: 1px solid var(--b); padding-top: 8px; }
.sb-side-label { font-size: 11px; font-weight: 650; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; padding: 4px 8px; }
.sb-side-create-item { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 6px; cursor: pointer; }
.sb-side-create-item:hover { background: #f1f4f4; }
.sb-side-create-item span { flex: 1; }
.sb-side-plus { color: var(--muted); }

.sb-gridwrap { flex: 1; overflow: auto; outline: none; position: relative; }
.sb-grid { position: relative; min-width: 100%; }
.sb-head { display: flex; position: sticky; top: 0; z-index: 30; background: #fff; height: 33px; }
.sb-headcell { position: relative; display: flex; align-items: center; gap: 6px; padding: 0 8px; height: 33px; background: #fbfcfc; border-right: 1px solid var(--b); border-bottom: 1px solid var(--b2); font-weight: 600; color: #3d474d; cursor: pointer; flex: none; }
.sb-headcell:hover { background: #f2f5f5; }
.sb-headcell.primary { position: sticky; z-index: 32; box-shadow: 1px 0 0 var(--b2); }
.sb-headcell.add { justify-content: center; color: var(--muted); }
.sb-headicon { color: var(--muted); flex: none; }
.sb-headname { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-headchev { color: var(--muted); opacity: 0; flex: none; }
.sb-headcell:hover .sb-headchev { opacity: 1; }
.sb-resize { position: absolute; right: -3px; top: 0; width: 7px; height: 100%; cursor: col-resize; z-index: 5; }
.sb-resize:hover { background: var(--acc); opacity: .55; }

.sb-row { display: flex; position: relative; }
.sb-row:hover .sb-cell { background: #f7faf9; }
.sb-row:hover .sb-rownum { display: none; }
.sb-row:hover .sb-rowcheck, .sb-row:hover .sb-expand { display: flex; }
.sb-row.checked .sb-cell { background: #fff6db; }
.sb-row.checked .sb-rowcheck { display: flex; }
.sb-row.checked .sb-rownum { display: none; }
.sb-gutter { position: sticky; left: 0; z-index: 20; display: flex; align-items: center; gap: 4px; padding-left: 8px; background: #fff; border-bottom: 1px solid var(--b); flex: none; }
.sb-row:hover .sb-gutter { background: #f7faf9; }
.sb-row.checked .sb-gutter { background: #fff6db; }
.sb-gutter.head { z-index: 34; background: #fbfcfc; border-bottom: 1px solid var(--b2); }
.sb-colorbar { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
.sb-rownum { width: 20px; text-align: right; color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.sb-rowcheck { display: none; width: 20px; justify-content: center; }
.sb-expand { display: none; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 4px; color: var(--muted); margin-left: auto; margin-right: 6px; cursor: pointer; }
.sb-expand:hover { background: #e3e8e8; color: var(--ink); }
.sb-check { width: 15px; height: 15px; border: 1.5px solid #b3babd; border-radius: 3px; display: flex; align-items: center; justify-content: center; cursor: pointer; background: #fff; flex: none; }
.sb-check.on { background: var(--acc); border-color: var(--acc); color: #fff; }

.sb-cell { position: relative; display: flex; align-items: center; padding: 0 8px; background: #fff; border-right: 1px solid var(--b); border-bottom: 1px solid var(--b); overflow: hidden; flex: none; }
.sb-cell.primary { position: sticky; z-index: 15; box-shadow: 1px 0 0 var(--b2); }
.sb-cell.comp { background: #fbfcfc; }
.sb-row:hover .sb-cell.comp { background: #f4f7f7; }
.sb-cell.wrap { align-items: flex-start; padding-top: 7px; white-space: pre-wrap; }
.sb-cell-blank { border-right: none; background: #fcfdfd; }
.sb-cell.sel { box-shadow: inset 0 0 0 2px var(--acc); z-index: 18; }
.sb-cell.primary.sel { box-shadow: inset 0 0 0 2px var(--acc), 1px 0 0 var(--b2); }
.sb-cell.editing { overflow: visible; z-index: 40; background: #fff; box-shadow: 0 0 0 2px var(--acc), 0 4px 12px rgba(0,0,0,.14); }
.sb-txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-cell.wrap .sb-txt { white-space: pre-wrap; }
.sb-num { width: 100%; text-align: right; font-variant-numeric: tabular-nums; }
.sb-computed { color: #2a3a3a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-computed.num { width: 100%; text-align: right; font-variant-numeric: tabular-nums; font-weight: 550; }
.sb-cell-center { width: 100%; display: flex; justify-content: center; }
.sb-link { color: var(--acc-d); text-decoration: underline; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-mark { background: #ffe9a3; border-radius: 2px; }
.sb-pills { display: flex; gap: 4px; overflow: hidden; }
.sb-pill { display: inline-flex; align-items: center; gap: 4px; height: 19px; padding: 0 8px; border-radius: 10px; font-size: 12px; font-weight: 500; white-space: nowrap; max-width: 100%; overflow: hidden; }
.sb-pill-x { cursor: pointer; opacity: .6; }
.sb-pill-x:hover { opacity: 1; }
.sb-chip { display: inline-flex; align-items: center; gap: 5px; height: 20px; padding: 0 8px; border-radius: 4px; background: #eef2f3; border: 1px solid #dde4e5; font-size: 12px; white-space: nowrap; max-width: 100%; overflow: hidden; }
.sb-chip-dot { width: 5px; height: 10px; border-radius: 1px; background: var(--acc); flex: none; }
.sb-chip-t { overflow: hidden; text-overflow: ellipsis; }
.sb-avatar { display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff; font-weight: 650; flex: none; }
.sb-person { display: inline-flex; align-items: center; gap: 6px; overflow: hidden; }
.sb-person span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-stars { display: inline-flex; gap: 1px; }
.sb-star { color: #d6dad9; cursor: pointer; }
.sb-star.on { color: #fcb400; fill: #fcb400; }

.sb-inline-input { position: absolute; inset: 0; width: 100%; height: 100%; border: none; outline: none; padding: 0 8px; background: #fff; }
.sb-inline-tall { position: absolute; left: 0; top: 0; min-height: 92px; background: #fff; z-index: 50; }
.sb-inline-tall textarea { width: 100%; height: 92px; border: none; outline: none; resize: none; padding: 6px 8px; }

.sb-addrow { display: flex; align-items: center; border-bottom: 1px solid var(--b); color: var(--muted); cursor: pointer; }
.sb-addrow:hover { background: #f7faf9; }
.sb-addrow-inner { position: sticky; left: 0; display: flex; align-items: center; padding-left: 8px; height: 100%; }
.sb-grouphead { display: flex; align-items: center; gap: 8px; height: 38px; padding-left: 10px; background: #f2f6f6; border-bottom: 1px solid var(--b); position: sticky; left: 0; cursor: pointer; }
.sb-groupchev { color: var(--muted); display: flex; }
.sb-groupval { font-weight: 600; }
.sb-groupcount { color: var(--muted); font-size: 12px; }

.sb-footer { height: 36px; display: flex; align-items: center; gap: 16px; padding: 0 14px; border-top: 1px solid var(--b); background: #fff; flex: none; }
.sb-foot-add { display: flex; align-items: center; gap: 6px; color: var(--muted); }
.sb-foot-add:hover { color: var(--ink); }
.sb-foot-count { color: var(--muted); }
.sb-foot-spacer { flex: 1; }
.sb-foot-meta { color: #93a0a3; font-size: 12px; }

.sb-backdrop { position: fixed; inset: 0; z-index: 100; }
.sb-pop { position: fixed; z-index: 101; background: #fff; border-radius: 8px; box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 8px 26px rgba(0,0,0,.18); overflow: hidden; max-height: 72vh; display: flex; flex-direction: column; }
.sb-pop-title { padding: 10px 12px 6px; font-weight: 650; color: var(--muted); font-size: 12px; }
.sb-pop-list { overflow-y: auto; padding: 4px; }
.sb-pop-list.scroll { max-height: 340px; }
.sb-pop-item { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 6px; cursor: pointer; }
.sb-pop-item:hover { background: #f1f4f4; }
.sb-pop-item.selected { background: var(--acc-l); }
.sb-pop-item.danger { color: #d1352b; }
.sb-pop-icon { color: var(--muted); flex: none; }
.sb-pop-check { margin-left: auto; color: var(--acc); }
.sb-pop-hint { margin-left: auto; font-size: 11px; color: var(--muted); }
.sb-pop-hintrow { padding: 8px 10px; color: var(--muted); font-size: 12px; }
.sb-pop-empty, .sb-pop-muted { padding: 10px; color: var(--muted); }
.sb-pop-note { margin-top: 8px; font-size: 11.5px; color: var(--muted); line-height: 1.45; }
.sb-pop-search { display: flex; align-items: center; gap: 7px; padding: 8px 10px; border-bottom: 1px solid var(--b); color: var(--muted); }
.sb-pop-search input { border: none; outline: none; width: 100%; }
.sb-pop-clear { color: var(--muted); }
.sb-pop-foot { display: flex; gap: 8px; padding: 8px; border-top: 1px solid var(--b); }
.sb-pop-foot button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 6px; border-radius: 5px; background: #f1f4f4; font-weight: 550; }
.sb-pop-foot button:hover { background: #e6ebeb; }
.sb-pop-pad { padding: 12px; overflow-y: auto; }
.sb-pop-label { font-size: 11px; font-weight: 650; color: var(--muted); text-transform: uppercase; margin: 12px 0 5px; }
.sb-pop-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.sb-pop-actions.left { justify-content: flex-start; }
.sb-editor { display: flex; flex-direction: column; min-height: 0; }
.sb-linkrow { flex: 1; overflow: hidden; }
.sb-linkrow-t { font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sb-linkrow-s { color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.sb-input { width: 100%; padding: 7px 9px; border: 1px solid var(--b2); border-radius: 6px; outline: none; background: #fff; }
.sb-input:focus { border-color: var(--acc); box-shadow: 0 0 0 2px rgba(15,141,132,.18); }
.sb-formula { min-height: 74px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; line-height: 1.5; }
.sb-err { margin-top: 6px; color: #b02318; font-size: 12px; background: #ffdce5; padding: 6px 8px; border-radius: 5px; }
.sb-fieldchips { display: flex; flex-wrap: wrap; gap: 5px; }
.sb-fieldchip { padding: 4px 8px; border-radius: 4px; background: #eef2f3; border: 1px solid #dde4e5; font-size: 12px; }
.sb-fieldchip:hover { background: var(--acc-l); border-color: var(--acc); }
.sb-btn { padding: 7px 14px; border-radius: 6px; font-weight: 550; }
.sb-btn.ghost { background: #f1f4f4; }
.sb-btn.primary { background: var(--acc); color: #fff; }
.sb-btn.primary:disabled { opacity: .45; cursor: default; }
.sb-linkbtn { display: inline-flex; align-items: center; gap: 5px; color: var(--acc-d); font-weight: 550; padding: 6px 4px; }
.sb-optlist { display: flex; flex-direction: column; gap: 6px; }
.sb-optrow { display: flex; align-items: center; gap: 8px; }
.sb-optdot { width: 16px; height: 16px; border-radius: 50%; cursor: pointer; flex: none; }
.sb-optinput { flex: 1; padding: 5px 8px; border: 1px solid var(--b2); border-radius: 5px; outline: none; }
.sb-optdel { color: var(--muted); cursor: pointer; }
.sb-toggle { width: 26px; height: 15px; border-radius: 8px; background: #cfd5d6; position: relative; flex: none; transition: background .12s; }
.sb-toggle span { position: absolute; top: 2px; left: 2px; width: 11px; height: 11px; border-radius: 50%; background: #fff; transition: left .12s; }
.sb-toggle.on { background: var(--acc); }
.sb-toggle.on span { left: 13px; }

.sb-filterrow { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.sb-filterlead { width: 88px; color: var(--muted); flex: none; }
.sb-filterval { flex: 1.2; display: flex; }
.sb-mini { padding: 5px 7px; border: 1px solid var(--b2); border-radius: 5px; background: #fff; outline: none; min-width: 90px; }
.sb-mini.grow { flex: 1; width: 100%; }
.sb-mini.disabled { background: #f5f7f7; flex: 1; }
.sb-rowdel { color: var(--muted); cursor: pointer; flex: none; }
.sb-segment { display: flex; border: 1px solid var(--b2); border-radius: 5px; overflow: hidden; flex: none; }
.sb-segment button { padding: 5px 10px; font-size: 12px; }
.sb-segment button.on { background: var(--acc); color: #fff; }

.sb-kanban, .sb-gallery {
  background-color: #f5f8f8;
  background-image: linear-gradient(rgba(15,141,132,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(15,141,132,.055) 1px, transparent 1px);
  background-size: 24px 24px;
}
.sb-kanban { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.sb-kanban-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; color: var(--muted); background: #fff; border-bottom: 1px solid var(--b); }
.sb-kanban-cols { flex: 1; display: flex; gap: 12px; padding: 14px; overflow-x: auto; }
.sb-kcol { width: 276px; flex: none; display: flex; flex-direction: column; background: rgba(233,238,238,.9); border-radius: 8px; max-height: 100%; }
.sb-kcol.over { background: var(--acc-l); outline: 2px dashed var(--acc); }
.sb-kcol-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; }
.sb-kcount { margin-left: auto; color: var(--muted); font-size: 12px; }
.sb-kcol-body { padding: 0 8px 8px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.sb-card { background: #fff; border-radius: 6px; padding: 10px; box-shadow: 0 0 0 1px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.06); cursor: pointer; }
.sb-card:hover { box-shadow: 0 0 0 1px rgba(15,141,132,.4), 0 2px 8px rgba(0,0,0,.1); }
.sb-card-title { font-weight: 620; margin-bottom: 6px; }
.sb-card-line { margin-top: 4px; color: #4a5459; overflow: hidden; }
.sb-kadd { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; color: var(--muted); border-radius: 6px; }
.sb-kadd:hover { background: #e2e7e7; }

.sb-gallery { flex: 1; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 14px; padding: 16px; overflow-y: auto; }
.sb-card.gallery { width: 254px; padding: 0; overflow: hidden; }
.sb-card.gallery.add { display: flex; align-items: center; justify-content: center; height: 130px; color: var(--muted); }
.sb-card-cover { height: 78px; display: flex; align-items: center; justify-content: center; }
.sb-card-body { padding: 10px 12px 12px; }
.sb-card-field { margin-top: 8px; }
.sb-card-label { font-size: 11px; color: var(--muted); font-weight: 600; margin-bottom: 2px; }
.sb-card-value { min-height: 18px; }
.sb-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--muted); }

.sb-modal-back { position: fixed; inset: 0; background: rgba(12,26,25,.45); z-index: 90; display: flex; align-items: center; justify-content: center; padding: 40px; }
.sb-modal { width: 100%; max-width: 960px; max-height: 86vh; background: #fff; border-radius: 10px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.3); }
.sb-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--b); }
.sb-modal-nav, .sb-modal-actions { display: flex; align-items: center; gap: 4px; }
.sb-modal-nav button, .sb-modal-actions button { padding: 5px; border-radius: 5px; color: var(--muted); }
.sb-modal-nav button:hover, .sb-modal-actions button:hover { background: #f1f4f4; color: var(--ink); }
.sb-modal-nav button:disabled { opacity: .3; cursor: default; }
.sb-modal-crumb { margin-left: 8px; color: var(--muted); }
.sb-modal-title { padding: 16px 22px 12px; font-size: 22px; font-weight: 675; }
.sb-modal-body { flex: 1; display: flex; min-height: 0; }
.sb-modal-fields { flex: 1.45; overflow-y: auto; padding: 4px 22px 22px; }
.sb-mrow { display: flex; align-items: flex-start; gap: 12px; padding: 5px 0; }
.sb-mlabel { width: 178px; flex: none; display: flex; align-items: center; gap: 7px; color: var(--muted); font-weight: 550; padding-top: 6px; }
.sb-mvalue { flex: 1; min-height: 30px; border-radius: 5px; cursor: text; }
.sb-mshow { padding: 6px 8px; border-radius: 5px; min-height: 30px; }
.sb-mshow:hover { background: #f1f4f4; }
.sb-mshow.computed { background: #f7faf9; cursor: default; }
.sb-mempty { color: #aeb6b8; }
.sb-minput, .sb-mtextarea { width: 100%; padding: 6px 8px; border: 2px solid var(--acc); border-radius: 5px; outline: none; }
.sb-mtextarea { min-height: 92px; resize: vertical; }
.sb-modal-comments { flex: 1; border-left: 1px solid var(--b); display: flex; flex-direction: column; background: #fafcfb; min-width: 300px; }
.sb-comments-head { display: flex; align-items: center; gap: 7px; padding: 12px 16px; font-weight: 650; border-bottom: 1px solid var(--b); }
.sb-comments-list { flex: 1; overflow-y: auto; padding: 12px 16px; }
.sb-comment { display: flex; gap: 10px; margin-bottom: 14px; }
.sb-comment-meta { font-weight: 600; font-size: 12.5px; }
.sb-comment-meta span { color: var(--muted); font-weight: 400; margin-left: 6px; }
.sb-comment-text { margin-top: 2px; }
.sb-comment-box { padding: 12px 16px; border-top: 1px solid var(--b); }
.sb-comment-box textarea { width: 100%; min-height: 62px; padding: 8px; border: 1px solid var(--b2); border-radius: 6px; outline: none; resize: vertical; margin-bottom: 8px; }
.sb-comment-box textarea:focus { border-color: var(--acc); }

@media (max-width: 980px) {
  .sb-nav, .sb-sidebar, .sb-modal-comments { display: none; }
}
`;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<SimpleBuildingsTwin />);