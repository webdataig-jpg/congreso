export type Categorias = Record<string, number>;

export interface Fuente {
  actualizado: string | null;
  url: string | null;
}

export interface Contacto {
  email: string | null;
  telefono: string | null;
  oficina: string | null;
  redes: { red: string; url: string }[];
  perfil: string;
  despacho?: string;
  revisado?: string | null;
}

export interface LegisladorBase {
  id: string;
  apellido: string;
  nombre: string;
  distrito: string;
  bloque: string;
  inicioMandato: string;
  inicio: string;
  fin: string;
  foto?: string | null;
  contacto?: Contacto | null;
}

export interface Senador extends LegisladorBase {
  partido: string;
  personal: { total: number; categorias: Categorias } | null;
}

export interface Datos {
  generado: string;
  parametros: {
    valorModulo: number;
    valorModuloVigencia: string;
    valorModuloFuente: string;
    modulosRC: number;
    modulosDietaSenador: number;
    modulosDietaSenadorDetalle: string;
    modulosDietaSenadorFuente: string;
    poblacion: number;
    poblacionFuente: string;
  };
  escala: Fuente & { modulos: Categorias };
  dietaDiputado: Fuente & { dieta: number; gastosRepresentacion: number };
  diputados: Fuente & { lista: LegisladorBase[] };
  personalDiputados: (Fuente & { total: number; categorias: Categorias }) | null;
  senadores: Fuente & { lista: Senador[] };
  presupuesto: Presupuesto | null;
  avisos: string[];
}

export type Camara = "diputados" | "senadores";

export interface Ajustes {
  aguinaldo: boolean;
  cargasPatronales: number; // porcentaje
}

export interface Fila {
  camara: Camara;
  id: string;
  apellido: string;
  nombre: string;
  distrito: string;
  bloque: string;
  inicio: string;
  fin: string;
  foto: string | null;
  contacto: Contacto | null;
  asesores: number;
  asesoresEstimado: boolean;
  categorias: Categorias | null;
  dietaMensual: number;
  dietaDetalle: { concepto: string; importe: number }[];
  asesoresMensual: number;
}

export interface Calificacion {
  suma: number;
  cant: number;
}

export interface Organismo {
  id: string;
  nombre: string;
  presupuestado: number;
  vigente: number;
  devengado: number;
}

/** Montos en millones de pesos. */
export interface Presupuesto {
  ejercicio: number;
  actualizado: string | null;
  url: string;
  unidad: string;
  totalNacional: { vigente: number; devengado: number };
  organismos: Organismo[];
  incisos: { nombre: string; vigente: number; devengado: number }[];
}
