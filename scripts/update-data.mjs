// Descarga los datos oficiales de HCDN y Senado y genera data/legisladores.json.
// Si una fuente falla, conserva lo que había en el JSON anterior (no rompe el build).
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "data", "legisladores.json");
const PARAMS = JSON.parse(await readFile(path.join(ROOT, "data", "parametros.json"), "utf8"));
const UA = "Mozilla/5.0 (compatible; cuanto-nos-cuestan/1.0)";
const HCDN_CKAN = "https://datos.hcdn.gob.ar/api/3/action/package_show?id=";
const SENADO = "https://www.senado.gob.ar";

let previo = null;
try {
  previo = JSON.parse(await readFile(OUT, "utf8"));
} catch {}

const avisos = [];
const log = (...a) => console.log("[datos]", ...a);

async function get(url, { tries = 3, timeout = 30000 } = {}) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeout) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.text();
    } catch (e) {
      err = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw err;
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x !== "")) rows.push(row);
  const [head, ...body] = rows;
  const keys = head.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}

// "6.125.805,18" -> 6125805.18 ; "328751,12" -> 328751.12
const num = (s) => Number(String(s).replace(/\./g, "").replace(",", "."));

async function hcdnCSV(dataset, nombreRecurso) {
  const pkg = JSON.parse(await get(HCDN_CKAN + dataset)).result;
  const r = pkg.resources.find(
    (x) => x.format?.toUpperCase() === "CSV" && x.name.toLowerCase().includes(nombreRecurso.toLowerCase()),
  );
  if (!r) throw new Error(`No se encontró el recurso ${nombreRecurso} en ${dataset}`);
  const url = r.url.replace(":443", "");
  return { filas: parseCSV(await get(url)), actualizado: r.last_modified || r.created, url };
}

