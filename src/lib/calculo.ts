import type { Ajustes, Categorias, Datos, Fila } from "./tipos";

/** Sueldo bruto mensual de un agente de la categoría dada (planta, Ley 24.600). */
export function sueldoCategoria(datos: Datos, categoria: string): number {
  const { valorModulo, modulosRC } = datos.parametros;
  const modulos = datos.escala.modulos[categoria];
  if (modulos == null) return 0;
  return (modulos + modulosRC) * valorModulo;
}

export function costoCategorias(datos: Datos, cats: Categorias): number {
  return Object.entries(cats).reduce((acc, [c, n]) => acc + n * sueldoCategoria(datos, c), 0);
}

export function construirFilas(datos: Datos): Fila[] {
  const p = datos.parametros;
  const filas: Fila[] = [];

  const dd = datos.dietaDiputado;
  const dietaDip = dd.dieta + dd.gastosRepresentacion;
  const nDip = datos.diputados.lista.length || 257;
  const pd = datos.personalDiputados;
  const promAsesores = pd ? pd.total / nDip : 0;
  const promCosto = pd ? costoCategorias(datos, pd.categorias) / nDip : 0;

  for (const d of datos.diputados.lista) {
    filas.push({
      camara: "diputados",
      id: d.id,
      apellido: d.apellido,
      nombre: d.nombre,
      distrito: d.distrito,
      bloque: d.bloque,
      inicio: d.inicio,
      fin: d.fin,
      foto: null,
      asesores: promAsesores,
      asesoresEstimado: true,
      categorias: null,
      dietaMensual: dietaDip,
      dietaDetalle: [
        { concepto: "Dieta", importe: dd.dieta },
        { concepto: "Gastos de representación", importe: dd.gastosRepresentacion },
      ],
      asesoresMensual: promCosto,
    });
  }

  const dietaSen = p.modulosDietaSenador * p.valorModulo;
  for (const s of datos.senadores.lista) {
    filas.push({
      camara: "senadores",
      id: s.id,
      apellido: s.apellido,
      nombre: s.nombre,
      distrito: s.distrito,
      bloque: s.bloque,
      inicio: s.inicio,
      fin: s.fin,
      foto: s.foto,
      asesores: s.personal?.total ?? 0,
      asesoresEstimado: false,
      categorias: s.personal?.categorias ?? null,
      dietaMensual: dietaSen,
      dietaDetalle: [
        { concepto: "Dieta (2.500 módulos)", importe: 2500 * p.valorModulo },
        { concepto: "Gastos de representación (1.000 módulos)", importe: 1000 * p.valorModulo },
        { concepto: "Desarraigo (500 módulos)", importe: 500 * p.valorModulo },
      ],
      asesoresMensual: s.personal ? costoCategorias(datos, s.personal.categorias) : 0,
    });
  }
  return filas;
}

/** Factor que se aplica a los montos mensuales según los ajustes elegidos. */
export function factor(a: Ajustes): number {
  return (1 + a.cargasPatronales / 100);
}

/** Costo mensual promedio (incluye aguinaldo prorrateado si está activo). */
export function mensual(f: Fila, a: Ajustes): number {
  const base = f.dietaMensual + f.asesoresMensual;
  return base * factor(a) * (a.aguinaldo ? 13 / 12 : 1);
}

const DIA = 86_400_000;
const MES = 30.436875 * DIA;

export const fechaMs = (iso: string) => new Date(`${iso}T00:00:00-03:00`).getTime();
/** El mandato termina al final del día de "fin" (hora argentina). */
export const finMs = (iso: string) => fechaMs(iso) + DIA;

export function mesesEntre(desde: number, hasta: number): number {
  return Math.max(0, (hasta - desde) / MES);
}

export function progreso(f: Fila, ahora: number): number {
  const a = fechaMs(f.inicio);
  const b = finMs(f.fin);
  return Math.min(1, Math.max(0, (ahora - a) / (b - a)));
}

/** Tiempo restante como años / meses / días calendario. */
export function restante(finIso: string, ahora: number) {
  const fin = finMs(finIso);
  if (ahora >= fin) return { anios: 0, meses: 0, dias: 0, totalDias: 0 };
  const totalDias = Math.ceil((fin - ahora) / DIA);
  const hoy = new Date(ahora - 3 * 3600_000); // hora argentina
  const f = new Date(fin - 3 * 3600_000 - DIA);
  let anios = f.getUTCFullYear() - hoy.getUTCFullYear();
  let meses = f.getUTCMonth() - hoy.getUTCMonth();
  let dias = f.getUTCDate() - hoy.getUTCDate();
  if (dias < 0) {
    meses--;
    dias += new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), 0)).getUTCDate();
  }
  if (meses < 0) {
    anios--;
    meses += 12;
  }
  return { anios, meses, dias, totalDias };
}
