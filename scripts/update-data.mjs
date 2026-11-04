// Descarga los datos oficiales de HCDN y Senado y genera data/legisladores.json.
// Si una fuente falla, conserva lo que había en el JSON anterior (no rompe el build).
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

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
      if (!res.ok) {
        const e = new Error(`HTTP ${res.status} ${url}`);
        e.status = res.status;
        throw e;
      }
      return await res.text();
    } catch (e) {
      err = e;
      // Si el sitio nos frena, no insistir
      if (e.status === 403 || e.status === 429 || e.status === 404) break;
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
    await contactosDiputados(lista);
    return { lista, actualizado, url };
  } catch (err) {
    avisos.push(`Diputados: se usó la copia local (${err.message})`);
    return previo?.diputados ?? { lista: [], actualizado: null, url: null };
  }
}

// ---------- Contacto y redes ----------
const REDES = [
  [/instagram\.com/i, "Instagram"],
  [/(twitter|x)\.com/i, "X"],
  [/facebook\.com|fb\.com/i, "Facebook"],
  [/youtube\.com|youtu\.be/i, "YouTube"],
  [/tiktok\.com/i, "TikTok"],
  [/linkedin\.com/i, "LinkedIn"],
  [/threads\.(net|com)/i, "Threads"],
];

function redes(urls) {
  const out = [];
  const vistos = new Set();
  for (let u of urls) {
    u = (u || "").trim();
    if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(u)) continue;
    const red = REDES.find(([re]) => re.test(u))?.[1] ?? "Web";
    if (vistos.has(red)) continue;
    vistos.add(red);
    out.push({ red, url: u });
  }
  return out;
}

const textoLimpio = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
// Cuántas páginas de diputados se revisan por corrida, y cada cuánto se refresca un contacto
const CONTACTOS_MAX = Number(process.env.CONTACTOS_MAX ?? 40);
const CONTACTOS_PAUSA_MS = 1500;
const CONTACTOS_VIGENCIA_DIAS = 30;