const MINUSCULAS = new Set(["de", "del", "la", "las", "los", "y", "e"]);
const titulo = (s) =>
  s
    .toLowerCase()
    .replace(/(^|[\s\-'(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
    .replace(/(?<=\s)(\p{L}+)/gu, (w) => (MINUSCULAS.has(w.toLowerCase()) ? w.toLowerCase() : w));

// HCDN publica algunas provincias sin tilde
const TILDES = {
  Cordoba: "Córdoba", "Entre Rios": "Entre Ríos", Neuquen: "Neuquén", "Rio Negro": "Río Negro",
  Tucuman: "Tucumán",
  "Ciudad Autónoma de Buenos Aires": "Ciudad de Buenos Aires",
  "Tierra del Fuego, Antártida e Islas del Atlántico Sur": "Tierra del Fuego",
};
const provincia = (s) => {
  const t = titulo(s);
  return TILDES[t] ?? t;
};

const slug = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// ---------- Escala salarial (módulos por categoría) ----------
async function escala() {
  try {
    const { filas, actualizado, url } = await hcdnCSV("escala-salarial", "escala");
    const e = {};
    for (const f of filas) {
      // Este CSV usa punto decimal ("591.5")
      e[f.ESCALAFON] = Math.round((Number(f.DEDICACION_FUNCIONAL_MODULO) + Number(f.SUELDO_BASICO_MODULO)) * 10) / 10;
    }
    if (Object.keys(e).length < 10) throw new Error("escala incompleta");
    return { modulos: e, actualizado, url };
  } catch (err) {
    avisos.push(`Escala salarial: se usó la copia local (${err.message})`);
    return previo?.escala ?? { modulos: PARAMS.escalaFallback, actualizado: null, url: null };
  }
}

// ---------- Dieta de diputados ----------
async function dietaDiputados() {
  try {
    const { filas, actualizado, url } = await hcdnCSV("dietas-y-gastos-de-representacion-legisladores-as", "remuneraciones");
    const get = (k) => num(filas.find((f) => Object.values(f)[0].toLowerCase().startsWith(k))?.importe ?? NaN);
    const d = { dieta: get("dieta"), gastosRepresentacion: get("gastos"), actualizado, url };
    if (!(d.dieta > 0)) throw new Error("dieta inválida");
    const modulos = d.dieta / PARAMS.valorModulo;
    if (Math.abs(modulos - Math.round(modulos)) > 0.01)
      avisos.push(`La dieta de diputados (${d.dieta}) no es un múltiplo entero del módulo configurado: revisar valorModulo en data/parametros.json`);
    return d;
  } catch (err) {
    avisos.push(`Dieta de diputados: se usó la copia local (${err.message})`);
    return previo?.dietaDiputado ?? { ...PARAMS.dietaDiputadoFallback, actualizado: null, url: null };
  }
}

// ---------- Diputados ----------
function fechaDMY(s) {
  const [d, m, y] = s.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

async function diputados() {
  try {
    const { filas, actualizado, url } = await hcdnCSV("legisladores", "composición actual");
    const lista = filas.map((f) => {
      const [desde, hasta] = f.MANDATO.split("-").map(Number);
      return {
        id: slug(`${f.APELLIDO}-${f.NOMBRE}`),
        apellido: f.APELLIDO,
        nombre: f.NOMBRE,
        distrito: provincia(f.DISTRITO),
        bloque: f.BLOQUE,
        inicioMandato: `${desde}-12-10`,
        inicio: f.FECHA_DE_INICIO ? fechaDMY(f.FECHA_DE_INICIO) : `${desde}-12-10`,
        fin: `${hasta}-12-09`,
      };
    });
    if (lista.length < 200) throw new Error(`solo ${lista.length} diputados`);
    return { lista, actualizado, url };
  } catch (err) {
    avisos.push(`Diputados: se usó la copia local (${err.message})`);
    return previo?.diputados ?? { lista: [], actualizado: null, url: null };
  }
}

// ---------- Personal de bloques en Diputados ----------
async function personalDiputados() {
  try {
    const { filas, actualizado, url } = await hcdnCSV("nomina-de-personal", "nómina");
    const categorias = {};
    let total = 0;
    for (const f of filas) {
      if (!/BLOQUE POLITICO/i.test(f.ESTRUCTURA)) continue;
      const m = f.ESCALAFON.match(/^A-(\d+)/);
      if (!m) continue;
      categorias[m[1]] = (categorias[m[1]] || 0) + 1;
      total++;
    }
    if (total < 100) throw new Error(`solo ${total} agentes`);
    return { total, categorias, actualizado, url };
  } catch (err) {
    avisos.push(`Personal de Diputados: se usó la copia local (${err.message})`);
    return previo?.personalDiputados ?? null;
  }
}

// ---------- Senadores ----------
async function personalSenador(id) {
  const html = await get(`${SENADO}/senadores/senador/${id}`);
  const i = html.indexOf('id="Personal"');
  if (i < 0) throw new Error("sin sección Personal");
  const bloque = html.slice(i, html.indexOf("</table>", i));
  const categorias = {};
  let total = 0;
  for (const m of bloque.matchAll(/<td>\s*([^<]+?)\s*<\/td>\s*<td>\s*A-(\d+)\s*<\/td>/g)) {
    categorias[m[2]] = (categorias[m[2]] || 0) + 1;
    total++;
  }
  return { total, categorias };
}

async function senadores() {
  try {
    const raw = await get(`${SENADO}/micrositios/DatosAbiertos/ExportarListadoSenadores/json`);
    const rows = JSON.parse(raw.replace(/^[\s\S]*?(\{)/, "$1").replace(/<\/pre>[\s\S]*$/, "")).table.rows;
    if (rows.length < 60) throw new Error(`solo ${rows.length} senadores`);
    const previos = new Map((previo?.senadores?.lista ?? []).map((s) => [s.id, s]));
    const lista = [];
    // Pedidos de a 6 para no saturar el sitio del Senado
    for (let i = 0; i < rows.length; i += 6) {
      const lote = await Promise.all(
        rows.slice(i, i + 6).map(async (r) => {
          let personal = null;
          try {
            personal = await personalSenador(r.ID);
          } catch (e) {
            personal = previos.get(r.ID)?.personal ?? null;
            avisos.push(`Personal del senador ${r.APELLIDO} (${r.ID}): ${personal ? "se usó la copia local" : "sin datos"} (${e.message})`);
          }
          return {
            id: r.ID,
            apellido: titulo(r.APELLIDO),
            nombre: titulo(r.NOMBRE),
            distrito: provincia(r.PROVINCIA),
            bloque: r.BLOQUE,
            partido: r["PARTIDO O ALIANZA"],
            inicioMandato: r.D_LEGAL,
            inicio: /^\d{4}-/.test(r.D_REAL) ? r.D_REAL : r.D_LEGAL,
            fin: r.C_LEGAL,
            foto: r.FOTO || null,
            personal,
          };
        }),
      );
      lista.push(...lote);
    }
    return { lista, actualizado: new Date().toISOString(), url: `${SENADO}/micrositios/DatosAbiertos/ExportarListadoSenadores/json` };
  } catch (err) {
    avisos.push(`Senadores: se usó la copia local (${err.message})`);
    return previo?.senadores ?? { lista: [], actualizado: null, url: null };
  }
}

const [esc, dieta, dips, persDip, sens] = await Promise.all([
  escala(),
  dietaDiputados(),
  diputados(),
  personalDiputados(),
  senadores(),
]);

const salida = {
  generado: new Date().toISOString(),
  parametros: PARAMS,
  escala: esc,
  dietaDiputado: dieta,
  diputados: dips,
  personalDiputados: persDip,
  senadores: sens,
  avisos,
};

if (!dips.lista.length && !sens.lista.length) {
  console.error("[datos] No hay datos de legisladores ni copia local. Abortando.");
  process.exit(1);
}

await writeFile(OUT, JSON.stringify(salida, null, 1) + "\n", "utf8");
log(`Diputados: ${dips.lista.length} · Senadores: ${sens.lista.length} · Personal de bloques HCDN: ${persDip?.total ?? "—"}`);
log(`Asesores de senadores: ${sens.lista.reduce((a, s) => a + (s.personal?.total ?? 0), 0)}`);
if (avisos.length) avisos.forEach((a) => log("AVISO:", a));
