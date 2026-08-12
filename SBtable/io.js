/* ------------------------------------------------------------------
   Import och export av CSV/Excel.

   Ren logik utan React. CSV läses och skrivs med egen kod, så den
   delen fungerar även om nätverket blockerar externa bibliotek.
   Excel laddas först när någon faktiskt väljer en .xlsx-fil.
------------------------------------------------------------------- */

/* ============================ CSV ================================= */

/* Gissar avgränsare genom att räkna tecken utanför citattecken på de
   första raderna. Svenska Excel skriver semikolon, engelska komma. */
export function detectDelimiter(text) {
  const sample = text.slice(0, 5000);
  const counts = { ";": 0, ",": 0, "\t": 0 };
  let inQuotes = false;
  for (let i = 0; i < sample.length; i++) {
    const c = sample[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (!inQuotes && c in counts) counts[c]++;
  }
  return Object.keys(counts).reduce((a, b) => (counts[b] > counts[a] ? b : a), ";");
}

/* Läser CSV till en tabell av strängar. Klarar citerade fält,
   radbrytningar inuti fält och dubbla citattecken som escape. */
export function parseCSV(text, delimiter) {
  let s = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const d = delimiter || detectDelimiter(s);
  const rows = [];
  let row = [], field = "", inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    // Citattecken gäller bara om de inleder fältet. Annars är det ett
    // vanligt tecken, som i: Kv. "Ekan" 3
    if (c === '"' && field === "") { inQuotes = true; continue; }
    if (c === d) { row.push(field); field = ""; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  row.push(field);
  rows.push(row);

  // Bort med helt tomma rader på slutet
  while (rows.length && rows[rows.length - 1].every((c) => String(c).trim() === "")) rows.pop();
  return rows.map((r) => r.map((c) => String(c).trim()));
}

export function toCSV(rows, delimiter = ";") {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /["\n;,\t]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map((r) => r.map(esc).join(delimiter)).join("\r\n");
}

/* ========================= Nedladdning ============================ */

export function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadCSV(filename, rows) {
  // BOM först, annars tolkar Excel å ä ö som skräptecken.
  download(filename, new Blob(["\uFEFF" + toCSV(rows)], { type: "text/csv;charset=utf-8" }));
}

export async function downloadXLSX(filename, sheets) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = (rows[0] || []).map((_, i) => ({
      wch: Math.min(42, Math.max(11, ...rows.slice(0, 200).map((r) => String(r[i] ?? "").length + 2))),
    }));
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(name));
  });
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(filename, new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}

function safeSheetName(n) {
  return String(n).replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Blad1";
}

/* Excel-biblioteket hämtas först vid behov. Går det inte kan
   användaren fortfarande jobba med CSV. */
let xlsxPromise = null;
export function loadXLSX() {
  if (!xlsxPromise)
    xlsxPromise = import("xlsx").catch(() => {
      xlsxPromise = null;
      throw new Error("Kunde inte hämta Excel-biblioteket. Spara filen som CSV och försök igen.");
    });
  return xlsxPromise;
}

/* ========================== Filinläsning ========================== */

export function readAsText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Kunde inte läsa filen."));
    // Excel på svenska sparar ofta CSV i Windows-1252 i stället för UTF-8.
    r.readAsText(file, "utf-8");
  });
}

function readAsBuffer(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Kunde inte läsa filen."));
    r.readAsArrayBuffer(file);
  });
}

/* Returnerar { rows, sheetNames, sheet } där rows är strängmatris. */
export async function readTable(file, sheetName) {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".xlsm")) {
    const XLSX = await loadXLSX();
    const wb = XLSX.read(await readAsBuffer(file), { type: "array", cellDates: true });
    const sheet = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, defval: "" });
    const rows = raw.map((r) => r.map(cellToText)).filter((r) => r.some((c) => c !== ""));
    return { rows, sheetNames: wb.SheetNames, sheet };
  }
  let text = await readAsText(file);
  // Tecknet U+FFFD betyder att UTF-8-tolkningen misslyckades – prova Windows-1252.
  if (text.includes("\uFFFD")) {
    try {
      const buf = await readAsBuffer(file);
      text = new TextDecoder("windows-1252").decode(buf);
    } catch (e) { /* behåll ursprunglig tolkning */ }
  }
  return { rows: parseCSV(text), sheetNames: null, sheet: null };
}

function cellToText(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return toISO(v);
  return String(v).trim();
}

/* ======================= Tolkning av värden ======================= */

const TRUE_WORDS = ["ja", "j", "true", "sant", "x", "1", "yes", "y", "kryssad", "ikryssad"];
const FALSE_WORDS = ["nej", "n", "false", "falskt", "0", "no", ""];

