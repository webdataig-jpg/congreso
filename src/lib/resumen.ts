import type { Datos, Fila } from "./tipos";
import { construirFilas, finMs } from "./calculo";

/** Nombre corto y grupo de cada organismo del Poder Legislativo (servicio administrativo financiero). */
const ORGANISMOS: Record<string, { corto: string; grupo: "Cámaras" | "Servicios del Congreso" | "Organismos de control" }> = {
  "313": { corto: "Cámara de Diputados", grupo: "Cámaras" },
  "312": { corto: "Senado", grupo: "Cámaras" },
  "316": { corto: "Obra social del personal (DAS)", grupo: "Servicios del Congreso" },
  "314": { corto: "Biblioteca del Congreso", grupo: "Servicios del Congreso" },
  "315": { corto: "Imprenta del Congreso", grupo: "Servicios del Congreso" },
  "369": { corto: "Oficina de Presupuesto del Congreso", grupo: "Servicios del Congreso" },
  "1": { corto: "Auditoría General de la Nación", grupo: "Organismos de control" },
  "340": { corto: "Procuración Penitenciaria", grupo: "Organismos de control" },
  "319": { corto: "Defensoría del Pueblo", grupo: "Organismos de control" },
  "385": { corto: "Defensoría de Niñas, Niños y Adolescentes", grupo: "Organismos de control" },
  "387": { corto: "Comité contra la Tortura", grupo: "Organismos de control" },
  "346": { corto: "Defensoría del Público Audiovisual", grupo: "Organismos de control" },
};

export function nombreOrganismo(id: string, nombre: string) {
  return ORGANISMOS[id] ?? { corto: nombre, grupo: "Organismos de control" as const };
}

const DIAS_ANIO = (anio: number) => ((anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0 ? 366 : 365);

export function resumenCongreso(datos: Datos) {
  const p = datos.presupuesto;
  if (!p) return null;
  const vigente = p.organismos.reduce((a, o) => a + o.vigente, 0); // millones
  const devengado = p.organismos.reduce((a, o) => a + o.devengado, 0);
  const presupuestado = p.organismos.reduce((a, o) => a + o.presupuestado, 0);
  const dias = DIAS_ANIO(p.ejercicio);
  const personal = p.incisos.find((i) => /personal/i.test(i.nombre))?.vigente ?? 0;
  return {
    ejercicio: p.ejercicio,
    actualizado: p.actualizado,
    vigente,
    devengado,
    presupuestado,
    ejecutado: devengado / vigente,
    porDia: vigente / dias,
    porSegundo: (vigente * 1e6) / (dias * 86400),
    porHabitante: (vigente * 1e6) / datos.parametros.poblacion,
    shareNacional: vigente / p.totalNacional.vigente,
    sharePersonal: personal / vigente,
    organismos: p.organismos.map((o) => ({ ...o, ...nombreOrganismo(o.id, o.nombre) })),
    incisos: p.incisos,
  };
}

/** Costo anual (millones) de dietas y asesores, a valores base (sin aguinaldo ni contribuciones). */
export function costoLegisladores(filas: Fila[]) {
  const suma = (fs: Fila[], k: "dietaMensual" | "asesoresMensual") => (fs.reduce((a, f) => a + f[k], 0) * 12) / 1e6;
  const dip = filas.filter((f) => f.camara === "diputados");
  const sen = filas.filter((f) => f.camara === "senadores");
  const partes = [
    { clave: "dietasDip", nombre: "Dietas de diputados", valor: suma(dip, "dietaMensual") },
    { clave: "asesoresDip", nombre: "Asesores de diputados (estimado)", valor: suma(dip, "asesoresMensual") },
    { clave: "dietasSen", nombre: "Dietas de senadores", valor: suma(sen, "dietaMensual") },
    { clave: "asesoresSen", nombre: "Asesores de senadores", valor: suma(sen, "asesoresMensual") },
  ];
  return { partes, total: partes.reduce((a, x) => a + x.valor, 0) };
}

/** Fechas de fin de mandato futuras, con cuántos terminan en cada una. */
export function recambios(filas: Fila[], ahora: number) {
  const m = new Map<string, { fin: string; diputados: number; senadores: number }>();
  for (const f of filas) {
    if (finMs(f.fin) <= ahora) continue;
    const r = m.get(f.fin) ?? { fin: f.fin, diputados: 0, senadores: 0 };
    r[f.camara]++;
    m.set(f.fin, r);
  }
  return [...m.values()].sort((a, b) => a.fin.localeCompare(b.fin));
}

export { construirFilas };

/** Distrito o bloque que más suma en dietas y asesores (pesos por mes), con su peso sobre el total. */
export function mayorGasto(filas: Fila[], clave: "distrito" | "bloque") {
  const m = new Map<string, { nombre: string; mensual: number; cantidad: number }>();
  let total = 0;
  for (const f of filas) {
    const k = f[clave].trim().toUpperCase();
    const r = m.get(k) ?? { nombre: f[clave].trim(), mensual: 0, cantidad: 0 };
    const v = f.dietaMensual + f.asesoresMensual;
    r.mensual += v;
    r.cantidad++;
    total += v;
    m.set(k, r);
  }
  const top = [...m.values()].sort((a, b) => b.mensual - a.mensual)[0];
  return top ? { ...top, share: top.mensual / total } : null;
}
