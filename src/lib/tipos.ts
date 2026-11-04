export type Categorias = Record<string, number>;

export interface Fuente {
  actualizado: string | null;
  url: string | null;
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
}

export interface Senador extends LegisladorBase {
  partido: string;
  foto: string | null;
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
  };
  escala: Fuente & { modulos: Categorias };
  dietaDiputado: Fuente & { dieta: number; gastosRepresentacion: number };
  diputados: Fuente & { lista: LegisladorBase[] };
  personalDiputados: (Fuente & { total: number; categorias: Categorias }) | null;
  senadores: Fuente & { lista: Senador[] };
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
  asesores: number;
  asesoresEstimado: boolean;
  categorias: Categorias | null;
  dietaMensual: number;
  dietaDetalle: { concepto: string; importe: number }[];
  asesoresMensual: number;
}