function toISO(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

export function parseNumber(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim().replace(/[\s\u00a0\u202f]/g, "").replace(/[^\d.,\-+eE]/g, "");
  if (!s || s === "-" || s === "+") return null;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Det tecken som står sist är decimaltecknet, det andra är tusentalsavgränsare.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(raw) {
  if (raw instanceof Date) return toISO(raw);
  const s = String(raw ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/); // 05/08/2026 tolkas som dag/månad
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{8})$/); // 20260805
  if (m) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d+(\.\d+)?$/.test(s)) {
    // Excels serienummer: dag 1 är 1900-01-01, med det kända skottdagsfelet.
    const n = Number(s);
    if (n > 20000 && n < 60000) {
      const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
      return toISO(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : toISO(d);
}

export function splitList(raw) {
  return String(raw ?? "")
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* Tolkar en cell från filen till appens format.
   Returnerar { value, newOptions, unmatched } där newOptions är
   alternativ som behöver skapas och unmatched är namn som inte
   kunde kopplas till någon post. */
export function coerce(raw, field, helpers = {}) {
  const { findRecordId, allowNewOptions = true } = helpers;
  const text = String(raw ?? "").trim();
  const result = { value: null, newOptions: [], unmatched: [] };

  switch (field.type) {
    case "number":
    case "currency":
      result.value = parseNumber(text);
      break;

    case "rating": {
      const n = parseNumber(text);
      result.value = n === null ? null : Math.max(0, Math.min(5, Math.round(n)));
      break;
    }

    case "checkbox": {
      const t = text.toLowerCase();
      result.value = TRUE_WORDS.includes(t) ? true : FALSE_WORDS.includes(t) ? false : Boolean(t);
      break;
    }

    case "date":
      result.value = parseDate(text);
      break;

    case "select": {
      if (!text) { result.value = null; break; }
      const hit = (field.options || []).find((o) => o.name.toLowerCase() === text.toLowerCase());
      if (hit) result.value = hit.id;
      else if (allowNewOptions) { result.newOptions.push(text); result.value = { __newOption: text }; }
      else result.value = null;
      break;
    }

    case "multiSelect": {
      const names = splitList(text);
      const ids = [];
      names.forEach((n) => {
        const hit = (field.options || []).find((o) => o.name.toLowerCase() === n.toLowerCase());
        if (hit) ids.push(hit.id);
        else if (allowNewOptions) { result.newOptions.push(n); ids.push({ __newOption: n }); }
      });
      result.value = ids;
      break;
    }

    case "link": {
      const names = splitList(text);
      const ids = [];
      names.forEach((n) => {
        const id = findRecordId ? findRecordId(field.linkedTableId, n) : null;
        if (id) ids.push(id);
        else result.unmatched.push(n);
      });
      result.value = ids;
      break;
    }

    case "longText":
    case "text":
    case "url":
    case "email":
    case "phone":
    case "person":
    default:
      result.value = text;
  }
  return result;
}

/* Gissar vilket fält en kolumnrubrik hör till. Exakt namn först,
   sedan utan versaler, blanksteg och det som står inom parentes. */
export function guessField(header, fields) {
  const norm = (s) =>
    String(s).toLowerCase().replace(/\(.*?\)/g, "").replace(/[\s_\-–]/g, "").trim();
  const h = norm(header);
  if (!h) return null;
  return (
    fields.find((f) => f.name.toLowerCase() === String(header).toLowerCase()) ||
    fields.find((f) => norm(f.name) === h) ||
    fields.find((f) => norm(f.name).startsWith(h) || h.startsWith(norm(f.name))) ||
    null
  );
}

/* Föreslår fälttyp för en kolumn som ska skapas som nytt fält. */
export function guessType(values) {
  const vals = values.map((v) => String(v ?? "").trim()).filter(Boolean).slice(0, 60);
  if (!vals.length) return "text";
  const all = (fn) => vals.every(fn);
  if (all((v) => TRUE_WORDS.includes(v.toLowerCase()) || FALSE_WORDS.includes(v.toLowerCase()))) return "checkbox";
  if (all((v) => parseNumber(v) !== null)) return "number";
  if (all((v) => parseDate(v) !== null && /[-/.]|^\d{8}$/.test(v))) return "date";
  if (all((v) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v))) return "email";
  if (all((v) => /^https?:\/\//i.test(v))) return "url";
  const unique = new Set(vals.map((v) => v.toLowerCase()));
  if (unique.size <= Math.max(2, Math.min(12, vals.length / 3))) return "select";
  if (vals.some((v) => v.length > 120)) return "longText";
  return "text";
}