async function contactoDiputado(slugHcdn) {
  const base = `https://www.hcdn.gob.ar/diputados/${slugHcdn}/`;
  const index = await get(base, { tries: 1 });
  const email = index.match(/href="mailto:([^"]+)"/i)?.[1]?.toLowerCase() ?? null;
  const i = index.indexOf("Redes Sociales:");
  const bloqueRedes = i > 0 ? index.slice(i, index.indexOf("</p>", i)) : "";
  const urls = [...bloqueRedes.matchAll(/href=['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const j = index.indexOf("Ubicación de Oficina:");
  const oficina = j > 0 ? textoLimpio(index.slice(j + 21, index.indexOf("</p>", j))).replace(/^<?\/?strong>?/, "").trim() || null : null;
  return {
    email,
    telefono: null,
    oficina,
    redes: redes(urls),
    perfil: base,
    despacho: `${base}jefe-despacho.html`,
    revisado: new Date().toISOString().slice(0, 10),
  };
}

async function contactosDiputados(lista) {
  const previos = new Map((previo?.diputados?.lista ?? []).map((d) => [d.id, d]));
  let indice;
  try {
    const html = await get("https://www.hcdn.gob.ar/diputados/");
    indice = new Map();
    for (const m of html.matchAll(/<tr>\s*<td><img src="([^"]*)"[^>]*><\/td>\s*<td>\s*<a href="\/diputados\/([^/"]+)\/">\s*([^<]+?)\s*<\/a>/g)) {
      indice.set(slug(m[3].replace(",", " ")), { foto: m[1], slugHcdn: m[2] });
    }
    if (indice.size < 200) throw new Error(`listado con ${indice.size} filas`);
  } catch (e) {
    avisos.push(`Contactos de diputados: se usó la copia local (${e.message})`);
    for (const d of lista) Object.assign(d, { foto: previos.get(d.id)?.foto ?? null, contacto: previos.get(d.id)?.contacto ?? null });
    return;
  }
  let sinMatch = 0;
  const pendientes = [];
  const limite = new Date(Date.now() - CONTACTOS_VIGENCIA_DIAS * 86400000).toISOString().slice(0, 10);
  for (const d of lista) {
    const ref = indice.get(slug(`${d.apellido} ${d.nombre}`));
    const anterior = previos.get(d.id)?.contacto ?? null;
    d.foto = ref?.foto ?? previos.get(d.id)?.foto ?? null;
    if (!ref) {
      sinMatch++;
      d.contacto = anterior;
      continue;
    }
    const base = `https://www.hcdn.gob.ar/diputados/${ref.slugHcdn}/`;
    d.contacto = anterior ?? {
      email: null, telefono: null, oficina: null, redes: [], perfil: base, despacho: `${base}jefe-despacho.html`, revisado: null,
    };
    if (!anterior?.revisado || anterior.revisado < limite) pendientes.push({ d, slugHcdn: ref.slugHcdn });
  }
  // Primero los nunca revisados, después los más viejos. De a uno y con pausa: HCDN bloquea ráfagas.
  pendientes.sort((a, b) => (a.d.contacto.revisado ?? "").localeCompare(b.d.contacto.revisado ?? ""));
  let hechos = 0;
  for (const { d, slugHcdn } of pendientes.slice(0, CONTACTOS_MAX)) {
    try {
      d.contacto = await contactoDiputado(slugHcdn);
      hechos++;
    } catch (e) {
      avisos.push(`Contactos de diputados: HCDN frenó los pedidos (${e.message}); se sigue en la próxima actualización`);
      break;
    }
    await esperar(CONTACTOS_PAUSA_MS);
  }
  const faltan = pendientes.length - hechos;
  log(`Contactos de diputados revisados: ${hechos} · pendientes: ${faltan}`);
  if (faltan > 0 && hechos === Math.min(CONTACTOS_MAX, pendientes.length))
    log(`Quedan ${faltan} contactos por revisar en próximas corridas (CONTACTOS_MAX=${CONTACTOS_MAX})`);
  if (sinMatch) avisos.push(`${sinMatch} diputados no se encontraron en el listado web de HCDN (sin foto ni contacto)`);
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
            contacto: {
              email: r.EMAIL?.trim().toLowerCase() || null,
              telefono: r.TELEFONO?.trim() ? `Interno ${r.TELEFONO.trim()}` : null,
              oficina: null,
              redes: redes([r.INSTAGRAM, r.TWITTER, r.FACEBOOK, r.YOUTUBE]),
              perfil: `${SENADO}/senadores/senador/${r.ID}`,
            },
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

// ---------- Presupuesto del Poder Legislativo (Ministerio de Economía, DGSIAF) ----------
// Crédito presupuestado, vigente y devengado del año, en millones de pesos, por organismo e inciso.
function unzipPrimerArchivo(buf) {
  // Busca el "end of central directory" y de ahí el primer archivo.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("zip sin directorio central");
  const cd = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error("zip: directorio central inválido");
  const metodo = buf.readUInt16LE(cd + 10);
  const comprimido = buf.readUInt32LE(cd + 20);
  const local = buf.readUInt32LE(cd + 42);
  const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  const datos = buf.subarray(inicio, inicio + comprimido);
  if (metodo === 0) return datos;
  if (metodo === 8) return inflateRawSync(datos);
  throw new Error(`zip: método ${metodo} no soportado`);
}

const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

async function presupuesto() {
  const anio = new Date().getFullYear();
  const url = `https://dgsiaf-repo.mecon.gob.ar/repository/pa/datasets/${anio}/credito-anual-${anio}.zip`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(180000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = unzipPrimerArchivo(Buffer.from(await res.arrayBuffer())).toString("utf8").replace(/^﻿/, "");
    const lineas = csv.split(/\r?\n/);
    const cab = splitCSV(lineas[0]);
    const ix = Object.fromEntries(cab.map((k, i) => [k, i]));
    const n = (x) => Number(String(x ?? "").replace(",", ".")) || 0;
    const org = new Map();
    const inc = new Map();
    const total = { vigente: 0, devengado: 0 };
    let fechaTxt = "";
    for (let i = 1; i < lineas.length; i++) {
      if (!lineas[i]) continue;
      const r = splitCSV(lineas[i]);
      const vig = n(r[ix.credito_vigente]);
      const dev = n(r[ix.credito_devengado]);
      total.vigente += vig;
      total.devengado += dev;
      fechaTxt ||= r[ix.ultima_actualizacion_fecha] ?? "";
      if (r[ix.jurisdiccion_id] !== "1") continue;
      const id = r[ix.servicio_id];
      const o = org.get(id) ?? { id, nombre: r[ix.servicio_desc], presupuestado: 0, vigente: 0, devengado: 0 };
      o.presupuestado += n(r[ix.credito_presupuestado]);
      o.vigente += vig;
      o.devengado += dev;
      org.set(id, o);
      const k = r[ix.inciso_desc];
      const x = inc.get(k) ?? { nombre: k, vigente: 0, devengado: 0 };
      x.vigente += vig;
      x.devengado += dev;
      inc.set(k, x);
    }
    if (org.size < 5) throw new Error(`solo ${org.size} organismos del Poder Legislativo`);
    const m = fechaTxt.match(/(\d{1,2}) (\p{L}+) (\d{4})/u);
    const actualizado = m && MESES[m[2].toLowerCase()]
      ? `${m[3]}-${String(MESES[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`
      : null;
    const r2 = (v) => Math.round(v * 100) / 100;
    return {
      ejercicio: anio,
      actualizado,
      url,
      unidad: "millones de pesos",
      totalNacional: { vigente: r2(total.vigente), devengado: r2(total.devengado) },
      organismos: [...org.values()]
        .map((o) => ({ ...o, presupuestado: r2(o.presupuestado), vigente: r2(o.vigente), devengado: r2(o.devengado) }))
        .sort((a, b) => b.vigente - a.vigente),
      incisos: [...inc.values()].map((x) => ({ ...x, vigente: r2(x.vigente), devengado: r2(x.devengado) })).sort((a, b) => b.vigente - a.vigente),
    };
  } catch (err) {
    avisos.push(`Presupuesto del Congreso: se usó la copia local (${err.message})`);
    return previo?.presupuesto ?? null;
  }
}

// Divide una línea CSV respetando comillas
function splitCSV(l) {
  const o = [];
  let f = "", q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) {
      if (c === '"' && l[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { o.push(f); f = ""; }
    else f += c;
  }
  o.push(f);
  return o;
}

const [esc, dieta, dips, persDip, sens, presu] = await Promise.all([
  escala(),
  dietaDiputados(),
  diputados(),
  personalDiputados(),
  senadores(),
  presupuesto(),
]);

const salida = {
  generado: new Date().toISOString(),
  parametros: PARAMS,
  escala: esc,
  dietaDiputado: dieta,
  diputados: dips,
  personalDiputados: persDip,
  senadores: sens,
  presupuesto: presu,
  avisos,
};

if (!dips.lista.length && !sens.lista.length) {
  console.error("[datos] No hay datos de legisladores ni copia local. Abortando.");
  process.exit(1);
}

await writeFile(OUT, JSON.stringify(salida, null, 1) + "\n", "utf8");
log(`Diputados: ${dips.lista.length} · Senadores: ${sens.lista.length} · Personal de bloques HCDN: ${persDip?.total ?? "—"}`);
if (presu) log(`Presupuesto ${presu.ejercicio} del Poder Legislativo: $ ${Math.round(presu.organismos.reduce((a, o) => a + o.vigente, 0))} M vigente (al ${presu.actualizado})`);
log(`Asesores de senadores: ${sens.lista.reduce((a, s) => a + (s.personal?.total ?? 0), 0)}`);
if (avisos.length) avisos.forEach((a) => log("AVISO:", a));
